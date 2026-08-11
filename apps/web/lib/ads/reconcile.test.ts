import { describe, expect, it } from "vitest";
import {
  DIVERGENCE_FLOOR_CENTS,
  DIVERGENCE_RATIO,
  isDivergent,
  parseSpendCents,
} from "./reconcile";

describe("isDivergent", () => {
  it("ignores spend under the absolute floor", () => {
    expect(isDivergent(DIVERGENCE_FLOOR_CENTS, 0)).toBe(false);
    expect(isDivergent(100, 50)).toBe(false);
  });

  it("flags any meaningful spend on a zero-budget mirror", () => {
    expect(isDivergent(DIVERGENCE_FLOOR_CENTS + 1, 0)).toBe(true);
  });

  it("flags spend beyond the ratio of the mirrored budget", () => {
    const budget = 1000;
    expect(isDivergent(budget * DIVERGENCE_RATIO, budget)).toBe(false);
    expect(isDivergent(budget * DIVERGENCE_RATIO + 1, budget)).toBe(true);
  });

  it("accepts spend within budget", () => {
    expect(isDivergent(900, 1000)).toBe(false);
  });
});

describe("parseSpendCents", () => {
  it("reads spend_cents directly", () => {
    expect(parseSpendCents({ spend_cents: 1234 })).toBe(1234);
  });

  it("converts dollar spend to cents", () => {
    expect(parseSpendCents({ spend: 12.34 })).toBe(1234);
    expect(parseSpendCents({ spend: "5.00" })).toBe(500);
  });

  it("unwraps a data envelope", () => {
    expect(parseSpendCents({ data: { spend: 1 } })).toBe(100);
  });

  it("rejects malformed responses", () => {
    expect(parseSpendCents(null)).toBeNull();
    expect(parseSpendCents("spend")).toBeNull();
    expect(parseSpendCents({ spend: "not a number" })).toBeNull();
    expect(parseSpendCents({})).toBeNull();
  });
});
