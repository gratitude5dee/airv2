/**
 * "Speed & Intelligence" — the tier name is the only thing a box or a browser
 * ever sees; the mapping to real model IDs lives here, server-side, so it can
 * change without touching a single box (ARCHITECTURE.md §2.5a).
 */

export type SpeedTier = "fast" | "balanced" | "deep";

const TIER_MODELS: Record<SpeedTier, string> = {
  fast: "gpt-4o-mini",
  balanced: "gpt-4o",
  deep: "o3",
};

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

/** Approximate USD per 1M tokens, for metering into agent_runs. */
const TIER_PRICING: Record<SpeedTier, { input: number; output: number }> = {
  fast: { input: 0.15, output: 0.6 },
  balanced: { input: 2.5, output: 10 },
  deep: { input: 10, output: 40 },
};

export function isSpeedTier(value: string): value is SpeedTier {
  return value === "fast" || value === "balanced" || value === "deep";
}

export function modelForTier(tier: SpeedTier): string {
  return tierOverride(tier) ?? TIER_MODELS[tier];
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
