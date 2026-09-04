import { afterEach, describe, expect, it } from "vitest";
import {
  clampCreateTier,
  costUsd,
  CREATE_TIER_MODELS,
  DEFAULT_MODEL_FAMILY,
  isModelFamily,
  isReasoningModel,
  isSpeedTier,
  modelForCreateTier,
  modelForSelection,
  modelForTier,
  createModelFor,
  isCreateModelRequest,
  parseCreateModel,
  parseLegacyCreateTier,
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

describe("Create tier family (MC4 §9.1)", () => {
  afterEach(() => {
    delete process.env["MODEL_CREATE_DEEP"];
    delete process.env["MODEL_DEEP"];
  });

  it("parses only create-<tier>:<slug> selections", () => {
    expect(parseCreateModel("create-fast:alice-countdown")).toEqual({
      tier: "fast",
      slug: "alice-countdown",
    });
    expect(parseCreateModel("create-deep:bob_app-2")).toEqual({
      tier: "deep",
      slug: "bob_app-2",
    });
    expect(parseCreateModel(createModelFor("balanced", "alice-x"))).toEqual({
      tier: "balanced",
      slug: "alice-x",
    });
    expect(parseCreateModel("create-fast")).toBeNull();
    expect(parseCreateModel("create-fast:")).toBeNull();
    expect(parseCreateModel("create-fast:Alice")).toBeNull();
    expect(parseCreateModel("create-fast:a/b")).toBeNull();
    expect(parseCreateModel(`create-fast:${"a".repeat(81)}`)).toBeNull();
    expect(parseCreateModel("fast")).toBeNull();
    expect(parseCreateModel("create-turbo:alice-x")).toBeNull();
    expect(parseCreateModel(42)).toBeNull();
  });

  it("recognises the Create namespace even when malformed", () => {
    expect(isCreateModelRequest("create-fast")).toBe(true);
    expect(isCreateModelRequest("create-fast:alice-x")).toBe(true);
    expect(isCreateModelRequest("fast")).toBe(false);
    expect(isCreateModelRequest(undefined)).toBe(false);
  });

  it("transitional: parses the project-less create-<tier> of runs started before the format changed", () => {
    expect(parseLegacyCreateTier("create-fast")).toBe("fast");
    expect(parseLegacyCreateTier("create-deep")).toBe("deep");
    expect(parseLegacyCreateTier("create-fast:alice-x")).toBeNull();
    expect(parseLegacyCreateTier("create-turbo")).toBeNull();
    expect(parseLegacyCreateTier("create-")).toBeNull();
    expect(parseLegacyCreateTier("fast")).toBeNull();
  });

  it("clamps to the entitled tier and never upgrades", () => {
    expect(clampCreateTier("deep", "balanced")).toBe("balanced");
    expect(clampCreateTier("balanced", "fast")).toBe("fast");
    expect(clampCreateTier("fast", "deep")).toBe("fast");
    expect(clampCreateTier("balanced", "balanced")).toBe("balanced");
  });

  it("defaults to the gpt-5.6 luna/terra family", () => {
    expect(CREATE_TIER_MODELS).toEqual({
      fast: "gpt-5.6-luna",
      balanced: "gpt-5.6-terra",
      deep: "gpt-5.6-terra",
    });
    expect(modelForCreateTier("deep")).toBe("gpt-5.6-terra");
  });

  it("reads MODEL_CREATE_* and never the ordinary MODEL_* override", () => {
    process.env["MODEL_DEEP"] = "ordinary-deep";
    expect(modelForCreateTier("deep")).toBe("gpt-5.6-terra");
    process.env["MODEL_CREATE_DEEP"] = "gpt-5.6-astra";
    expect(modelForCreateTier("deep")).toBe("gpt-5.6-astra");
    expect(modelForTier("deep")).toBe("ordinary-deep");
  });
});
