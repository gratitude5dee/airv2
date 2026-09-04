/**
 * Upstream capture. Every byte the Kit normalizes is first written verbatim to
 * `evidence/<source>/upstream/…` so the lock's `upstream` sha256 is checkable
 * offline and a re-harvest is a pure function of the committed captures.
 *
 * Network is touched only with `--refresh` (or when a capture is missing).
 */
import path from "node:path";
import { EVIDENCE_DIR } from "./paths.ts";
import { exists, readJson, readText, sha256, writeJson, writeText } from "./fsx.ts";
import type { GithubPin, SourceSpec } from "./sources.ts";

export interface CaptureRecord {
  readonly url: string;
  readonly capturedAt: string;
  readonly sha256: string;
  readonly files: readonly string[];
}

export interface CaptureOptions {
  readonly refresh: boolean;
  readonly log: (line: string) => void;
}

export function upstreamDir(spec: SourceSpec): string {
  return path.join(EVIDENCE_DIR, spec.id, "upstream");
}

/** Files above `base` (e.g. a repo-root LICENSE reached via `../`) are kept inside upstream/ under `__up__/`. */
export function upstreamPath(spec: SourceSpec, file: string): string {
  const parts = file.split("/");
  let up = 0;
  while (parts[0] === "..") {
    parts.shift();
    up++;
  }
  return path.join(upstreamDir(spec), ...Array<string>(up).fill("__up__"), ...parts);
}

async function get(url: string): Promise<string> {
  const res = await fetch(url, { headers: { "user-agent": "air-create-kit-harvest" }, redirect: "follow" });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return await res.text();
}

function captureIndexPath(spec: SourceSpec): string {
  return path.join(EVIDENCE_DIR, spec.id, "capture.json");
}

function readIndex(spec: SourceSpec): Record<string, CaptureRecord> {
  const p = captureIndexPath(spec);
  return exists(p) ? readJson<Record<string, CaptureRecord>>(p) : {};
}

function writeIndex(spec: SourceSpec, index: Record<string, CaptureRecord>): void {
  const sorted: Record<string, CaptureRecord> = {};
  for (const k of Object.keys(index).sort()) sorted[k] = index[k]!;
  writeJson(captureIndexPath(spec), sorted);
}

export function rawGithubUrl(pin: GithubPin, file: string): string {
  const full = path.posix.normalize(path.posix.join(pin.base, file));
  return `https://raw.githubusercontent.com/${pin.repo}/${pin.commit}/${full}`;
}

/** Capture files from a pinned GitHub commit. `files` are relative to `pin.base`. */
export async function captureGithub(
  spec: SourceSpec,
  files: readonly string[],
  opts: CaptureOptions
): Promise<void> {
  if (spec.pin.kind !== "github") throw new Error(`${spec.id} is not a github source`);
  const index = readIndex(spec);
  for (const file of files) {
    const dest = upstreamPath(spec, file);
    if (exists(dest) && !opts.refresh) continue;
    const url = rawGithubUrl(spec.pin, file);
    opts.log(`fetch ${url}`);
    const text = await get(url);
    writeText(dest, text);
    index[file] = { url, capturedAt: today(), sha256: sha256(text), files: [file] };
  }
  writeIndex(spec, index);
}

interface RegistryItem {
  readonly name: string;
  readonly files: readonly { readonly path: string; readonly content: string }[];
}

/** Capture shadcn-style registry items (`<url><item>.json` with `files[{path,content}]`). */
export async function captureRegistry(
  spec: SourceSpec,
  items: readonly string[],
  opts: CaptureOptions
): Promise<{ missing: string[] }> {
  if (spec.pin.kind !== "registry") throw new Error(`${spec.id} is not a registry source`);
  const index = readIndex(spec);
  const missing: string[] = [];
  for (const item of items) {
    const have = index[item];
    if (have && !opts.refresh && have.files.every((f) => exists(upstreamPath(spec, f)))) continue;
    const url = `${spec.pin.url}${item}.json`;
    opts.log(`fetch ${url}`);
    let text: string;
    try {
      text = await get(url);
    } catch (err) {
      opts.log(`  ${(err as Error).message}`);
      if (!have) missing.push(item);
      continue;
    }
    const parsed = JSON.parse(text) as RegistryItem;
    const files: string[] = [];
    for (const f of parsed.files) {
      writeText(upstreamPath(spec, f.path), f.content);
      files.push(f.path);
    }
    index[item] = { url, capturedAt: today(), sha256: sha256(text), files };
  }
  writeIndex(spec, index);
  return { missing };
}

/**
 * Capture arlan.me vault studies. The site is a Next.js app whose RSC flight
 * payload carries `fullSource: [{file, code}]` for each study; `code` is either
 * inline or a `$<id>` reference to a `T` (text) chunk.
 */
export async function captureArlan(
  spec: SourceSpec,
  slugs: readonly string[],
  opts: CaptureOptions
): Promise<{ missing: string[] }> {
  if (spec.pin.kind !== "pages") throw new Error(`${spec.id} is not a pages source`);
  const index = readIndex(spec);
  const missing: string[] = [];
  for (const slug of slugs) {
    const have = index[slug];
    if (have && !opts.refresh && have.files.every((f) => exists(upstreamPath(spec, f)))) continue;
    const url = `${spec.pin.url}${slug}`;
    opts.log(`fetch ${url}`);
    let html: string;
    try {
      html = await get(url);
    } catch (err) {
      opts.log(`  ${(err as Error).message}`);
      if (!have) missing.push(slug);
      continue;
    }
    const files = extractFlightSources(html);
    if (files.size === 0) {
      opts.log(`  no fullSource found for ${slug}`);
      if (!have) missing.push(slug);
      continue;
    }
    const names: string[] = [];
    for (const [file, code] of files) {
      writeText(upstreamPath(spec, file), code);
      names.push(file);
    }
    index[slug] = { url, capturedAt: today(), sha256: sha256(html), files: names.sort() };
  }
  writeIndex(spec, index);
  return { missing };
}

/** Parse `self.__next_f.push([1,"…"])` chunks into `{file → code}`. */
export function extractFlightSources(html: string): Map<string, string> {
  const pushes = [...html.matchAll(/self\.__next_f\.push\(\[1,"((?:[^"\\]|\\.)*)"\]\)/g)].map((m) =>
    JSON.parse(`"${m[1]}"`) as string
  );
  const flight = Buffer.from(pushes.join(""), "utf8");

  // Text chunks: `<id>:T<hexlen>,<bytes>`; other rows are `<id>:<json>\n`.
  const texts = new Map<string, string>();
  const rows: string[] = [];
  let pos = 0;
  while (pos < flight.length) {
    const colon = flight.indexOf(":", pos);
    if (colon < 0) break;
    const id = flight.subarray(pos, colon).toString("utf8");
    if (!/^[0-9a-f]+$/.test(id)) {
      const nl = flight.indexOf("\n", pos);
      if (nl < 0) break;
      pos = nl + 1;
      continue;
    }
    if (flight[colon + 1] === 0x54 /* T */) {
      const comma = flight.indexOf(",", colon + 2);
      const len = parseInt(flight.subarray(colon + 2, comma).toString("utf8"), 16);
      texts.set(id, flight.subarray(comma + 1, comma + 1 + len).toString("utf8"));
      pos = comma + 1 + len;
      continue;
    }
    const nl = flight.indexOf("\n", colon);
    const end = nl < 0 ? flight.length : nl;
    rows.push(flight.subarray(colon + 1, end).toString("utf8"));
    pos = end + 1;
  }

  const out = new Map<string, string>();
  const joined = rows.join("\n");
  for (const m of joined.matchAll(/"fullSource":(\[(?:[^\[\]]|\[[^\[\]]*\])*\])/g)) {
    let list: { file: string; code: string }[];
    try {
      list = JSON.parse(m[1]!) as { file: string; code: string }[];
    } catch {
      continue;
    }
    for (const entry of list) {
      const ref = /^\$([0-9a-f]+)$/.exec(entry.code);
      const code = ref ? texts.get(ref[1]!) : entry.code;
      if (typeof code === "string") out.set(entry.file, code);
    }
  }
  return out;
}

/** Read a captured upstream file or throw with a hint to run `--refresh`. */
export function readUpstream(spec: SourceSpec, file: string): string {
  const p = upstreamPath(spec, file);
  if (!exists(p)) throw new Error(`missing capture ${spec.id}/${file}; run harvest --refresh`);
  return readText(p);
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
