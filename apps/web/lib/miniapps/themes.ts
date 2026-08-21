/**
 * Mini-app theme tokens (see design.md at the repository root). A theme is data, never markup: the
 * renderers emit token-referencing CSS (`var(--panel-bg)`) and the theme
 * supplies the values, the type pair, and the backdrop layer. Adding the
 * liquid-glass / gradient variants and a Settings theme selector means adding
 * entries to THEMES — no renderer changes.
 *
 * Backdrops name their own capabilities so the page CSP stays as tight as the
 * chosen theme allows: a shader backdrop needs `script-src 'self'` for the
 * self-hosted fx.js custom elements, a CSS-only backdrop needs nothing.
 */

export const THEME_IDS = ["atmosphere", "pixel"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "atmosphere";

export function isThemeId(value: string): value is ThemeId {
  return (THEME_IDS as readonly string[]).includes(value);
}

/**
 * The token contract every theme fills. Values are raw CSS, emitted as custom
 * properties on `:root`; renderers may only reference these names, so a new
 * theme can restyle a surface it has never seen.
 */
export interface ThemeTokens {
  /** Page canvas behind the backdrop layer. */
  readonly canvas: string;
  /** Primary text, and the fill of solid controls. */
  readonly ink: string;
  /** Secondary text: helper copy, disabled/eyebrow states. */
  readonly inkMuted: string;
  /** Text that sits on top of an accent fill. */
  readonly onAccent: string;
  /** Text that sits on top of an `ink` fill (solid buttons). */
  readonly onInk: string;
  /** Accent: focus rings, active step, links, notices. */
  readonly accent: string;
  /** Elevated surface fill (slide panel, header pill, nav pill). */
  readonly panelBg: string;
  /** Inset surface fill (inputs, rows, code blocks). */
  readonly wellBg: string;
  /**
   * Plate behind the wordmark. The mark is dark chrome artwork, so a theme
   * with a bright or busy backdrop must put a light plate under it.
   */
  readonly logoPlate: string;
  /**
   * Scrim painted over the backdrop and under the content, so text keeps its
   * contrast wherever the backdrop goes bright. "none" for flat themes.
   */
  readonly scrim: string;
  /** Hairline border on every surface. */
  readonly ring: string;
  /** Elevation shadow for panels and pills. */
  readonly shadow: string;
  /** Backdrop filter applied to elevated surfaces ("none" is valid). */
  readonly blur: string;
  /** Display/body family. */
  readonly fontBody: string;
  /** Eyebrow/UI family — labels, buttons, counters. */
  readonly fontUi: string;
  /** Corner radius of elevated surfaces. */
  readonly radiusPanel: string;
  /** Corner radius of inset surfaces. */
  readonly radiusWell: string;
  /** Corner radius of buttons and pills. */
  readonly radiusPill: string;
  /** Slide-transition duration; "0ms" disables the entrance animation. */
  readonly slideIn: string;
}

/** How a theme paints behind the content. */
export type ThemeBackdrop =
  | {
      readonly kind: "shader";
      /** Self-hosted script defining the custom element. */
      readonly script: string;
      /** Custom-element markup, positioned fixed by the renderer's CSS. */
      readonly element: string;
      /** Film-grain overlay on top of the shader. */
      readonly grain: boolean;
    }
  | { readonly kind: "css"; readonly grain: boolean };

export interface Theme {
  readonly id: ThemeId;
  readonly name: string;
  readonly description: string;
  readonly tokens: ThemeTokens;
  readonly backdrop: ThemeBackdrop;
  /** Web-font stylesheet to link, when the theme isn't system-font only. */
  readonly fontStylesheet: string | null;
}

const WZRD_FONTS =
  "https://fonts.googleapis.com/css2?family=Azeret+Mono:wght@300..800&family=Newsreader:opsz,wght@6..72,200..700&display=swap";

/**
 * Atmosphere — the WZRD Creator OS look: the fBm cloud + light-ray GLSL field
 * from the landing page behind glass panels, Newsreader display over Azeret
 * Mono labels.
 */
const atmosphere: Theme = {
  id: "atmosphere",
  name: "Atmosphere",
  description:
    "WZRD Creator OS: animated cloud shader, glass panels, Newsreader + Azeret Mono.",
  tokens: {
    canvas:
      "radial-gradient(circle at 73% 63%, rgba(182,219,255,0.5), transparent 11%)," +
      "radial-gradient(ellipse at 50% 78%, rgba(224,239,255,0.5) 0 11%, transparent 42%)," +
      "radial-gradient(ellipse at 17% 43%, rgba(136,188,241,0.42) 0 12%, transparent 39%)," +
      "radial-gradient(ellipse at 66% 13%, rgba(83,146,225,0.58) 0 20%, transparent 45%)," +
      "linear-gradient(180deg,#154b95 0%,#0a2b65 47%,#06162d 100%)",
    ink: "#f1ebdd",
    inkMuted: "rgba(241,235,221,0.62)",
    onAccent: "#05070a",
    onInk: "#05070a",
    accent: "#8cc8ff",
    panelBg: "rgba(12,11,16,0.62)",
    wellBg: "rgba(5,7,10,0.42)",
    logoPlate: "rgba(238,244,255,0.92)",
    scrim:
      "radial-gradient(ellipse at 50% 52%, rgba(3,8,20,0.5) 0%, rgba(3,8,20,0.28) 45%, transparent 78%)," +
      "linear-gradient(180deg, rgba(3,8,20,0.5) 0%, transparent 22%, transparent 74%, rgba(3,8,20,0.6) 100%)",
    ring: "rgba(255,255,255,0.14)",
    shadow:
      "0 0.5rem 1.3rem rgba(2,5,10,0.4),inset 0 1px 0 rgba(255,255,255,0.08)",
    blur: "blur(16px) saturate(160%)",
    fontBody: "'Newsreader',Georgia,serif",
    fontUi: "'Azeret Mono',ui-monospace,Consolas,monospace",
    radiusPanel: "1.1rem",
    radiusWell: "0.75rem",
    radiusPill: "999px",
    slideIn: "620ms",
  },
  backdrop: {
    kind: "shader",
    script: "/creator-os/fx.js",
    element: '<wz-sky mode="full" rays="0.9" aria-hidden="true"></wz-sky>',
    grain: true,
  },
  fontStylesheet: WZRD_FONTS,
};

/**
 * Pixel — the current in-app Pixel OS surface as a theme: flat light/dark
 * neutrals, system type, no backdrop layer. The fallback whenever a theme
 * can't run its backdrop (no WebGL, reduced data) and the baseline the other
 * themes are measured against.
 */
const pixel: Theme = {
  id: "pixel",
  name: "Pixel",
  description:
    "Flat Pixel OS neutrals, system type, no animated backdrop — the calm default.",
  tokens: {
    canvas: "#101012",
    ink: "#f5f5f5",
    inkMuted: "#a3a3a3",
    onAccent: "#ffffff",
    onInk: "#101012",
    accent: "#2b7fff",
    panelBg: "#1a1a1c",
    wellBg: "#232326",
    logoPlate: "rgba(240,244,255,0.94)",
    scrim: "none",
    ring: "rgba(255,255,255,0.12)",
    shadow:
      "0 0 0 0.5px rgba(255,255,255,0.12),0 1px 2px rgba(0,0,0,0.4),0 2px 4px rgba(0,0,0,0.3)",
    blur: "none",
    fontBody: '"Inter",-apple-system,system-ui,sans-serif',
    fontUi: '"Inter",-apple-system,system-ui,sans-serif',
    radiusPanel: "12px",
    radiusWell: "10px",
    radiusPill: "999px",
    slideIn: "0ms",
  },
  backdrop: { kind: "css", grain: false },
  fontStylesheet: null,
};

export const THEMES: Record<ThemeId, Theme> = { atmosphere, pixel };

export function theme(id: ThemeId): Theme {
  return THEMES[id];
}

/** The `:root` custom-property block for a theme. */
export function tokenBlock(tokens: ThemeTokens): string {
  const pairs: Array<[string, string]> = [
    ["canvas", tokens.canvas],
    ["ink", tokens.ink],
    ["ink-muted", tokens.inkMuted],
    ["on-accent", tokens.onAccent],
    ["on-ink", tokens.onInk],
    ["accent", tokens.accent],
    ["panel-bg", tokens.panelBg],
    ["well-bg", tokens.wellBg],
    ["logo-plate", tokens.logoPlate],
    ["scrim", tokens.scrim],
    ["ring", tokens.ring],
    ["shadow", tokens.shadow],
    ["blur", tokens.blur],
    ["font-body", tokens.fontBody],
    ["font-ui", tokens.fontUi],
    ["radius-panel", tokens.radiusPanel],
    ["radius-well", tokens.radiusWell],
    ["radius-pill", tokens.radiusPill],
    ["slide-in", tokens.slideIn],
  ];
  return `:root{${pairs.map(([name, value]) => `--${name}:${value}`).join(";")}}`;
}

/**
 * The fetch-directive part of the CSP a theme needs, on top of the strict
 * mini-app baseline. A theme only widens what its own assets require: no
 * shader means no script-src at all, no web font means no font-src.
 */
export function themeCsp(current: Theme): string {
  const directives = ["default-src 'none'", "img-src 'self'"];
  if (current.backdrop.kind === "shader") directives.push("script-src 'self'");
  if (current.fontStylesheet === null) {
    directives.push("style-src 'unsafe-inline'");
  } else {
    directives.push("style-src 'unsafe-inline' https://fonts.googleapis.com");
    directives.push("font-src https://fonts.gstatic.com");
  }
  return directives.join("; ");
}
