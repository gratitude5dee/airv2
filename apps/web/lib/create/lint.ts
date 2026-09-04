/**
 * V11 §8.2 CSP linter. A Drop is served under the publisher CSP ceiling
 * (`default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline';
 * connect-src 'self'`, CR12), so anything the ceiling forbids is caught here
 * before a version exists: external scripts, styles, fonts and frames, client
 * storage, and `eval`. Those are hard findings and reject the Drop. Inline
 * scripts and event handlers (script-src 'self' has no 'unsafe-inline'),
 * bundled frames (frame-src falls back to default-src 'none'), off-origin
 * media, `<meta http-equiv>`, oversized base64 blobs and dangling relative
 * references are soft: the page stages and the finding tells the owner what
 * will not load and why (§8.4). The linter reports; it never rewrites the
 * owner's files.
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
  | "inline-script"
  | "inline-handler"
  | "bundled-frame"
  | "large-data-uri"
  | "external-media"
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
  "inline-script":
    "move the code into a .js file in the bundle and load it with <script src>; script-src 'self' does not run inline scripts",
  "inline-handler":
    "move the handler into a script file with addEventListener; script-src 'self' does not run inline handlers",
  "bundled-frame":
    "render the page's content directly instead of framing it; the CSP allows no frames at all (frame-src falls back to default-src 'none')",
  "large-data-uri":
    "save the base64 blob as a file in the bundle and reference it by path; inline data over 2 MiB slows every load",
  "external-media":
    "ship the image/audio/video in the bundle or host it on the platform media origin; img-src and media-src allow no other hosts",
  "dangling-ref":
    "add the referenced file to the bundle or fix the path; nothing in the bundle matches it",
};

/** Image origins the publisher CSP admits besides 'self' and data: (§14.1). */
export function allowedImageOrigins(): string[] {
  const configured = process.env["R2_PUBLIC_BASE_URL"];
  return ["https://media.wzrd.tech", ...(configured ? [configured] : [])].map(
    (origin) => origin.replace(/\/+$/, "").toLowerCase()
  );
}

function isAllowedImage(url: string): boolean {
  const lower = url.trim().toLowerCase();
  return allowedImageOrigins().some(
    (origin) => lower === origin || lower.startsWith(`${origin}/`)
  );
}

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

/** Overwrite `[from, to)` with spaces, keeping newlines so line numbers hold. */
function blankRange(out: string[], from: number, to: number): void {
  for (let i = from; i < to; i += 1) {
    if (out[i] !== "\n") out[i] = " ";
  }
}

/**
 * Blank JS comments and, unless `strings` is false, string/template literal
 * text (keeping newlines and `${…}` expressions) so identifiers mentioned in
 * prose are not linted as calls. Strings are always tracked so a `//` inside
 * a URL literal never starts a comment. Regex literals are left as-is: `/`
 * vs division is not decidable without a parser, and a false hit there is
 * rare.
 */
export function blankCommentsAndStrings(source: string, strings = true): string {
  const out = source.split("");
  const blank = (from: number, to: number): void => {
    blankRange(out, from, to);
  };
  const blankText = strings ? blank : () => undefined;
  const n = source.length;
  let i = 0;
  const templateDepth: number[] = [];
  while (i < n) {
    const ch = source[i];
    const next = source[i + 1];
    if (ch === "/" && next === "/") {
      const end = source.indexOf("\n", i);
      const stop = end === -1 ? n : end;
      blank(i, stop);
      i = stop;
    } else if (ch === "/" && next === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      blank(i, stop);
      i = stop;
    } else if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && source[j] !== ch && source[j] !== "\n") {
        if (source[j] === "\\") j += 1;
        j += 1;
      }
      blankText(i + 1, Math.min(j, n));
      i = j + 1;
    } else if (ch === "`") {
      // Template text is blanked up to the next `${` or closing backtick;
      // the expression inside `${…}` is scanned like ordinary code.
      let j = i + 1;
      while (j < n && source[j] !== "`") {
        if (source[j] === "\\") {
          j += 2;
          continue;
        }
        if (source[j] === "$" && source[j + 1] === "{") {
          templateDepth.push(0);
          break;
        }
        j += 1;
      }
      blankText(i + 1, Math.min(j, n));
      i = templateDepth.length > 0 && source[j] === "$" ? j + 2 : j + 1;
    } else if (templateDepth.length > 0 && ch === "{") {
      const last = templateDepth.length - 1;
      templateDepth[last] = (templateDepth[last] ?? 0) + 1;
      i += 1;
    } else if (templateDepth.length > 0 && ch === "}") {
      const depth = templateDepth[templateDepth.length - 1] ?? 0;
      if (depth === 0) {
        // Back inside the template text: blank until the next `${` or the
        // closing backtick.
        templateDepth.pop();
        let j = i + 1;
        let reopened = false;
        while (j < n && source[j] !== "`") {
          if (source[j] === "\\") {
            j += 2;
            continue;
          }
          if (source[j] === "$" && source[j + 1] === "{") {
            reopened = true;
            break;
          }
          j += 1;
        }
        blankText(i + 1, Math.min(j, n));
        if (reopened) {
          templateDepth.push(0);
          i = j + 2;
        } else {
          i = j + 1;
        }
      } else {
        templateDepth[templateDepth.length - 1] = depth - 1;
        i += 1;
      }
    } else {
      i += 1;
    }
  }
  return out.join("");
}

/**
 * Blank `/* … *\/` comments in CSS. Quoted strings are skipped, not blanked,
 * and `//` is never a comment here (it is how `url(//cdn…)` starts).
 */
export function blankCssComments(source: string): string {
  const out = source.split("");
  const n = source.length;
  let i = 0;
  while (i < n) {
    const ch = source[i];
    if (ch === '"' || ch === "'") {
      let j = i + 1;
      while (j < n && source[j] !== ch && source[j] !== "\n") {
        if (source[j] === "\\") j += 1;
        j += 1;
      }
      i = j + 1;
    } else if (ch === "/" && source[i + 1] === "*") {
      const end = source.indexOf("*/", i + 2);
      const stop = end === -1 ? n : end + 2;
      blankRange(out, i, stop);
      i = stop;
    } else {
      i += 1;
    }
  }
  return out.join("");
}

const RAW_TEXT_OPEN_RE = /^<(script|style)(?=[\s/>])/i;

/**
 * Blank `<!-- … -->` in HTML. `<script>` and `<style>` bodies are raw text
 * to the parser (a `<!--` inside them is code, not markup), so they are
 * skipped here and left to their own comment rules.
 */
export function blankHtmlComments(source: string): string {
  const out = source.split("");
  const lower = source.toLowerCase();
  const n = source.length;
  let i = 0;
  while (i < n) {
    if (source[i] !== "<") {
      i += 1;
      continue;
    }
    if (source.startsWith("<!--", i)) {
      const end = source.indexOf("-->", i + 4);
      const stop = end === -1 ? n : end + 3;
      blankRange(out, i, stop);
      i = stop;
      continue;
    }
    const open = RAW_TEXT_OPEN_RE.exec(source.slice(i, i + 8));
    if (open) {
      const close = `</${(open[1] ?? "").toLowerCase()}`;
      const end = lower.indexOf(close, i + open[0].length);
      i = end === -1 ? n : end + close.length;
      continue;
    }
    i += 1;
  }
  return out.join("");
}

function lintScriptText(collector: Collector, source: string, base: number): void {
  const code = blankCommentsAndStrings(source);
  for (const match of code.matchAll(STORAGE_RE)) {
    report(collector, "client-storage", base + (match.index ?? 0));
  }
  for (const match of code.matchAll(EVAL_RE)) {
    report(collector, "eval", base + (match.index ?? 0));
  }
  // Import specifiers live in string literals, so only comments go.
  const literals = blankCommentsAndStrings(source, false);
  for (const match of literals.matchAll(JS_IMPORT_RE)) {
    report(collector, "external-script", base + (match.index ?? 0));
  }
}

function lintStyleText(collector: Collector, source: string, base: number): void {
  const text = blankCssComments(source);
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

const TAG_RE = /<(script|link|iframe|frame|meta|style|img|source|audio|video|track)\b[^>]*>/gi;
const SRCSET_URL_RE = /(?:^|,)\s*(\S+)/g;
const SCRIPT_BLOCK_RE = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const STYLE_BLOCK_RE = /<style\b[^>]*>([\s\S]*?)<\/style\s*>/gi;
const INLINE_HANDLER_RE = /<[a-z][^>]*\s(on[a-z]+)\s*=/gi;
const REF_ATTR_RE =
  /<(?:script|link|img|source|audio|video|a)\b[^>]*?\s(?:src|href)\s*=\s*(?:"([^"]*)"|'([^']*)')/gi;

/** `type` values whose body the browser executes as script (data blocks do not). */
function isScriptType(type: string | null): boolean {
  const value = (type ?? "").trim().toLowerCase();
  return (
    value === "" ||
    value === "module" ||
    value === "importmap" ||
    /^(?:text|application)\/(?:x-)?(?:java|ecma)script$/.test(value)
  );
}

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
  const text = blankHtmlComments(collector.text);
  for (const match of text.matchAll(TAG_RE)) {
    const tag = match[0];
    const name = (match[1] ?? "").toLowerCase();
    const at = match.index ?? 0;
    if (name === "script") {
      const src = attr(tag, "src");
      if (src && isExternal(src)) report(collector, "external-script", at);
      if (src === null && isScriptType(attr(tag, "type"))) {
        const end = text.indexOf("</script", at + tag.length);
        const body = text.slice(at + tag.length, end === -1 ? undefined : end);
        if (body.trim() !== "") report(collector, "inline-script", at);
      }
    } else if (name === "link") {
      const href = attr(tag, "href");
      if (href && isExternal(href)) {
        if (isStylesheetLink(tag)) report(collector, "external-style", at);
        else if (isFontLink(tag)) report(collector, "external-font", at);
      }
    } else if (name === "iframe" || name === "frame") {
      const src = attr(tag, "src");
      if (src && isExternal(src)) report(collector, "external-frame", at);
      else if (src && src.trim() !== "" && !/^about:/i.test(src.trim())) {
        report(collector, "bundled-frame", at);
      }
    } else if (name === "meta") {
      if (attr(tag, "http-equiv") !== null) {
        report(collector, "meta-http-equiv", at);
      }
    } else {
      lintMediaTag(collector, tag, name, at);
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
  lintDanglingRefs(collector, text, paths);
}

/**
 * `<img>`, `<source>`, `<audio>`, `<video>`, `<track>` (and `<video poster>`)
 * pointing off-origin: img-src admits only 'self', data: and the platform
 * media origin; media-src only 'self'. Soft — the page still stages, the
 * resource just will not load.
 */
function lintMediaTag(collector: Collector, tag: string, name: string, at: number): void {
  const urls: string[] = [];
  const src = attr(tag, "src");
  if (src) urls.push(src);
  const poster = attr(tag, "poster");
  if (poster) urls.push(poster);
  const srcset = attr(tag, "srcset");
  if (srcset) {
    for (const match of srcset.matchAll(SRCSET_URL_RE)) {
      if (match[1]) urls.push(match[1]);
    }
  }
  // A <source> is an image when it sits in <picture> (srcset / image type);
  // with a bare src or an audio/video type it is media-src territory.
  const imageLike =
    name === "img" ||
    (name === "source" &&
      (srcset !== null || /^image\//i.test(attr(tag, "type") ?? "")));
  for (const url of urls) {
    if (!isExternal(url)) continue;
    if ((imageLike || url === poster) && isAllowedImage(url)) continue;
    report(collector, "external-media", at, `${url}: ${HINTS["external-media"]}`);
    return;
  }
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
function lintDanglingRefs(
  collector: Collector,
  text: string,
  paths: ReadonlySet<string>
): void {
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
      lintDataUris(collector, blankCssComments(collector.text));
    } else if (JS_RE.test(type)) {
      lintScriptText(collector, collector.text, 0);
      lintDataUris(collector, blankCommentsAndStrings(collector.text, false));
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
