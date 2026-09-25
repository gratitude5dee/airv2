#!/usr/bin/env node
/**
 * R-ARCH-04 codemod: mechanical console.* → lib/log conversion.
 *
 *   node scripts/codemod-console-to-log.mjs [paths...] [--check]
 *
 * Paths default to apps/web/lib and apps/web/app. Only the fully
 * mechanical shape is rewritten:
 *
 *   console.<level>(JSON.stringify({ msg: "…", ...fields }))
 *     → log.<level>("…", { ...fields })
 *
 * Anything else — extra arguments, a non-`JSON.stringify` first arg, a
 * call the scanner cannot parse — is left alone and reported as skipped.
 * Rewritten files get `import { log } from "<rel>/lib/log"` (or
 * "@/lib/log" for app/) inserted after the last import.
 *
 * --check performs a dry run: prints the files that would change.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const WEB = join(ROOT, "apps", "web");
const LEVELS = {
  log: "info",
  info: "info",
  warn: "warn",
  error: "error",
  debug: "debug",
};
const CALL_RE = /\bconsole\.(log|info|warn|error|debug)\s*\(/g;

/** Walk a directory for .ts/.tsx sources, skipping tests and build output. */
function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) {
      if (entry === "node_modules" || entry === ".next") continue;
      yield* walk(path);
    } else if (
      /\.(ts|tsx)$/.test(entry) &&
      !entry.endsWith(".test.ts") &&
      !entry.endsWith(".test.tsx") &&
      !entry.endsWith(".d.ts")
    ) {
      yield path;
    }
  }
}

/** Index just past the string/template literal starting at `i`. */
function skipString(s, i) {
  const q = s[i];
  i += 1;
  while (i < s.length) {
    if (s[i] === "\\") {
      i += 2;
      continue;
    }
    if (s[i] === q) return i + 1;
    if (q === "`" && s[i] === "$" && s[i + 1] === "{") {
      i = matchDelim(s, i + 1, "{", "}");
      if (i === -1) return -1;
      continue;
    }
    i += 1;
  }
  return -1;
}

/**
 * Index of the `closeCh` matching the `openCh` at `openIdx`, or -1.
 * Strings, templates, and both comment kinds are skipped.
 */
function matchDelim(s, openIdx, openCh, closeCh) {
  let depth = 1;
  let i = openIdx + 1;
  while (i < s.length) {
    const c = s[i];
    const next = s[i + 1];
    if (c === "/" && next === "/") {
      while (i < s.length && s[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && next === "*") {
      i += 2;
      while (i < s.length && !(s[i] === "*" && s[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      i = skipString(s, i);
      if (i === -1) return -1;
      continue;
    }
    if (c === openCh) depth += 1;
    else if (c === closeCh) {
      depth -= 1;
      if (depth === 0) return i;
    }
    i += 1;
  }
  return -1;
}

/** First non-whitespace index at/after `i`. */
function skipSpace(s, i) {
  while (i < s.length && /\s/.test(s[i])) i += 1;
  return i;
}

/**
 * Pull the top-level `msg: <expr>` member out of an object literal.
 * Returns { msg, rest } — `rest` is the literal without that member.
 */
function splitMsg(objectText) {
  const inner = objectText.trim();
  if (!inner.startsWith("{")) return null;
  if (matchDelim(inner, 0, "{", "}") !== inner.length - 1) return null;
  let i = 1;
  const n = inner.length;
  while (i < n) {
    const c = inner[i];
    if (c === "/" && inner[i + 1] === "/") {
      while (i < n && inner[i] !== "\n") i += 1;
      continue;
    }
    if (c === "/" && inner[i + 1] === "*") {
      i += 2;
      while (i < n && !(inner[i] === "*" && inner[i + 1] === "/")) i += 1;
      i += 2;
      continue;
    }
    if (c === "'" || c === '"' || c === "`") {
      i = skipString(inner, i);
      if (i === -1) return null;
      continue;
    }
    if (c === "m" && /^msg\s*:/.test(inner.slice(i, i + 8))) {
      // Make sure `msg` is a top-level key, not part of another identifier.
      if (/[A-Za-z0-9_$]/.test(inner[i - 1] ?? "")) {
        i += 1;
        continue;
      }
      const keyStart = i;
      const vStart = skipSpace(inner, inner.indexOf(":", i) + 1);
      let j = vStart;
      let vdepth = 0;
      while (j < n) {
        const v = inner[j];
        const vn = inner[j + 1];
        if (v === "/" && vn === "/") {
          while (j < n && inner[j] !== "\n") j += 1;
          continue;
        }
        if (v === "/" && vn === "*") {
          j += 2;
          while (j < n && !(inner[j] === "*" && inner[j + 1] === "/")) j += 1;
          j += 2;
          continue;
        }
        if (v === "'" || v === '"' || v === "`") {
          j = skipString(inner, j);
          if (j === -1) return null;
          continue;
        }
        if (v === "(" || v === "[" || v === "{") vdepth += 1;
        else if (v === ")" || v === "]" || v === "}") {
          if (vdepth === 0) break; // the closing } of the object
          vdepth -= 1;
        }
        if (vdepth === 0 && v === ",") break;
        j += 1;
      }
      const msg = inner.slice(vStart, j).trim();
      const after = inner[j] === "," ? j + 1 : j;
      const rest = (inner.slice(0, keyStart) + inner.slice(after)).trim();
      return { msg, rest };
    }
    i += 1;
  }
  return null;
}

/** The import specifier for lib/log relative to a converted file. */
function logSpecifier(file) {
  const relWeb = relative(WEB, file);
  if (relWeb === "lib/log.ts") return null;
  if (relWeb.startsWith("lib/")) {
    const rel = relative(dirname(file), join(WEB, "lib", "log"));
    return rel.startsWith(".") ? rel : "./" + rel;
  }
  return "@/lib/log";
}

/** Insert `import { log } from "<spec>";` after the last import statement. */
function addImport(source, file) {
  const spec = logSpecifier(file);
  if (!spec) return source;
  if (/import\s*\{[^}]*\blog\b[^}]*\}\s*from\s*["'][^"']*\/log["']/.test(source))
    return source;
  const line = `import { log } from "${spec}";\n`;
  const importRe = /^import[\s\S]*?from\s*["'][^"']+["'];?\s*$/gm;
  let lastEnd = -1;
  for (const m of source.matchAll(importRe)) lastEnd = m.index + m[0].length;
  if (lastEnd === -1) {
    // No imports: a "use client"/"use server" directive must stay first.
    const directive = source.match(/^(?:\s*["']use (?:client|server)["'];?)+/);
    if (directive) {
      const at = directive[0].length;
      return directive[0] + "\n" + line + source.slice(at);
    }
    return line + source;
  }
  return (
    source.slice(0, lastEnd) +
    (source[lastEnd] === "\n" ? "" : "\n") +
    line +
    source.slice(lastEnd)
  );
}

function transform(source, file) {
  const out = [];
  const skipped = [];
  let converted = 0;
  let cursor = 0;
  for (const match of source.matchAll(CALL_RE)) {
    const level = LEVELS[match[1]];
    const openParen = source.indexOf("(", match.index);
    const closeParen = matchDelim(source, openParen, "(", ")");
    if (closeParen === -1) {
      skipped.push(`unbalanced console.${match[1]} call @${match.index}`);
      continue;
    }
    const argStart = skipSpace(source, openParen + 1);
    if (!source.startsWith("JSON.stringify", argStart)) {
      skipped.push(`non-JSON.stringify console.${match[1]} @${match.index}`);
      continue;
    }
    const innerOpen = source.indexOf("(", argStart);
    const innerClose = matchDelim(source, innerOpen, "(", ")");
    const tail = source.slice(innerClose + 1, closeParen).trim();
    if (innerClose === -1 || tail.replace(/,$/, "").trim() !== "") {
      skipped.push(`extra arguments @${match.index}`);
      continue;
    }
    const objectText = source.slice(innerOpen + 1, innerClose).trim();
    const parts = splitMsg(objectText);
    let replacement;
    if (parts) {
      const fields = parts.rest
        .replace(/^\{/, "")
        .replace(/\}$/, "")
        .trim();
      replacement =
        fields.length > 0
          ? `log.${level}(${parts.msg}, {${fields}})`
          : `log.${level}(${parts.msg})`;
    } else {
      replacement = `log.${level}(${objectText})`;
    }
    out.push(source.slice(cursor, match.index), replacement);
    cursor = closeParen + 1;
    converted += 1;
  }
  if (converted === 0) return { source, converted, skipped };
  out.push(source.slice(cursor));
  return { source: addImport(out.join(""), file), converted, skipped };
}

const argv = process.argv.slice(2);
const check = argv.includes("--check");
const paths = argv.filter((a) => a !== "--check");
const targets =
  paths.length > 0 ? paths.map((p) => join(ROOT, p)) : [join(WEB, "lib"), join(WEB, "app")];

let changedFiles = 0;
let totalConverted = 0;
const skippedAll = [];
for (const target of targets) {
  const stat = statSync(target, { throwIfNoEntry: false });
  if (!stat) {
    console.error(`not found: ${target}`);
    continue;
  }
  const files = stat.isDirectory() ? [...walk(target)] : [target];
  for (const file of files) {
    const source = readFileSync(file, "utf8");
    CALL_RE.lastIndex = 0;
    if (!CALL_RE.test(source)) continue;
    CALL_RE.lastIndex = 0;
    const { source: next, converted, skipped } = transform(source, file);
    for (const s of skipped) skippedAll.push(`${relative(ROOT, file)}: ${s}`);
    if (converted === 0) continue;
    changedFiles += 1;
    totalConverted += converted;
    if (!check) writeFileSync(file, next);
  }
}
console.log(
  `${check ? "would convert" : "converted"} ${totalConverted} console.* site(s) across ${changedFiles} file(s)`
);
for (const s of skippedAll) console.log(`skipped: ${s}`);
