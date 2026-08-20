import { describe, expect, it } from "vitest";
import { costUsd, isReasoningModel, isSpeedTier, modelForTier } from "./models";

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

  it("defaults match the documented gpt-5.6 fleet (P1-7)", () => {
    expect(modelForTier("fast")).toBe("gpt-5.6-luna");
    expect(modelForTier("balanced")).toBe("gpt-5.6-luna");
    expect(modelForTier("deep")).toBe("gpt-5.6-terra");
  });

  it("classifies reasoning model families", () => {
    expect(isReasoningModel("gpt-5.6-luna")).toBe(true);
    expect(isReasoningModel("gpt-5.6-terra")).toBe(true);
    expect(isReasoningModel("o3")).toBe(true);
    expect(isReasoningModel("gpt-4o")).toBe(false);
    expect(isReasoningModel("gpt-4o-mini")).toBe(false);
    expect(isReasoningModel("claude-sonnet-4-5")).toBe(false);
  });

  it("computes a positive cost from usage", () => {
    expect(costUsd("balanced", 1000, 500)).toBeGreaterThan(0);
    expect(costUsd("fast", 0, 0)).toBe(0);
  });
});
