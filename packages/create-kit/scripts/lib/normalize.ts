/**
 * Source normalization (§12.4 step 3). Pure text → text; every rule is
 * deterministic so a re-harvest reproduces kit/ byte for byte.
 */
import type { ComponentSpec, Patch } from "./catalog.ts";

const W3_NS = /https?:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink|1998\/Math\/MathML|XML\/1998\/namespace)/;

export interface NormalizeResult {
  readonly text: string;
  readonly notes: string[];
}

export function applyPatches(file: string, text: string, patches: readonly Patch[]): string {
  let out = text;
  for (const p of patches) {
    if (p.file !== file) continue;
    const before = out;
    out = typeof p.find === "string" ? out.replace(p.find, p.replace) : out.replace(p.find, p.replace);
    if (out === before && !p.optional) {
      throw new Error(`patch did not match in ${file}: ${String(p.find).slice(0, 80)}`);
    }
  }
  return out;
}

/** Strip a scheme+host from a string literal unless it is an XML namespace. */
function scrubUrls(text: string, notes: string[]): string {
  return text.replace(/(["'`])(https?:\/\/[^"'`\s]+)\1/g, (m, q: string, url: string) => {
    if (W3_NS.test(url)) return m;
    notes.push(`demo URL replaced with "#": ${url}`);
    return `${q}#${q}`;
  });
}

/** `// author: Name <https://site>` → `// author: Name` (keeps credit, drops the host). */
function scrubAuthorUrls(text: string): string {
  return text.replace(/^(\/\/\s*author:\s*[^<\n]+?)\s*<https?:\/\/[^>\n]+>\s*$/gm, "$1");
}

function extractAuthor(text: string): string | null {
  const m = /^\/\/\s*author:\s*([^<\n]+?)\s*(?:<https?:\/\/[^>\n]+>)?\s*$/m.exec(text);
  return m ? m[1]!.trim() : null;
}

function ensureUseClient(text: string): string {
  if (/^\s*["']use client["'];?/.test(text)) return text;
  const usesHooks = /\buse(?:State|Effect|LayoutEffect|Ref|Memo|Callback|Reducer|Id|SyncExternalStore)\b/.test(text);
  const touchesDom = /\b(?:window|document|navigator|matchMedia|requestAnimationFrame|ResizeObserver|IntersectionObserver)\b/.test(text);
  if (!usesHooks && !touchesDom) return text;
  return `"use client";\n\n${text}`;
}

const kebab = (s: string): string => s.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase();

function rewriteAliases(text: string): string {
  return text
    .replace(/from\s+["']@\/lib\/utils["']/g, 'from "../../air"')
    .replace(/from\s+["']@\/hooks\/([a-z0-9-]+)["']/g, 'from "./$1"')
    .replace(/from\s+["']@\/components\/(?:atoms|primitives)\/([A-Za-z0-9]+)["']/g, (_m, name: string) => `from "../${kebab(name)}"`);
}

function tidy(text: string): string {
  return text.replace(/[ \t]+$/gm, "").replace(/\n{3,}/g, "\n\n").replace(/\s*$/, "") + "\n";
}

export function normalizeFile(spec: Pick<ComponentSpec, "id" | "patches">, file: string, raw: string): NormalizeResult & { author: string | null } {
  const notes: string[] = [];
  const author = extractAuthor(raw);
  let text = raw.replace(/\r\n/g, "\n");
  const isCode = /\.(tsx?|jsx?)$/.test(file);
  const isCss = /\.css$/.test(file);

  if (spec.id === "beautiful/foundation" && file === "foundation.css") {
    text = transformFoundation(text);
  }
  text = applyPatches(file, text, spec.patches ?? []);
  if (isCode) {
    text = rewriteAliases(text);
    text = scrubAuthorUrls(text);
    text = scrubUrls(text, notes);
    if (/\.tsx$/.test(file)) text = ensureUseClient(text);
  }
  if (isCss) {
    text = text.replace(/@import\s+url\([^)]*\);?\n?/g, () => {
      notes.push("removed external @import");
      return "";
    });
  }
  return { text: tidy(text), notes, author };
}

/**
 * Beautiful UI foundation.css → Air. Drops the Tailwind/shadow-plugin imports,
 * replaces the light/dark token ramps with a bridge onto Air ThemeTokens (Air
 * owns light vs dark via theme), and removes html/body rules (the Air shell
 * owns the page). Keeps `@theme inline` for the Build Service's utility pass,
 * the primitive-* utilities, keyframes and component-specific blocks.
 */
export function transformFoundation(css: string): string {
  const themeIdx = css.indexOf("@theme inline {");
  if (themeIdx < 0) throw new Error("foundation.css: @theme inline block not found");
  let out = AIR_BRIDGE + css.slice(themeIdx);

  out = out
    .replace(/--font-sans:[^;]+;/, "--font-sans: var(--font-body);")
    .replace(/--font-mono:[^;]+;/, "--font-mono: var(--font-ui);");

  out = out.replace(/\/\* ── base ─+ \*\/\n\nhtml \{[\s\S]*?\n\}\n\nbody \{[\s\S]*?\n\}\n\n/, "/* ── base ─── (html/body are owned by the Air shell) */\n\n");
  out = out.replace(/background-attachment:\s*fixed;\n?/g, "");
  return out;
}

const AIR_BRIDGE = `/* Beautiful UI foundation, re-based on Air.
 * Upstream: beautifului.dev/r/foundation.json (MIT, Shane Levine).
 * Token ramps below resolve to Air ThemeTokens (kit/air/theme.css) so the
 * atmosphere and pixel themes both drive these components; the Tailwind and
 * shadow-plugin imports are gone (utility classes are compiled by the Build
 * Service; shadows are literal). */

:root {
  --page: var(--canvas);
  --surface: var(--panel-bg);
  --inset: var(--well-bg);
  --hover: color-mix(in srgb, var(--ink) 5%, transparent);
  --hover-2: color-mix(in srgb, var(--ink) 9%, transparent);

  --ink-2: var(--ink-muted);
  --ink-3: color-mix(in srgb, var(--ink-muted) 65%, transparent);

  --line: var(--ring);
  --line-strong: color-mix(in srgb, var(--ink) 18%, transparent);
  --line-soft: color-mix(in srgb, var(--ink) 6%, transparent);
  --grid-line: color-mix(in srgb, var(--line) 78%, transparent);
  --field: var(--well-bg);
  --stripe: transparent;
  --stripe-bg: transparent;

  --accent-ink: var(--accent);
  --accent-tint: color-mix(in srgb, var(--accent) 14%, transparent);

  --green: oklch(0.603 0.155 150.883);
  --green-tint: color-mix(in srgb, var(--green) 14%, transparent);
  --orange: oklch(0.689 0.179 49.902);
  --orange-tint: color-mix(in srgb, var(--orange) 14%, transparent);
  --red: oklch(0.621 0.192 23.042);
  --red-tint: color-mix(in srgb, var(--red) 14%, transparent);

  --tooltip-bg: var(--ink);
  --tooltip-fg: var(--canvas);
  --tooltip-muted: color-mix(in srgb, var(--canvas) 70%, transparent);
  --tooltip-border: color-mix(in srgb, var(--canvas) 20%, transparent);

  --shadow-hairline: 0 0 0 1px var(--line);
  --shadow-btn: 0 0 0 1px var(--line-strong), 0 1px 2px rgba(0, 0, 0, 0.06);
  --shadow-card: 0 0 0 1px var(--line), var(--shadow);
  --shadow-raised: 0 0 0 1px var(--line), var(--shadow);
  --shadow-overlay: 0 0 0 1px var(--line), var(--shadow);
  --shadow-inset-field: inset 0 1px 2px rgba(0, 0, 0, 0.12);
}

`;
