/**
 * V12 §10 the mirror — `gratitude5dee/wzrd-create` (CR20).
 *
 * After the owner approves a publish decision whose payload says
 * `mirror: true`, the version's source is copied under
 * `apps/<username>/<appname>/` in the mirror repository: one commit per
 * version, made through the platform's own GitHub App installation on that
 * repository (`WZRD_CREATE_INSTALLATION_ID`) with the git-data API. The tree
 * is pulled from the Box the way `build.ts` does and scrubbed first:
 * `.build/`, `node_modules`, anything the built version did not consume,
 * Tier B modules (`@kit/restricted/*` → a stub + NOTICE.md), anything
 * `textContainsSecrets` flags, and binaries over 2 MiB are left out and
 * listed in `.wzrd/manifest.json` `omitted[]`. The mirror is a copy of what
 * the app origin serves, not a deploy path: pushing to it deploys nothing.
 *
 * Postgres holds the receipt only (`miniapp_versions.mirrored_at`,
 * `mirror_commit`) and, on failure, a short error class on
 * `create_intakes.mirror_error` — never a URL, never content.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureComputeAwake } from "../compute/awake";
import { isBoxEnvironment } from "../compute/environments";
import { readComputeFile } from "../compute/runtime";
import { env } from "../env";
import { installationToken } from "../github/app";
import { bundleKey } from "../miniapps/bundles";
import { splitPublishedSlug } from "../miniapps/nested";
import type { RegistryApp } from "../miniapps/registry";
import { armStopAfter } from "../orchestrator/boxes";
import { recordOpsEvent, type OpsEventKind } from "../security/limits";
import { textContainsSecrets } from "../storage/guard";
import { listKeys, r2Configured } from "../storage/r2";
import { pullWorkspace, workspacePath, type WorkspaceFile } from "./build";
import { createConfig } from "./config";
import { RESTRICTED_SPECIFIER_RE } from "./kit";
import { devUrl } from "./release";
import type { VersionRow } from "./versions";

/* ---------------------------------------------------------------- types */

export type OmitReason = "not-built" | "build-dir" | "node_modules" | "tier-b" | "secret" | "too-large";

export interface MirrorInputFile {
  path: string;
  text?: string | undefined;
  bytes?: Buffer | undefined;
}

export interface MirrorFile {
  path: string;
  bytes: Buffer;
}

export interface Omitted {
  path: string;
  reason: OmitReason;
}

export interface FilterResult {
  kept: MirrorFile[];
  omitted: Omitted[];
}

export class MirrorError extends Error {
  readonly status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.name = "MirrorError";
    this.status = status;
  }
}

/** §10.1: assets over this size stay out of the mirror. */
export const MIRROR_BINARY_MAX_BYTES = 2 * 1024 * 1024;
export const TIER_B_STUB = "// omitted: Tier B (Commons Clause) — see NOTICE\n";
export const NOTICE_PATH = "NOTICE.md";
export const MANIFEST_PATH = ".wzrd/manifest.json";
export const MIRROR_BRANCH = "main";
export const MIRROR_LICENSE = "MIT";

export const NOTICE_MD =
  "# NOTICE\n\n" +
  "One or more modules of this app import `@kit/restricted/*` — the Tier B\n" +
  "component pack, licensed under the Commons Clause and not redistributable\n" +
  "here. Their bodies are replaced with a one-line stub in this mirror; the\n" +
  "app as served at its origin contains the real modules. Everything else in\n" +
  `this folder is ${MIRROR_LICENSE}-licensed per the LICENSE at the repository root.\n`;

/** §10.1 hosting statement, verbatim in every generated README. */
export const HOSTING_STATEMENT =
  "Apps here run at `link.wzrd.tech/<u>/<a>` (dev) and `mini.wzrd.tech/<u>/<a>` (production). " +
  "This repository is a source mirror, not the deploy path.";

/* --------------------------------------------------------------- filter */

const RESTRICTED_IMPORT_RE =
  /(?:from\s*|import\s*\(?\s*|require\s*\(\s*)["'](@kit\/restricted\/[a-z0-9-]+)["']/;
const TEXT_EXT_RE = /\.(?:[cm]?[jt]sx?|json|md|txt|css|html?|svg|ya?ml|toml|env|xml|csv|txt)$/i;

function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "").replace(/^\/+/, "");
}

function hasSegment(path: string, segment: string): boolean {
  return path.split("/").includes(segment);
}

/** Text when it has no NUL in its first 8 KiB and decodes as UTF-8 cleanly. */
export function looksLikeText(bytes: Buffer, path: string): boolean {
  if (TEXT_EXT_RE.test(path)) return true;
  const head = bytes.subarray(0, 8192);
  if (head.includes(0)) return false;
  return Buffer.from(head.toString("utf8"), "utf8").equals(head);
}

/** True when the module imports a Tier B (`@kit/restricted/*`) specifier (CR11). */
export function importsRestricted(text: string): boolean {
  const match = RESTRICTED_IMPORT_RE.exec(text);
  return match !== null && RESTRICTED_SPECIFIER_RE.test(match[1] ?? "");
}

/**
 * Pure §10.2 scrub. `builtFileList` names the workspace paths the built
 * version consumed; anything else is `not-built`. Order per file: build
 * dir → node_modules → not built → binary size → Tier B stub → secrets.
 * A Tier B module stays in `kept` as the stub (so the import graph still
 * reads) and is listed in `omitted` with reason `tier-b`; NOTICE.md is
 * added once when any module was stubbed.
 */
export function filterMirrorTree(files: readonly MirrorInputFile[], builtFileList: readonly string[]): FilterResult {
  const built = new Set(builtFileList.map(normalizePath));
  const kept: MirrorFile[] = [];
  const omitted: Omitted[] = [];
  let stubbed = false;
  const seen = new Set<string>();
  for (const file of files) {
    const path = normalizePath(file.path);
    if (!path || seen.has(path)) continue;
    seen.add(path);
    if (hasSegment(path, ".build")) {
      omitted.push({ path, reason: "build-dir" });
      continue;
    }
    if (hasSegment(path, "node_modules")) {
      omitted.push({ path, reason: "node_modules" });
      continue;
    }
    if (!built.has(path)) {
      omitted.push({ path, reason: "not-built" });
      continue;
    }
    const bytes = file.bytes ?? Buffer.from(file.text ?? "", "utf8");
    const isText = file.text !== undefined || looksLikeText(bytes, path);
    if (!isText) {
      if (bytes.length > MIRROR_BINARY_MAX_BYTES) {
        omitted.push({ path, reason: "too-large" });
        continue;
      }
      kept.push({ path, bytes });
      continue;
    }
    const text = file.text ?? bytes.toString("utf8");
    if (importsRestricted(text)) {
      omitted.push({ path, reason: "tier-b" });
      kept.push({ path, bytes: Buffer.from(TIER_B_STUB, "utf8") });
      stubbed = true;
      continue;
    }
    if (textContainsSecrets(text) !== null) {
      omitted.push({ path, reason: "secret" });
      continue;
    }
    kept.push({ path, bytes });
  }
  if (stubbed && !seen.has(NOTICE_PATH)) {
    kept.push({ path: NOTICE_PATH, bytes: Buffer.from(NOTICE_MD, "utf8") });
  }
  return { kept, omitted };
}

/* ------------------------------------------------------------- manifest */

export interface MirrorManifest {
  version: string;
  bundle_sha256: string;
  worker_sha256: string | null;
  kit_version: string | null;
  mirrored_at: string;
  omitted: Omitted[];
}

/** `.wzrd/manifest.json` (§10.1). Sorted `omitted[]`, stable key order. */
export function writeManifest(manifest: MirrorManifest): MirrorFile {
  const body = {
    schema: "wzrd.mirror.v1",
    version: manifest.version,
    bundle_sha256: manifest.bundle_sha256,
    worker_sha256: manifest.worker_sha256,
    kit_version: manifest.kit_version,
    mirrored_at: manifest.mirrored_at,
    omitted: [...manifest.omitted].sort((a, b) => a.path.localeCompare(b.path)),
  };
  return { path: MANIFEST_PATH, bytes: Buffer.from(`${JSON.stringify(body, null, 2)}\n`, "utf8") };
}

export interface ReadmeInput {
  name: string;
  description: string;
  username: string;
  appname: string;
  devUrl: string | null;
  productionUrl: string;
  kitVersion: string | null;
  version: string;
  tests: { passed: number; total: number } | null;
}

/** The generated per-app README (§10.1): name, description, URLs, kit, tests, hosting statement. */
export function renderReadme(input: ReadmeInput): string {
  const tests =
    input.tests === null
      ? "no acceptance tests declared"
      : `${input.tests.passed}/${input.tests.total} acceptance tests passing at ${input.version}`;
  const lines = [
    `# ${input.name}`,
    "",
    input.description || "_no description_",
    "",
    "| | |",
    "| --- | --- |",
    `| production | ${input.productionUrl} |`,
    `| dev | ${input.devUrl ?? "—"} |`,
    `| version | \`${input.version}\` |`,
    `| kit | ${input.kitVersion ? `\`${input.kitVersion}\`` : "—"} |`,
    `| tests | ${tests} |`,
    "",
    `Built with Air Create by @${input.username}; mirrored as \`apps/${input.username}/${input.appname}\`.`,
    "",
    HOSTING_STATEMENT,
    "",
    `See \`.wzrd/manifest.json\` for the version digest and the paths left out of this mirror.`,
    "",
  ];
  return lines.join("\n");
}

/** README that replaces `src/` when an app is revoked or suspended (§10.2). */
export function renderRemovalReadme(input: { username: string; appname: string; removedAt: string }): string {
  return [
    `# ${input.username}/${input.appname}`,
    "",
    `This app was removed from the mirror on ${input.removedAt}; its source is no longer published here.`,
    "The commit history remains public, as the decision card said it would.",
    "",
    HOSTING_STATEMENT,
    "",
  ].join("\n");
}

/* -------------------------------------------------------------- git data */

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

interface GitClient {
  repo: string;
  token: string;
  fetch: FetchLike;
}

async function git<T>(
  client: GitClient,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown
): Promise<T> {
  const url = `${env.githubApiBase().replace(/\/+$/, "")}/repos/${client.repo}${path}`;
  let response: Response;
  try {
    response = await client.fetch(url, {
      method,
      headers: {
        authorization: `Bearer ${client.token}`,
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "wzrd-create-mirror",
        ...(body !== undefined ? { "content-type": "application/json" } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : null,
      signal: AbortSignal.timeout(30_000),
    });
  } catch {
    throw new MirrorError("github_unreachable", 502);
  }
  if (!response.ok) throw new MirrorError(`github_${response.status}`, response.status >= 500 ? 502 : response.status);
  return (await response.json()) as T;
}

interface TreeEntry {
  path: string;
  mode: "100644" | "100755" | "040000" | "160000" | "120000";
  type: "blob" | "tree" | "commit";
  sha: string | null;
}

/** Folder for a slug under `apps/`: `<username>/<appname>`; a flat slug uses itself. */
export function mirrorFolder(app: Pick<RegistryApp, "slug">): string {
  const parts = splitPublishedSlug(app.slug);
  return parts ? `apps/${parts.username}/${parts.appname}` : `apps/${app.slug}`;
}

/** `apps/<u>/<a>: v<epoch> (<bundle_sha256 first 12>)` */
export function commitMessage(app: Pick<RegistryApp, "slug">, version: Pick<VersionRow, "version" | "bundle_sha256">): string {
  return `${mirrorFolder(app)}: ${version.version} (${version.bundle_sha256.slice(0, 12)})`;
}

/**
 * One commit on `main` that replaces everything under `folder` with `files`.
 * Blobs → tree (base = current main tree, stale paths under the folder
 * deleted) → commit → ref update; never force.
 */
async function commitFolder(
  client: GitClient,
  folder: string,
  files: readonly MirrorFile[],
  message: string
): Promise<string> {
  const ref = await git<{ object: { sha: string } }>(client, "GET", `/git/ref/heads/${MIRROR_BRANCH}`);
  const headSha = ref.object.sha;
  const head = await git<{ tree: { sha: string } }>(client, "GET", `/git/commits/${headSha}`);
  const baseTree = await git<{ tree: { path: string; type: string; mode: string }[] }>(
    client,
    "GET",
    `/git/trees/${head.tree.sha}?recursive=1`
  );
  const nextPaths = new Set(files.map((file) => `${folder}/${file.path}`));
  const entries: TreeEntry[] = [];
  for (const entry of baseTree.tree) {
    if (entry.type !== "blob" || !entry.path.startsWith(`${folder}/`) || nextPaths.has(entry.path)) continue;
    entries.push({ path: entry.path, mode: "100644", type: "blob", sha: null });
  }
  for (const file of files) {
    const blob = await git<{ sha: string }>(client, "POST", "/git/blobs", {
      content: file.bytes.toString("base64"),
      encoding: "base64",
    });
    entries.push({ path: `${folder}/${file.path}`, mode: "100644", type: "blob", sha: blob.sha });
  }
  const tree = await git<{ sha: string }>(client, "POST", "/git/trees", {
    base_tree: head.tree.sha,
    tree: entries,
  });
  const commit = await git<{ sha: string }>(client, "POST", "/git/commits", {
    message,
    tree: tree.sha,
    parents: [headSha],
  });
  await git(client, "PATCH", `/git/refs/heads/${MIRROR_BRANCH}`, { sha: commit.sha, force: false });
  return commit.sha;
}

/* --------------------------------------------------------------- mirror */

// 0117 admits the kind; the union in lib/security/limits.ts is another lane's file.
const MIRROR_KIND: OpsEventKind = "mirror";

export interface MirrorOptions {
  fetch?: FetchLike | undefined;
  /** Pre-minted installation token (tests); otherwise minted per call. */
  token?: string | undefined;
  /** Pre-pulled tree (tests); otherwise pulled from the owner's Box. */
  files?: readonly MirrorInputFile[] | undefined;
  /** Paths the built version consumed; otherwise derived (see `builtFileListFor`). */
  builtFileList?: readonly string[] | undefined;
  /** `goal.md` / `plan.md` bytes (tests); otherwise read from the Box. */
  docs?: { goal?: string | null; plan?: string | null } | undefined;
  now?: Date | undefined;
}

export interface MirrorReceipt {
  commit: string;
  folder: string;
  files: number;
  omitted: Omitted[];
  mirrored_at: string;
}

function mirrorClient(options: MirrorOptions, token: string): GitClient {
  return {
    repo: createConfig.mirrorRepo(),
    token,
    fetch: options.fetch ?? ((input, init) => fetch(input, init)),
  };
}

async function mintToken(options: MirrorOptions): Promise<string> {
  if (options.token) return options.token;
  const installationId = createConfig.mirrorInstallationId();
  if (!installationId || !/^\d+$/.test(installationId)) throw new MirrorError("mirror_unconfigured", 503);
  try {
    return await installationToken(Number(installationId), { permissions: { contents: "write" } });
  } catch {
    throw new MirrorError("installation_token", 502);
  }
}

/**
 * Paths the built version consumed: every source-shaped workspace file plus
 * `public/<path>` for each asset the stored bundle carries. When the bundle
 * cannot be listed (R2 unconfigured) every `public/` file counts as built.
 */
export async function builtFileListFor(
  app: Pick<RegistryApp, "slug">,
  version: Pick<VersionRow, "version">,
  files: readonly MirrorInputFile[]
): Promise<string[]> {
  const list = files
    .map((file) => normalizePath(file.path))
    .filter((path) => path === "air.json" || path === "create.plan.md" || /^(?:src|functions)\//.test(path));
  const publicFiles = files.map((file) => normalizePath(file.path)).filter((path) => path.startsWith("public/"));
  if (!r2Configured() || publicFiles.length === 0) return [...list, ...publicFiles];
  const prefix = bundleKey(app.slug, version.version, "");
  let keys: string[];
  try {
    keys = await listKeys(prefix, 1000);
  } catch {
    return [...list, ...publicFiles];
  }
  const served = new Set(keys.map((key) => key.slice(prefix.length)).filter((path) => path && !path.startsWith(".")));
  return [...list, ...publicFiles.filter((path) => served.has(path.slice("public/".length)))];
}

async function pullTree(
  supabase: SupabaseClient,
  app: RegistryApp,
  appname: string
): Promise<{ files: WorkspaceFile[]; goal: string | null; plan: string | null }> {
  if (!app.owner_user_id) throw new MirrorError("no_owner", 409);
  const target = await ensureComputeAwake(supabase, app.owner_user_id);
  try {
    const files = await pullWorkspace(target, appname);
    const root = workspacePath(appname);
    const read = (path: string): Promise<string | null> =>
      readComputeFile(target, `${root}/${path}`).catch(() => null);
    const goal = (await read("goal.md")) ?? (await read("intake/goal.md"));
    const plan = (await read("plan.md")) ?? (await read("intake/plan.md"));
    return { files, goal, plan };
  } catch (error) {
    if (error instanceof MirrorError) throw error;
    throw new MirrorError("workspace_pull", 502);
  } finally {
    if (isBoxEnvironment(target.environment)) {
      await armStopAfter(supabase, app.owner_user_id).catch(() => undefined);
    }
  }
}

/** Assemble the folder contents for one version: README, docs, scrubbed tree, manifest. */
export function assembleMirrorFolder(input: {
  app: RegistryApp;
  version: VersionRow;
  files: readonly MirrorInputFile[];
  builtFileList: readonly string[];
  goal: string | null;
  plan: string | null;
  now: Date;
}): { files: MirrorFile[]; omitted: Omitted[] } {
  const parts = splitPublishedSlug(input.app.slug);
  const username = parts?.username ?? input.app.publisher_username ?? "unknown";
  const appname = parts?.appname ?? input.app.appname ?? input.app.slug;
  const filtered = filterMirrorTree(input.files, input.builtFileList);
  const out: MirrorFile[] = [];
  const planFromWorkspace = filtered.kept.find((file) => file.path === "create.plan.md");
  for (const file of filtered.kept) {
    if (file.path === "create.plan.md") continue;
    out.push(file);
  }
  const plan = input.plan ?? planFromWorkspace?.bytes.toString("utf8") ?? null;
  if (plan !== null && textContainsSecrets(plan) === null) out.push({ path: "plan.md", bytes: Buffer.from(plan, "utf8") });
  if (input.goal !== null && textContainsSecrets(input.goal) === null) {
    out.push({ path: "goal.md", bytes: Buffer.from(input.goal, "utf8") });
  }
  const tests =
    typeof input.version.tests_total === "number" && typeof input.version.tests_passed === "number"
      ? { passed: input.version.tests_passed, total: input.version.tests_total }
      : null;
  out.push({
    path: "README.md",
    bytes: Buffer.from(
      renderReadme({
        name: input.app.name,
        description: input.app.description,
        username,
        appname,
        devUrl: input.app.dev_version ? devUrl(input.app) : null,
        productionUrl: `${env.miniappOrigin().replace(/\/+$/, "")}/${username}/${appname}`,
        kitVersion: input.version.kit_version,
        version: input.version.version,
        tests,
      }),
      "utf8"
    ),
  });
  out.push(
    writeManifest({
      version: input.version.version,
      bundle_sha256: input.version.bundle_sha256,
      worker_sha256: input.version.worker_sha256,
      kit_version: input.version.kit_version,
      mirrored_at: input.now.toISOString(),
      omitted: filtered.omitted,
    })
  );
  return { files: out.sort((a, b) => a.path.localeCompare(b.path)), omitted: filtered.omitted };
}

async function recordFailure(supabase: SupabaseClient, app: RegistryApp, error: unknown): Promise<void> {
  const reason = error instanceof MirrorError ? error.message : error instanceof Error ? error.name : "mirror_failed";
  if (app.owner_user_id) {
    try {
      await supabase
        .from("create_intakes")
        .update({ mirror_error: reason.slice(0, 200), updated_at: new Date().toISOString() })
        .eq("app_id", app.id)
        .eq("user_id", app.owner_user_id);
    } catch {
      /* the receipt is best-effort; the caller already has the error */
    }
  }
  console.error(JSON.stringify({ msg: "mirror failed", user_id: app.owner_user_id, slug: app.slug, reason }));
}

/**
 * §10.2: mirror one published version. Pull → filter → one commit on
 * `main` → stamp `miniapp_versions.mirrored_at` / `mirror_commit` and an
 * `ops_events('mirror')`. On failure `create_intakes.mirror_error` gets a
 * short class string and a `MirrorError` is rethrown; the caller decides
 * (the approval path swallows it — the publish never waits on the mirror).
 */
export async function mirrorVersion(
  supabase: SupabaseClient,
  app: RegistryApp,
  version: VersionRow,
  options: MirrorOptions = {}
): Promise<MirrorReceipt> {
  if (version.app_id !== app.id) throw new MirrorError("version_mismatch", 409);
  const now = options.now ?? new Date();
  try {
    const appname = app.appname ?? splitPublishedSlug(app.slug)?.appname ?? app.slug;
    const token = await mintToken(options);
    let files: readonly MirrorInputFile[];
    let goal: string | null;
    let plan: string | null;
    if (options.files) {
      files = options.files;
      goal = options.docs?.goal ?? null;
      plan = options.docs?.plan ?? null;
    } else {
      const pulled = await pullTree(supabase, app, appname);
      files = pulled.files;
      goal = pulled.goal;
      plan = pulled.plan;
    }
    const builtFileList = options.builtFileList ?? (await builtFileListFor(app, version, files));
    const folder = mirrorFolder(app);
    const assembled = assembleMirrorFolder({ app, version, files, builtFileList, goal, plan, now });
    const commit = await commitFolder(
      mirrorClient(options, token),
      folder,
      assembled.files,
      commitMessage(app, version)
    );
    const mirroredAt = now.toISOString();
    const { error } = await supabase
      .from("miniapp_versions")
      .update({ mirrored_at: mirroredAt, mirror_commit: commit })
      .eq("id", version.id);
    if (error) throw new MirrorError("receipt_write", 502);
    await recordOpsEvent(supabase, MIRROR_KIND, app.owner_user_id, app.slug, assembled.files.length);
    console.log(
      JSON.stringify({
        msg: "mirror committed",
        user_id: app.owner_user_id,
        slug: app.slug,
        version: version.version,
        files: assembled.files.length,
        omitted: assembled.omitted.length,
      })
    );
    return { commit, folder, files: assembled.files.length, omitted: assembled.omitted, mirrored_at: mirroredAt };
  } catch (error) {
    await recordFailure(supabase, app, error);
    if (error instanceof MirrorError) throw error;
    throw new MirrorError("mirror_failed", 502);
  }
}

/**
 * §10.2: a revoked or suspended app gets one commit that replaces its folder
 * with a README stating the removal (the history stays public). Exported for
 * the revoke/suspend paths to call; nothing wires it yet.
 */
export async function removeMirror(
  supabase: SupabaseClient,
  app: RegistryApp,
  options: MirrorOptions = {}
): Promise<{ commit: string; folder: string }> {
  const now = options.now ?? new Date();
  try {
    const token = await mintToken(options);
    const parts = splitPublishedSlug(app.slug);
    const folder = mirrorFolder(app);
    const readme = renderRemovalReadme({
      username: parts?.username ?? app.publisher_username ?? "unknown",
      appname: parts?.appname ?? app.appname ?? app.slug,
      removedAt: now.toISOString().slice(0, 10),
    });
    const commit = await commitFolder(
      mirrorClient(options, token),
      folder,
      [{ path: "README.md", bytes: Buffer.from(readme, "utf8") }],
      `${folder}: removed`
    );
    await recordOpsEvent(supabase, MIRROR_KIND, app.owner_user_id, `${app.slug}:removed`);
    return { commit, folder };
  } catch (error) {
    await recordFailure(supabase, app, error);
    if (error instanceof MirrorError) throw error;
    throw new MirrorError("mirror_failed", 502);
  }
}

