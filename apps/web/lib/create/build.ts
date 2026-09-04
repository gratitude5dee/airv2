/**
 * V11 §9.3 Lane B — the Build Service. A workspace tree from the Box becomes
 * a staged draft version:
 *
 *   pull tree → air.json (air.app.v1) → esbuild with Kit-only resolution
 *   → theme + pruned shell + utility CSS → lintBundle → validateBundle
 *   → manifest.json → uploadVersion(..., "vibe", { promote: false })
 *   → { version, preview_url, findings, sizes }
 *
 * `compileWorkspace` is the pure core (files in, bundle + findings out) and
 * `buildApp` wraps it with the Box, the registry and the ledger. A build with
 * a hard finding produces no version; `visibility`/`access`/`password`/
 * `price` in air.json are proposals the build never applies (§4.1). Source
 * never touches Postgres — the ledger row carries digests, findings and
 * sizes only.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { gzipSync } from "node:zlib";
import type { SupabaseClient } from "@supabase/supabase-js";
import esbuild from "esbuild";
import { z } from "zod";
import { runCommand, type ComputeTarget } from "../compute/runtime";
import { ensureComputeAwake } from "../compute/awake";
import { env } from "../env";
import {
  BundleError,
  bundleContentType,
  validateBundle,
  type BundleFile,
} from "../miniapps/bundles";
import { nestedPathFor } from "../miniapps/nested";
import { PublishError, validateAppName } from "../miniapps/publish";
import type { RegistryApp } from "../miniapps/registry";
import { buildStylesheet, type ThemeName } from "./css";
import { resolveDropApp } from "./drop";
import {
  classifySpecifier,
  ensureRestrictedExtracted,
  ensureVendorExtracted,
  kitBudgets,
  kitComponentIdOf,
  kitDir,
  kitRoot,
  kitVersion,
  KitError,
  listKitComponents,
  nonLiteVendorNames,
  packageNameOf,
  readTarGz,
  resolveKitFile,
  restrictedConfig,
  restrictedEntry,
  safeArchivePath,
  vendorAliases,
  vendorPackageNames,
} from "./kit";
import { lintBundle, LintError } from "./lint";
import { draftPreviewUrl } from "./preview";
import { newVersionId, uploadVersion, VersionError, type Finding } from "./versions";

export const AIR_APP_SCHEMA = "air.app.v1";
export const WORKSPACE_ROOT = ".hermes/create";
export const WORKSPACE_MAX_FILES = 400;
export const WORKSPACE_MAX_BYTES = 24 * 1024 * 1024;
export const SOURCE_MAX_BYTES = 512 * 1024;
export const ASSET_MAX_BYTES = 2 * 1024 * 1024;
export const LOG_TAIL_LINES = 50;

const APPNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const KIT_ID_RE = /^(air|[a-z0-9-]+\/[a-z0-9-]+)$/;
const ACTION_RE = /^[a-z][a-z0-9_-]{0,47}$/;
const SOURCE_EXT = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".css", ".json", ".html", ".txt", ".md"]);
const ASSET_EXT = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".woff", ".woff2", ".mp3", ".mp4", ".webm", ".json", ".txt", ".md"]);

export const airJsonSchema = z
  .object({
    schema: z.literal(AIR_APP_SCHEMA),
    appname: z.string().regex(APPNAME_RE, "appname must be 1–32 lowercase letters, digits, or hyphens"),
    name: z.string().trim().min(1).max(80),
    description: z.string().max(400).default(""),
    lane: z.enum(["vibe", "drop", "import"]).default("vibe"),
    entry: z
      .string()
      .regex(/^src\/[A-Za-z0-9_./-]+\.(tsx|ts|jsx|js)$/, "entry must be a file under src/")
      .default("src/main.tsx"),
    theme: z.enum(["atmosphere", "pixel"]).default("atmosphere"),
    surface: z
      .object({ lite: z.boolean().default(true), expanded: z.boolean().default(true) })
      .default({ lite: true, expanded: true }),
    kit: z
      .object({
        version: z.string().max(40).optional(),
        components: z.array(z.string().regex(KIT_ID_RE)).max(64).default([]),
      })
      .default({ components: [] }),
    actions: z.array(z.string().regex(ACTION_RE)).max(64).default([]),
    guestActions: z.array(z.string().regex(ACTION_RE)).max(64).default([]),
    functions: z.null().or(z.object({ entry: z.string() })).default(null),
    visibility: z.enum(["public", "unlisted", "private"]).optional(),
    access: z.enum(["single", "multiplayer"]).optional(),
    password: z.string().optional(),
    price: z.number().nonnegative().optional(),
  })
  .strict();

export type AirJson = z.infer<typeof airJsonSchema>;

export interface WorkspaceFile {
  /** Workspace-relative POSIX path (`src/main.tsx`). */
  path: string;
  bytes: Buffer;
}

export interface BuildSizes {
  js: number;
  css: number;
  html: number;
  assets: number;
  total: number;
  js_gzip: number;
  css_gzip: number;
  files: number;
}

export interface CompileOutput {
  files: BundleFile[];
  findings: Finding[];
  sizes: BuildSizes;
  manifest: BuildManifest | null;
  /** Content-free build log: stage names and counts, never source. */
  log: string[];
  air: AirJson | null;
}

export interface BuildManifest {
  schema: "air.manifest.v1";
  appname: string;
  name: string;
  theme: ThemeName;
  actions: string[];
  guestActions: string[];
  functions: null;
  kit: { version: string; components: string[] };
  surface: { lite: boolean; expanded: boolean };
  version: string;
}

export interface BuildResult {
  slug: string;
  appname: string;
  /** Null when a hard finding stopped the build (§9.3). */
  version: string | null;
  preview_url: string | null;
  url: string;
  findings: Finding[];
  sizes: BuildSizes;
  log: string[];
  status: RegistryApp["status"];
}

export class BuildError extends Error {
  readonly status: number;
  readonly findings: Finding[];
  constructor(message: string, status = 400, findings: Finding[] = []) {
    super(message);
    this.name = "BuildError";
    this.status = status;
    this.findings = findings;
  }
}

export function hard(findings: Finding[]): Finding[] {
  return findings.filter((finding) => finding.severity === "hard");
}

function finding(
  file: string,
  rule: string,
  hint: string,
  severity: "hard" | "soft" = "hard",
  line?: number
): Finding {
  return line === undefined ? { file, rule, hint, severity } : { file, line, rule, hint, severity };
}

/* ------------------------------------------------------------ air.json */

export function parseAirJson(text: string): { air: AirJson | null; findings: Finding[] } {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { air: null, findings: [finding("air.json", "schema", "air.json is not valid JSON")] };
  }
  const parsed = airJsonSchema.safeParse(raw);
  if (!parsed.success) {
    const findings = parsed.error.issues.slice(0, 20).map((issue) =>
      finding(
        "air.json",
        "schema",
        `${issue.path.join(".") || "root"}: ${issue.message} (schema ${AIR_APP_SCHEMA})`
      )
    );
    return { air: null, findings };
  }
  const air = parsed.data;
  const findings: Finding[] = [];
  for (const guest of air.guestActions) {
    if (!air.actions.includes(guest)) {
      findings.push(
        finding("air.json", "schema", `guestActions.${guest} is not one of actions`)
      );
    }
  }
  if (air.functions !== null) {
    findings.push(
      finding(
        "air.json",
        "functions",
        "functions are not built in this lane yet (MC5); set functions to null",
        "soft"
      )
    );
  }
  return { air: findings.some((f) => f.severity === "hard") ? null : air, findings };
}

/* ------------------------------------------------------------ workspace */

export function workspacePath(appname: string): string {
  return `${WORKSPACE_ROOT}/${validateAppName(appname)}`;
}

/** Workspace-relative path or null when it cannot be trusted. */
export function safeWorkspacePath(entryPath: string): string | null {
  const safe = safeArchivePath(entryPath);
  if (!safe) return null;
  const top = safe.split("/")[0]!;
  if (top === "air.json" && safe === top) return safe;
  if (top === "create.plan.md" && safe === top) return safe;
  if (!["src", "public"].includes(top)) return null;
  return safe;
}

/**
 * Size and shape checks on the tree before anything reads it. The caps are
 * the bundle contract's, so a workspace that fits here can fit a version.
 */
export function checkWorkspace(files: WorkspaceFile[]): Finding[] {
  const findings: Finding[] = [];
  if (files.length > WORKSPACE_MAX_FILES) {
    findings.push(finding("workspace", "size", `more than ${WORKSPACE_MAX_FILES} files`));
  }
  let total = 0;
  for (const file of files) {
    total += file.bytes.length;
    const ext = path.posix.extname(file.path).toLowerCase();
    if (file.path.startsWith("src/")) {
      if (!SOURCE_EXT.has(ext)) {
        findings.push(finding(file.path, "workspace", `${ext || "extensionless"} files do not belong in src/`));
      } else if (file.bytes.length > SOURCE_MAX_BYTES) {
        findings.push(finding(file.path, "size", `source files are capped at ${SOURCE_MAX_BYTES / 1024} KiB`));
      }
    } else if (file.path.startsWith("public/")) {
      if (ext === ".svg") {
        findings.push(finding(file.path, "workspace", "svg is scriptable; export png or webp"));
      } else if (!ASSET_EXT.has(ext)) {
        findings.push(finding(file.path, "workspace", `${ext || "extensionless"} assets cannot be served`));
      } else if (file.bytes.length > ASSET_MAX_BYTES) {
        findings.push(finding(file.path, "size", `assets are capped at ${ASSET_MAX_BYTES / 1024 / 1024} MiB each`));
      }
    }
  }
  if (total > WORKSPACE_MAX_BYTES) {
    findings.push(finding("workspace", "size", `workspace exceeds ${WORKSPACE_MAX_BYTES / 1024 / 1024} MiB`));
  }
  return findings;
}

/**
 * The tree as one gzipped tar over the command lane — one round trip, size-
 * capped on the Box side so a runaway workspace is a finding, not a payload.
 * `.build/`, `functions/` and anything hidden stay in the Box.
 */
export async function pullWorkspace(
  target: ComputeTarget,
  appname: string
): Promise<WorkspaceFile[]> {
  const dir = workspacePath(appname);
  const cap = WORKSPACE_MAX_BYTES + 1;
  const cmd =
    `cd "$HOME/${dir}" 2>/dev/null || exit 3; ` +
    `tar -czf - --exclude='.*' --exclude='node_modules' air.json create.plan.md src public 2>/dev/null | head -c ${cap} | base64 -w0`;
  const result = await runCommand(target, cmd, 60);
  if (result.exitCode === 3) throw new BuildError("no workspace for that app", 404);
  const archive = Buffer.from(result.stdout.trim(), "base64");
  if (archive.length === 0) throw new BuildError("workspace is empty", 400);
  if (archive.length >= cap) {
    throw new BuildError(`workspace exceeds ${WORKSPACE_MAX_BYTES / 1024 / 1024} MiB`, 413);
  }
  let entries;
  try {
    entries = readTarGz(archive, {
      maxFiles: WORKSPACE_MAX_FILES + 1,
      // tar headers + 512-byte padding on top of the content cap
      maxBytes: WORKSPACE_MAX_BYTES + (WORKSPACE_MAX_FILES + 1) * 1024 + 1,
    });
  } catch (error) {
    if (error instanceof KitError) throw new BuildError(error.message, error.status);
    throw error;
  }
  const files: WorkspaceFile[] = [];
  for (const entry of entries) {
    const safe = safeWorkspacePath(entry.path);
    if (!safe) continue;
    files.push({ path: safe, bytes: entry.bytes });
  }
  return files;
}

export interface WorkspaceEntry {
  path: string;
  bytes: number;
}

/** Paths and sizes only (the Files tab's tree); the same visibility rules
 * as `pullWorkspace`, so `.build/` and `functions/` never list. */
export async function listWorkspace(
  target: ComputeTarget,
  appname: string
): Promise<WorkspaceEntry[]> {
  const dir = workspacePath(appname);
  const cmd =
    `cd "$HOME/${dir}" 2>/dev/null || exit 3; ` +
    `find air.json create.plan.md src public -type f -not -path '*/.*' -not -path '*/node_modules/*' -printf '%s %p\\n' 2>/dev/null | head -n ${WORKSPACE_MAX_FILES}`;
  const result = await runCommand(target, cmd, 30);
  if (result.exitCode === 3) throw new BuildError("no workspace for that app", 404);
  const entries: WorkspaceEntry[] = [];
  for (const line of result.stdout.split("\n")) {
    const match = /^(\d+) (.+)$/.exec(line.trim());
    if (!match) continue;
    const safe = safeWorkspacePath(match[2]!);
    if (!safe) continue;
    entries.push({ path: safe, bytes: Number(match[1]) });
  }
  return entries.sort((a, b) => a.path.localeCompare(b.path));
}

/* ------------------------------------------------------------ compile */

interface KitPluginState {
  findings: Finding[];
  used: Set<string>;
  restrictedUsed: Set<string>;
  vendorUsed: Set<string>;
}

function within(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel === "" || (!rel.startsWith("..") && !path.isAbsolute(rel));
}

function relTo(sandbox: string, file: string): string {
  return path.relative(sandbox, file).split(path.sep).join("/");
}

/**
 * Resolution policy as an esbuild plugin: workspace-relative imports stay in
 * the sandbox or map onto the Kit (`./kit/<source>/<name>` from any depth);
 * `@kit/*` maps onto the Kit; `@kit/restricted/*` onto the Tier B tree when
 * configured; bare names must be in the vendor SBOM (the alias map then pins
 * them). Everything else is a hard finding with the importer's path.
 */
function kitPlugin(
  sandbox: string,
  vendor: Set<string>,
  nodeModules: string,
  restrictedDir: string | null,
  state: KitPluginState
): esbuild.Plugin {
  const root = kitRoot();
  const kit = kitDir(root);
  const fromVendor = (dir: string) => within(nodeModules, dir);
  const refuse = (importer: string, reason: string, rule = "foreign-import") => {
    const file = within(sandbox, importer) ? relTo(sandbox, importer) : path.basename(importer);
    state.findings.push(finding(file, rule, reason));
    return { errors: [{ text: reason }] };
  };
  return {
    name: "air-kit",
    setup(build) {
      build.onResolve({ filter: /^[^./]/ }, (args) => {
        if (args.kind === "entry-point" || fromVendor(args.resolveDir)) return null;
        const resolution = classifySpecifier(args.path, vendor, root);
        switch (resolution.kind) {
          case "kit":
            state.used.add(resolution.id);
            return { path: resolution.path };
          case "vendor":
            state.vendorUsed.add(resolution.pkg);
            return null;
          case "restricted": {
            if (!restrictedDir) {
              return refuse(
                args.importer,
                `${args.path} is a Tier B component; this Build Service is not configured for the restricted Kit`,
                "restricted-unavailable"
              );
            }
            const entry = restrictedEntry(restrictedDir, resolution.name);
            if (!entry) {
              return refuse(args.importer, `${args.path} is not in the restricted Kit`, "foreign-import");
            }
            state.restrictedUsed.add(resolution.name);
            return { path: entry };
          }
          case "foreign":
            return refuse(args.importer, resolution.reason);
        }
      });
      build.onResolve({ filter: /^\./ }, (args) => {
        if (args.kind === "entry-point" || fromVendor(args.resolveDir)) return null;
        const fromKit = within(kit, args.resolveDir) || (restrictedDir !== null && within(restrictedDir, args.resolveDir));
        const target = path.resolve(args.resolveDir, args.path);
        if (fromKit) {
          const resolved = resolveKitFile(target, root);
          if (resolved) {
            const id = kitComponentIdOf(resolved, root);
            if (id) state.used.add(id);
            return { path: resolved };
          }
          if (restrictedDir && within(restrictedDir, target)) return null;
          return refuse(args.importer, `${args.path} escapes the Kit`, "path-escape");
        }
        if (within(sandbox, target)) {
          const inSandbox = resolveSandboxFile(target);
          if (inSandbox) return { path: inSandbox };
        }
        const kitIndex = args.path.split("/").indexOf("kit");
        if (kitIndex >= 0) {
          const rest = args.path.split("/").slice(kitIndex + 1).join("/");
          const resolved = resolveKitFile(path.join(kit, rest), root);
          if (resolved) {
            const id = kitComponentIdOf(resolved, root);
            if (id) state.used.add(id);
            return { path: resolved };
          }
        }
        if (!within(sandbox, target)) {
          return refuse(args.importer, `${args.path} escapes the workspace`, "path-escape");
        }
        return refuse(args.importer, `${args.path} does not exist in the workspace`, "missing-import");
      });
      build.onResolve({ filter: /^\// }, (args) =>
        args.kind === "entry-point"
          ? null
          : refuse(args.importer, `${args.path}: absolute imports are not allowed`, "path-escape")
      );
    },
  };
}

function resolveSandboxFile(target: string): string | null {
  if (fs.existsSync(target) && fs.statSync(target).isFile()) return target;
  for (const ext of [".tsx", ".ts", ".jsx", ".js", ".css", ".json"]) {
    if (fs.existsSync(target + ext)) return target + ext;
  }
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) {
    for (const name of ["index.tsx", "index.ts", "index.jsx", "index.js"]) {
      const candidate = path.join(target, name);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function writeSandbox(files: WorkspaceFile[]): string {
  const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "air-build-"));
  for (const file of files) {
    const dest = path.join(sandbox, ...file.path.split("/"));
    if (!within(sandbox, dest)) continue;
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, file.bytes);
  }
  return sandbox;
}

function gzipBytes(text: string): number {
  return gzipSync(Buffer.from(text, "utf8"), { level: 9 }).length;
}

function emptySizes(): BuildSizes {
  return { js: 0, css: 0, html: 0, assets: 0, total: 0, js_gzip: 0, css_gzip: 0, files: 0 };
}

/** `?lite=1` (the Create surface's lite toggle, low-end webviews) flips
 * `<html data-lite>` so `useLite()` reads true; no inline script under CSP. */
const LITE_BANNER =
  'if(/[?&]lite=1(?:&|$)/.test(location.search))document.documentElement.setAttribute("data-lite","1");';

function htmlShell(air: AirJson, version: string): string {
  const title = air.name.replace(/[<>&"]/g, (ch) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;" })[ch]!);
  return [
    "<!doctype html>",
    `<html lang="en" data-theme="${air.theme}" data-version="${version}">`,
    "<head>",
    '<meta charset="utf-8">',
    '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">',
    '<meta name="color-scheme" content="dark">',
    `<title>${title}</title>`,
    '<link rel="stylesheet" href="app.css">',
    "</head>",
    "<body>",
    '<div id="root"></div>',
    '<script type="module" src="app.js"></script>',
    "</body>",
    "</html>",
    "",
  ].join("\n");
}

function injectIntoHtml(html: string): string {
  let out = html;
  if (!/<link[^>]+app\.css/.test(out)) {
    out = out.replace(/<\/head>/i, '<link rel="stylesheet" href="app.css">\n</head>');
  }
  if (!/<script[^>]+app\.js/.test(out)) {
    out = out.replace(/<\/body>/i, '<script type="module" src="app.js"></script>\n</body>');
  }
  return out;
}

export interface CompileOptions {
  /** Version id the manifest and shell carry; a fresh one when absent. */
  version?: string;
  /** Skip the Tier B lookup (tests, and builds that cannot reach R2). */
  restricted?: boolean;
}

/**
 * Files in, bundle out. Never throws on the app's account: every problem
 * with the workspace is a finding, and `files` is empty whenever a hard one
 * exists. Throws only when the Build Service itself is broken (Kit missing,
 * vendor snapshot corrupt).
 */
export async function compileWorkspace(
  files: WorkspaceFile[],
  options: CompileOptions = {}
): Promise<CompileOutput> {
  const log: string[] = [];
  const findings: Finding[] = [];
  const stop = (extra: Finding[] = []): CompileOutput => {
    findings.push(...extra);
    log.push(`stopped: ${hard(findings).length} hard finding(s)`);
    return { files: [], findings, sizes: emptySizes(), manifest: null, log, air: null };
  };

  log.push(`workspace: ${files.length} files`);
  const shape = checkWorkspace(files);
  if (hard(shape).length > 0) return stop(shape);
  findings.push(...shape);

  const airFile = files.find((file) => file.path === "air.json");
  if (!airFile) return stop([finding("air.json", "schema", "air.json is missing")]);
  const parsedAir = parseAirJson(airFile.bytes.toString("utf8"));
  findings.push(...parsedAir.findings);
  if (!parsedAir.air) return stop();
  const air = parsedAir.air;
  log.push(`air.json: ${air.appname} (${air.theme}, lite=${air.surface.lite})`);

  const entry = files.find((file) => file.path === air.entry);
  if (!entry) return stop([finding("air.json", "schema", `entry ${air.entry} is not in the workspace`)]);

  const components = listKitComponents();
  for (const id of air.kit.components) {
    if (!components.has(id)) {
      findings.push(finding("air.json", "foreign-import", `kit.components ${id} is not in the Kit`));
    }
  }
  if (hard(findings).length > 0) return stop();

  const version = options.version ?? `v${Date.now()}`;
  const vendor = vendorPackageNames();
  const nodeModules = await ensureVendorExtracted();
  const restrictedDir = options.restricted === false ? null : await ensureRestrictedExtracted();
  const sandbox = writeSandbox(files);
  const state: KitPluginState = {
    findings: [],
    used: new Set(),
    restrictedUsed: new Set(),
    vendorUsed: new Set(),
  };
  let js = "";
  let css = "";
  try {
    const result = await esbuild.build({
      entryPoints: [path.join(sandbox, ...air.entry.split("/"))],
      plugins: [kitPlugin(sandbox, vendor, nodeModules, restrictedDir, state)],
      bundle: true,
      write: false,
      minify: true,
      format: "esm",
      banner: air.surface.lite ? { js: LITE_BANNER } : {},
      platform: "browser",
      target: ["es2020", "safari15"],
      jsx: "automatic",
      metafile: true,
      logLevel: "silent",
      legalComments: "none",
      outdir: path.join(sandbox, ".out"),
      entryNames: "app",
      nodePaths: [nodeModules],
      alias: vendorAliases(nodeModules),
      define: { "process.env.NODE_ENV": '"production"' },
      loader: { ".png": "file", ".jpg": "file", ".jpeg": "file", ".webp": "file", ".gif": "file", ".woff2": "file", ".woff": "file", ".md": "text", ".txt": "text" },
      assetNames: "assets/[name]-[hash]",
      publicPath: "",
      absWorkingDir: sandbox,
    });
    for (const file of result.outputFiles) {
      if (file.path.endsWith(".css")) css += file.text;
      else if (file.path.endsWith(".js")) js += file.text;
    }
    for (const warning of result.warnings) {
      if (/directive/i.test(warning.text)) continue;
      const file = warning.location?.file;
      if (file && !within(sandbox, path.resolve(sandbox, file))) continue;
      findings.push(finding(file ?? air.entry, "compile", warning.text, "soft", warning.location?.line));
    }
    // Asset outputs (images referenced from source) ride along as files.
    const assetFiles: BundleFile[] = [];
    for (const file of result.outputFiles) {
      if (file.path.endsWith(".css") || file.path.endsWith(".js")) continue;
      assetFiles.push({ path: relTo(path.join(sandbox, ".out"), file.path), bytes: Buffer.from(file.contents) });
    }
    return await finish(assetFiles);
  } catch (error) {
    if (state.findings.length > 0) {
      return stop(state.findings);
    }
    const messages =
      error instanceof Error && "errors" in error && Array.isArray((error as { errors: unknown }).errors)
        ? ((error as { errors: esbuild.Message[] }).errors ?? [])
        : [];
    if (messages.length === 0) {
      if (error instanceof KitError) throw error;
      throw new BuildError(error instanceof Error ? error.message : "compile failed", 500);
    }
    return stop(
      messages.slice(0, 20).map((message) => {
        const file = message.location?.file;
        const rel = file ? (within(sandbox, path.resolve(sandbox, file)) ? relTo(sandbox, path.resolve(sandbox, file)) : path.basename(file)) : air.entry;
        return finding(rel, "compile", message.text, "hard", message.location?.line);
      })
    );
  } finally {
    fs.rmSync(sandbox, { recursive: true, force: true });
  }

  async function finish(assetFiles: BundleFile[]): Promise<CompileOutput> {
    log.push(`esbuild: ${(js.length / 1024).toFixed(1)} KiB js, ${state.used.size} kit component(s)`);
    if (air.surface.lite) {
      for (const id of state.used) {
        const meta = components.get(id);
        if (meta && !meta.lite) {
          findings.push(finding("air.json", "lite", `${id} is not lite; drop it or set surface.lite to false`));
        }
      }
      for (const name of state.restrictedUsed) {
        findings.push(finding("air.json", "lite", `@kit/restricted/${name} is not lite; drop it or set surface.lite to false`));
      }
      const nonLite = nonLiteVendorNames();
      for (const pkg of state.vendorUsed) {
        if (nonLite.has(packageNameOf(pkg))) {
          findings.push(finding("air.json", "lite", `${pkg} is not lite; drop it or set surface.lite to false`, "soft"));
        }
      }
    }
    if (hard(findings).length > 0) return stop();

    const htmlSource = files.find((file) => file.path === "src/index.html");
    const html = htmlSource ? injectIntoHtml(htmlSource.bytes.toString("utf8")) : htmlShell(air, version);
    const stylesheet = await buildStylesheet({
      theme: air.theme,
      lite: air.surface.lite,
      texts: [js, html],
      appCss: css,
    });
    if (stylesheet.utilityFailed) {
      findings.push(finding("app.css", "css", "utility classes were not generated; shell and theme only", "soft"));
    }
    log.push(`css: ${(stylesheet.css.length / 1024).toFixed(1)} KiB`);

    const bundle: BundleFile[] = [
      { path: "index.html", bytes: Buffer.from(html, "utf8") },
      { path: "app.js", bytes: Buffer.from(js, "utf8") },
      { path: "app.css", bytes: Buffer.from(stylesheet.css, "utf8") },
      ...assetFiles,
    ];
    for (const [fontPath, bytes] of stylesheet.fonts) bundle.push({ path: fontPath, bytes });
    for (const file of files) {
      if (!file.path.startsWith("public/")) continue;
      bundle.push({ path: file.path.slice("public/".length), bytes: file.bytes });
    }
    const manifest: BuildManifest = {
      schema: "air.manifest.v1",
      appname: air.appname,
      name: air.name,
      theme: air.theme,
      actions: air.actions,
      guestActions: air.guestActions,
      functions: null,
      kit: { version: kitVersion(), components: [...state.used].sort() },
      surface: air.surface,
      version,
    };
    bundle.push({ path: "manifest.json", bytes: Buffer.from(JSON.stringify(manifest), "utf8") });

    const seen = new Set<string>();
    for (const file of bundle) {
      if (seen.has(file.path)) {
        findings.push(finding(file.path, "workspace", "public/ file collides with a build output"));
      }
      seen.add(file.path);
    }
    if (hard(findings).length > 0) return stop();

    const sizes = measure(bundle, js, stylesheet.css, html);
    findings.push(...budgetFindings(sizes, air.surface.lite));
    const lint = lintBundle(bundle).map<Finding>((f) => ({
      file: f.file,
      line: f.line,
      rule: f.rule,
      hint: f.hint,
      severity: f.severity,
    }));
    findings.push(...lint);
    log.push(`lint: ${hard(lint).length} hard, ${lint.length - hard(lint).length} soft`);
    if (hard(findings).length > 0) return stop();
    try {
      validateBundle(bundle);
    } catch (error) {
      if (error instanceof BundleError) {
        return stop([finding("bundle", "bundle", error.message)]);
      }
      throw error;
    }
    log.push(`bundle: ${bundle.length} files, ${(sizes.total / 1024).toFixed(1)} KiB`);
    return { files: bundle, findings, sizes, manifest, log, air };
  }
}

function measure(bundle: BundleFile[], js: string, css: string, html: string): BuildSizes {
  let assets = 0;
  for (const file of bundle) {
    const type = bundleContentType(file.path) ?? "";
    if (/^(text\/(javascript|css|html))/.test(type)) continue;
    if (file.path === "manifest.json") continue;
    assets += file.bytes.length;
  }
  const sizes: BuildSizes = {
    js: Buffer.byteLength(js),
    css: Buffer.byteLength(css),
    html: Buffer.byteLength(html),
    assets,
    total: bundle.reduce((sum, file) => sum + file.bytes.length, 0),
    js_gzip: gzipBytes(js),
    css_gzip: gzipBytes(css),
    files: bundle.length,
  };
  return sizes;
}

function budgetFindings(sizes: BuildSizes, lite: boolean): Finding[] {
  const budgets = kitBudgets();
  const out: Finding[] = [];
  const jsKb = sizes.js_gzip / 1024;
  const cssKb = sizes.css_gzip / 1024;
  if (jsKb > budgets.hardJsKb) {
    out.push(finding("app.js", "budget", `${jsKb.toFixed(1)} KiB gzip exceeds the ${budgets.hardJsKb} KiB ceiling`));
  } else if (lite && jsKb > budgets.liteJsKb) {
    out.push(finding("app.js", "budget", `${jsKb.toFixed(1)} KiB gzip is over the ${budgets.liteJsKb} KiB lite budget`, "soft"));
  }
  if (cssKb > budgets.cssKb) {
    out.push(finding("app.css", "budget", `${cssKb.toFixed(1)} KiB gzip is over the ${budgets.cssKb} KiB budget`, "soft"));
  }
  return out;
}

/* ------------------------------------------------------------ build */

export interface BuildAppInput {
  appname: string;
  /** Pre-pulled tree (tests, and the route's 202 continuation). */
  files?: WorkspaceFile[];
  /** Already-resolved owner app (the tracked build opened its ledger row). */
  app?: RegistryApp;
  onLog?: (line: string) => void;
}

/**
 * The whole loop for one app: wake the Box, pull the tree, compile, and —
 * only when nothing hard was found — stage a draft version. The app row is
 * created on first build (lane `vibe`), exactly as Drop does for its lane.
 */
export async function buildApp(
  supabase: SupabaseClient,
  userId: string,
  input: BuildAppInput
): Promise<BuildResult> {
  const appname = validateAppName(input.appname);
  let files = input.files;
  if (!files) {
    const target = await ensureComputeAwake(supabase, userId);
    files = await pullWorkspace(target, appname);
  }
  const airFile = files.find((file) => file.path === "air.json");
  const parsedAir = airFile ? parseAirJson(airFile.bytes.toString("utf8")) : null;
  if (parsedAir?.air && parsedAir.air.appname !== appname) {
    throw new BuildError(`air.json names ${parsedAir.air.appname}, not ${appname}`, 400, parsedAir.findings);
  }
  const app =
    input.app ??
    (await resolveDropApp(
      supabase,
      userId,
      {
        appname,
        name: parsedAir?.air?.name,
        description: parsedAir?.air?.description,
      },
      "vibe"
    ));
  const version = newVersionId();
  const output = await compileWorkspace(files, { version });
  for (const line of output.log) input.onLog?.(line);
  const url = `${env.miniappOrigin().replace(/\/$/, "")}${nestedPathFor(app.slug)}`;
  if (output.files.length === 0 || hard(output.findings).length > 0) {
    return {
      slug: app.slug,
      appname,
      version: null,
      preview_url: null,
      url,
      findings: output.findings,
      sizes: output.sizes,
      log: output.log,
      status: app.status,
    };
  }
  const stored = await uploadVersion(supabase, app, output.files, "vibe", {
    findings: output.findings,
    promote: false,
    version,
    kitVersion: output.manifest?.kit.version ?? null,
  });
  output.log.push(`version: ${stored} staged as draft`);
  const staged: RegistryApp = { ...app, draft_version: stored };
  return {
    slug: app.slug,
    appname,
    version: stored,
    preview_url: draftPreviewUrl(staged),
    url,
    findings: output.findings,
    sizes: output.sizes,
    log: output.log,
    status: app.status,
  };
}

/** The Tier B lane is configured when both pins are present. */
export function restrictedKitConfigured(): boolean {
  return restrictedConfig() !== null;
}

/** Last `LOG_TAIL_LINES` lines, content-free by construction. */
export function logTail(log: string[]): string[] {
  return log.slice(-LOG_TAIL_LINES);
}

/* ------------------------------------------------------------ ledger */

export type BuildState = "queued" | "running" | "succeeded" | "failed";

/** One `create_builds` row as the status route reports it (§14.1). */
export interface BuildRecord {
  id: string;
  status: BuildState;
  log: string[];
  findings: Finding[];
  sizes: BuildSizes | null;
  version: string | null;
  error: string | null;
  started_at: string;
  finished_at: string | null;
}

const BUILD_COLUMNS =
  "id, status, log, findings, sizes, version, error, started_at, finished_at";

function asBuildRecord(row: Record<string, unknown>): BuildRecord {
  return {
    id: String(row["id"]),
    status: row["status"] as BuildState,
    log: Array.isArray(row["log"]) ? (row["log"] as string[]) : [],
    findings: Array.isArray(row["findings"]) ? (row["findings"] as Finding[]) : [],
    sizes: (row["sizes"] as BuildSizes | null) ?? null,
    version: (row["version"] as string | null) ?? null,
    error: (row["error"] as string | null) ?? null,
    started_at: String(row["started_at"]),
    finished_at: (row["finished_at"] as string | null) ?? null,
  };
}

export async function openBuild(
  supabase: SupabaseClient,
  app: RegistryApp,
  userId: string
): Promise<string> {
  const { data, error } = await supabase
    .from("create_builds")
    .insert({ app_id: app.id, user_id: userId, lane: "vibe", status: "running" })
    .select("id")
    .single();
  if (error || !data) {
    throw new Error(`build ledger insert failed: ${error?.message ?? "no row"}`);
  }
  return String((data as { id: string }).id);
}

export async function closeBuild(
  supabase: SupabaseClient,
  buildId: string,
  outcome:
    | { result: BuildResult }
    | { error: string; findings?: Finding[]; log?: string[] }
): Promise<void> {
  const patch =
    "result" in outcome
      ? {
          status: outcome.result.version ? "succeeded" : "failed",
          log: logTail(outcome.result.log),
          findings: outcome.result.findings,
          sizes: outcome.result.sizes,
          version: outcome.result.version,
          error: outcome.result.version ? null : "hard findings",
        }
      : {
          status: "failed",
          log: logTail(outcome.log ?? []),
          findings: outcome.findings ?? [],
          error: outcome.error.slice(0, 500),
        };
  const { error } = await supabase
    .from("create_builds")
    .update({ ...patch, finished_at: new Date().toISOString() })
    .eq("id", buildId);
  if (error) {
    console.error(
      JSON.stringify({ msg: "build ledger update failed", build_id: buildId, error: error.message })
    );
  }
}

export async function latestBuild(
  supabase: SupabaseClient,
  appId: string
): Promise<BuildRecord | null> {
  const { data } = await supabase
    .from("create_builds")
    .select(BUILD_COLUMNS)
    .eq("app_id", appId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? asBuildRecord(data as Record<string, unknown>) : null;
}

/** One build by id, only if it belongs to this owner *and* this app. */
export async function getBuild(
  supabase: SupabaseClient,
  userId: string,
  appId: string,
  buildId: string
): Promise<BuildRecord | null> {
  const { data } = await supabase
    .from("create_builds")
    .select(BUILD_COLUMNS)
    .eq("id", buildId)
    .eq("user_id", userId)
    .eq("app_id", appId)
    .maybeSingle();
  return data ? asBuildRecord(data as Record<string, unknown>) : null;
}

/** Errors a build may legitimately end with; anything else is a crash. */
export function buildFailureMessage(error: unknown): string | null {
  if (
    error instanceof BuildError ||
    error instanceof KitError ||
    error instanceof PublishError ||
    error instanceof BundleError ||
    error instanceof LintError ||
    error instanceof VersionError
  ) {
    return error.message;
  }
  return null;
}

/**
 * The route's build: open the ledger row, run, close it whatever happens.
 * The Box workspace is pulled inside so the row exists before the wake.
 */
export async function trackedBuild(
  supabase: SupabaseClient,
  userId: string,
  appname: string
): Promise<{ buildId: string; done: Promise<BuildResult> }> {
  const app = await resolveDropApp(supabase, userId, { appname }, "vibe");
  const buildId = await openBuild(supabase, app, userId);
  const log: string[] = [];
  const done = buildApp(supabase, userId, {
    appname,
    app,
    onLog: (line) => log.push(line),
  }).then(
    async (result) => {
      await closeBuild(supabase, buildId, { result });
      return result;
    },
    async (error: unknown) => {
      const message = buildFailureMessage(error);
      const findings = error instanceof BuildError ? error.findings : [];
      await closeBuild(supabase, buildId, {
        error: message ?? "build crashed",
        findings,
        log,
      });
      throw error;
    }
  );
  return { buildId, done };
}
