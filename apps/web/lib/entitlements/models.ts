/**
 * "Speed & Intelligence" — the tier name is the only thing a box or a browser
 * ever sees; the mapping to real model IDs lives here, server-side, so it can
 * change without touching a single box (ARCHITECTURE.md §2.5a).
 */

export type SpeedTier = "fast" | "balanced" | "deep";

const TIER_MODELS: Record<SpeedTier, string> = {
  fast: "gpt-5.6-luna",
  balanced: "gpt-5.6-luna",
  deep: "gpt-5.6-terra",
};

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
    fast: process.env.MODEL_FAST,
    balanced: process.env.MODEL_BALANCED,
    deep: process.env.MODEL_DEEP,
  };
  return byTier[tier];
}

/**
 * Optional per-tier reasoning effort (MODEL_REASONING_FAST / _BALANCED /
 * _DEEP), injected by the gateway for providers that accept
 * `reasoning_effort` (OpenAI GPT-5.x). Unset means don't send the field.
 */
export function reasoningForTier(tier: SpeedTier): string | undefined {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env.MODEL_REASONING_FAST,
    balanced: process.env.MODEL_REASONING_BALANCED,
    deep: process.env.MODEL_REASONING_DEEP,
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
    fast: process.env.MODEL_SERVICE_TIER_FAST,
    balanced: process.env.MODEL_SERVICE_TIER_BALANCED,
    deep: process.env.MODEL_SERVICE_TIER_DEEP,
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

export function isSpeedTier(value: string): value is SpeedTier {
  return value === "fast" || value === "balanced" || value === "deep";
}

export function modelForTier(tier: SpeedTier): string {
  return tierOverride(tier) ?? TIER_MODELS[tier];
}

/**
 * Display-only model label for the UI (C19). MODEL_LABEL_FAST / _BALANCED /
 * _DEEP let ops show a friendly name distinct from the wire model ID; falls
 * back to the resolved model ID.
 */
export function modelLabelForTier(tier: SpeedTier): string {
  const byTier: Record<SpeedTier, string | undefined> = {
    fast: process.env.MODEL_LABEL_FAST,
    balanced: process.env.MODEL_LABEL_BALANCED,
    deep: process.env.MODEL_LABEL_DEEP,
  };
  const value = byTier[tier];
  return value && value.trim() ? value.trim() : modelForTier(tier);
}

export function costUsd(
  tier: SpeedTier,
  promptTokens: number,
  completionTokens: number
): number {
  const pricing = TIER_PRICING[tier];
  return (
    (promptTokens * pricing.input + completionTokens * pricing.output) / 1_000_000
  );
}
