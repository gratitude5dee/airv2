/**
 * Kit verifier (goal-create-v11 §19 "Kit"). Runs in CI and by hand; needs no
 * network, no browser and no vendor extraction — it checks what `harvest`
 * recorded against what is in git.
 *
 *   npx tsx packages/create-kit/scripts/verify.ts
 *
 * Fails (exit 1) when any of these break:
 *   - every file under kit/ has a lock entry whose hash matches, and vice versa
 *   - every lock entry carries a license tier; no Tier B file is in git
 *   - no ReactBits / CanvasUI source anywhere under packages/create-kit
 *   - every component has meta.json + ref.md; lite ones passed the 390x760
 *     WebGL-off reduced-motion harness and their measured weights are recorded
 *   - lite set within budget (300 KiB gz JS, 200 KiB CSS); no lite component
 *     over the hard per-component ceiling
 *   - every kit file passes the CSP lint (hosts, storage, eval, frames, fonts…)
 *   - every vendor tarball is in the SBOM with a matching sha256, and every
 *     bare import of a component resolves to an SBOM package
 *   - DESIGN.md, prompts/create-agent.system.md and the Box template copy
 *     regenerate byte-identically from meta.json + prompts/src
 *   - kit.sources.json lists exactly the harvested component directories
 */
import fs from "node:fs";
import path from "node:path";
import { hardFindings, lintFile } from "./lib/cspLint.ts";
import { buildDesign, buildSystemPrompt } from "./lib/design.ts";
import { exists, readJson, readText, sha256, walk } from "./lib/fsx.ts";
import { BUDGETS, type Lock, type Meta, type SourcesJsonEntry } from "./lib/meta.ts";
import {
  DESIGN_FILE,
  KIT_DIR,
  KIT_ROOT,
  LOCK_FILE,
  REPO_ROOT,
  SOURCES_FILE,
  SYSTEM_PROMPT_FILE,
  TEMPLATE_DESIGN_FILE,
  VENDOR_DIR,
  VENDOR_TARBALLS,
  rel,
} from "./lib/paths.ts";
import { SBOM_FILE, type Sbom } from "./lib/vendor.ts";

const problems: string[] = [];
const fail = (msg: string) => problems.push(msg);

const TEXT_EXT = /\.(tsx?|jsx?|mjs|css|md|json|html?|svg)$/i;
/** Tier B fingerprints; none of this may be in git (goal-create-v11 §12.1, §20). */
const RESTRICTED_RE = /react-?bits|reactbits\.dev|canvas-?ui|DavidHDev|Commons Clause/i;
const RESTRICTED_SCAN_SKIP = new Set(["restricted", "evidence", ".cache", ".harness", "node_modules", ".extracted", "tarballs"]);

// --- 1. lock ⇄ files ------------------------------------------------------
const lock = readJson<Lock>(LOCK_FILE);
const kitFiles = walk(KIT_DIR, (n) => n === ".DS_Store").map((p) => `kit/${p}`);
const lockKeys = Object.keys(lock.files);
for (const f of kitFiles) {
  const entry = lock.files[f];
  if (!entry) {
    fail(`${f}: no kit.lock.json entry (re-run harvest)`);
    continue;
  }
  const actual = sha256(fs.readFileSync(path.join(KIT_ROOT, f)));
  if (actual !== entry.computedHash) fail(`${f}: hash ${actual.slice(0, 12)} != lock ${entry.computedHash.slice(0, 12)} (edited by hand? re-run harvest)`);
  if (entry.tier !== "A" && entry.tier !== "B") fail(`${f}: lock entry has no license tier`);
  if (entry.tier === "B") fail(`${f}: Tier B file committed to git; Tier B ships only via restricted/`);
  if (!entry.spdx) fail(`${f}: lock entry has no SPDX id`);
  if (!entry.source || !entry.sourceType) fail(`${f}: lock entry lacks source/sourceType`);
}
const present = new Set(kitFiles);
for (const k of lockKeys) if (!present.has(k)) fail(`${k}: in kit.lock.json but not on disk`);
if (lock.kit.components !== new Set(Object.values(lock.files).map((e) => e.component)).size) {
  fail(`kit.lock.json: components=${lock.kit.components} but ${new Set(Object.values(lock.files).map((e) => e.component)).size} distinct components locked`);
}

// --- 2. restricted-source fingerprint scan ---------------------------------
for (const relPath of walk(KIT_ROOT, (n) => RESTRICTED_SCAN_SKIP.has(n))) {
  if (!TEXT_EXT.test(relPath)) continue;
  if (relPath === "scripts/verify.ts" || relPath === "scripts/pack-restricted.ts" || relPath.startsWith("prompts/src/") || relPath === "DESIGN.md" || relPath.startsWith("scripts/lib/sources.ts") || relPath === "kit.sources.json" || relPath === "prompts/create-agent.system.md") continue;
  const text = readText(path.join(KIT_ROOT, relPath));
  const m = RESTRICTED_RE.exec(text);
  if (m) fail(`${relPath}: mentions "${m[0]}" — Tier B (ReactBits/CanvasUI) material must not be in git`);
}

// --- 3. per-component meta / harness / csp ---------------------------------
const metas: Meta[] = [];
const componentDirs = new Set<string>();
for (const f of kitFiles) {
  const parts = f.split("/");
  if (parts[1] === "air") componentDirs.add("air");
  else if (parts.length >= 4) componentDirs.add(`${parts[1]}/${parts[2]}`);
}
for (const id of [...componentDirs].sort()) {
  const dir = path.join(KIT_DIR, id);
  const metaPath = path.join(dir, "meta.json");
  const refPath = path.join(dir, "ref.md");
  if (!exists(metaPath)) {
    fail(`${id}: missing meta.json`);
    continue;
  }
  if (!exists(refPath)) fail(`${id}: missing ref.md`);
  const meta = readJson<Meta>(metaPath);
  metas.push(meta);
  if (meta.id !== id) fail(`${id}: meta.id is "${meta.id}"`);
  if (!exists(path.join(dir, meta.entry))) fail(`${id}: entry ${meta.entry} not found`);
  if (!meta.license?.tier || !meta.license.spdx) fail(`${id}: meta.license incomplete`);
  if (meta.license.tier === "B") fail(`${id}: Tier B component in git`);
  if (!meta.author) fail(`${id}: meta.author missing`);
  if (typeof meta.weightKb?.js !== "number" || typeof meta.weightKb?.css !== "number") fail(`${id}: weight not measured`);
  if (!meta.csp?.ok) fail(`${id}: meta.csp.ok=false (${meta.csp?.findings.join("; ")})`);
  if (meta.lite) {
    if (meta.kind !== "helper") {
      if (meta.harness.viewport !== "390x760" || meta.harness.webgl !== false || meta.harness.reducedMotion !== true) fail(`${id}: lite but harness not 390x760/WebGL-off/reduced-motion`);
      if (!meta.harness.ok) fail(`${id}: lite but harness failed: ${meta.harness.errors.join("; ")}`);
    }
    if (meta.weightKb.jsFull > BUDGETS.hardJsKb) fail(`${id}: lite but ${meta.weightKb.jsFull} KiB > ${BUDGETS.hardJsKb} KiB hard ceiling`);
  }
  for (const f of kitFiles.filter((k) => k.startsWith(`kit/${id}/`) && TEXT_EXT.test(k) && !k.endsWith("meta.json") && !k.endsWith("ref.md"))) {
    const hard = hardFindings(lintFile(f, readText(path.join(KIT_ROOT, f)), { lite: meta.lite }));
    for (const h of hard) fail(`${f}:${h.line}: csp ${h.rule} — ${h.hint}`);
  }
}

// --- 4. budgets -------------------------------------------------------------
if (lock.kit.liteJsKb > BUDGETS.liteJsKb) fail(`lite set JS ${lock.kit.liteJsKb} KiB > ${BUDGETS.liteJsKb} KiB`);
if (lock.kit.liteCssKb > BUDGETS.cssKb) fail(`lite set CSS ${lock.kit.liteCssKb} KiB > ${BUDGETS.cssKb} KiB`);
const liteOwnJs = metas.filter((m) => m.lite).reduce((n, m) => n + m.weightKb.js, 0);
if (liteOwnJs > BUDGETS.liteJsKb) fail(`sum of lite own JS ${liteOwnJs.toFixed(1)} KiB > ${BUDGETS.liteJsKb} KiB`);

// --- 5. vendor snapshot -----------------------------------------------------
const sbom = readJson<Sbom>(SBOM_FILE);
const sbomByName = new Map(sbom.components.map((c) => [c.name, c] as const));
const tarballsOnDisk = new Set(fs.existsSync(VENDOR_TARBALLS) ? fs.readdirSync(VENDOR_TARBALLS).filter((f) => f.endsWith(".tgz")) : []);
for (const c of sbom.components) {
  const p = path.join(VENDOR_DIR, c.tarball);
  if (!exists(p)) {
    fail(`vendor: ${c.name}@${c.version} tarball missing (${c.tarball})`);
    continue;
  }
  const actual = sha256(fs.readFileSync(p));
  if (actual !== c.sha256) fail(`vendor: ${c.tarball} sha256 mismatch`);
  if (!c.license) fail(`vendor: ${c.name} has no license in SBOM`);
  tarballsOnDisk.delete(path.basename(c.tarball));
}
for (const orphan of tarballsOnDisk) fail(`vendor: ${orphan} not in sbom.json`);
for (const m of metas) {
  for (const dep of m.deps) {
    const c = sbomByName.get(dep);
    if (!c) fail(`${m.id}: dep "${dep}" is not in vendor/sbom.json`);
    else if (m.lite && c.nonLite) fail(`${m.id}: lite component depends on non-lite package ${dep}`);
  }
}

// --- 6. generated docs are byte-identical -----------------------------------
const inputs = { metas: metas.sort((a, b) => a.id.localeCompare(b.id)), liteJsKb: lock.kit.liteJsKb, liteCssKb: lock.kit.liteCssKb };
const design = buildDesign(inputs);
if (readText(DESIGN_FILE) !== design) fail(`${rel(DESIGN_FILE)} differs from regeneration (hand-edited? re-run harvest)`);
if (readText(SYSTEM_PROMPT_FILE) !== buildSystemPrompt(inputs)) fail(`${rel(SYSTEM_PROMPT_FILE)} differs from regeneration`);
if (!exists(TEMPLATE_DESIGN_FILE)) fail(`${path.relative(KIT_ROOT, TEMPLATE_DESIGN_FILE)} missing (run harvest to sync)`);
else if (readText(TEMPLATE_DESIGN_FILE) !== design) fail(`Box template DESIGN.md is out of sync with packages/create-kit/DESIGN.md`);

// --- 7. kit.sources.json ⇄ directories --------------------------------------
const sources = readJson<{ sources: SourcesJsonEntry[] }>(SOURCES_FILE);
const harvestedIds = new Set(sources.sources.flatMap((s) => s.harvested));
for (const id of componentDirs) if (id !== "air" && !harvestedIds.has(id)) fail(`${id}: on disk but not listed in kit.sources.json`);
for (const id of harvestedIds) if (!componentDirs.has(id)) fail(`${id}: listed in kit.sources.json but not on disk (gap must be recorded under "gaps")`);
for (const s of sources.sources) {
  if (s.tier === "B" && s.harvested.length > 0) fail(`${s.id}: Tier B source lists harvested components`);
  for (const ev of s.licenseEvidence) if (!exists(path.join(KIT_ROOT, ev))) fail(`${s.id}: license evidence ${ev} missing`);
}

// --- 8. engineer skill lock + restricted/ holds no source --------------------
const skillsLock = readJson<{ skills: Record<string, { skillPath: string; computedHash: string }> }>(path.join(REPO_ROOT, "skills-lock.json"));
const kitSkill = skillsLock.skills["create-kit"];
if (!kitSkill) fail("skills-lock.json: no create-kit entry");
else {
  const skillFile = path.join(REPO_ROOT, kitSkill.skillPath);
  if (!exists(skillFile)) fail(`skills-lock.json: ${kitSkill.skillPath} missing`);
  else if (sha256(readText(skillFile)) !== kitSkill.computedHash) fail(`skills-lock.json: create-kit computedHash is stale (sha256 ${kitSkill.skillPath})`);
}
for (const f of walk(path.join(KIT_ROOT, "restricted"))) {
  if (/\.(tgz|manifest\.json)$/.test(f)) continue; // gitignored pack outputs
  if (!/^(README\.md|allowlist\.json)$/.test(f)) fail(`restricted/${f}: only README.md and allowlist.json may be committed here`);
}

// --- report -----------------------------------------------------------------
const liteCount = metas.filter((m) => m.lite).length;
console.log(`create-kit verify: ${kitFiles.length} files, ${metas.length} components (${liteCount} lite), lite set ${lock.kit.liteJsKb} KiB JS / ${lock.kit.liteCssKb} KiB CSS, ${sbom.components.length} vendor packages`);
if (problems.length > 0) {
  for (const p of problems) console.error(`  FAIL ${p}`);
  console.error(`create-kit verify: ${problems.length} problem(s)`);
  process.exit(1);
}
console.log("create-kit verify: ok");
