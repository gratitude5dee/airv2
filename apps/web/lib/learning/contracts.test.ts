/**
 * Contract enforcement for learning-receipt.v1 (goal.md §2, §15.2, L4).
 *
 * The schema in packages/learning-contracts is the seam between the Box
 * daemon and this control plane; the same fixture corpus is validated
 * Python-side by infra/template/learning/tests/test_contracts.py. Here we
 * pin the control-plane half: fixtures validate under ajv, and the
 * learning_events allowlist (RECEIPT_COLUMNS) can only name keys the
 * contract declares — so a schema edit and a drain drift both fail here.
 */
import { describe, expect, it } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { RECEIPT_COLUMNS } from "./learning";

const CONTRACTS = fileURLToPath(
  new URL("../../../../packages/learning-contracts", import.meta.url),
);
const SCHEMA = JSON.parse(
  readFileSync(join(CONTRACTS, "schemas", "learning-receipt.v1.json"), "utf8"),
) as {
  required: string[];
  properties: Record<string, unknown>;
};

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

function* fixtures(dir: "valid" | "invalid") {
  const base = join(CONTRACTS, "fixtures", "receipts", dir);
  for (const name of readdirSync(base).filter((n) => n.endsWith(".json")).sort()) {
    yield { name, receipt: JSON.parse(readFileSync(join(base, name), "utf8")) };
  }
}

describe("learning-receipt.v1 fixtures", () => {
  it("accepts every valid fixture", () => {
    for (const { name, receipt } of fixtures("valid")) {
      expect(validate(receipt), `${name}: ${JSON.stringify(validate.errors)}`).toBe(true);
    }
  });

  it("rejects every invalid fixture", () => {
    for (const { name, receipt } of fixtures("invalid")) {
      expect(validate(receipt), `${name} unexpectedly valid`).toBe(false);
    }
  });
});

describe("control-plane receipt allowlist", () => {
  it("stores only keys the contract declares (content boundary)", () => {
    const declared = new Set(Object.keys(SCHEMA.properties));
    for (const column of RECEIPT_COLUMNS) {
      expect(declared.has(column), `${column} is not a contract key`).toBe(true);
    }
  });

  it("persists every required field except the version sentinel", () => {
    // schema_version pins the contract itself; it is asserted, never stored.
    const stored = new Set(RECEIPT_COLUMNS);
    for (const key of SCHEMA.required) {
      if (key === "schema_version") continue;
      expect(stored.has(key), `required key ${key} cannot reach learning_events`).toBe(true);
    }
  });
});
