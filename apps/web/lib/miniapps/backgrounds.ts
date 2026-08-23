/**
 * Switchable mini-app backdrops (React Bits ports, self-hosted). A background
 * is data, like a theme: the id is stored per user (users.miniapp_background),
 * the shell swaps the theme's own backdrop layer for a `#wz-bg` mount, and the
 * bundled /creator-os/bg/bg.js entry lazy-loads only the chosen effect's
 * chunk. "theme" keeps the theme's native backdrop (Atmosphere's cloud
 * shader / Pixel's flat canvas) and downloads nothing.
 */

export const BACKGROUND_IDS = [
  "theme",
  "molten-metal",
  "liquid-ether",
  "prism",
  "silk",
  "side-rays",
  "light-rays",
  "grainient",
  "beams",
  "galaxy",
  "dither",
  "faulty-terminal",
  "iridescence",
  "liquid-chrome",
] as const;

export type BackgroundId = (typeof BACKGROUND_IDS)[number];
export const DEFAULT_BACKGROUND: BackgroundId = "theme";

export function isBackgroundId(value: string): value is BackgroundId {
  return (BACKGROUND_IDS as readonly string[]).includes(value);
}

export const BACKGROUND_NAMES: Record<BackgroundId, string> = {
  theme: "Theme default",
  "molten-metal": "Molten Metal",
  "liquid-ether": "Liquid Ether",
  prism: "Prism",
  silk: "Silk",
  "side-rays": "Side Rays",
  "light-rays": "Light Rays",
  grainient: "Grainient",
  beams: "Beams",
  galaxy: "Galaxy",
  dither: "Dither",
  "faulty-terminal": "Faulty Terminal",
  iridescence: "Iridescence",
  "liquid-chrome": "Liquid Chrome",
};
