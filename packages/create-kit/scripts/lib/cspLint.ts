/**
 * CSP / webview lint over Kit component files (goal-create-v11 §8.2, CR12).
 *
 * `apps/web/lib/create/lint.ts` did not exist on `main` when this was written,
 * so the §8.2 rule set is implemented here. When MC4 lands the platform linter,
 * import it from there and delete the duplicate rules (see DESIGN.md
 * "Reconciliation").
 *
 * Hard findings reject a component; soft findings are recorded in meta.json
 * (`csp.soft`) for the agent to act on.
 */

export type Severity = "hard" | "soft";

export interface Finding {
  readonly file: string;
  readonly line: number;
  readonly rule: string;
  readonly severity: Severity;
  readonly hint: string;
}

/** Identifiers that look like hosts but never hit the network. */
const HOST_ALLOWLIST: readonly RegExp[] = [
  /https?:\/\/www\.w3\.org\/(?:2000\/svg|1999\/xlink|1998\/Math\/MathML|XML\/1998\/namespace)/g,
  /http%3A%2F%2Fwww\.w3\.org%2F2000%2Fsvg/g,
  /http:\/\/www\.w3\.org\/2000\/svg/g,
];

const HOST_RE = /https?:\/\/[a-z0-9.-]+(?::\d+)?(?:\/[^\s"'`)]*)?/gi;
const PROTOCOL_RELATIVE_RE = /(?:src|href|url\()\s*=?\s*["'(]\/\/[a-z0-9.-]+/gi;
const STORAGE_RE = /\b(localStorage|sessionStorage|indexedDB)\b/g;
const COOKIE_RE = /document\.cookie/g;
const EVAL_RE = /(?<![.\w$])eval\s*\(/g;
const NEW_FUNCTION_RE = /\bnew\s+Function\s*\(/g;
const META_HTTP_EQUIV_RE = /<meta[^>]+http-equiv/gi;
const IFRAME_RE = /<(iframe|frame|embed|object)\b/gi;
const SERVICE_WORKER_RE = /navigator\.serviceWorker|importScripts\s*\(/g;
const INLINE_HANDLER_RE = /<[a-z][^>]*\s(on[a-z]+)\s*=\s*["']/gi;
const INNER_HTML_RE = /dangerouslySetInnerHTML|\.innerHTML\s*=|\.outerHTML\s*=|insertAdjacentHTML\s*\(/g;
const FONT_IMPORT_RE = /@import\s+url\(|@import\s+["']https?:|<link[^>]+rel=["']stylesheet/gi;
const BASE64_RE = /data:[a-z/+.-]+;base64,([A-Za-z0-9+/=]+)/g;
const BASE64_MAX = 2 * 1024 * 1024;
const WEBGL_RE = /getContext\(\s*["'](webgl2?|experimental-webgl)["']|from\s+["'](three|ogl|@react-three\/[a-z-]+|@paper-design\/shaders)["']/g;

function lineOf(text: string, index: number): number {
  let line = 1;
  for (let i = 0; i < index && i < text.length; i++) if (text.charCodeAt(i) === 10) line++;
  return line;
}

function stripAllowlisted(text: string): string {
  let out = text;
  for (const re of HOST_ALLOWLIST) out = out.replace(re, (m) => " ".repeat(m.length));
  return out;
}

function collect(
  file: string,
  text: string,
  re: RegExp,
  rule: string,
  severity: Severity,
  hint: string,
  out: Finding[]
): void {
  re.lastIndex = 0;
  for (const m of text.matchAll(re)) {
    out.push({ file, line: lineOf(text, m.index ?? 0), rule, severity, hint });
  }
}

export interface LintOptions {
  /** `lite` components may not touch WebGL at all; non-lite ones get a soft note. */
  readonly lite?: boolean;
}

export function lintFile(file: string, raw: string, opts: LintOptions = {}): Finding[] {
  const out: Finding[] = [];
  const text = stripAllowlisted(raw);
  const isMarkup = /\.(html?|svg)$/i.test(file);

  collect(file, text, HOST_RE, "host-reference", "hard", "Remove the URL; ship the asset in the bundle or take it as a prop.", out);
  collect(file, text, PROTOCOL_RELATIVE_RE, "host-reference", "hard", "Protocol-relative URL reaches a host; use a bundled asset.", out);
  collect(file, text, STORAGE_RE, "client-storage", "hard", "All mini-apps share the mini origin; keep state in useAirState() (Apps API), never in the browser.", out);
  collect(file, text, COOKIE_RE, "client-storage", "hard", "document.cookie is off-limits; the session cookie is HttpOnly and state lives in the Apps API.", out);
  collect(file, text, EVAL_RE, "eval", "hard", "script-src 'self' has no 'unsafe-eval'; replace eval() with data.", out);
  collect(file, text, NEW_FUNCTION_RE, "eval", "hard", "new Function() needs 'unsafe-eval'; replace with a plain function.", out);
  collect(file, text, META_HTTP_EQUIV_RE, "meta-http-equiv", "hard", "The platform sets CSP headers; <meta http-equiv> is rejected by the bundle validator.", out);
  collect(file, text, IFRAME_RE, "frame", "hard", "frame-src is 'none' under the CSP ceiling; render the content inline.", out);
  collect(file, text, SERVICE_WORKER_RE, "service-worker", "hard", "Service workers are rejected by the bundle validator (shared origin).", out);
  collect(file, text, FONT_IMPORT_RE, "external-style", "hard", "style-src/font-src are 'self'; import Kit CSS relatively and use the self-hosted Air fonts.", out);
  if (isMarkup) {
    collect(file, text, INLINE_HANDLER_RE, "inline-handler", "soft", "Inline on*= handlers run under 'unsafe-inline' only; attach listeners from the module.", out);
  }
  collect(file, text, INNER_HTML_RE, "raw-html", "soft", "Raw HTML injection; make sure the string is not user-controlled.", out);

  BASE64_RE.lastIndex = 0;
  for (const m of text.matchAll(BASE64_RE)) {
    const payload = m[1] ?? "";
    if (payload.length * 0.75 > BASE64_MAX) {
      out.push({ file, line: lineOf(text, m.index ?? 0), rule: "base64-blob", severity: "hard", hint: "Inline blob over 2 MiB; ship it as a file." });
    }
  }

  WEBGL_RE.lastIndex = 0;
  for (const m of text.matchAll(WEBGL_RE)) {
    out.push({
      file,
      line: lineOf(text, m.index ?? 0),
      rule: "webgl",
      severity: opts.lite ? "hard" : "soft",
      hint: opts.lite ? "lite components cannot use WebGL (surface.lite disables it)." : "WebGL: component must stay non-lite and degrade to a static frame.",
    });
  }
  return out;
}

export function hardFindings(findings: readonly Finding[]): Finding[] {
  return findings.filter((f) => f.severity === "hard");
}
