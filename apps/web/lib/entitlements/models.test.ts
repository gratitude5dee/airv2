import { afterEach, describe, expect, it } from "vitest";
import {
  clampCreateTier,
  costUsd,
  CREATE_STAGES,
  CREATE_TIER_MODELS,
  createEffortFor,
  createProviderFor,
  gmiReasoningEffort,
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
  it("defaults to the openai family, resolved through the tier", () => {
    expect(DEFAULT_MODEL_FAMILY).toBe("openai");
    expect(modelForSelection(DEFAULT_MODEL_FAMILY, "balanced")).toBe(
      modelForTier("balanced")
    );
  });

  it("validates family names", () => {
    expect(isModelFamily("ox-alpha")).toBe(false);
    expect(isModelFamily("openai")).toBe(true);
    expect(isModelFamily("gmi")).toBe(true);
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
    expect(isReasoningModel(modelForSelection("inkling", "fast"))).toBe(false);
    expect(isReasoningModel(modelForSelection("inkling-small", "fast"))).toBe(
      false
    );
  });

  it("gates only the free Inkling endpoints behind consent", () => {
    expect(requiresConsent("inkling")).toBe(true);
    expect(requiresConsent("inkling-small")).toBe(true);
    expect(requiresConsent("openai")).toBe(false);
    expect(requiresConsent("gmi")).toBe(false);
  });

  it("meters the free families at zero and priced families above it", () => {
    expect(costUsd("deep", 1000, 1000, "inkling")).toBe(0);
    expect(costUsd("deep", 1000, 1000, "anthropic")).toBeGreaterThan(0);
    expect(costUsd("deep", 1000, 1000, "openai")).toBeGreaterThan(0);
    expect(costUsd("deep", 1000, 1000, "gmi")).toBeGreaterThan(0);
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
      stage: null,
    });
    expect(parseCreateModel("create-deep:bob_app-2")).toEqual({
      tier: "deep",
      slug: "bob_app-2",
      stage: null,
    });
    expect(parseCreateModel(createModelFor("balanced", "alice-x"))).toEqual({
      tier: "balanced",
      slug: "alice-x",
      stage: null,
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

  it("defaults to the V12 §7.1 table: Astra plans, GLM builds and reviews", () => {
    expect(CREATE_TIER_MODELS).toEqual({
      fast: "zai-org/GLM-5.3-Flash",
      balanced: "zai-org/GLM-5.3-Flash",
      deep: "openai/gpt-6-astra",
    });
    expect(modelForCreateTier("deep")).toBe("openai/gpt-6-astra");
  });

  it("reads MODEL_CREATE_* and never the ordinary MODEL_* override", () => {
    process.env["MODEL_DEEP"] = "ordinary-deep";
    expect(modelForCreateTier("deep")).toBe("openai/gpt-6-astra");
    process.env["MODEL_CREATE_DEEP"] = "gpt-5.6-astra";
    expect(modelForCreateTier("deep")).toBe("gpt-5.6-astra");
    expect(modelForTier("deep")).toBe("ordinary-deep");
  });
});

describe("Create routing (V12 §7.1, §7.3 — CR18)", () => {
  afterEach(() => {
    delete process.env["GMI_CREATE_BUILD_EFFORT"];
    delete process.env["GMI_GLM_EFFORT"];
  });

  it("dispatches GMI catalog slugs to gmi and everything else to openai", () => {
    expect(createProviderFor("openai/gpt-6-astra")).toBe("gmi");
    expect(createProviderFor("zai-org/GLM-5.3-Flash")).toBe("gmi");
    expect(createProviderFor("gpt-5.6-terra")).toBe("openai");
    expect(createProviderFor("gpt-5.6-astra")).toBe("openai");
    for (const tier of ["fast", "balanced", "deep"] as const) {
      expect(createProviderFor(modelForCreateTier(tier))).toBe("gmi");
    }
  });

  it("accepts an optional #<stage> suffix and strips it from the slug", () => {
    expect(parseCreateModel("create-deep:alice-countdown#plan")).toEqual({
      tier: "deep",
      slug: "alice-countdown",
      stage: "plan",
    });
    expect(parseCreateModel("create-balanced:alice-countdown#build")?.stage).toBe("build");
    expect(parseCreateModel("create-fast:alice-countdown#review")?.stage).toBe("review");
    expect(parseCreateModel("create-deep:alice-countdown#finalize")?.stage).toBe("finalize");
    expect(parseCreateModel("create-deep:alice-countdown")).toEqual({
      tier: "deep",
      slug: "alice-countdown",
      stage: null,
    });
    expect(CREATE_STAGES).toEqual(["plan", "build", "review", "finalize"]);
  });

  it("refuses a malformed stage suffix rather than ignoring it", () => {
    expect(parseCreateModel("create-deep:alice-countdown#deploy")).toBeNull();
    expect(parseCreateModel("create-deep:alice-countdown#")).toBeNull();
    expect(parseCreateModel("create-deep:alice-countdown#PLAN")).toBeNull();
    expect(parseCreateModel("create-deep:alice-countdown#plan#build")).toBeNull();
    expect(isCreateModelRequest("create-deep:alice-countdown#deploy")).toBe(true);
  });

  it("createModelFor emits the stage and round-trips through the parser", () => {
    expect(createModelFor("deep", "alice-x", "plan")).toBe("create-deep:alice-x#plan");
    expect(createModelFor("fast", "alice-x", null)).toBe("create-fast:alice-x");
    expect(createModelFor("fast", "alice-x")).toBe("create-fast:alice-x");
    expect(parseCreateModel(createModelFor("balanced", "alice-x", "build"))).toEqual({
      tier: "balanced",
      slug: "alice-x",
      stage: "build",
    });
  });

  it("sends the build effort for balanced GLM, low for fast GLM, nothing for deep or non-GLM", () => {
    expect(createEffortFor("balanced", "zai-org/GLM-5.3-Flash")).toBe("medium");
    process.env["GMI_CREATE_BUILD_EFFORT"] = "high";
    expect(createEffortFor("balanced", "zai-org/GLM-5.3-Flash")).toBe("high");
    expect(createEffortFor("fast", "zai-org/GLM-5.3-Flash")).toBe("low");
    expect(createEffortFor("deep", "zai-org/GLM-5.3-Flash")).toBeUndefined();
    expect(createEffortFor("deep", "openai/gpt-6-astra")).toBeUndefined();
    expect(createEffortFor("balanced", "gpt-5.6-terra")).toBeUndefined();
    expect(createEffortFor("fast", "openai/gpt-5.6-luna")).toBeUndefined();
  });

  it("fast-lane invariant: delegated children on the gmi family still pin GLM at low effort", () => {
    // delegation.model = "fast" on every box: never the owner's pin, never
    // the Create table, and gmiReasoningEffort's "low" default is untouched
    // by the Create effort table.
    process.env["GMI_CREATE_BUILD_EFFORT"] = "high";
    expect(modelForSelection("gmi", "fast", { gmiModel: "openai/gpt-6-astra" })).toBe(
      "zai-org/GLM-5.3-Flash"
    );
    expect(gmiReasoningEffort("zai-org/GLM-5.3-Flash")).toBe("low");
    expect(gmiReasoningEffort("openai/gpt-6-astra")).toBeUndefined();
  });
});
