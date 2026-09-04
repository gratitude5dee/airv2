"use client";

/**
 * thinking-orbs (libraries.dev, MIT) on Air: `theme` follows the Air theme
 * (both Air themes are dark-ink-on-dark, so ink is light), `paused` follows
 * reduced motion, and lite drops to the 20px preset.
 */
import { ThinkingOrb, type ThinkingOrbProps, type OrbState } from "thinking-orbs";
import { useLite, useReducedMotion } from "../../air";

export type { OrbState };

export interface AirThinkingOrbProps extends Omit<ThinkingOrbProps, "theme" | "paused"> {
  readonly paused?: boolean;
}

export function AirThinkingOrb({ paused, size, ...rest }: AirThinkingOrbProps) {
  const lite = useLite();
  const reduced = useReducedMotion();
  return <ThinkingOrb theme="dark" size={lite ? 20 : (size ?? 64)} paused={paused ?? reduced} {...rest} />;
}

export { ThinkingOrb };
export default AirThinkingOrb;
