/**
 * Brand kit source of record (goal-creative.md CM0). One structured source,
 * one compiler, three targets: a Hermes theme YAML for the box dashboard,
 * a BRAND.md brief the agent reads, and brand.tokens.json for the control
 * plane UI and the ad asset-group builder (CC11).
 *
 * The palette/typography/layout/assets blocks compile straight into a Hermes
 * theme; the voice/claims/imagery blocks are creative extensions the theme
 * loader ignores.
 */

export interface BrandPaletteColor {
  hex: string;
  alpha?: number;
}

export interface BrandSource {
  /** Machine name: lowercase slug, used for the theme filename. */
  name: string;
  /** Human label. */
  label: string;
  palette: {
    background: string;
    midground: string;
    foreground: string | BrandPaletteColor;
    /** Extra named colors, CSS color strings. */
    [key: string]: string | BrandPaletteColor;
  };
  typography?: {
    fontSans?: string;
    fontDisplay?: string;
    fontUrl?: string;
    baseSize?: string;
  };
  layout?: {
    radius?: string;
    density?: "compact" | "comfortable" | "spacious";
  };
  assets?: {
    logo?: string;
    custom?: Record<string, string>;
  };
  voice?: {
    register?: string;
    person?: string;
    banned?: string[];
    readingLevel?: number;
  };
  claims?: {
    allowed?: string[];
    forbidden?: string[];
    requiresLegal?: string[];
  };
  imagery?: {
    do?: string[];
    avoid?: string[];
    talentRelease?: "required" | "not-required";
  };
  markets?: string[];
}

export interface CompiledBrand {
  /** Hermes theme YAML → ~/.hermes/dashboard-themes/<name>.yaml in the box. */
  themeYaml: string;
  /** Prose brief the agent reads → BRAND.md in the box workspace. */
  brandMd: string;
  /** Tokens for the control-plane UI and lib/publish/specs. */
  tokensJson: string;
}

export interface CopyViolation {
  kind: "voice.banned" | "claims.forbidden" | "claims.requiresLegal";
  term: string;
}
