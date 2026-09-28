/**
 * R-ARCH-08: lib/box is the only module that reads the boxes table's
 * credential columns (hosted_token, api_server_key). This test greps every
 * non-test source file under apps/web and fails on:
 *
 *   1. the literal `hosted_token` — unambiguous; only the boxes table has it;
 *   2. `api_server_key` inside a `.select("...")` literal — the boxes read
 *      shape (the bots table's own api_server_key column is selected through
 *      the shared BOT_COLUMNS constant in lib/bots/store.ts, never inline);
 *   3. `["hosted_token"]` / `["api_server_key"]` bracket reads.
 *
 * Files that legitimately name the columns — the write sites in provisioning
 * and the migration credential swap, plus comments documenting the C3
 * boundary — live in ALLOWLIST. Shrink it, don't grow it: if a caller needs
 * credentials, get them via loadBoxCredentials() in ./credentials.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const WEB_ROOT = join(dirname(fileURLToPath(import.meta.url)), "../..");

const ALLOWLIST: ReadonlyArray<{ path: string; reason: string }> = [
  {
    path: "lib/provisioning/provision.ts",
    reason:
      "writes hosted_token/api_server_key when a box is created or replaced (writer, not reader)",
  },
  {
    path: "lib/migration/steps.ts",
    reason:
      "select * + verbatim credential rewrite during the provider swap",
  },
  {
    path: "lib/migration/credentials.ts",
    reason: "sealed envelope field names mirror the column names",
  },
  {
    path: "lib/auth/session.ts",
    reason: "comment documenting the C3 boundary (no code read)",
  },
  {
    path: "app/api/chat/[runId]/events/route.ts",
    reason: "comment documenting the C3 boundary (no code read)",
  },
  {
    path: "app/api/bots/[name]/chat/[runId]/events/route.ts",
    reason: "comment documenting the C3 boundary (no code read)",
  },
];

function* sourceFiles(dir: string): Generator<string> {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name.startsWith(".")) {
        continue;
      }
      yield* sourceFiles(path);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes(".test.")) {
      yield path;
    }
  }
}

const SELECT_RE = /\.select\(\s*([`'"])(.*?)\1/g;
const BRACKET_READ_RE = /\[\s*['"](hosted_token|api_server_key)['"]\s*\]/g;

function violationsIn(text: string): string[] {
  const violations: string[] = [];
  if (text.includes("hosted_token")) {
    violations.push("contains `hosted_token`");
  }
  for (const match of text.matchAll(SELECT_RE)) {
    if (match[2]?.includes("api_server_key")) {
      violations.push(
        `select()s the api_server_key column: "${match[2].slice(0, 80)}…"`
      );
    }
  }
  for (const match of text.matchAll(BRACKET_READ_RE)) {
    violations.push(`bracket-reads ${match[1]}`);
  }
  return violations;
}

describe("R-ARCH-08: the lib/box seam owns the credential columns", () => {
  it("no file outside lib/box reads hosted_token/api_server_key", () => {
    const allowed = new Map(ALLOWLIST.map((a) => [a.path, a.reason]));
    const offenders: string[] = [];
    for (const file of sourceFiles(WEB_ROOT)) {
      const rel = relative(WEB_ROOT, file);
      if (rel.startsWith(`lib/box/`)) continue;
      if (allowed.has(rel)) continue;
      const violations = violationsIn(readFileSync(file, "utf8"));
      for (const violation of violations) {
        offenders.push(`${rel}: ${violation}`);
      }
    }
    expect(
      offenders,
      "credential reads outside lib/box — go through lib/box/credentials instead"
    ).toEqual([]);
  });

  it("every allowlist entry still points at a real file", () => {
    for (const { path } of ALLOWLIST) {
      expect(existsSync(join(WEB_ROOT, path)), `${path} no longer exists`).toBe(
        true
      );
    }
  });

  it("namespace implements the BoxProvider interface", async () => {
    const { provider } = await import("../namespace/client");
    const methods: Array<keyof typeof provider> = [
      "getBox",
      "resume",
      "stop",
      "deleteBox",
      "requestDesktop",
      "command",
      "readFile",
      "writeFile",
      "hostRoute",
    ];
    for (const method of methods) {
      expect(typeof provider[method]).toBe("function");
    }
  });

  it("mapInstanceState maps namespace statuses into Box states", async () => {
    const { mapInstanceState } = await import("../namespace/client");
    expect(mapInstanceState("RUNNING")).toBe("ready");
    expect(mapInstanceState("CREATING")).toBe("cloning");
    expect(mapInstanceState("SUSPENDED")).toBe("stopped");
    expect(mapInstanceState("DESTROYED")).toBe("error");
    expect(mapInstanceState("FAILED")).toBe("error");
    expect(mapInstanceState("PENDING")).toBe("provisioned");
    expect(mapInstanceState("SOMETHING_NEW")).toBe("provisioned");
  });
});
