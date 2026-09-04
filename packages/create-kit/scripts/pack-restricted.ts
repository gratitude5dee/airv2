/**
 * Tier B packaging (CR11): builds the private React Bits artifact the Build
 * Service reads from R2 at `_platform/kit/restricted/<version>.tgz`.
 *
 *   KIT_CLONE_REACTBITS=/path/to/react-bits npx tsx packages/create-kit/scripts/pack-restricted.ts
 *
 * Reads only the files named in restricted/allowlist.json out of a local
 * checkout, normalizes them with the same rules as Tier A, and writes
 * restricted/<version>.tgz + restricted/<version>.manifest.json (both
 * gitignored). Nothing here is uploaded: the operator pushes the tarball with
 * the Build Service credential (see restricted/README.md). Never run this
 * against `kit/` — Tier B source must not enter git.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { hardFindings, lintFile } from "./lib/cspLint.ts";
import { exists, readJson, readText, sha256, sortKeys, writeJson, writeText } from "./lib/fsx.ts";
import { KIT_VERSION } from "./lib/meta.ts";
import { normalizeFile } from "./lib/normalize.ts";
import { KIT_ROOT, REPO_ROOT } from "./lib/paths.ts";

interface AllowlistComponent {
  readonly id: string;
  readonly upstream: string;
  readonly kind: string;
  readonly lite: boolean;
}
interface Allowlist {
  readonly source: {
    readonly id: string;
    readonly name: string;
    readonly repo: string;
    readonly spdx: string;
    readonly tier: "B";
    readonly licenseFile: string;
    readonly licenseMustContain: readonly string[];
  };
  readonly components: readonly AllowlistComponent[];
}

const RESTRICTED_DIR = path.join(KIT_ROOT, "restricted");
const ALLOWLIST = readJson<Allowlist>(path.join(RESTRICTED_DIR, "allowlist.json"));
const KEY_PREFIX = "_platform/kit/restricted";

function fail(msg: string): never {
  console.error(`pack-restricted: ${msg}`);
  process.exit(1);
}

const clone = process.env.KIT_CLONE_REACTBITS;
if (!clone || !exists(path.join(clone, ALLOWLIST.source.licenseFile))) {
  fail(`set KIT_CLONE_REACTBITS to a ${ALLOWLIST.source.repo} checkout (needs ${ALLOWLIST.source.licenseFile})`);
}
if (path.resolve(clone).startsWith(REPO_ROOT + path.sep)) fail("the checkout must live outside this repository");

const commit = execFileSync("git", ["-C", clone, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const version = `${KIT_VERSION}+${ALLOWLIST.source.id}.${commit.slice(0, 12)}`;

const license = readText(path.join(clone, ALLOWLIST.source.licenseFile));
for (const needle of ALLOWLIST.source.licenseMustContain) {
  if (!license.includes(needle)) fail(`${ALLOWLIST.source.licenseFile} no longer contains "${needle}" — re-check the tier before packaging`);
}

const stage = fs.mkdtempSync(path.join(os.tmpdir(), "kit-restricted-"));
const files: Record<string, { upstream: string; sha256: string; upstreamSha256: string; kind: string; lite: boolean; bytes: number }> = {};
for (const c of ALLOWLIST.components) {
  const src = path.join(clone, c.upstream);
  if (!exists(src)) fail(`${c.id}: ${c.upstream} missing in checkout ${commit}`);
  const raw = readText(src);
  const file = path.basename(c.upstream);
  const { text: normalized } = normalizeFile({ id: c.id }, file, raw);
  const findings = hardFindings(lintFile(file, normalized, { lite: c.lite }));
  if (findings.length > 0) fail(`${c.id}: CSP findings after normalize:\n  ${findings.map((f) => `${f.file}:${f.line} ${f.rule} — ${f.hint}`).join("\n  ")}`);
  const rel = `components/${c.id.split("/")[1]}/${file}`;
  writeText(path.join(stage, rel), normalized);
  files[rel] = { upstream: c.upstream, sha256: sha256(normalized), upstreamSha256: sha256(raw), kind: c.kind, lite: c.lite, bytes: Buffer.byteLength(normalized) };
}
writeText(path.join(stage, "LICENSE.md"), license);
writeText(
  path.join(stage, "NOTICE"),
  [
    `${ALLOWLIST.source.name} (${ALLOWLIST.source.repo} @ ${commit})`,
    `License: ${ALLOWLIST.source.spdx} — see LICENSE.md.`,
    "Permitted use: compiled into an Air mini-app as part of that application.",
    "Not permitted: redistribution of these files alone, bundled, ported, in a source export, or in a published package.",
    "",
  ].join("\n")
);
const manifest = sortKeys({
  schema: "air-create-kit/restricted@1",
  version,
  kitVersion: KIT_VERSION,
  source: { ...ALLOWLIST.source, commit },
  r2Key: `${KEY_PREFIX}/${version}.tgz`,
  files,
});
writeJson(path.join(stage, "manifest.json"), manifest);

fs.mkdirSync(RESTRICTED_DIR, { recursive: true });
const tgz = path.join(RESTRICTED_DIR, `${version}.tgz`);
// Fixed mtime/owner/order so the same inputs produce the same bytes.
execFileSync("tar", ["--sort=name", "--mtime=@0", "--owner=0", "--group=0", "--numeric-owner", "-czf", tgz, "-C", stage, "."]);
fs.rmSync(stage, { recursive: true, force: true });
writeJson(path.join(RESTRICTED_DIR, `${version}.manifest.json`), { ...manifest, tarballSha256: sha256(fs.readFileSync(tgz)), tarballBytes: fs.statSync(tgz).size });

console.log(`pack-restricted: ${Object.keys(files).length} components → ${path.relative(REPO_ROOT, tgz)}`);
console.log(`pack-restricted: upload as ${KEY_PREFIX}/${version}.tgz (private, Build Service credential) — see restricted/README.md`);
