import { afterEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  costUsd,
  DEFAULT_VENICE_MODEL,
  defaultOpenRouterModelForTier,
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
    expect(providerForFamily("ox-alpha")).toBe("openrouter");
    expect(providerForFamily("minimax-m3")).toBe("gmi");
    expect(providerForFamily("minimax-m2.7")).toBe("gmi");
    expect(isOpenRouterFamily("venice")).toBe(false);
    expect(isOpenRouterFamily("ox-alpha")).toBe(true);
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
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { imagine_model: "Flux2-Dev", edit_model: "bogus" },
            }),
          }),
        }),
      }),
    } as unknown as SupabaseClient;
    const prefs = await loadCreativePrefs(supabase, "u1");
    expect(prefs.imagine).toBe("Flux2-Dev");
    expect(prefs.edit).toBe(DEFAULT_LANE_MODELS.edit);
    expect(prefs.animate).toBe(DEFAULT_LANE_MODELS.animate);
    expect(prefs.zap).toBe(DEFAULT_LANE_MODELS.zap);
  });

  it("setCreativeModel rejects slugs outside the lane catalog", async () => {
    const upsert = vi.fn(async () => ({ error: null }));
    const supabase = {
      from: () => ({ upsert }),
    } as unknown as SupabaseClient;
    expect(
      await setCreativeModel(
        supabase,
        "u1",
        "imagine",
        "gemini-3.1-flash-image",
      ),
    ).toBe(false);
    expect(upsert).not.toHaveBeenCalled();
    expect(await setCreativeModel(supabase, "u1", "imagine", "Flux2-Dev")).toBe(
      true,
    );
    expect(upsert).toHaveBeenCalledOnce();
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
  interface Row {
    user_id: string;
    provider: string;
    api_key_sealed: string;
    key_hint: string | null;
    updated_at: string | null;
  }

  const makeSupabase = (rows: Row[]): SupabaseClient => {
    const filtered = (filters: Record<string, string>): Row[] =>
      rows.filter((row) =>
        Object.entries(filters).every(
          ([key, value]) => row[key as keyof Row] === value,
        ),
      );
    return {
      from: () => ({
        upsert: async (row: Row) => {
          rows.push(row);
          return { error: null };
        },
        delete: () => {
          const filters: Record<string, string> = {};
          const chain = {
            eq: (key: string, value: string) => {
              filters[key] = value;
              return chain;
            },
            then: (resolve: (value: { error: null }) => void) => {
              for (const row of filtered(filters)) {
                rows.splice(rows.indexOf(row), 1);
              }
              resolve({ error: null });
            },
          };
          return chain;
        },
        select: () => {
          const filters: Record<string, string> = {};
          const chain = {
            eq: (key: string, value: string) => {
              filters[key] = value;
              return chain;
            },
            maybeSingle: async () => ({ data: filtered(filters)[0] ?? null }),
            then: (resolve: (value: { data: Row[] }) => void) => {
              resolve({ data: filtered(filters) });
            },
          };
          return chain;
        },
      }),
    } as unknown as SupabaseClient;
  };

  it("seals at rest (no plaintext in the row) and round-trips server-side", async () => {
    vi.stubEnv("PROVIDER_VAULT_KEY", VAULT_KEY);
    const rows: Row[] = [];
    const supabase = makeSupabase(rows);
    const result = await setProviderKey(
      supabase,
      "u1",
      "openrouter",
      "sk-or-v1-secret-key-value",
    );
    expect(result.ok).toBe(true);
    expect(rows[0]!.api_key_sealed).not.toContain("secret-key-value");
    expect(rows[0]!.api_key_sealed.startsWith("v1:")).toBe(true);
    expect(rows[0]!.key_hint).toBe("alue");
    expect(await getProviderKey(supabase, "u1", "openrouter")).toBe(
      "sk-or-v1-secret-key-value",
    );
    expect(await getProviderKey(supabase, "u1", "venice")).toBeNull();
  });

  it("statuses expose only hint metadata, never the sealed value", async () => {
    vi.stubEnv("PROVIDER_VAULT_KEY", VAULT_KEY);
    const rows: Row[] = [];
    const supabase = makeSupabase(rows);
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
    const supabase = makeSupabase([]);
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
