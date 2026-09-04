/**
 * vendor/: pinned npm tarballs the Build Service and the Box use offline.
 * `vendor/sbom.json` is generated from the tarballs (name, version, license,
 * sha256, npm publish time, dependency edges). `vendor/.extracted/` is a
 * scratch node_modules used for measuring and type-checking; never committed.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { VENDOR_DIR, VENDOR_EXTRACTED, VENDOR_TARBALLS } from "./paths.ts";
import { readJson, sha256, sortKeys, writeJson } from "./fsx.ts";

export const SBOM_FILE = path.join(VENDOR_DIR, "sbom.json");
export const MIN_AGE_DAYS = 7;

/** Packages the Kit may import (§12.2 vendor list + metal-fx, non-lite) and their transitive closure. */
export const DIRECT: readonly string[] = [
  "react",
  "react-dom",
  "motion",
  "clsx",
  "tailwind-merge",
  "lucide-react",
  "thinking-orbs",
  "border-beam",
  "liquid-gooey",
  "hono",
  "zod",
];
export const NON_LITE: readonly string[] = ["metal-fx"];

export interface SbomComponent {
  readonly name: string;
  readonly version: string;
  readonly license: string;
  readonly tarball: string;
  readonly sha256: string;
  readonly bytes: number;
  readonly published: string;
  readonly direct: boolean;
  readonly nonLite: boolean;
  readonly dependencies: Readonly<Record<string, string>>;
  readonly peerDependencies: Readonly<Record<string, string>>;
}

export interface Sbom {
  readonly $schema: string;
  readonly generated: string;
  readonly minAgeDays: number;
  readonly components: readonly SbomComponent[];
}

interface PkgJson {
  name: string;
  version: string;
  license?: string;
  dependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
}

function readPkgFromTarball(tgz: string): PkgJson {
  const out = execFileSync("tar", ["-xOzf", tgz, "package/package.json"], { encoding: "utf8" });
  return JSON.parse(out) as PkgJson;
}

function existingSbom(): Sbom | null {
  return fs.existsSync(SBOM_FILE) ? readJson<Sbom>(SBOM_FILE) : null;
}

async function publishTime(name: string, version: string, prior: Sbom | null): Promise<string> {
  const known = prior?.components.find((c) => c.name === name && c.version === version);
  if (known) return known.published;
  const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}`, {
    headers: { accept: "application/json" },
  });
  if (!res.ok) throw new Error(`registry ${name}: HTTP ${res.status}`);
  const meta = (await res.json()) as { time?: Record<string, string> };
  const t = meta.time?.[version];
  if (!t) throw new Error(`registry ${name}@${version}: no publish time`);
  return t;
}

export function tarballs(): string[] {
  if (!fs.existsSync(VENDOR_TARBALLS)) return [];
  return fs
    .readdirSync(VENDOR_TARBALLS)
    .filter((f) => f.endsWith(".tgz"))
    .sort()
    .map((f) => path.join(VENDOR_TARBALLS, f));
}

export async function buildSbom(log: (s: string) => void): Promise<{ sbom: Sbom; changed: boolean }> {
  const prior = existingSbom();
  const components: SbomComponent[] = [];
  for (const tgz of tarballs()) {
    const pkg = readPkgFromTarball(tgz);
    const buf = fs.readFileSync(tgz);
    const published = await publishTime(pkg.name, pkg.version, prior);
    components.push({
      name: pkg.name,
      version: pkg.version,
      license: pkg.license ?? "UNKNOWN",
      tarball: `tarballs/${path.basename(tgz)}`,
      sha256: sha256(buf),
      bytes: buf.length,
      published,
      direct: DIRECT.includes(pkg.name),
      nonLite: NON_LITE.includes(pkg.name),
      dependencies: pkg.dependencies ?? {},
      peerDependencies: pkg.peerDependencies ?? {},
    });
    log(`vendor ${pkg.name}@${pkg.version} (${pkg.license})`);
  }
  components.sort((a, b) => a.name.localeCompare(b.name));
  const sbom: Sbom = {
    $schema: "air-create-kit/sbom@1",
    generated: prior?.generated ?? new Date().toISOString().slice(0, 10),
    minAgeDays: MIN_AGE_DAYS,
    components,
  };
  const changed = writeJson(SBOM_FILE, sortKeys(sbom));
  return { sbom, changed };
}

/** Closure check: every dependency of every component is itself vendored. */
export function sbomProblems(sbom: Sbom, asOf: Date): string[] {
  const problems: string[] = [];
  const have = new Set(sbom.components.map((c) => c.name));
  for (const name of [...DIRECT, ...NON_LITE]) if (!have.has(name)) problems.push(`missing direct package: ${name}`);
  for (const c of sbom.components) {
    for (const dep of Object.keys(c.dependencies)) if (!have.has(dep)) problems.push(`${c.name} depends on unvendored ${dep}`);
    for (const dep of Object.keys(c.peerDependencies)) if (!have.has(dep)) problems.push(`${c.name} peer-depends on unvendored ${dep}`);
    const age = (asOf.getTime() - new Date(c.published).getTime()) / 86_400_000;
    if (age < sbom.minAgeDays) problems.push(`${c.name}@${c.version} published ${age.toFixed(1)}d before snapshot (< ${sbom.minAgeDays}d)`);
    if (!/^(MIT|ISC|0BSD|BSD-[23]-Clause|Apache-2\.0)$/.test(c.license)) problems.push(`${c.name}: license ${c.license} is not on the vendor allowlist`);
    const tgz = path.join(VENDOR_DIR, c.tarball);
    if (!fs.existsSync(tgz)) problems.push(`${c.name}: tarball missing (${c.tarball})`);
    else if (sha256(fs.readFileSync(tgz)) !== c.sha256) problems.push(`${c.name}: tarball sha256 mismatch`);
  }
  return problems;
}

/** Unpack every tarball into vendor/.extracted/node_modules/<name>. Idempotent. */
export function extractVendor(log: (s: string) => void): string {
  const nm = path.join(VENDOR_EXTRACTED, "node_modules");
  fs.mkdirSync(nm, { recursive: true });
  for (const tgz of tarballs()) {
    const pkg = readPkgFromTarball(tgz);
    const dest = path.join(nm, pkg.name);
    const stamp = path.join(dest, ".kit-sha256");
    const hash = sha256(fs.readFileSync(tgz));
    if (fs.existsSync(stamp) && fs.readFileSync(stamp, "utf8") === hash) continue;
    fs.rmSync(dest, { recursive: true, force: true });
    fs.mkdirSync(dest, { recursive: true });
    execFileSync("tar", ["-xzf", tgz, "-C", dest, "--strip-components=1"]);
    fs.writeFileSync(stamp, hash);
    log(`extract ${pkg.name}@${pkg.version}`);
  }
  return nm;
}
