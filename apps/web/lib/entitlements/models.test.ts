import { describe, expect, it } from "vitest";
import { costUsd, isSpeedTier, modelForTier } from "./models";

describe("speed tiers", () => {
  it("maps every tier to a model server-side", () => {
    expect(modelForTier("fast")).toBeTruthy();
    expect(modelForTier("balanced")).toBeTruthy();
    expect(modelForTier("deep")).toBeTruthy();
    expect(modelForTier("deep")).not.toBe(modelForTier("fast"));
  });

  it("validates tier names", () => {
    expect(isSpeedTier("fast")).toBe(true);
    expect(isSpeedTier("gpt-4o")).toBe(false);
  });

  it("computes a positive cost from usage", () => {
    expect(costUsd("balanced", 1000, 500)).toBeGreaterThan(0);
    expect(costUsd("fast", 0, 0)).toBe(0);
  });
});
