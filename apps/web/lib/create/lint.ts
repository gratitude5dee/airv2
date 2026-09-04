/**
 * V11 §8.2 CSP linter. A Drop is served under the publisher CSP ceiling
 * (`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
 * connect-src 'self'`, CR12), so anything the ceiling forbids is caught here
 * before a version exists: external scripts, styles, fonts and frames, client
 * storage, and `eval`. Those are hard findings and reject the Drop. Inline
 * event handlers, `<meta http-equiv>`, oversized base64 blobs and dangling
 * relative references are soft: they ride along on the version row for the
 * agent to act on. The linter reports; it never rewrites the owner's files.
 */
import { bundleContentType, type BundleFile } from "../miniapps/bundles";

export type FindingSeverity = "hard" | "soft";

export type LintRule =
  | "external-script"
  | "external-style"
  | "external-font"
  | "external-frame"
  | "client-storage"
  | "eval"
  | "meta-http-equiv"
  | "inline-handler"
  | "large-data-uri"
  | "dangling-ref";

export interface LintFinding {
  file: string;
  line: number;
  rule: LintRule;
  severity: FindingSeverity;
  hint: string;
}

export class LintError extends Error {
  readonly status: number;
  readonly findings: LintFinding[];
  constructor(findings: LintFinding[]) {
    const hard = findings.filter((finding) => finding.severity === "hard");
    const [first] = hard;
    super(
      first
        ? `${first.file}:${first.line} ${first.rule}: ${first.hint}` +
            (hard.length > 1 ? ` (+${hard.length - 1} more)` : "")
        : "bundle failed the CSP lint"
    );
    this.name = "LintError";
    this.status = 400;
    this.findings = findings;
  }
}

export const LARGE_DATA_URI_BYTES = 2 * 1024 * 1024;

const HARD_RULES: ReadonlySet<LintRule> = new Set<LintRule>([
  "external-script",
  "external-style",
  "external-font",
  "external-frame",
  "client-storage",
  "eval",
]);

const HINTS: Record<LintRule, string> = {
  "external-script":
    "copy the script into the bundle and load it with a relative path; the CSP allows script-src 'self' only",
  "external-style":
    "copy the stylesheet into the bundle and link it relatively; the CSP allows style-src 'self' only",
  "external-font":
    "ship the font file (.woff2) in the bundle; the CSP allows font-src 'self' only",
  "external-frame":
    "remove the third-party iframe; the CSP allows no external frames",
  "client-storage":
    "keep state in memory or in the app's own backend; localStorage, sessionStorage and indexedDB are not available",
  eval: "replace eval/new Function with plain code; the CSP has no 'unsafe-eval'",
  "meta-http-equiv":
    "remove the <meta http-equiv> tag; response headers are set by the platform and cannot be overridden",
  "inline-handler":
    "move the handler into a script file with addEventListener; inline handlers are allowed but harder to review",
  "large-data-uri":
    "save the base64 blob as a file in the bundle and reference it by path; inline data over 2 MiB slows every load",
  "dangling-ref":
    "add the referenced file to the bundle or fix the path; nothing in the bundle matches it",
};

const HTML_RE = /^text\/html/;
const CSS_RE = /^text\/css/;
const JS_RE = /^text\/javascript/;

function lineAt(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i += 1) {
    if (text.charCodeAt(i) === 10) line += 1;
  }
  return line;
}

function isExternal(url: string): boolean {
  return /^(?:https?:)?\/\//i.test(url.trim());
}

function attr(tag: string, name: string): string | null {
  const match = new RegExp(
    `(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s"'>]+))`,
    "i"
  ).exec(tag);
  if (!match) return null;
  return match[1] ?? match[2] ?? match[3] ?? "";
}

interface Collector {
  file: string;
  text: string;
  findings: LintFinding[];
}

function report(
  collector: Collector,
  rule: LintRule,
  index: number,
  hint = HINTS[rule]
): void {
  collector.findings.push({
    file: collector.file,
    line: lineAt(collector.text, index),
    rule,
    severity: HARD_RULES.has(rule) ? "hard" : "soft",
    hint,
  });
}

const STORAGE_RE = /\b(?:localStorage|sessionStorage|indexedDB)\b/g;
const EVAL_RE = /\beval\s*\(|\bnew\s+Function\s*\(/g;
const DATA_URI_RE = /data:[a-z0-9.+/-]+;base64,([A-Za-z0-9+/=]+)/gi;
const IMPORT_URL_RE = /@import\s+(?:url\(\s*)?["']?([^"')\s]+)/gi;
const CSS_URL_RE = /url\(\s*["']?([^"')\s]+)["']?\s*\)/gi;
const FONT_FACE_RE = /@font-face\s*\{[^}]*\}/gi;
const JS_IMPORT_RE =
  /\bimport\s*(?:[^'";]*?\bfrom\s*)?["']((?:https?:)?\/\/[^"']+)["']|\bimport\s*\(\s*["']((?:https?:)?\/\/[^"']+)["']/gi;

function lintScriptText(collector: Collector, text: string, base: number): void {
  for (const match of text.matchAll(STORAGE_RE)) {
    report(collector, "client-storage", base + (match.index ?? 0));
  }
  for (const match of text.matchAll(EVAL_RE)) {
    report(collector, "eval", base + (match.index ?? 0));
  }
  for (const match of text.matchAll(JS_IMPORT_RE)) {
    report(collector, "external-script", base + (match.index ?? 0));
  }
}

function lintStyleText(collector: Collector, text: string, base: number): void {
  const importRanges: Array<[number, number]> = [];
  for (const match of text.matchAll(IMPORT_URL_RE)) {
    const start = match.index ?? 0;
    importRanges.push([start, start + match[0].length]);
    if (match[1] && isExternal(match[1])) {
      report(collector, "external-style", base + start);
    }
  }
  const fontRanges: Array<[number, number]> = [];
  for (const face of text.matchAll(FONT_FACE_RE)) {
    const start = face.index ?? 0;
    fontRanges.push([start, start + face[0].length]);
  }
  for (const match of text.matchAll(CSS_URL_RE)) {
    const url = match[1] ?? "";
    if (!isExternal(url)) continue;
    const at = match.index ?? 0;
    if (importRanges.some(([s, e]) => at >= s && at < e)) continue;
    const inFontFace = fontRanges.some(([s, e]) => at >= s && at < e);
    report(
      collector,
      inFontFace ? "external-font" : "external-style",
      base + at
    );
  }
}

function lintDataUris(collector: Collector, text: string): void {
  for (const match of text.matchAll(DATA_URI_RE)) {
    const payload = match[1] ?? "";
    // 4 base64 chars encode 3 bytes; padding rounds down.
    const bytes = Math.floor((payload.length * 3) / 4);
    if (bytes > LARGE_DATA_URI_BYTES) {
      report(collector, "large-data-uri", match.index ?? 0);
    }
  }
}

const TAG_RE = /<(script|link|iframe|frame|meta|style)\b[^>]*>/gi;
const SCRIPT_BLOCK_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const INLINE_HANDLER_RE = /<[a-z][^>]*\s(on[a-z]+)\s*=/gi;
const REF_ATTR_RE =
  /<(?:script|link|img|source|audio|video|a)\b[^>]*?\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

function isStylesheetLink(tag: string): boolean {
  const rel = (attr(tag, "rel") ?? "").toLowerCase();
  const as = (attr(tag, "as") ?? "").toLowerCase();
  return rel.includes("stylesheet") || (rel.includes("preload") && as === "style");
}

function isFontLink(tag: string): boolean {
  const rel = (attr(tag, "rel") ?? "").toLowerCase();
  const as = (attr(tag, "as") ?? "").toLowerCase();
  return rel.includes("preload") && as === "font";
}

function lintHtml(collector: Collector, paths: ReadonlySet<string>): void {
  const { text } = collector;
  for (const match of text.matchAll(TAG_RE)) {
    const tag = match[0];
    const name = (match[1] ?? "").toLowerCase();
    const at = match.index ?? 0;
    if (name === "script") {
      const src = attr(tag, "src");
      if (src && isExternal(src)) report(collector, "external-script", at);
    } else if (name === "link") {
      const href = attr(tag, "href");
      if (href && isExternal(href)) {
        if (isStylesheetLink(tag)) report(collector, "external-style", at);
        else if (isFontLink(tag)) report(collector, "external-font", at);
      }
    } else if (name === "iframe" || name === "frame") {
      const src = attr(tag, "src");
      if (src && isExternal(src)) report(collector, "external-frame", at);
    } else if (name === "meta") {
      if (attr(tag, "http-equiv") !== null) {
        report(collector, "meta-http-equiv", at);
      }
    }
  }
  for (const match of text.matchAll(SCRIPT_BLOCK_RE)) {
    const body = match[2] ?? "";
    const open = match[0].indexOf(">") + 1;
    lintScriptText(collector, body, (match.index ?? 0) + open);
  }
  for (const match of text.matchAll(STYLE_BLOCK_RE)) {
    const body = match[1] ?? "";
    const open = match[0].indexOf(">") + 1;
    lintStyleText(collector, body, (match.index ?? 0) + open);
  }
  for (const match of text.matchAll(INLINE_HANDLER_RE)) {
    report(
      collector,
      "inline-handler",
      match.index ?? 0,
      `${(match[1] ?? "").toLowerCase()}: ${HINTS["inline-handler"]}`
    );
  }
  lintDataUris(collector, text);
  lintDanglingRefs(collector, paths);
}

function resolveRelative(from: string, ref: string): string | null {
  const clean = ref.split(/[?#]/)[0] ?? "";
  if (clean === "" || clean.startsWith("/")) return null;
  const dir = from.includes("/") ? from.slice(0, from.lastIndexOf("/") + 1) : "";
  const segments: string[] = [];
  for (const part of `${dir}${clean}`.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (segments.length === 0) return null;
      segments.pop();
      continue;
    }
    segments.push(part);
  }
  return segments.join("/");
}

/** A relative `src`/`href` on a resource tag that matches nothing in the bundle. */
function lintDanglingRefs(collector: Collector, paths: ReadonlySet<string>): void {
  const { text } = collector;
  for (const match of text.matchAll(REF_ATTR_RE)) {
    const ref = (match[1] ?? match[2] ?? "").trim();
    if (
      ref === "" ||
      ref.startsWith("#") ||
      ref.startsWith("/") ||
      /^[a-z][a-z0-9+.-]*:/i.test(ref) ||
      isExternal(ref)
    ) {
      continue;
    }
    const resolved = resolveRelative(collector.file, ref);
    if (resolved === null || resolved === "") continue;
    // Anchors to other pages count only when they look like a file.
    if (match[0].toLowerCase().startsWith("<a") && !/\.[a-z0-9]{1,5}$/i.test(resolved)) {
      continue;
    }
    if (!paths.has(resolved)) {
      report(
        collector,
        "dangling-ref",
        match.index ?? 0,
        `${ref}: ${HINTS["dangling-ref"]}`
      );
    }
  }
}

/** Lint every text file in an already-validated bundle. Never throws. */
export function lintBundle(files: BundleFile[]): LintFinding[] {
  const paths = new Set(files.map((file) => file.path));
  const findings: LintFinding[] = [];
  for (const file of files) {
    const type = bundleContentType(file.path);
    if (!type) continue;
    const collector: Collector = {
      file: file.path,
      text: file.bytes.toString("utf8"),
      findings,
    };
    if (HTML_RE.test(type)) {
      lintHtml(collector, paths);
    } else if (CSS_RE.test(type)) {
      lintStyleText(collector, collector.text, 0);
      lintDataUris(collector, collector.text);
    } else if (JS_RE.test(type)) {
      lintScriptText(collector, collector.text, 0);
      lintDataUris(collector, collector.text);
    }
  }
  return findings;
}

export function hardFindings(findings: LintFinding[]): LintFinding[] {
  return findings.filter((finding) => finding.severity === "hard");
}

export function softFindings(findings: LintFinding[]): LintFinding[] {
  return findings.filter((finding) => finding.severity === "soft");
}

/**
 * Lint and enforce CR12: throws a `LintError` (one-line reason, every hard
 * finding attached) when the bundle cannot be served under the ceiling;
 * otherwise returns the soft findings for the version row.
 */
export function enforceCsp(files: BundleFile[]): LintFinding[] {
  const findings = lintBundle(files);
  if (hardFindings(findings).length > 0) throw new LintError(findings);
  return findings;
}
