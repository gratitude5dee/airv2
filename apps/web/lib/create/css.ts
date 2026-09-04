/**
 * The Build Service's stylesheet pass (goal-create-v11 §9.3, §12.2): the
 * Kit's `theme.css` tokens, the `shell.css` vocabulary pruned to the
 * selectors the app actually uses, and Tailwind utilities generated for the
 * class candidates found in the compiled output through the `@theme inline`
 * token bridge that `theme.css` declares. Pure: reads nothing from the
 * workspace, writes nothing.
 */
import fs from "node:fs";
import path from "node:path";
import { compile as compileTailwind } from "tailwindcss";
import { kitDir } from "./kit";

export type ThemeName = "atmosphere" | "pixel";

export const FONT_FILES = ["azeret-mono-latin.woff2", "newsreader-latin.woff2"];

export function readThemeCss(root?: string): string {
  return fs.readFileSync(path.join(kitDir(root), "air", "theme.css"), "utf8");
}

export function readShellCss(root?: string): string {
  return fs.readFileSync(path.join(kitDir(root), "air", "shell.css"), "utf8");
}

/** Font bytes keyed by bundle path (`fonts/<file>`). */
export function readFonts(root?: string): Map<string, Buffer> {
  const out = new Map<string, Buffer>();
  const dir = path.join(kitDir(root), "air", "fonts");
  for (const file of FONT_FILES) {
    const full = path.join(dir, file);
    if (fs.existsSync(full)) out.set(`fonts/${file}`, fs.readFileSync(full));
  }
  return out;
}

/* ------------------------------------------------------------ candidates */

const CANDIDATE_RE = /[A-Za-z0-9_][A-Za-z0-9_:./[\]%#()!,-]*/g;

/**
 * Every token that could be a class name, from the compiled JS/HTML/CSS. Over-
 * inclusive on purpose — Tailwind ignores what it cannot compile — and
 * bounded so a pathological bundle cannot turn into a pathological build.
 */
export function classCandidates(texts: string[], max = 20_000): Set<string> {
  const out = new Set<string>();
  for (const text of texts) {
    for (const match of text.matchAll(CANDIDATE_RE)) {
      const token = match[0];
      if (token.length > 64) continue;
      out.add(token);
      if (out.size >= max) return out;
    }
  }
  return out;
}

/** Class names referenced by a selector (`.a.b > .c` → a, b, c). */
export function selectorClasses(selector: string): string[] {
  const out: string[] = [];
  for (const match of selector.matchAll(/\.(-?[_a-zA-Z][\w-]*)/g)) out.push(match[1]!);
  return out;
}

/* ------------------------------------------------------------ pruning */

interface CssRule {
  prelude: string;
  body: string;
  nested: boolean;
}

function stripComments(css: string): string {
  return css.replace(/\/\*[\s\S]*?\*\//g, "");
}

/** Split a stylesheet into top-level rules, matching braces (strings aware
 * enough for the Kit's own generated CSS). */
export function splitRules(css: string): CssRule[] {
  const rules: CssRule[] = [];
  let depth = 0;
  let start = 0;
  let bodyStart = -1;
  let quote: string | null = null;
  for (let i = 0; i < css.length; i++) {
    const ch = css[i]!;
    if (quote) {
      if (ch === "\\") i++;
      else if (ch === quote) quote = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
      continue;
    }
    if (ch === "{") {
      if (depth === 0) bodyStart = i + 1;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) {
        const prelude = css.slice(start, bodyStart - 1).trim();
        const body = css.slice(bodyStart, i);
        rules.push({ prelude, body, nested: body.includes("{") });
        start = i + 1;
      }
    } else if (ch === ";" && depth === 0) {
      const prelude = css.slice(start, i).trim();
      if (prelude) rules.push({ prelude, body: "", nested: false });
      start = i + 1;
    }
  }
  return rules;
}

function keepSelectorList(prelude: string, used: Set<string>): string | null {
  const kept: string[] = [];
  for (const selector of prelude.split(",")) {
    const trimmed = selector.trim();
    if (!trimmed) continue;
    const classes = selectorClasses(trimmed);
    if (classes.every((cls) => used.has(cls))) kept.push(trimmed);
  }
  return kept.length > 0 ? kept.join(",") : null;
}

function pruneBlock(css: string, used: Set<string>, keyframes: Set<string>): string {
  const out: string[] = [];
  for (const rule of splitRules(css)) {
    if (!rule.prelude) continue;
    if (rule.prelude.startsWith("@")) {
      if (rule.body === "") {
        out.push(`${rule.prelude};`);
        continue;
      }
      if (/^@keyframes\s+/.test(rule.prelude)) {
        const name = rule.prelude.replace(/^@keyframes\s+/, "").trim();
        if (keyframes.has(name)) out.push(`${rule.prelude}{${rule.body}}`);
        continue;
      }
      if (rule.nested) {
        const inner = pruneBlock(rule.body, used, keyframes);
        if (inner.trim()) out.push(`${rule.prelude}{${inner}}`);
        continue;
      }
      out.push(`${rule.prelude}{${rule.body}}`);
      continue;
    }
    const kept = keepSelectorList(rule.prelude, used);
    if (kept) out.push(`${kept}{${rule.body}}`);
  }
  return out.join("\n");
}

function animationNames(css: string): Set<string> {
  const names = new Set<string>();
  for (const match of css.matchAll(/animation(?:-name)?\s*:\s*([^;}]+)/g)) {
    const first = match[1]!.trim().split(/\s+/)[0];
    if (first && !/^(none|\d|infinite|ease|linear)/.test(first)) names.add(first);
  }
  return names;
}

/**
 * `shell.css` with only the class selectors the app uses. Element and
 * attribute selectors always stay (they are the vocabulary's floor);
 * `@keyframes` stay only when something kept still animates with them.
 */
export function pruneShellCss(shell: string, used: Set<string>): string {
  const noComments = stripComments(shell);
  const firstPass = pruneBlock(noComments, used, new Set(animationNames(noComments)));
  return pruneBlock(noComments, used, animationNames(firstPass));
}

/* ------------------------------------------------------------ theme */

/** Drop the `@theme inline` bridge (Tailwind consumed it) and, when the
 * theme never uses the self-hosted faces, the `@font-face` rules. */
export function themeCssFor(theme: string, lite: boolean, withFonts: boolean): string {
  const rules = splitRules(stripComments(theme));
  const out: string[] = [];
  for (const rule of rules) {
    if (!rule.prelude) continue;
    if (rule.prelude.startsWith("@theme")) continue;
    if (rule.prelude.startsWith("@font-face") && !withFonts) continue;
    out.push(rule.body === "" ? `${rule.prelude};` : `${rule.prelude}{${rule.body}}`);
  }
  if (lite) out.push("html{background-attachment:scroll}");
  return out.join("\n");
}

export function themeUsesFonts(theme: ThemeName): boolean {
  return theme === "atmosphere";
}

/* ------------------------------------------------------------ tailwind */

/** Nearest `node_modules/tailwindcss` above cwd; a plain walk so the bundler leaves it alone. */
function tailwindDir(): string | null {
  for (let dir = process.cwd(); ; dir = path.dirname(dir)) {
    const candidate = path.join(dir, "node_modules", "tailwindcss");
    if (fs.existsSync(path.join(candidate, "theme.css"))) return candidate;
    if (path.dirname(dir) === dir) return null;
  }
}

/**
 * Utilities for the candidates that compile, on top of Tailwind's default
 * theme plus the Kit's `@theme inline` bridge. Returns "" when nothing
 * compiled; throws only on a broken Tailwind install.
 */
export async function utilityCss(
  themeCss: string,
  candidates: Iterable<string>
): Promise<string> {
  const bridge = splitRules(stripComments(themeCss))
    .filter((rule) => rule.prelude.startsWith("@theme"))
    .map((rule) => `${rule.prelude}{${rule.body}}`)
    .join("\n");
  const dir = tailwindDir();
  const input = [
    dir ? '@import "tailwindcss/theme.css" layer(theme);' : "",
    "@tailwind utilities;",
    bridge,
  ].join("\n");
  const compiled = await compileTailwind(input, {
    base: dir ?? process.cwd(),
    loadStylesheet: async (id, base) => {
      if (!dir || !id.startsWith("tailwindcss/")) {
        throw new Error(`stylesheet import refused: ${id}`);
      }
      const file = path.join(dir, id.slice("tailwindcss/".length));
      return { path: file, base, content: fs.readFileSync(file, "utf8") };
    },
    loadModule: async () => {
      throw new Error("plugins are not available to Create apps");
    },
  });
  // The theme layer stays: utilities read `--spacing` and friends from it,
  // and the Kit's unlayered tokens still win over its self-referencing bridge.
  return compiled.build([...candidates]).replace(/^\/\*![^*]*\*\/\s*/, "").trim();
}

/* ------------------------------------------------------------ assembly */

export interface StylesheetInput {
  theme: ThemeName;
  lite: boolean;
  /** Compiled JS + HTML + app CSS to scan for classes. */
  texts: string[];
  /** The app's own CSS (esbuild output), appended last. */
  appCss: string;
  root?: string;
}

export interface Stylesheet {
  css: string;
  fonts: Map<string, Buffer>;
  utilityFailed: boolean;
}

/**
 * `app.css`: theme tokens, pruned shell, Tailwind utilities, the app's own
 * CSS. Fonts ride along only when the theme uses them.
 */
export async function buildStylesheet(input: StylesheetInput): Promise<Stylesheet> {
  const theme = readThemeCss(input.root);
  const shell = readShellCss(input.root);
  const candidates = classCandidates([...input.texts, input.appCss]);
  const withFonts = themeUsesFonts(input.theme);
  let utilities = "";
  let utilityFailed = false;
  try {
    utilities = await utilityCss(theme, candidates);
  } catch {
    utilityFailed = true;
  }
  const css = [
    themeCssFor(theme, input.lite, withFonts),
    pruneShellCss(shell, candidates),
    utilities,
    input.appCss.trim(),
  ]
    .filter(Boolean)
    .join("\n");
  return {
    css,
    fonts: withFonts ? readFonts(input.root) : new Map(),
    utilityFailed,
  };
}
