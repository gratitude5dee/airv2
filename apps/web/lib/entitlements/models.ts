/**
 * "Speed & Intelligence" — the tier name is the only thing a box or a browser
 * ever sees; the mapping to real model IDs lives here, server-side, so it can
 * change without touching a single box (ARCHITECTURE.md §2.5a).
 */

import { createConfig } from "../create/config";

export type SpeedTier = "fast" | "balanced" | "deep";

/**
 * The model family sits on top of the tiers: `openai` resolves through the
 * speed tier, every other family is a single upstream slug.
 */
export type ModelFamily =
  | "openai"
  | "inkling"
  | "inkling-small"
  | "anthropic"
  | "minimax-m3"
  | "minimax-m2.7"
  | "openrouter"
  | "venice"
  | "gmi";

export const DEFAULT_MODEL_FAMILY: ModelFamily = "openai";

const TIER_MODELS: Record<SpeedTier, string> = {
  fast: "gpt-5.6-luna",
  balanced: "gpt-5.6-luna",
  deep: "gpt-5.6-terra",
};

/**
 * Create sessions (goal-create-v11 §9.1, goal-create-v12 §7.1) resolve on
 * their own tier family so the Vibe lane can move models without touching
 * the chat lane. Independent of the owner's `model_family`: the provider is
 * decided per served slug by `createProviderFor` — GMI for the catalog's
 * GMI slugs (Astra plans, GLM builds; CR18), OpenAI for anything else, so an
 * operator override can still point a tier at an OpenAI slug.
 */
export const CREATE_TIER_MODELS: Record<SpeedTier, string> = {
  fast: "zai-org/GLM-5.3-Flash",
  balanced: "zai-org/GLM-5.3-Flash",
  deep: "openai/gpt-6-astra",
};

/** §7.3 — which role's turn a Create completion was, for `agent_runs.create_stage`. */
export const CREATE_STAGES = ["plan", "build", "review", "finalize"] as const;
export type CreateStage = (typeof CREATE_STAGES)[number];

export function isCreateStage(value: unknown): value is CreateStage {
  return typeof value === "string" && (CREATE_STAGES as readonly string[]).includes(value);
}

/**
 * A Create turn's model request: `create-<tier>:<project slug>[#<stage>]`.
 * The slug is the project the run was opened for (`agent_runs.label =
 * create:<slug>`), so every completion is attributed — and budgeted — to
 * the project that made it, not to whichever of the owner's runs happened
 * to start last. The optional `#<stage>` (§7.3) attributes the turn to a
 * role for the admin Tokens page and is stripped before resolution. Still
 * tier names only on the Box side (C2): the gateway resolves the model slug.
 */
export const CREATE_MODEL_RE =
  /^create-(fast|balanced|deep):([a-z0-9_][a-z0-9_-]{0,79})(?:#(plan|build|review|finalize))?$/;

export interface CreateModelRequest {
  tier: SpeedTier;
  slug: string;
  /** Null when the request carried no `#<stage>` suffix. */
  stage: CreateStage | null;
}

/** Slugs for the fixed families that don't go through the tiers. */
const FAMILY_MODELS: Record<
  Exclude<ModelFamily, "openai" | "openrouter" | "venice" | "gmi">,
  string
> = {
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

/**
 * GMI Cloud chat models (api.gmi-serving.com, OpenAI-compatible). Unlike the
 * menu families, `gmi` resolves per tier — fast is the delegation lane
 * (delegation.model = "fast" in every box's config), so it is pinned to
 * GLM-5.3-Flash regardless of the owner's gmi_model pick: the pin binds the
 * owner-visible tiers only. Pricing is list price; Astra/Luna assume the
 * OpenAI list until the GMI console figure is confirmed (goal-gmi-models §4).
 */
export const GMI_MODELS: readonly [CatalogModel, ...CatalogModel[]] = [
  {
    slug: "zai-org/GLM-5.3-Flash",
    label: "GLM-5.3 Flash",
    tier: "fast",
    pricing: { input: 0.15, output: 0.5 },
  },
  {
    slug: "openai/gpt-5.6-luna",
    label: "GPT-5.6 Luna (GMI)",
    tier: "balanced",
    pricing: { input: 0.4, output: 2.4 },
  },
  {
    slug: "openai/gpt-6-astra",
    label: "GPT-6 Astra (GMI)",
    tier: "deep",
    pricing: { input: 10, output: 50 },
  },
];

export const GMI_TIER_MODELS: Record<SpeedTier, string> = {
  fast: "zai-org/GLM-5.3-Flash",
  balanced: "openai/gpt-5.6-luna",
  deep: "openai/gpt-6-astra",
};

export function isGmiModel(slug: string): boolean {
  return GMI_MODELS.some((model) => model.slug === slug);
}

export function defaultGmiModelForTier(tier: SpeedTier): string {
  const override = gmiTierOverride(tier);
  return override ?? GMI_TIER_MODELS[tier];
}

/** GMI_FAST_MODEL / GMI_BALANCED_MODEL / GMI_DEEP_MODEL — ops re-pin without
 * a deploy, mirroring MODEL_FAST/… on the openai lane. The override must
 * still name a catalog slug so a typo can't route spend to anything else. */
function gmiTierOverride(tier: SpeedTier): string | undefined {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env["GMI_FAST_MODEL"],
    balanced: process.env["GMI_BALANCED_MODEL"],
    deep: process.env["GMI_DEEP_MODEL"],
  };
  const value = byTier[tier];
  return value && isGmiModel(value) ? value : undefined;
}

/** GLM-5.3-Flash bills mandatory reasoning inside the output cap; "low"
 * keeps child calls cheap. GMI_GLM_EFFORT overrides; "" omits the field. */
export function gmiReasoningEffort(model: string): string | undefined {
  if (!model.startsWith("zai-org/")) return undefined;
  const value = process.env["GMI_GLM_EFFORT"] ?? "low";
  return value && value.trim() ? value.trim() : undefined;
}

/** Per-user model selections read from entitlements alongside the family. */
export interface ModelSelection {
  openrouterModel?: string | null;
  veniceModel?: string | null;
  gmiModel?: string | null;
}

/** Families whose selection needs the TML free-endpoint consent (§7). */
export const CONSENT_FAMILIES: readonly ModelFamily[] = [
  "inkling",
  "inkling-small",
];

export function isModelFamily(value: string): value is ModelFamily {
  return (
    value === "openai" ||
    value === "inkling" ||
    value === "inkling-small" ||
    value === "anthropic" ||
    value === "minimax-m3" ||
    value === "minimax-m2.7" ||
    value === "openrouter" ||
    value === "venice" ||
    value === "gmi"
  );
}

export type ModelProvider = "openai" | "openrouter" | "venice" | "gmi";

/** Which upstream serves a family. */
export function providerForFamily(family: ModelFamily): ModelProvider {
  if (family === "openai") return "openai";
  if (family === "venice") return "venice";
  if (
    family === "minimax-m3" ||
    family === "minimax-m2.7" ||
    family === "gmi"
  )
    return "gmi";
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
 * except the fast tier, which defaults to "xhigh": agent quality is the
 * fleet default, and the Responses path carries effort on tool-bearing
 * calls so nothing runs unreasoned. Set MODEL_REASONING_FAST="low" for
 * cheaper delegated children, or "" to omit.
 */
export function reasoningForTier(tier: SpeedTier): string | undefined {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env["MODEL_REASONING_FAST"] ?? "xhigh",
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
  Exclude<ModelFamily, "openai" | "openrouter" | "venice" | "gmi">,
  { input: number; output: number }
> = {
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

/**
 * §7.1 — the upstream that serves a resolved Create slug: GMI for the GMI
 * catalog (Astra, GLM), OpenAI otherwise. Decided per slug, never per the
 * owner's chat family, so `MODEL_CREATE_DEEP=gpt-5.6-terra` routes to OpenAI
 * while the defaults stay on the prepaid GMI lane.
 */
export function createProviderFor(slug: string): Extract<ModelProvider, "gmi" | "openai"> {
  return isGmiModel(slug) ? "gmi" : "openai";
}

/**
 * §7.1 — `reasoning_effort` for a Create turn on a GLM slug: the Builder
 * (balanced) sends `GMI_CREATE_BUILD_EFFORT` (default medium), the Reviewer
 * (fast) `low`, and the Planner (deep) — like every non-GLM slug — nothing.
 * The fast-lane invariant of `gmiReasoningEffort` still holds for delegated
 * children: they are not Create turns and never reach this function.
 */
export function createEffortFor(tier: SpeedTier, slug: string): string | undefined {
  if (!slug.startsWith("zai-org/")) return undefined;
  if (tier === "balanced") return createConfig.buildEffort();
  if (tier === "fast") return "low";
  return undefined;
}

const TIER_RANK: Record<SpeedTier, number> = { fast: 0, balanced: 1, deep: 2 };

export function createModelFor(tier: SpeedTier, slug: string, stage?: CreateStage | null): string {
  return `create-${tier}:${slug}${stage ? `#${stage}` : ""}`;
}

/** `create-<tier>:<slug>[#<stage>]` from a Box, or null when the request is
 * not a well-formed Create turn. */
export function parseCreateModel(model: unknown): CreateModelRequest | null {
  if (typeof model !== "string") return null;
  const match = CREATE_MODEL_RE.exec(model);
  const tier = match?.[1];
  const slug = match?.[2];
  const stage = match?.[3];
  if (!tier || !slug || !isSpeedTier(tier)) return null;
  return { tier, slug, stage: isCreateStage(stage) ? stage : null };
}

/**
 * Transitional: the project-less `create-<tier>` a Hermes run started before
 * the project-bearing format shipped keeps sending for the rest of its life
 * (a run's model is fixed at createRun; runs live at most
 * CREATE_RUN_MAX_MINUTES). The gateway attributes it to the caller's single
 * open Create run, as before. Remove once no such run can still be open.
 */
export function parseLegacyCreateTier(model: unknown): SpeedTier | null {
  if (typeof model !== "string" || !model.startsWith("create-")) return null;
  const tier = model.slice("create-".length);
  return isSpeedTier(tier) ? tier : null;
}

/** True for anything in the Create namespace, well-formed or not, so a
 * malformed `create-*` request is refused rather than served on the chat
 * family and charged to the owner's general spend. */
export function isCreateModelRequest(model: unknown): boolean {
  return typeof model === "string" && model.startsWith("create-");
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
  if (family === "gmi") {
    // The fast tier is the delegation lane (delegation.model = "fast" on
    // every box): it always resolves to the cheap GMI tier model, never to
    // the owner's pin — a pinned Astra must not price children at the deep
    // rate.
    if (tier === "fast") return defaultGmiModelForTier("fast");
    const chosen = selection.gmiModel ?? "";
    return isGmiModel(chosen) ? chosen : defaultGmiModelForTier(tier);
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
        : family === "gmi"
          ? GMI_MODELS
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
      : family === "gmi"
        ? (GMI_MODELS.find((entry) => entry.slug === model)?.pricing ??
          // Served on an ops override or an unpinned tier — price by the
          // tier's default slug rather than the family floor.
          GMI_MODELS.find(
            (entry) => entry.slug === GMI_TIER_MODELS[tier],
          )!.pricing)
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
