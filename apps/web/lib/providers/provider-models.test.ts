import { afterEach, describe, expect, it, vi } from "vitest";
import {
  costUsd,
  DEFAULT_VENICE_MODEL,
  defaultGmiModelForTier,
  defaultOpenRouterModelForTier,
  gmiReasoningEffort,
  isGmiModel,
  isModelFamily,
  isOpenRouterFamily,
  isOpenRouterModel,
  isVeniceModel,
  modelForSelection,
  OPENROUTER_MODELS,
  providerForFamily,
  VENICE_MODELS,
} from "../entitlements/models";
import {
  CREATIVE_LANES,
  DEFAULT_LANE_MODELS,
  guideForModel,
  isLaneModel,
  LANE_MODELS,
  loadCreativePrefs,
  setCreativeModel,
} from "../creative/model-prefs";
import { buildGenerationRequest, type CreativeTurn } from "../creative/gmi";
import type { RouterPlan } from "../creative/schema";
import { routeExplicitCommand } from "../creative/router";
import {
  clearProviderKey,
  getProviderKey,
  listProviderKeyStatuses,
  setProviderKey,
} from "./keys";
import { FakeSupabase } from "../testing/fakeSupabase";

const VAULT_KEY = "a".repeat(64);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("model catalog", () => {
  it("recognizes the new families and routes them to the right provider", () => {
    expect(isModelFamily("openrouter")).toBe(true);
    expect(isModelFamily("venice")).toBe(true);
    expect(providerForFamily("openrouter")).toBe("openrouter");
    expect(providerForFamily("venice")).toBe("venice");
    expect(providerForFamily("openai")).toBe("openai");
    expect(providerForFamily("gmi")).toBe("gmi");
    expect(providerForFamily("minimax-m3")).toBe("gmi");
    expect(providerForFamily("minimax-m2.7")).toBe("gmi");
    expect(isOpenRouterFamily("venice")).toBe(false);
    expect(isOpenRouterFamily("inkling")).toBe(true);
  });

  it("covers all three tiers in the OpenRouter menu", () => {
    for (const tier of ["fast", "balanced", "deep"] as const) {
      expect(OPENROUTER_MODELS.some((model) => model.tier === tier)).toBe(true);
      expect(isOpenRouterModel(defaultOpenRouterModelForTier(tier))).toBe(true);
    }
  });

  it("resolves a valid selection and falls back on stale slugs", () => {
    const pick = OPENROUTER_MODELS[3]!.slug;
    expect(
      modelForSelection("openrouter", "fast", { openrouterModel: pick }),
    ).toBe(pick);
    expect(
      modelForSelection("openrouter", "deep", {
        openrouterModel: "evil/injected-model",
      }),
    ).toBe(defaultOpenRouterModelForTier("deep"));
    expect(
      modelForSelection("venice", "balanced", {
        veniceModel: VENICE_MODELS[1]!.slug,
      }),
    ).toBe(VENICE_MODELS[1]!.slug);
    expect(
      modelForSelection("venice", "balanced", { veniceModel: "nope" }),
    ).toBe(DEFAULT_VENICE_MODEL);
    expect(modelForSelection("minimax-m3", "balanced")).toBe(
      "MiniMaxAI/MiniMax-M3",
    );
    expect(modelForSelection("minimax-m2.7", "balanced")).toBe(
      "MiniMaxAI/MiniMax-M2.7",
    );
    expect(isVeniceModel("nope")).toBe(false);
  });

  it("tier-maps the gmi family: GLM fast, Luna balanced, Astra deep", () => {
    for (const tier of ["fast", "balanced", "deep"] as const) {
      expect(isGmiModel(defaultGmiModelForTier(tier))).toBe(true);
    }
    expect(modelForSelection("gmi", "fast")).toBe("zai-org/GLM-5.3-Flash");
    expect(modelForSelection("gmi", "balanced")).toBe("openai/gpt-5.6-luna");
    expect(modelForSelection("gmi", "deep")).toBe("openai/gpt-6-astra");
    // A catalog pin binds the owner-visible tiers only — the fast lane is
    // what delegated children ride, so it can never be repriced upward.
    const pin = { gmiModel: "openai/gpt-6-astra" };
    expect(modelForSelection("gmi", "fast", pin)).toBe(
      "zai-org/GLM-5.3-Flash",
    );
    expect(modelForSelection("gmi", "balanced", pin)).toBe(
      "openai/gpt-6-astra",
    );
    expect(modelForSelection("gmi", "deep", pin)).toBe("openai/gpt-6-astra");
    // Stale slugs fall back to the tier default, never upstream.
    expect(modelForSelection("gmi", "deep", { gmiModel: "evil/model" })).toBe(
      "openai/gpt-6-astra",
    );
    expect(isGmiModel("openai/gpt-5.6-terra")).toBe(false);
  });

  it("keeps reasoning_effort off GMI's openai slugs and low on GLM", () => {
    expect(gmiReasoningEffort("openai/gpt-6-astra")).toBeUndefined();
    expect(gmiReasoningEffort("openai/gpt-5.6-luna")).toBeUndefined();
    expect(gmiReasoningEffort("zai-org/GLM-5.3-Flash")).toBe("low");
    expect(gmiReasoningEffort("MiniMaxAI/MiniMax-M3")).toBeUndefined();
    vi.stubEnv("GMI_GLM_EFFORT", "high");
    expect(gmiReasoningEffort("zai-org/GLM-5.3-Flash")).toBe("high");
  });

  it("prices gmi usage per served slug", () => {
    expect(
      costUsd("fast", 1_000_000, 1_000_000, "gmi", "zai-org/GLM-5.3-Flash"),
    ).toBeCloseTo(0.15 + 0.5);
    expect(
      costUsd("deep", 1_000_000, 1_000_000, "gmi", "openai/gpt-6-astra"),
    ).toBeCloseTo(10 + 50);
    // An unknown slug falls back to the tier default's rate, not zero.
    expect(costUsd("fast", 1_000_000, 0, "gmi", "unknown/slug")).toBeCloseTo(
      0.15,
    );
  });

  it("prices OpenRouter usage per model and Venice at zero", () => {
    const model = OPENROUTER_MODELS.find(
      (entry) => entry.slug === "anthropic/claude-sonnet-4.5",
    )!;
    expect(
      costUsd("balanced", 1_000_000, 1_000_000, "openrouter", model.slug),
    ).toBeCloseTo(model.pricing.input + model.pricing.output);
    expect(costUsd("fast", 1_000_000, 0, "openrouter", "unknown/slug")).toBe(0);
    expect(
      costUsd(
        "fast",
        1_000_000,
        1_000_000,
        "venice",
        "qwen3-235b-a22b-instruct-2507",
      ),
    ).toBe(0);
  });
});

describe("creative model prefs", () => {
  it("every lane has a default that is in its own catalog with a guide", () => {
    for (const lane of CREATIVE_LANES) {
      expect(isLaneModel(lane, DEFAULT_LANE_MODELS[lane])).toBe(true);
      for (const model of LANE_MODELS[lane]) {
        expect(guideForModel(model.slug)).toBeTruthy();
      }
    }
  });

  it("loadCreativePrefs falls back to defaults on stale or missing rows", async () => {
    const db = new FakeSupabase();
    db.tables["creative_prefs"] = [
      {
        user_id: "u1",
        imagine_model: "Flux2-Dev",
        edit_model: "bogus",
      },
    ];
    const prefs = await loadCreativePrefs(db.client(), "u1");
    expect(prefs.imagine).toBe("Flux2-Dev");
    expect(prefs.edit).toBe(DEFAULT_LANE_MODELS.edit);
    expect(prefs.animate).toBe(DEFAULT_LANE_MODELS.animate);
    expect(prefs.zap).toBe(DEFAULT_LANE_MODELS.zap);
  });

  it("setCreativeModel rejects slugs outside the lane catalog", async () => {
    const db = new FakeSupabase();
    const supabase = db.client();
    expect(
      await setCreativeModel(
        supabase,
        "u1",
        "imagine",
        "gemini-3.1-flash-image",
      ),
    ).toBe(false);
    expect(db.upserts).toHaveLength(0);
    expect(await setCreativeModel(supabase, "u1", "imagine", "Flux2-Dev")).toBe(
      true,
    );
    expect(db.upserts).toHaveLength(1);
    expect(db.upserts[0]?.table).toBe("creative_prefs");
  });
});

const plan = (overrides: Partial<RouterPlan> = {}): RouterPlan => ({
  mode: "imagine",
  needs_input: false,
  chat_reply: "on it",
  delivery_line: "made this",
  expanded_prompt: "a fox in the fog",
  params: {
    aspect_ratio: "auto",
    duration: null,
    quality: "auto",
    generate_audio: true,
    use_input_image_as: "none",
  },
  ...overrides,
});

const turn = (overrides: Partial<CreativeTurn> = {}): CreativeTurn => ({
  text: "a fox in the fog",
  mediaInputs: [],
  ...overrides,
});

describe("buildGenerationRequest with prefs", () => {
  it("uses the selected imagine/edit/animate/zap models", () => {
    const prefs = {
      imagine: "Flux2-Dev",
      edit: "gemini-3.1-flash-image",
      animate: "ltx-2-fast-text-to-video",
      zap: "minimax/h3-max",
    };
    const imagineRequest = buildGenerationRequest(plan(), turn(), prefs);
    expect(imagineRequest.model).toBe("Flux2-Dev");
    // Flux advertises width/height, not size/quality/n.
    expect(imagineRequest.payload).toEqual({
      prompt: "a fox in the fog",
      width: 1024,
      height: 1024,
    });
    const editRequest = buildGenerationRequest(
      plan(),
      turn({ mediaInputs: [{ kind: "image", url: "https://x.test/in.png" }] }),
      prefs,
    );
    expect(editRequest.model).toBe("gemini-3.1-flash-image");
    expect(editRequest.payload).toEqual({
      prompt: "a fox in the fog",
      image: "https://x.test/in.png",
    });
    const animateRequest = buildGenerationRequest(
      plan({ mode: "animate" }),
      turn(),
      prefs,
    );
    expect(animateRequest.model).toBe("ltx-2-fast-text-to-video");
    // LTX advertises no ratio/watermark parameters.
    expect(animateRequest.payload).toEqual({
      prompt: "a fox in the fog",
      duration: 8,
      resolution: "720p",
      generate_audio: true,
    });
    // /zap renders on fal, so it has no GMI payload at all.
    expect(() =>
      buildGenerationRequest(plan({ mode: "zap" }), turn(), prefs),
    ).toThrow();
  });

  it("keeps the shipped defaults without prefs", () => {
    expect(buildGenerationRequest(plan(), turn()).model).toBe(
      "gpt-image-2-generate",
    );
  });
});

describe("router metaprompt", () => {
  it("appends the model guide to the system prompt without changing the mode", async () => {
    let systemPrompt = "";
    const chat = vi.fn(
      async (options: {
        messages: Array<{ role: string; content: string }>;
      }) => {
        systemPrompt = options.messages[0]!.content;
        return JSON.stringify(plan());
      },
    );
    const result = await routeExplicitCommand(
      {
        mode: "imagine",
        text: "/imagine a fox",
        cleanedText: "a fox",
        mediaInputs: [],
      },
      null,
      chat as never,
      guideForModel("Flux2-Dev"),
    );
    expect(result.mode).toBe("imagine");
    expect(systemPrompt).toContain("Target model guide");
    expect(systemPrompt).toContain("comma-separated visual tags");
  });
});

describe("provider keys", () => {
  const makeDb = () => new FakeSupabase();

  it("seals at rest (no plaintext in the row) and round-trips server-side", async () => {
    vi.stubEnv("PROVIDER_VAULT_KEY", VAULT_KEY);
    const db = makeDb();
    const supabase = db.client();
    const result = await setProviderKey(
      supabase,
      "u1",
      "openrouter",
      "sk-or-v1-secret-key-value",
    );
    expect(result.ok).toBe(true);
    const row = db.rows("provider_keys")[0]!;
    expect(row["api_key_sealed"]).not.toContain("secret-key-value");
    expect((row["api_key_sealed"] as string).startsWith("v1:")).toBe(true);
    expect(row["key_hint"]).toBe("alue");
    expect(await getProviderKey(supabase, "u1", "openrouter")).toBe(
      "sk-or-v1-secret-key-value",
    );
    expect(await getProviderKey(supabase, "u1", "venice")).toBeNull();
  });

  it("statuses expose only hint metadata, never the sealed value", async () => {
    vi.stubEnv("PROVIDER_VAULT_KEY", VAULT_KEY);
    const db = makeDb();
    const supabase = db.client();
    await setProviderKey(supabase, "u1", "gmi", "gmi-personal-key-9876");
    const statuses = await listProviderKeyStatuses(supabase, "u1");
    expect(statuses).toHaveLength(3);
    const gmi = statuses.find((status) => status.provider === "gmi")!;
    expect(gmi.hint).toBe("9876");
    expect(JSON.stringify(statuses)).not.toContain("gmi-personal-key");
    await clearProviderKey(supabase, "u1", "gmi");
    expect(await getProviderKey(supabase, "u1", "gmi")).toBeNull();
  });

  it("rejects garbage keys and disabled vaults", async () => {
    vi.stubEnv("PROVIDER_VAULT_KEY", VAULT_KEY);
    const supabase = makeDb().client();
    expect((await setProviderKey(supabase, "u1", "venice", "short")).ok).toBe(
      false,
    );
    expect(
      (await setProviderKey(supabase, "u1", "venice", "has spaces in it")).ok,
    ).toBe(false);
    vi.stubEnv("PROVIDER_VAULT_KEY", "");
    // A dashboard key alone must NOT enable the vault — no fallback secret.
    vi.stubEnv("BOX_DASHBOARD_AUTH_KEY", VAULT_KEY);
    expect(
      (await setProviderKey(supabase, "u1", "venice", "valid-looking-key-123"))
        .ok,
    ).toBe(false);
    expect(await getProviderKey(supabase, "u1", "venice")).toBeNull();
  });
});
