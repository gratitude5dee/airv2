import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { computeKCaseSets, type KCaseSets } from "./k-case-sets";
import { loadCases } from "./lib";

const HERE = new URL(".", import.meta.url).pathname;

function committed(): KCaseSets {
  return JSON.parse(
    readFileSync(join(HERE, "k-case-sets.json"), "utf8")
  ) as KCaseSets;
}

describe("k-case-sets.json", () => {
  it("matches a fresh regeneration from messages.jsonl + ROUTE_OPTIONS", () => {
    const regenerated = computeKCaseSets(
      loadCases(join(HERE, "messages.jsonl"))
    );
    expect(committed()).toEqual(regenerated);
  });

  it("holds out exactly a third of the K-cases", () => {
    const sets = committed();
    const ids = Object.keys(sets.cases);
    expect(ids).toHaveLength(96);
    const holdouts = ids.filter((id) => sets.cases[id]!.holdout);
    expect(holdouts).toHaveLength(32);
    expect(holdouts.every((id) => Number(id.slice(1)) % 3 === 0)).toBe(true);
  });

  it("labels every in-sample case with its shared-token audit trail", () => {
    const sets = committed();
    for (const [id, label] of Object.entries(sets.cases)) {
      expect(
        label.in_sample,
        `${id}: in_sample must agree with the shared-token count`
      ).toBe(label.shared.length >= 2);
    }
  });
});
