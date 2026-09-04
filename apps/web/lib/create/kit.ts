/**
 * The Kit as the Build Service sees it (goal-create-v11 §7.1, §12.2). This
 * module is the only place a Create bundle's imports are resolved: `@kit/*`
 * to `packages/create-kit/kit/**`, bare package names to the committed
 * `vendor/` snapshot (extracted once per process into a scratch directory,
 * never installed), `@kit/restricted/*` to the private Tier B artifact when
 * the Build Service is configured for it. Anything else — a foreign
 * specifier, an npm name outside the SBOM, a path that escapes the
 * workspace — is a hard finding, not a network fetch.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { getObject, r2Configured } from "../storage/r2";

export const KIT_SPECIFIER_RE =
  /^@kit\/(air|restricted\/[a-z0-9-]+|[a-z0-9-]+\/[a-z0-9-]+)(\/[A-Za-z0-9._/-]+)?$/;
export const RESTRICTED_SPECIFIER_RE = /^@kit\/restricted\/([a-z0-9-]+)$/;
export const RESTRICTED_KEY_PREFIX = "_platform/kit/restricted/";

export class KitError extends Error {
  readonly status: number;
  constructor(message: string, status = 500) {
    super(message);
    this.name = "KitError";
    this.status = status;
  }
}

/** `KIT_DIR` points at a checked-out packages/create-kit; the default is the
 * monorepo location relative to apps/web. */
export function kitRoot(): string {
  const configured = process.env["KIT_DIR"]?.trim();
  if (configured) return path.resolve(configured);
  return path.resolve(process.cwd(), "..", "..", "packages", "create-kit");
}

export function kitDir(root = kitRoot()): string {
  return path.join(root, "kit");
}

interface KitLock {
  kit?: { version?: string; budgets?: Record<string, number> };
}

export function kitVersion(root = kitRoot()): string {
  try {
    const lock = JSON.parse(
      fs.readFileSync(path.join(root, "kit.lock.json"), "utf8")
    ) as KitLock;
    return lock.kit?.version ?? "unknown";
  } catch {
    return "unknown";
  }
}

export interface KitBudgets {
  liteJsKb: number;
  cssKb: number;
  hardJsKb: number;
  imageKb: number;
}

const DEFAULT_BUDGETS: KitBudgets = {
  liteJsKb: 300,
  cssKb: 200,
  hardJsKb: 1024,
  imageKb: 2048,
};

export function kitBudgets(root = kitRoot()): KitBudgets {
  try {
    const lock = JSON.parse(
      fs.readFileSync(path.join(root, "kit.lock.json"), "utf8")
    ) as KitLock;
    return { ...DEFAULT_BUDGETS, ...(lock.kit?.budgets ?? {}) };
  } catch {
    return DEFAULT_BUDGETS;
  }
}

export interface KitComponentMeta {
  id: string;
  kind: "component" | "helper";
  entry: string;
  lite: boolean;
  deps: string[];
  license: { tier: "A" | "B" | string };
}

/** `<source>/<name>` → meta.json, plus `air`. Read once per call; the Kit
 * is a committed tree, so a process never sees it change. */
export function listKitComponents(root = kitRoot()): Map<string, KitComponentMeta> {
  const out = new Map<string, KitComponentMeta>();
  const dir = kitDir(root);
  if (!fs.existsSync(dir)) return out;
  const push = (id: string, metaPath: string) => {
    try {
      const meta = JSON.parse(fs.readFileSync(metaPath, "utf8")) as Partial<KitComponentMeta>;
      out.set(id, {
        id,
        kind: meta.kind === "helper" ? "helper" : "component",
        entry: typeof meta.entry === "string" ? meta.entry : "index.tsx",
        lite: meta.lite !== false,
        deps: Array.isArray(meta.deps) ? meta.deps.filter((d): d is string => typeof d === "string") : [],
        license: { tier: meta.license?.tier ?? "A" },
      });
    } catch {
      // a component without a readable meta.json is not importable
    }
  };
  for (const source of fs.readdirSync(dir)) {
    const sourceDir = path.join(dir, source);
    if (!fs.statSync(sourceDir).isDirectory()) continue;
    if (source === "air") {
      push("air", path.join(sourceDir, "meta.json"));
      continue;
    }
    for (const name of fs.readdirSync(sourceDir)) {
      const metaPath = path.join(sourceDir, name, "meta.json");
      if (fs.existsSync(metaPath)) push(`${source}/${name}`, metaPath);
    }
  }
  return out;
}

/* ------------------------------------------------------------ vendor */

interface SbomComponent {
  name: string;
  version: string;
  tarball: string;
  sha256: string;
  nonLite?: boolean;
}

interface Sbom {
  components: SbomComponent[];
}

export function readSbom(root = kitRoot()): Sbom {
  const file = path.join(root, "vendor", "sbom.json");
  if (!fs.existsSync(file)) return { components: [] };
  return JSON.parse(fs.readFileSync(file, "utf8")) as Sbom;
}

/** Package names a Create app may import bare. React's subpaths ride along. */
export function vendorPackageNames(root = kitRoot()): Set<string> {
  return new Set(readSbom(root).components.map((component) => component.name));
}

export function nonLiteVendorNames(root = kitRoot()): Set<string> {
  return new Set(
    readSbom(root)
      .components.filter((component) => component.nonLite)
      .map((component) => component.name)
  );
}

/** `@scope/name` or `name` from a bare specifier (`motion/react` → `motion`). */
export function packageNameOf(specifier: string): string {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
}

export interface TarEntry {
  path: string;
  bytes: Buffer;
}

function tarString(block: Buffer, start: number, length: number): string {
  const slice = block.subarray(start, start + length);
  const end = slice.indexOf(0);
  return slice.subarray(0, end < 0 ? slice.length : end).toString("utf8");
}

function tarNumber(block: Buffer, start: number, length: number): number {
  const text = tarString(block, start, length).trim();
  return text ? parseInt(text, 8) : 0;
}

/**
 * Minimal tar reader: ustar / pax (`x` path override) / GNU long names
 * (`L`), regular files only. Enough for npm tarballs and a Box workspace
 * archive; directories, links and devices are skipped rather than trusted.
 * Throws on a truncated archive so a capped read can never yield a partial
 * file that looks whole.
 */
export function readTar(archive: Buffer, maxFiles = 20_000): TarEntry[] {
  const entries: TarEntry[] = [];
  let offset = 0;
  let longName: string | null = null;
  let paxPath: string | null = null;
  while (offset + 512 <= archive.length) {
    const header = archive.subarray(offset, offset + 512);
    if (header.every((byte) => byte === 0)) break;
    const size = tarNumber(header, 124, 12);
    const type = String.fromCharCode(header[156]!);
    const prefix = tarString(header, 345, 155);
    let name = tarString(header, 0, 100);
    if (prefix) name = `${prefix}/${name}`;
    const dataStart = offset + 512;
    const dataEnd = dataStart + size;
    if (dataEnd > archive.length) throw new KitError("archive truncated", 413);
    const data = archive.subarray(dataStart, dataEnd);
    offset = dataStart + Math.ceil(size / 512) * 512;
    if (type === "L") {
      longName = tarString(data, 0, data.length);
      continue;
    }
    if (type === "x") {
      for (const line of data.toString("utf8").split("\n")) {
        const match = /^\d+ path=(.*)$/.exec(line);
        if (match) paxPath = match[1]!;
      }
      continue;
    }
    const resolved = paxPath ?? longName ?? name;
    longName = null;
    paxPath = null;
    if (type !== "0" && type !== "\0" && type !== "") continue;
    if (entries.length >= maxFiles) throw new KitError("archive has too many files", 413);
    entries.push({ path: resolved, bytes: Buffer.from(data) });
  }
  return entries;
}

/** Largest tar a vendored or restricted tarball may inflate to. */
export const ARCHIVE_MAX_UNPACKED_BYTES = 256 * 1024 * 1024;

export interface ReadTarGzOptions {
  maxFiles?: number | undefined;
  /** Inflated size cap; a gzip bomb fails here before any byte is read. */
  maxBytes?: number | undefined;
}

export function readTarGz(
  archive: Buffer,
  { maxFiles, maxBytes = ARCHIVE_MAX_UNPACKED_BYTES }: ReadTarGzOptions = {}
): TarEntry[] {
  let tar: Buffer;
  try {
    tar = gunzipSync(archive, { maxOutputLength: maxBytes });
  } catch (error) {
    if ((error as { code?: string }).code === "ERR_BUFFER_TOO_LARGE") {
      throw new KitError("archive inflates past the size cap", 413);
    }
    throw new KitError("archive is not gzip", 400);
  }
  return readTar(tar, maxFiles);
}

/**
 * The entry's path as a clean relative POSIX path, or null when it could
 * escape the extraction root: absolute, `..`-bearing, NUL, or empty once
 * `./` and duplicate separators are folded away.
 */
export function safeArchivePath(entryPath: string): string | null {
  if (!entryPath || entryPath.includes("\0")) return null;
  const slashed = entryPath.replace(/\\/g, "/");
  if (slashed.startsWith("/")) return null;
  const normalized = path.posix.normalize(slashed).replace(/\/+$/, "");
  if (!normalized || normalized === ".") return null;
  if (normalized === ".." || normalized.startsWith("../")) return null;
  if (normalized.split("/").some((segment) => segment === "..")) return null;
  return normalized;
}

/** `root/<safe>` if it stays under root, else null. */
function destinationUnder(root: string, safe: string): string | null {
  const base = path.resolve(root);
  const dest = path.resolve(base, safe);
  return dest.startsWith(base + path.sep) ? dest : null;
}

function scratchRoot(): string {
  const configured = process.env["KIT_SCRATCH_DIR"]?.trim();
  return configured ? path.resolve(configured) : path.join(os.tmpdir(), "air-create-kit");
}

let extractedVendor: Promise<string> | null = null;

/**
 * Extract the vendor tarballs into `<scratch>/vendor-<sbom sha>/node_modules`
 * once per process (idempotent across processes: the directory is keyed by
 * the SBOM digest and finished with a marker). Tarballs are verified against
 * the SBOM before extraction; a mismatch fails the build rather than
 * building on an unvetted package.
 */
export function ensureVendorExtracted(root = kitRoot()): Promise<string> {
  if (!extractedVendor) {
    extractedVendor = extractVendor(root).catch((error: unknown) => {
      extractedVendor = null;
      throw error;
    });
  }
  return extractedVendor;
}

async function extractVendor(root: string): Promise<string> {
  const sbom = readSbom(root);
  if (sbom.components.length === 0) throw new KitError("vendor SBOM missing");
  const digest = createHash("sha256")
    .update(JSON.stringify(sbom.components.map((c) => [c.name, c.version, c.sha256])))
    .digest("hex")
    .slice(0, 16);
  const target = path.join(scratchRoot(), `vendor-${digest}`);
  const nodeModules = path.join(target, "node_modules");
  const marker = path.join(target, ".complete");
  if (fs.existsSync(marker)) return nodeModules;
  const staging = `${target}.${process.pid}.${Date.now()}`;
  fs.mkdirSync(path.join(staging, "node_modules"), { recursive: true });
  for (const component of sbom.components) {
    const tgz = path.join(root, "vendor", component.tarball);
    const bytes = fs.readFileSync(tgz);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (sha !== component.sha256) {
      throw new KitError(`vendor tarball ${component.name} does not match the SBOM`);
    }
    const pkgDir = path.join(staging, "node_modules", component.name);
    for (const entry of readTarGz(bytes)) {
      const safe = safeArchivePath(entry.path);
      if (!safe || !safe.startsWith("package/")) continue;
      const rel = safe.slice("package/".length);
      if (!rel) continue;
      const dest = destinationUnder(pkgDir, rel);
      if (!dest) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, entry.bytes);
    }
  }
  fs.writeFileSync(path.join(staging, ".complete"), new Date().toISOString());
  try {
    fs.renameSync(staging, target);
  } catch {
    // another process won the race; ours is redundant
    fs.rmSync(staging, { recursive: true, force: true });
    if (!fs.existsSync(marker)) throw new KitError("vendor extraction failed");
  }
  return nodeModules;
}

/** Pin every vendored package name to the snapshot so the app's own
 * node_modules (and the repo's) can never satisfy an import. */
export function vendorAliases(nodeModules: string): Record<string, string> {
  const out: Record<string, string> = {};
  if (!fs.existsSync(nodeModules)) return out;
  for (const name of fs.readdirSync(nodeModules)) {
    if (name.startsWith(".")) continue;
    if (name.startsWith("@")) {
      for (const sub of fs.readdirSync(path.join(nodeModules, name))) {
        out[`${name}/${sub}`] = path.join(nodeModules, name, sub);
      }
    } else {
      out[name] = path.join(nodeModules, name);
    }
  }
  return out;
}

/* ------------------------------------------------------------ Tier B */

export interface RestrictedConfig {
  version: string;
  sha256: string;
  key: string;
}

/**
 * `KIT_RESTRICTED_VERSION` + `KIT_RESTRICTED_SHA256` pin the Tier B artifact
 * (restricted/README.md). Absent means Tier B is refused with a finding.
 */
export function restrictedConfig(): RestrictedConfig | null {
  const version = process.env["KIT_RESTRICTED_VERSION"]?.trim();
  const sha256 = process.env["KIT_RESTRICTED_SHA256"]?.trim().toLowerCase();
  if (!version || !sha256) return null;
  if (!/^[0-9A-Za-z.+-]{1,80}$/.test(version) || !/^[0-9a-f]{64}$/.test(sha256)) {
    return null;
  }
  return { version, sha256, key: `${RESTRICTED_KEY_PREFIX}${version}.tgz` };
}

let extractedRestricted: Promise<string | null> | null = null;

/**
 * The extracted Tier B `components/` directory, or null when unconfigured.
 * Read with the Build Service's own R2 credential, verified against the
 * pinned sha256, extracted into scratch only (never into a Box or a bundle).
 */
export function ensureRestrictedExtracted(): Promise<string | null> {
  if (!extractedRestricted) {
    extractedRestricted = extractRestricted().catch((error: unknown) => {
      extractedRestricted = null;
      throw error;
    });
  }
  return extractedRestricted;
}

async function extractRestricted(): Promise<string | null> {
  const config = restrictedConfig();
  if (!config || !r2Configured()) return null;
  const target = path.join(scratchRoot(), `restricted-${config.sha256.slice(0, 16)}`);
  const components = path.join(target, "components");
  const marker = path.join(target, ".complete");
  if (fs.existsSync(marker)) return components;
  const object = await getObject(config.key);
  if (!object) throw new KitError("restricted kit artifact missing", 503);
  const sha = createHash("sha256").update(object.body).digest("hex");
  if (sha !== config.sha256) {
    throw new KitError("restricted kit artifact does not match its pin", 503);
  }
  const staging = `${target}.${process.pid}.${Date.now()}`;
  fs.mkdirSync(path.join(staging, "components"), { recursive: true });
  for (const entry of readTarGz(object.body)) {
    const safe = safeArchivePath(entry.path);
    if (!safe || !safe.startsWith("components/")) continue;
    const dest = destinationUnder(staging, safe);
    if (!dest) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, entry.bytes);
  }
  fs.writeFileSync(path.join(staging, ".complete"), new Date().toISOString());
  try {
    fs.renameSync(staging, target);
  } catch {
    fs.rmSync(staging, { recursive: true, force: true });
    if (!fs.existsSync(marker)) throw new KitError("restricted extraction failed");
  }
  return components;
}

/** `components/<name>/<File>.jsx` — the one file in a Tier B component dir. */
export function restrictedEntry(componentsDir: string, name: string): string | null {
  const dir = path.join(componentsDir, name);
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((file) => /\.(jsx|tsx|js|ts)$/.test(file)).sort();
  return files[0] ? path.join(dir, files[0]) : null;
}

/* ------------------------------------------------------------ resolution */

export type KitResolution =
  | { kind: "kit"; id: string; path: string }
  | { kind: "restricted"; name: string }
  | { kind: "vendor"; pkg: string }
  | { kind: "foreign"; reason: string };

/**
 * Classify a bare specifier. `@kit/<source>/<name>[/sub]` maps to the Kit
 * tree; `@kit/air` to the helpers; `@kit/restricted/<name>` to Tier B; a
 * package in the SBOM is vendor; everything else is foreign.
 */
export function classifySpecifier(
  specifier: string,
  vendor: Set<string>,
  root = kitRoot()
): KitResolution {
  const restricted = RESTRICTED_SPECIFIER_RE.exec(specifier);
  if (restricted) return { kind: "restricted", name: restricted[1]! };
  const kit = KIT_SPECIFIER_RE.exec(specifier);
  if (kit) {
    const id = kit[1]!;
    const sub = kit[2] ?? "";
    const target = path.join(kitDir(root), id + sub);
    const resolved = resolveKitFile(target, root);
    if (!resolved) return { kind: "foreign", reason: `${specifier} is not in the Kit` };
    return { kind: "kit", id, path: resolved };
  }
  if (specifier.startsWith("@kit/")) {
    return { kind: "foreign", reason: `${specifier} is not a Kit component` };
  }
  const pkg = packageNameOf(specifier);
  if (vendor.has(pkg)) return { kind: "vendor", pkg };
  return {
    kind: "foreign",
    reason: `${specifier} is not in the Kit or its vendor snapshot (no npm at build time)`,
  };
}

const ENTRY_CANDIDATES = ["index.tsx", "index.ts", "index.jsx", "index.js", "index.css"];
const EXT_CANDIDATES = [".tsx", ".ts", ".jsx", ".js", ".css", ".json"];

export function resolveKitFile(target: string, root = kitRoot()): string | null {
  const kitPath = kitDir(root);
  const within = (candidate: string) => {
    const rel = path.relative(kitPath, candidate);
    return rel && !rel.startsWith("..") && !path.isAbsolute(rel);
  };
  if (fs.existsSync(target) && fs.statSync(target).isFile()) {
    return within(target) ? target : null;
  }
  for (const ext of EXT_CANDIDATES) {
    const candidate = target + ext;
    if (fs.existsSync(candidate) && within(candidate)) return candidate;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    for (const name of ENTRY_CANDIDATES) {
      const candidate = path.join(target, name);
      if (fs.existsSync(candidate) && within(candidate)) return candidate;
    }
  }
  return null;
}

/** The `<source>/<name>` a Kit file belongs to (`air` for the helpers). */
export function kitComponentIdOf(file: string, root = kitRoot()): string | null {
  const rel = path.relative(kitDir(root), file).split(path.sep);
  if (rel.length === 0 || rel[0] === ".." || path.isAbsolute(rel[0]!)) return null;
  if (rel[0] === "air") return "air";
  return rel.length >= 2 ? `${rel[0]}/${rel[1]}` : null;
}
