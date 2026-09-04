/**
 * harvest.ts — fetch → normalize → measure → meta → lock → DESIGN.md (goal-create-v11 §12.4).
 *
 * Runs by hand on a branch. Never in a Box, never at build time.
 *
 *   npx tsx packages/create-kit/scripts/harvest.ts [--refresh] [--skip-harness] [--only <id>]
 *
 * Offline by default: upstream bytes come from evidence/<source>/upstream/ (committed
 * captures). `--refresh` re-fetches through the network (or a local clone via
 * KIT_CLONE_<SOURCE>=/path). `--skip-harness` reuses the previous headless verdicts.
 */
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { COMPONENTS, componentDir, shortName, type ComponentSpec } from "./lib/catalog.ts";
import { SOURCES, source, provenance, type SourceSpec } from "./lib/sources.ts";
import { captureArlan, captureGithub, captureRegistry, rawGithubUrl, readUpstream, upstreamPath } from "./lib/capture.ts";
import { normalizeFile } from "./lib/normalize.ts";
import { hardFindings, lintFile } from "./lib/cspLint.ts";
import { writeAirAssets } from "./lib/air.ts";
import { buildSbom, extractVendor, DIRECT, NON_LITE } from "./lib/vendor.ts";
import { bundle, gzKb, measureComponent } from "./lib/measure.ts";
import { runHarness, type Verdict } from "./lib/harness.ts";
import { buildDesign, buildRef, buildSystemPrompt } from "./lib/design.ts";
import { BUDGETS, KIT_VERSION, type Lock, type LockEntry, type Meta, type SourcesJsonEntry } from "./lib/meta.ts";
import {
  DESIGN_FILE,
  EVIDENCE_DIR,
  HARNESS_DIR,
  KIT_DIR,
  KIT_ROOT,
  LOCK_FILE,
  SOURCES_FILE,
  SYSTEM_PROMPT_FILE,
  TEMPLATE_DESIGN_FILE,
} from "./lib/paths.ts";
import { exists, readJson, readText, sha256, sortKeys, walk, writeJson, writeText } from "./lib/fsx.ts";

const args = new Set(process.argv.slice(2));
const REFRESH = args.has("--refresh");
const SKIP_HARNESS = args.has("--skip-harness");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx > 0 ? process.argv[onlyIdx + 1] : undefined;

const log = (s: string) => console.log(s);
const GLUE_DIR = path.join(KIT_ROOT, "scripts", "glue");

// ── 1. captures ──────────────────────────────────────────────────────────────

/** With KIT_CLONE_<ID>=/path/to/clone, read pinned bytes with `git show` instead of the network. */
function localClone(spec: SourceSpec): string | undefined {
  return process.env[`KIT_CLONE_${spec.id.toUpperCase()}`];
}

function captureFromClone(spec: SourceSpec, files: readonly string[], clone: string): void {
  if (spec.pin.kind !== "github") return;
  const indexPath = path.join(EVIDENCE_DIR, spec.id, "capture.json");
  const index = exists(indexPath) ? readJson<Record<string, unknown>>(indexPath) : {};
  for (const file of files) {
    const dest = upstreamPath(spec, file);
    if (exists(dest) && !REFRESH) continue;
    const full = path.posix.normalize(path.posix.join(spec.pin.base, file));
    const text = execFileSync("git", ["-C", clone, "show", `${spec.pin.commit}:${full}`], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
    writeText(dest, text);
    index[file] = { url: rawGithubUrl(spec.pin, file), capturedAt: new Date().toISOString().slice(0, 10), sha256: sha256(text), files: [file], via: "local-clone" };
    log(`capture ${spec.id}/${file} (clone)`);
  }
  writeJson(indexPath, sortKeys(index));
}

async function ensureCaptures(specs: readonly ComponentSpec[]): Promise<Map<string, string[]>> {
  const gaps = new Map<string, string[]>();
  for (const src of SOURCES) {
    const mine = specs.filter((c) => c.source === src.id);
    const files = [...new Set([...mine.flatMap((c) => c.files.filter((f) => f.from).map((f) => f.from!)), ...src.licenseFiles.map((l) => l.from)])];
    const missing = files.filter((f) => !exists(upstreamPath(src, f)));
    if (missing.length === 0 && !REFRESH) continue;
    if (src.pin.kind === "github") {
      const clone = localClone(src);
      if (clone) captureFromClone(src, files, clone);
      else await captureGithub(src, files, { refresh: REFRESH, log });
    } else if (src.pin.kind === "registry") {
      const items = [...new Set(mine.map((c) => c.registryItem ?? shortName(c)))];
      const { missing: gone } = await captureRegistry(src, items, { refresh: REFRESH, log });
      if (gone.length) gaps.set(src.id, gone);
    } else {
      const slugs = [...new Set(mine.map((c) => shortName(c)))];
      const { missing: gone } = await captureArlan(src, slugs, { refresh: REFRESH, log });
      if (gone.length) gaps.set(src.id, gone);
    }
  }
  return gaps;
}

/** Copy license texts out of the captures into evidence/<source>/ (the paths kit.sources.json points at). */
function placeLicenseEvidence(): void {
  for (const src of SOURCES) {
    for (const lf of src.licenseFiles) {
      const from = upstreamPath(src, lf.from);
      if (!exists(from)) continue;
      writeText(path.join(EVIDENCE_DIR, src.id, lf.to), readText(from));
    }
    for (const ev of src.licenseEvidence) {
      if (!exists(path.join(KIT_ROOT, ev))) throw new Error(`license evidence missing: ${ev} (capture it before harvesting ${src.id})`);
    }
  }
}

// ── 2. normalize ─────────────────────────────────────────────────────────────

interface HarvestedFile {
  readonly to: string;
  readonly from: string | null;
  readonly text: string;
  readonly upstream: string | null;
}

interface Harvested {
  readonly spec: ComponentSpec;
  readonly dir: string;
  readonly files: readonly HarvestedFile[];
  readonly author: string | null;
  readonly notes: readonly string[];
}

function harvestComponent(spec: ComponentSpec): Harvested {
  const src = source(spec.source);
  const dir = componentDir(spec);
  const files: HarvestedFile[] = [];
  const notes: string[] = [];
  let author: string | null = null;
  for (const f of spec.files) {
    if (f.air) {
      const gluePath = path.join(GLUE_DIR, spec.id, f.to);
      if (!exists(gluePath)) throw new Error(`glue missing for ${spec.id}/${f.to}: ${gluePath}`);
      files.push({ to: f.to, from: null, text: readText(gluePath), upstream: null });
      continue;
    }
    const raw = readUpstream(src, f.from!);
    let n: ReturnType<typeof normalizeFile>;
    try {
      n = normalizeFile(spec, f.to, raw);
    } catch (e) {
      throw new Error(`${spec.id}: ${(e as Error).message}`);
    }
    author ??= n.author;
    notes.push(...n.notes.map((x) => `${f.to}: ${x}`));
    files.push({ to: f.to, from: f.from!, text: n.text, upstream: raw });
  }
  return { spec, dir, files, author, notes };
}

function writeHarvested(h: Harvested): void {
  const dir = path.join(KIT_DIR, h.spec.id);
  const keep = new Set([...h.files.map((f) => f.to), "meta.json", "ref.md"]);
  if (exists(dir)) for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.rmSync(path.join(dir, f), { recursive: true, force: true });
  for (const f of h.files) writeText(path.join(dir, f.to), f.text);
}

// ── 3. props ─────────────────────────────────────────────────────────────────

/** Best-effort props from `interface XProps` / `type XProps =` in the entry file. Author `props` win. */
function extractProps(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  const m = /(?:interface|type)\s+[A-Za-z0-9_]*Props(?:<[^>]*>)?\s*(?:=\s*)?(?:extends[^{]*)?\{([\s\S]*?)\n\}/m.exec(text);
  if (!m) return out;
  let body = m[1]!.replace(/\/\*\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  body = body.replace(/\([^()]*\)/g, (s) => s.replace(/[;\n]/g, " "));
  // Nested object types read as a single `object` prop (innermost first).
  for (let prev = ""; prev !== body; ) {
    prev = body;
    body = body.replace(/\{[^{}]*\}/g, "object");
  }
  for (const line of body.split(/[;\n]/)) {
    const p = /^\s*(?:readonly\s+)?([A-Za-z_$][\w$]*)(\?)?\s*:\s*(.+?)\s*$/.exec(line);
    if (!p) continue;
    const key = p[1]!;
    if (key === "className" || key === "children" || key === "style") continue;
    out[key] = `${p[3]!.replace(/\s+/g, " ").trim()}${p[2] ? "?" : ""}`;
  }
  return out;
}

// ── 4. main ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const specs = ONLY ? COMPONENTS.filter((c) => c.id === ONLY) : COMPONENTS;
  if (specs.length === 0) throw new Error(`no component matches --only ${ONLY}`);

  log(`Kit ${KIT_VERSION}: ${specs.length} components`);
  const gaps = await ensureCaptures(specs);
  placeLicenseEvidence();

  for (const f of writeAirAssets()) log(`air ${path.relative(KIT_ROOT, f)}`);

  const { sbom } = await buildSbom(log);
  const nodeModules = extractVendor(log);
  const vendorNames = sbom.components.map((c) => c.name);

  const harvested = specs.map(harvestComponent);
  for (const h of harvested) writeHarvested(h);

  // Lint + measure.
  const metas = new Map<string, Meta>();
  const prevMeta = (id: string): Meta | null => {
    const p = path.join(KIT_DIR, id, "meta.json");
    return exists(p) ? readJson<Meta>(p) : null;
  };
  const verdicts: Map<string, Verdict> = SKIP_HARNESS ? new Map() : await runHarness(harvested.map((h) => h.spec), nodeModules, log);

  for (const h of harvested) {
    const spec = h.spec;
    const entry = spec.entry ?? "index.tsx";
    const entryPath = path.join(KIT_DIR, spec.id, entry);
    const findings = h.files.flatMap((f) => lintFile(`${spec.id}/${f.to}`, f.text, { lite: spec.litePolicy === "auto" }));
    const hard = hardFindings(findings);
    const weight = await measureComponent(entryPath, nodeModules, vendorNames);
    const prev = prevMeta(spec.id);
    const verdict = verdicts.get(spec.id) ?? (prev ? { ok: prev.harness.ok, errors: prev.harness.errors, heightPx: prev.harness.heightPx, requests: [] } : null);
    if (!verdict) throw new Error(`${spec.id}: no harness verdict and no previous meta.json; run without --skip-harness`);

    let liteReason: string | null = null;
    if (spec.litePolicy === "never") liteReason = spec.litePolicyReason ?? "policy: non-lite surface";
    else if (hard.length) liteReason = `csp: ${hard[0]!.rule}`;
    else if (!verdict.ok) liteReason = `harness: ${verdict.errors[0] ?? (verdict.requests[0] ? `request ${verdict.requests[0]}` : "empty render")}`;
    const lite = liteReason === null;

    const entryText = h.files.find((f) => f.to === entry)?.text ?? "";
    const props = { ...extractProps(entryText), ...(spec.props ?? {}) };
    const src = source(spec.source);
    const meta: Meta = {
      id: spec.id,
      title: spec.title,
      tags: [...spec.tags],
      when: spec.when,
      kind: spec.kind ?? "component",
      entry,
      props,
      deps: [...spec.deps],
      weightKb: weight,
      lite,
      liteReason,
      touch: spec.touch,
      reducedMotion: spec.reducedMotion,
      author: spec.author ?? h.author ?? src.author,
      license: { spdx: src.spdx, tier: src.tier, source: provenance(src) },
      csp: { ok: hard.length === 0, findings: findings.map((f) => `${f.severity} ${f.rule} ${f.file}:${f.line} ${f.hint}`) },
      harness: { viewport: "390x760", webgl: false, reducedMotion: true, ok: verdict.ok, heightPx: verdict.heightPx, errors: [...verdict.errors, ...verdict.requests.map((r) => `request: ${r}`)] },
      notes: [...(spec.notes ?? []), ...h.notes],
    };
    metas.set(spec.id, meta);
    writeJson(path.join(KIT_DIR, spec.id, "meta.json"), meta);
    writeText(path.join(KIT_DIR, spec.id, "ref.md"), buildRef(spec, meta));
    log(`${lite ? "lite" : "----"} ${spec.id.padEnd(40)} js=${weight.js}kb css=${weight.css}kb full=${weight.jsFull}kb${liteReason ? `  (${liteReason})` : ""}`);
  }

  // Air entry gets a meta too so the catalog lists it.
  const airMetaSpecs = ONLY ? [] : [airMeta(nodeModules)];
  for (const p of airMetaSpecs) metas.set(p.id, await p.meta);

  // Aggregate lite budget: every lite entry in one bundle with React included.
  const allMetas = ONLY ? mergeWithExisting(metas) : [...metas.values()].sort((a, b) => a.id.localeCompare(b.id));
  const liteIds = allMetas.filter((m) => m.lite && m.kind !== "helper").map((m) => m.id);
  const aggEntry = path.join(HARNESS_DIR, "lite-set.tsx");
  writeText(
    aggEntry,
    `import "../kit/air/theme.css";\nimport "../kit/air/shell.css";\nexport * as air from "../kit/air/index.ts";\n` +
      liteIds.filter((id) => id !== "air").map((id, i) => `export * as c${i} from "../kit/${id}/${allMetas.find((m) => m.id === id)!.entry}";`).join("\n") +
      "\n"
  );
  const agg = await bundle(aggEntry, nodeModules, { externals: [], bundleReact: true });
  const liteJsKb = gzKb(agg.js);
  const liteCssKb = gzKb(agg.css);
  log(`lite set: ${liteIds.length} components, ${liteJsKb} KiB JS, ${liteCssKb} KiB CSS (budget ${BUDGETS.liteJsKb}/${BUDGETS.cssKb})`);

  // Lock.
  const files: Record<string, LockEntry> = {};
  const byDir = new Map(harvested.map((h) => [h.spec.id, h]));
  for (const inside of walk(KIT_DIR, (n) => n === ".DS_Store")) {
    const abs = path.join(KIT_DIR, inside);
    const rel = `kit/${inside}`;
    const id = inside.split("/").slice(0, 2).join("/");
    const name = inside.split("/").slice(2).join("/");
    const h = byDir.get(id);
    const text = fs.readFileSync(abs);
    const src = h ? source(h.spec.source) : null;
    const hf = h?.files.find((f) => f.to === name);
    if (h && src && hf?.from) {
      files[rel] = {
        source: provenance(src),
        sourceType: src.pin.kind,
        skillPath: hf.from,
        computedHash: sha256(text),
        upstreamHash: sha256(hf.upstream!),
        component: id,
        spdx: src.spdx,
        tier: src.tier,
      };
    } else {
      files[rel] = {
        source: "gratitude5dee/airv2",
        sourceType: "air",
        skillPath: null,
        computedHash: sha256(text),
        upstreamHash: null,
        component: inside.startsWith("air/") ? "air" : id,
        spdx: h ? source(h.spec.source).spdx : "MIT",
        tier: "A",
      };
    }
  }
  const prevLock = exists(LOCK_FILE) ? readJson<Lock>(LOCK_FILE) : null;
  if (ONLY && prevLock) for (const [k, v] of Object.entries(prevLock.files)) if (!(k in files) && !k.startsWith(`kit/${ONLY}/`)) files[k] = v;
  const lock: Lock = {
    version: 1,
    kit: { version: KIT_VERSION, components: allMetas.length, liteJsKb, liteCssKb, budgets: BUDGETS },
    files: sortKeys(files),
  };
  writeJson(LOCK_FILE, lock);

  // kit.sources.json
  const sourcesJson: SourcesJsonEntry[] = SOURCES.map((s) => ({
    id: s.id,
    name: s.name,
    homepage: s.homepage,
    author: s.author,
    spdx: s.spdx,
    tier: s.tier,
    pin: s.pin,
    licenseEvidence: s.licenseEvidence,
    harvested: COMPONENTS.filter((c) => c.source === s.id).map((c) => c.id),
    excluded: s.excluded.filter((e) => !e.reason.startsWith("GAP")),
    gaps: [
      ...s.excluded.filter((e) => e.reason.startsWith("GAP")).map((e) => ({ name: e.name, reason: e.reason.replace(/^GAP\s*[—-]\s*/, "") })),
      ...(gaps.get(s.id) ?? []).map((name) => ({ name, reason: "capture failed at harvest time" })),
    ],
  }));
  writeJson(SOURCES_FILE, { $schema: "air-create-kit/sources@1", kit: KIT_VERSION, sources: sourcesJson });

  // Docs.
  const inputs = { metas: allMetas, liteJsKb, liteCssKb };
  writeText(DESIGN_FILE, buildDesign(inputs));
  writeText(SYSTEM_PROMPT_FILE, buildSystemPrompt(inputs));
  writeText(TEMPLATE_DESIGN_FILE, readText(DESIGN_FILE));
  log(`wrote ${path.relative(KIT_ROOT, DESIGN_FILE)}, ${path.relative(KIT_ROOT, SYSTEM_PROMPT_FILE)}, ${path.relative(KIT_ROOT, TEMPLATE_DESIGN_FILE)}`);
  if (gaps.size) log(`GAPS: ${[...gaps].map(([s, g]) => `${s}: ${g.join(", ")}`).join("; ")}`);
}

function mergeWithExisting(fresh: Map<string, Meta>): Meta[] {
  const out = new Map<string, Meta>();
  for (const rel of walk(KIT_DIR)) {
    if (path.basename(rel) !== "meta.json") continue;
    const m = readJson<Meta>(path.join(KIT_DIR, rel));
    out.set(m.id, m);
  }
  for (const [k, v] of fresh) out.set(k, v);
  return [...out.values()].sort((a, b) => a.id.localeCompare(b.id));
}

function airMeta(nodeModules: string): { id: string; meta: Promise<Meta> } {
  const entry = path.join(KIT_DIR, "air", "index.ts");
  const meta = (async (): Promise<Meta> => {
    const text = readText(entry);
    const findings = [
      ...lintFile("air/index.ts", text, { lite: true }),
      ...lintFile("air/theme.css", readText(path.join(KIT_DIR, "air", "theme.css")), { lite: true }),
      ...lintFile("air/shell.css", readText(path.join(KIT_DIR, "air", "shell.css")), { lite: true }),
    ];
    const weight = await measureComponent(entry, nodeModules, [...DIRECT, ...NON_LITE]);
    const cssEntry = path.join(HARNESS_DIR, "air-css.ts");
    writeText(cssEntry, `import "../kit/air/theme.css";\nimport "../kit/air/shell.css";\n`);
    const css = await bundle(cssEntry, nodeModules, { externals: [] });
    const m: Meta = {
      id: "air",
      title: "Air shell, theme and hooks",
      tags: ["air", "layout", "hooks", "state", "theme"],
      when: "Always: theme.css + shell.css give every screen its tokens and vocabulary; index.ts gives useLite(), useReducedMotion(), useTheme(), useAirState().",
      kind: "helper",
      entry: "index.ts",
      props: {
        "useAirState(resource?, initial?)": "{ state, status, canWrite, error, save, update, reload }",
        "useLite()": "boolean",
        "useReducedMotion()": "boolean",
        "useTheme()": '"atmosphere" | "pixel"',
        "cn(...classes)": "string",
      },
      deps: ["clsx", "tailwind-merge"],
      weightKb: { js: weight.js, css: gzKb(css.css), jsFull: weight.jsFull },
      lite: true,
      liteReason: null,
      touch: true,
      reducedMotion: "n/a",
      author: "Air",
      license: { spdx: "MIT", tier: "A", source: "gratitude5dee/airv2" },
      csp: { ok: hardFindings(findings).length === 0, findings: findings.map((f) => `${f.severity} ${f.rule} ${f.file}:${f.line} ${f.hint}`) },
      harness: { viewport: "390x760", webgl: false, reducedMotion: true, ok: true, heightPx: 0, errors: [] },
      notes: ["Generated from apps/web/lib/miniapps/themes.ts and shell.ts; regenerate with harvest, never edit theme.css/shell.css."],
    };
    writeJson(path.join(KIT_DIR, "air", "meta.json"), m);
    writeText(path.join(KIT_DIR, "air", "ref.md"), airRef(m));
    return m;
  })();
  return { id: "air", meta };
}

function airRef(m: Meta): string {
  return (
    `<!-- GENERATED by packages/create-kit/scripts/harvest.ts — do not edit. -->\n\n` +
    `# ${m.title} (\`air\`)\n\n${m.when}\n\n` +
    `- **Weight**: ${m.weightKb.js} KiB JS (hooks), ${m.weightKb.css} KiB CSS (theme + shell), gzip.\n` +
    `- **Files**: \`kit/air/theme.css\` (tokens for both themes, lite and reduced-motion variants, self-hosted fonts), \`kit/air/shell.css\` (\`.app .panel .card .item .row .kicker .status\` vocabulary), \`kit/air/index.ts\`.\n\n` +
    `## Usage\n\n\`\`\`tsx\nimport "./kit/air/theme.css";\nimport "./kit/air/shell.css";\nimport { useAirState, useLite, useReducedMotion, cn } from "./kit/air";\n\n` +
    `function App() {\n  const { state, status, canWrite, update } = useAirState<{ items: string[] }>("main", { items: [] });\n  const lite = useLite();\n  if (status === "loading") return <main className="app"><div className="panel status">Loading…</div></main>;\n  return (\n    <main className={cn("app", lite && "app--lite")}>\n      <section className="panel">\n        {state.items.map((it) => <div key={it} className="item">{it}</div>)}\n        {canWrite !== false && (\n          <button className="row" onClick={() => update((s) => ({ items: [...s.items, "new"] }))}>Add</button>\n        )}\n      </section>\n    </main>\n  );\n}\n\`\`\`\n\n` +
    `## API\n\n${Object.entries(m.props).map(([k, v]) => `- \`${k}\` → \`${v}\``).join("\n")}\n\n` +
    `## Rules\n\n- State lives in the Apps API (\`${"/api/apps/v1/state"}\`), never in localStorage/sessionStorage/IndexedDB: every mini-app shares the mini origin.\n- \`save\`/\`update\` refuse bodies over 256 KiB and roll back on failure; a 403 flips \`canWrite\` to \`false\` (guest) and the UI must go read-only.\n- \`canWrite\` is \`null\` until the first write attempt — render controls optimistically, hide them on \`false\`.\n- Theme is chosen by the shell (\`html[data-theme]\`); read it with \`useTheme()\`, never set it.\n- \`useLite()\` reads \`html[data-lite="1"]\` and \`navigator.connection.saveData\`; under lite there is no blur, no fixed backgrounds and no app animation.\n`
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.stack ?? err.message : err);
  process.exit(1);
});
