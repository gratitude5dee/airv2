/**
 * The one brand compiler (CC11): BrandSource → theme.yaml | BRAND.md |
 * brand.tokens.json. Pure functions, no I/O — mirroring into the box lives
 * in ./mirror.ts.
 */
import type {
  BrandPaletteColor,
  BrandSource,
  CompiledBrand,
  CopyViolation,
} from "./types";

function yamlString(value: string): string {
  return JSON.stringify(value);
}

/** Map keys are caller-supplied — quote them so they can never restructure
 * the emitted YAML. */
function yamlKey(key: string): string {
  return JSON.stringify(key);
}

function colorValue(value: string | BrandPaletteColor): string {
  if (typeof value === "string") return value;
  if (value.alpha !== undefined && value.alpha < 1) {
    const hex = value.hex.replace("#", "");
    const r = parseInt(hex.slice(0, 2), 16);
    const g = parseInt(hex.slice(2, 4), 16);
    const b = parseInt(hex.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${value.alpha})`;
  }
  return value.hex;
}

/** Serialize the theme-shaped subset as Hermes theme YAML. */
export function compileThemeYaml(source: BrandSource): string {
  const lines: string[] = [
    `name: ${yamlString(source.name)}`,
    `label: ${yamlString(source.label)}`,
    "palette:",
  ];
  for (const [key, value] of Object.entries(source.palette)) {
    lines.push(`  ${yamlKey(key)}: ${yamlString(colorValue(value))}`);
  }
  const typography = Object.entries(source.typography ?? {}).filter(
    ([, value]) => value !== undefined && value !== ""
  );
  if (typography.length > 0) {
    lines.push("typography:");
    for (const [key, value] of typography) {
      lines.push(`  ${key}: ${yamlString(String(value))}`);
    }
  }
  if (source.layout?.radius || source.layout?.density) {
    lines.push("layout:");
    if (source.layout.radius) {
      lines.push(`  radius: ${yamlString(source.layout.radius)}`);
    }
    if (source.layout.density) {
      lines.push(`  density: ${yamlString(String(source.layout.density))}`);
    }
  }
  if (source.assets && (source.assets.logo || source.assets.custom)) {
    lines.push("assets:");
    if (source.assets.logo) {
      lines.push(`  logo: ${yamlString(source.assets.logo)}`);
    }
    const custom = Object.entries(source.assets.custom ?? {});
    if (custom.length > 0) {
      lines.push("  custom:");
      for (const [key, value] of custom) {
        lines.push(`    ${yamlKey(key)}: ${yamlString(value)}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

function list(items: string[] | undefined): string[] {
  return (items ?? []).filter((item) => item.trim() !== "");
}

/** The brief the agent reads: rules as instructions, palette as named hexes. */
export function compileBrandMd(source: BrandSource): string {
  const sections: string[] = [
    `# ${source.label} — brand brief`,
    "",
    "This file is compiled from the brand kit. Do not edit it here — it is",
    "overwritten on every brand change. Follow it in every caption, headline,",
    "image brief, and reply written on behalf of the brand.",
    "",
    "## Palette",
    "",
  ];
  for (const [key, value] of Object.entries(source.palette)) {
    sections.push(`- ${key}: ${colorValue(value)}`);
  }
  if (source.typography?.fontSans || source.typography?.fontDisplay) {
    sections.push("", "## Typography", "");
    if (source.typography.fontSans) {
      sections.push(`- Sans: ${source.typography.fontSans}`);
    }
    if (source.typography.fontDisplay) {
      sections.push(`- Display: ${source.typography.fontDisplay}`);
    }
  }
  sections.push("", "## Voice", "");
  if (source.voice?.register) {
    sections.push(`Write in a ${source.voice.register} register.`);
  }
  if (source.voice?.person) {
    sections.push(`Speak in the ${source.voice.person}.`);
  }
  if (source.voice?.readingLevel) {
    sections.push(
      `Keep copy at or below a grade ${source.voice.readingLevel} reading level.`
    );
  }
  const banned = list(source.voice?.banned);
  if (banned.length > 0) {
    sections.push(
      `Never use: ${banned.map((term) => `"${term}"`).join(", ")}.`
    );
  }
  sections.push("", "## Claims", "");
  const allowed = list(source.claims?.allowed);
  if (allowed.length > 0) {
    sections.push(`Claims you may make: ${allowed.join("; ")}.`);
  }
  const forbidden = list(source.claims?.forbidden);
  if (forbidden.length > 0) {
    sections.push(`Claims you must never make: ${forbidden.join("; ")}.`);
  }
  const legal = list(source.claims?.requiresLegal);
  if (legal.length > 0) {
    sections.push(
      `Claims requiring legal sign-off before use: ${legal.join("; ")}.`
    );
  }
  const imageryDo = list(source.imagery?.do);
  const imageryAvoid = list(source.imagery?.avoid);
  if (imageryDo.length > 0 || imageryAvoid.length > 0) {
    sections.push("", "## Imagery", "");
    if (imageryDo.length > 0) {
      sections.push(`Prefer: ${imageryDo.join("; ")}.`);
    }
    if (imageryAvoid.length > 0) {
      sections.push(`Avoid: ${imageryAvoid.join("; ")}.`);
    }
    if (source.imagery?.talentRelease === "required") {
      sections.push(
        "Any image with a recognizable person requires a talent release."
      );
    }
  }
  const markets = list(source.markets);
  if (markets.length > 0) {
    sections.push("", "## Markets", "", markets.join(", "));
  }
  return sections.join("\n") + "\n";
}

/** Tokens for the control-plane UI and the ad asset-group builder. */
export function compileTokensJson(source: BrandSource): string {
  const palette: Record<string, string> = {};
  for (const [key, value] of Object.entries(source.palette)) {
    palette[key] = colorValue(value);
  }
  return JSON.stringify(
    {
      name: source.name,
      label: source.label,
      palette,
      typography: source.typography ?? {},
      layout: source.layout ?? {},
      assets: source.assets ?? {},
      voice: source.voice ?? {},
      claims: source.claims ?? {},
      imagery: source.imagery ?? {},
      markets: source.markets ?? [],
    },
    null,
    2
  );
}

export function compileBrand(source: BrandSource): CompiledBrand {
  return {
    themeYaml: compileThemeYaml(source),
    brandMd: compileBrandMd(source),
    tokensJson: compileTokensJson(source),
  };
}

/**
 * Guardrails as a validator, not just prose (CM0 task 5): every generated
 * caption/headline runs through this before it can reach an approval card.
 * Word-boundary, case-insensitive; punctuation-only bans (e.g. "!") match
 * literally.
 */
export function lintCopy(text: string, source: BrandSource): CopyViolation[] {
  const violations: CopyViolation[] = [];
  const lower = text.toLowerCase();
  const check = (
    terms: string[] | undefined,
    kind: CopyViolation["kind"]
  ): void => {
    for (const term of list(terms)) {
      const needle = term.toLowerCase();
      const isWordLike = /[a-z0-9]/.test(needle);
      const found = isWordLike
        ? new RegExp(
            `(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}($|[^a-z0-9])`,
            "i"
          ).test(lower)
        : lower.includes(needle);
      if (found) {
        violations.push({ kind, term });
      }
    }
  };
  check(source.voice?.banned, "voice.banned");
  check(source.claims?.forbidden, "claims.forbidden");
  check(source.claims?.requiresLegal, "claims.requiresLegal");
  return violations;
}

function requireHttpsUrl(field: string, value: unknown): void {
  if (value === undefined || value === "") return;
  let url: URL;
  try {
    url = new URL(String(value));
  } catch {
    throw new Error(`${field} must be an https URL`);
  }
  if (url.protocol !== "https:") {
    throw new Error(`${field} must be an https URL`);
  }
}

const SLUG = /^[a-z0-9][a-z0-9-]{0,63}$/;
const TOKEN_KEY = /^[a-zA-Z][a-zA-Z0-9_-]{0,63}$/;
const DENSITIES = new Set(["compact", "comfortable", "spacious"]);

/** Shape-check an untrusted source before it is stored or compiled. */
export function validateBrandSource(input: unknown): BrandSource {
  if (!input || typeof input !== "object") {
    throw new Error("brand source must be an object");
  }
  const source = input as BrandSource;
  if (typeof source.name !== "string" || !SLUG.test(source.name)) {
    throw new Error("brand name must be a lowercase slug");
  }
  if (typeof source.label !== "string" || source.label.trim() === "") {
    throw new Error("brand label is required");
  }
  if (!source.palette || typeof source.palette !== "object") {
    throw new Error("brand palette is required");
  }
  for (const key of ["background", "midground", "foreground"] as const) {
    if (!source.palette[key]) {
      throw new Error(`palette.${key} is required`);
    }
  }
  for (const [key, value] of Object.entries(source.palette)) {
    if (!TOKEN_KEY.test(key)) {
      throw new Error(`palette key ${JSON.stringify(key)} must be a simple token name`);
    }
    const raw = typeof value === "string" ? value : value?.hex;
    if (typeof raw !== "string" || raw.trim() === "") {
      throw new Error(`palette.${key} must be a color string`);
    }
  }
  if (
    source.layout?.density !== undefined &&
    !DENSITIES.has(String(source.layout.density))
  ) {
    throw new Error("layout.density must be compact, comfortable or spacious");
  }
  for (const [key, value] of Object.entries(source.assets?.custom ?? {})) {
    if (!TOKEN_KEY.test(key)) {
      throw new Error(`asset key ${JSON.stringify(key)} must be a simple token name`);
    }
    requireHttpsUrl(`assets.custom.${key}`, value);
  }
  requireHttpsUrl("assets.logo", source.assets?.logo);
  requireHttpsUrl("typography.fontUrl", source.typography?.fontUrl);
  return source;
}
