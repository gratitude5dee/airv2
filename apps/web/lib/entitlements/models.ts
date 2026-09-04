/**
 * "Speed & Intelligence" — the tier name is the only thing a box or a browser
 * ever sees; the mapping to real model IDs lives here, server-side, so it can
 * change without touching a single box (ARCHITECTURE.md §2.5a).
 */

export type SpeedTier = "fast" | "balanced" | "deep";

/**
 * The model family sits on top of the tiers: `openai` resolves through the
 * speed tier, every other family is a single upstream slug. `ox-alpha` is the
 * default for anyone who never touches the setting; the stealth endpoint it
 * was named after graduated into Z.ai's GLM 5.3 Flash, which now serves it.
 */
export type ModelFamily =
  | "openai"
  | "ox-alpha"
  | "inkling"
  | "inkling-small"
  | "anthropic"
  | "minimax-m3"
  | "minimax-m2.7"
  | "openrouter"
  | "venice";

export const DEFAULT_MODEL_FAMILY: ModelFamily = "ox-alpha";

const TIER_MODELS: Record<SpeedTier, string> = {
  fast: "gpt-5.6-luna",
  balanced: "gpt-5.6-luna",
  deep: "gpt-5.6-terra",
};

/**
 * Create sessions (goal-create-v11 §9.1) resolve on their own tier family so
 * the Vibe lane can move models without touching the chat lane. Served by
 * the `openai` provider regardless of the owner's `model_family`.
 */
export const CREATE_TIER_MODELS: Record<SpeedTier, string> = {
  fast: "gpt-5.6-luna",
  balanced: "gpt-5.6-terra",
  deep: "gpt-5.6-terra",
};

export const CREATE_MODEL_RE = /^create-(fast|balanced|deep)$/;

/** Slugs for the fixed families that don't go through the tiers. */
const FAMILY_MODELS: Record<
  Exclude<ModelFamily, "openai" | "openrouter" | "venice">,
  string
> = {
  "ox-alpha": "z-ai/glm-5.3-flash",
  inkling: "thinkingmachines/inkling:free",
  "inkling-small": "thinkingmachines/inkling-small:free",
  anthropic: "anthropic/claude-sonnet-5",
  "minimax-m3": "MiniMaxAI/MiniMax-M3",
  "minimax-m2.7": "MiniMaxAI/MiniMax-M2.7",
};

export interface CatalogModel {
  slug: string;
  label: string;
  tier: SpeedTier;
  /** Approximate USD per 1M tokens for metering. */
  pricing: { input: number; output: number };
}

/**
 * The curated OpenRouter menu shown in Settings, grouped by the speed tier
 * each entry best serves. The slug is validated on every write AND on every
 * gateway read, so a stale row can never route to an arbitrary upstream.
 */
export const OPENROUTER_MODELS: readonly [CatalogModel, ...CatalogModel[]] = [
  {
    slug: "google/gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    tier: "fast",
    pricing: { input: 0.3, output: 2.5 },
  },
  {
    slug: "openai/gpt-4o-mini",
    label: "GPT-4o Mini",
    tier: "fast",
    pricing: { input: 0.15, output: 0.6 },
  },
  {
    slug: "meta-llama/llama-3.3-70b-instruct",
    label: "Llama 3.3 70B",
    tier: "fast",
    pricing: { input: 0.1, output: 0.3 },
  },
  {
    slug: "anthropic/claude-sonnet-4.5",
    label: "Claude Sonnet 4.5",
    tier: "balanced",
    pricing: { input: 3, output: 15 },
  },
  {
    slug: "deepseek/deepseek-chat-v3.1",
    label: "DeepSeek V3.1",
    tier: "balanced",
    pricing: { input: 0.27, output: 1.1 },
  },
  {
    slug: "qwen/qwen3-235b-a22b",
    label: "Qwen3 235B",
    tier: "balanced",
    pricing: { input: 0.2, output: 0.6 },
  },
  {
    slug: "google/gemini-2.5-pro",
    label: "Gemini 2.5 Pro",
    tier: "deep",
    pricing: { input: 1.25, output: 10 },
  },
  {
    slug: "anthropic/claude-opus-4.5",
    label: "Claude Opus 4.5",
    tier: "deep",
    pricing: { input: 5, output: 25 },
  },
  {
    slug: "x-ai/grok-4.6",
    label: "Grok 4.6",
    tier: "deep",
    pricing: { input: 3, output: 15 },
  },
];

/**
 * Venice models (OpenAI-compatible at api.venice.ai). Platform pricing is
 * treated as zero for metering: Venice bills in its own credit units, and
 * the family is expected to run on the user's personal key.
 */
export const VENICE_MODELS: readonly [CatalogModel, ...CatalogModel[]] = [
  {
    slug: "venice-uncensored-1-2",
    label: "Venice Uncensored",
    tier: "balanced",
    pricing: { input: 0, output: 0 },
  },
  {
    slug: "qwen3-235b-a22b-instruct-2507",
    label: "Qwen3 235B",
    tier: "deep",
    pricing: { input: 0, output: 0 },
  },
  {
    slug: "llama-3.3-70b",
    label: "Llama 3.3 70B",
    tier: "fast",
    pricing: { input: 0, output: 0 },
  },
  {
    slug: "deepseek-v3.2",
    label: "DeepSeek V3.2",
    tier: "deep",
    pricing: { input: 0, output: 0 },
  },
];

export function isOpenRouterModel(slug: string): boolean {
  return OPENROUTER_MODELS.some((model) => model.slug === slug);
}

export function isVeniceModel(slug: string): boolean {
  return VENICE_MODELS.some((model) => model.slug === slug);
}

export function defaultOpenRouterModelForTier(tier: SpeedTier): string {
  const match = OPENROUTER_MODELS.find((model) => model.tier === tier);
  return (match ?? OPENROUTER_MODELS[0]).slug;
}

export const DEFAULT_VENICE_MODEL = VENICE_MODELS[0].slug;

/** Per-user model selections read from entitlements alongside the family. */
export interface ModelSelection {
  openrouterModel?: string | null;
  veniceModel?: string | null;
}

/** Families whose selection needs the TML free-endpoint consent (§7). */
export const CONSENT_FAMILIES: readonly ModelFamily[] = [
  "inkling",
  "inkling-small",
];

export function isModelFamily(value: string): value is ModelFamily {
  return (
    value === "openai" ||
    value === "ox-alpha" ||
    value === "inkling" ||
    value === "inkling-small" ||
    value === "anthropic" ||
    value === "minimax-m3" ||
    value === "minimax-m2.7" ||
    value === "openrouter" ||
    value === "venice"
  );
}

export type ModelProvider = "openai" | "openrouter" | "venice" | "gmi";

/** Which upstream serves a family. */
export function providerForFamily(family: ModelFamily): ModelProvider {
  if (family === "openai") return "openai";
  if (family === "venice") return "venice";
  if (family === "minimax-m3" || family === "minimax-m2.7") return "gmi";
  return "openrouter";
}

export function requiresConsent(family: ModelFamily): boolean {
  return CONSENT_FAMILIES.includes(family);
}

/** True for the families served by OpenRouter rather than OpenAI directly. */
export function isOpenRouterFamily(family: ModelFamily): boolean {
  return providerForFamily(family) === "openrouter";
}

/**
 * OpenAI reasoning families (gpt-5.x / o-series) accept `reasoning_effort`
 * and the reasoning-model parameter rules; everything else rejects them.
 */
export function isReasoningModel(model: string): boolean {
  return /^(gpt-5|o[0-9])/.test(model);
}

/** Env overrides (MODEL_FAST / MODEL_BALANCED / MODEL_DEEP) let ops swap the
 * fleet's models without a deploy touching any box. */
function tierOverride(tier: SpeedTier): string | undefined {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env["MODEL_FAST"],
    balanced: process.env["MODEL_BALANCED"],
    deep: process.env["MODEL_DEEP"],
  };
  return byTier[tier];
}

/**
 * Optional per-tier reasoning effort (MODEL_REASONING_FAST / _BALANCED /
 * _DEEP), injected by the gateway for providers that accept
 * `reasoning_effort` (OpenAI GPT-5.x). Unset means don't send the field —
 * except the fast tier, which defaults to "low": there is no faster model
 * slug behind "fast", so low reasoning effort IS the fast-mode lever.
 * Set MODEL_REASONING_FAST="" to disable the default.
 */
export function reasoningForTier(tier: SpeedTier): string | undefined {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env["MODEL_REASONING_FAST"] ?? "low",
    balanced: process.env["MODEL_REASONING_BALANCED"],
    deep: process.env["MODEL_REASONING_DEEP"],
  };
  const value = byTier[tier];
  return value && value.trim() ? value.trim() : undefined;
}

/**
 * Optional per-tier OpenAI service tier (MODEL_SERVICE_TIER_FAST /
 * _BALANCED / _DEEP) — e.g. "fast" (priority processing) or "flex".
 * Unset means don't send the field.
 */
export function serviceTierForTier(tier: SpeedTier): string | undefined {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env["MODEL_SERVICE_TIER_FAST"],
    balanced: process.env["MODEL_SERVICE_TIER_BALANCED"],
    deep: process.env["MODEL_SERVICE_TIER_DEEP"],
  };
  const value = byTier[tier];
  return value && value.trim() ? value.trim() : undefined;
}

/** Approximate USD per 1M tokens, for metering into agent_runs
 * (gpt-5.6-luna / -terra at Fast-mode rates). */
const TIER_PRICING: Record<SpeedTier, { input: number; output: number }> = {
  fast: { input: 0.4, output: 2.4 },
  balanced: { input: 0.4, output: 2.4 },
  deep: { input: 4, output: 24 },
};

/** USD per 1M tokens for the fixed model families. */
const FAMILY_PRICING: Record<
  Exclude<ModelFamily, "openai" | "openrouter" | "venice">,
  { input: number; output: number }
> = {
  "ox-alpha": { input: 0.075, output: 0.25 },
  inkling: { input: 0, output: 0 },
  "inkling-small": { input: 0, output: 0 },
  anthropic: { input: 2, output: 10 },
  "minimax-m3": { input: 0.3, output: 1.2 },
  "minimax-m2.7": { input: 0.3, output: 1.2 },
};

export function isSpeedTier(value: string): value is SpeedTier {
  return value === "fast" || value === "balanced" || value === "deep";
}

export function modelForTier(tier: SpeedTier): string {
  return tierOverride(tier) ?? TIER_MODELS[tier];
}

/** MODEL_CREATE_FAST / _BALANCED / _DEEP — Create-only; never falls back to
 * MODEL_FAST/… so the two lanes can be re-pinned independently. */
function createTierOverride(tier: SpeedTier): string | undefined {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env["MODEL_CREATE_FAST"],
    balanced: process.env["MODEL_CREATE_BALANCED"],
    deep: process.env["MODEL_CREATE_DEEP"],
  };
  const value = byTier[tier];
  return value && value.trim() ? value.trim() : undefined;
}

export function modelForCreateTier(tier: SpeedTier): string {
  return createTierOverride(tier) ?? CREATE_TIER_MODELS[tier];
}

const TIER_RANK: Record<SpeedTier, number> = { fast: 0, balanced: 1, deep: 2 };

/** `create-<tier>` from a Box, or null when the request is not a Create turn. */
export function parseCreateTier(model: unknown): SpeedTier | null {
  if (typeof model !== "string") return null;
  const match = CREATE_MODEL_RE.exec(model);
  const tier = match?.[1];
  return tier && isSpeedTier(tier) ? tier : null;
}

/** The requested Create tier clamped to the entitlement: a Box may ask for
 * less than the owner pays for, never more. */
export function clampCreateTier(
  requested: SpeedTier,
  entitled: SpeedTier,
): SpeedTier {
  return TIER_RANK[requested] > TIER_RANK[entitled] ? entitled : requested;
}

/**
 * The one resolution point for "what model does this user actually get":
 * a family slug for everything but `openai`, which keeps using the tiers.
 */
export function modelForSelection(
  family: ModelFamily,
  tier: SpeedTier,
  selection: ModelSelection = {},
): string {
  if (family === "openai") return modelForTier(tier);
  if (family === "openrouter") {
    const chosen = selection.openrouterModel ?? "";
    return isOpenRouterModel(chosen)
      ? chosen
      : defaultOpenRouterModelForTier(tier);
  }
  if (family === "venice") {
    const chosen = selection.veniceModel ?? "";
    return isVeniceModel(chosen) ? chosen : DEFAULT_VENICE_MODEL;
  }
  return FAMILY_MODELS[family];
}

/** Display label for a family — the tier's label for `openai` (C19). */
export function modelLabelForFamily(
  family: ModelFamily,
  tier: SpeedTier,
  selection: ModelSelection = {},
): string {
  if (family === "openai") return modelLabelForTier(tier);
  const slug = modelForSelection(family, tier, selection);
  const catalog =
    family === "venice"
      ? VENICE_MODELS
      : family === "openrouter"
        ? OPENROUTER_MODELS
        : null;
  return catalog?.find((model) => model.slug === slug)?.label ?? slug;
}

/**
 * Display-only model label for the UI (C19). MODEL_LABEL_FAST / _BALANCED /
 * _DEEP let ops show a friendly name distinct from the wire model ID; falls
 * back to the resolved model ID.
 */
export function modelLabelForTier(tier: SpeedTier): string {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env["MODEL_LABEL_FAST"],
    balanced: process.env["MODEL_LABEL_BALANCED"],
    deep: process.env["MODEL_LABEL_DEEP"],
  };
  const value = byTier[tier];
  return value && value.trim() ? value.trim() : modelForTier(tier);
}

export function costUsd(
  tier: SpeedTier,
  promptTokens: number,
  completionTokens: number,
  family: ModelFamily = "openai",
  model?: string,
): number {
  const pricing =
    family === "openai"
      ? TIER_PRICING[tier]
      : family === "openrouter" || family === "venice"
        ? ((family === "venice" ? VENICE_MODELS : OPENROUTER_MODELS).find(
            (entry) => entry.slug === model,
          )?.pricing ?? { input: 0, output: 0 })
        : FAMILY_PRICING[family];
  return (
    (promptTokens * pricing.input + completionTokens * pricing.output) /
    1_000_000
  );
}
