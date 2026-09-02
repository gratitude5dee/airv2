import { describe, expect, it } from "vitest";
import {
  costUsd,
  DEFAULT_MODEL_FAMILY,
  isModelFamily,
  isReasoningModel,
  isSpeedTier,
  modelForSelection,
  modelForTier,
  requiresConsent,
} from "./models";

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

describe("model families", () => {
  it("defaults to the ox-alpha family, served by its GLM successor", () => {
    expect(DEFAULT_MODEL_FAMILY).toBe("ox-alpha");
    expect(modelForSelection(DEFAULT_MODEL_FAMILY, "balanced")).toBe(
      "z-ai/glm-5.3-flash"
    );
  });

  it("validates family names", () => {
    expect(isModelFamily("ox-alpha")).toBe(true);
    expect(isModelFamily("openai")).toBe(true);
    expect(isModelFamily("inkling")).toBe(true);
    expect(isModelFamily("inkling-small")).toBe(true);
    expect(isModelFamily("stealth/ox-alpha")).toBe(false);
    expect(isModelFamily("fast")).toBe(false);
  });

  it("resolves each family to its slug and openai through the tiers", () => {
    expect(modelForSelection("inkling", "fast")).toBe(
      "thinkingmachines/inkling:free"
    );
    expect(modelForSelection("inkling-small", "deep")).toBe(
      "thinkingmachines/inkling-small:free"
    );
    expect(modelForSelection("openai", "deep")).toBe(modelForTier("deep"));
    expect(modelForSelection("openai", "fast")).toBe(modelForTier("fast"));
  });

  it("keeps the OpenRouter slugs out of the reasoning-param path", () => {
    expect(isReasoningModel(modelForSelection("ox-alpha", "fast"))).toBe(false);
    expect(isReasoningModel(modelForSelection("inkling", "fast"))).toBe(false);
    expect(isReasoningModel(modelForSelection("inkling-small", "fast"))).toBe(
      false
    );
  });

  it("gates only the free Inkling endpoints behind consent", () => {
    expect(requiresConsent("inkling")).toBe(true);
    expect(requiresConsent("inkling-small")).toBe(true);
    expect(requiresConsent("ox-alpha")).toBe(false);
    expect(requiresConsent("openai")).toBe(false);
  });

  it("meters the free families at zero and priced families above it", () => {
    expect(costUsd("deep", 1000, 1000, "inkling")).toBe(0);
    expect(costUsd("deep", 1000, 1000, "ox-alpha")).toBeGreaterThan(0);
    expect(costUsd("deep", 1000, 1000, "openai")).toBeGreaterThan(0);
  });
});
