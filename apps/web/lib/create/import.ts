/**
 * V11 §10 Lane C — Import. A repository the owner connected through the WZRD
 * GitHub App becomes, and stays, a staged draft:
 *
 *   link: installation token → zipball @ branch head → subtree → Repo Scan
 *         → static: validateBundle → lint → uploadVersion("import")  (§8.2)
 *         → build:  workflow file committed to the branch; the repo's own
 *                   Actions run builds and POSTs its output to /api/create/push
 *   push webhook (static link on that branch) → the same sync
 *   /api/create/push (build link, Actions OIDC) → validateBundle → lint →
 *         uploadVersion("push")
 *
 * Nothing here publishes (CR9): every sync moves only the draft pointer and
 * the owner still taps Publish (CR4). No dependency is ever installed and no
 * script is ever run on this side — `build` mode exists precisely so that
 * happens in the repository's own GitHub Actions sandbox, not ours. The Repo
 * Scan (`planRepository`) is the static-analysis half of §10's plan: it
 * reads package.json and lockfiles, never executes them.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { env } from "../env";
import {
  branchHeadSha,
  deleteInstallation,
  downloadZipball,
  getFile,
  getRepository,
  GitHubError,
  installationToken,
  putFile,
  type Repository,
} from "../github/app";
import {
  BundleError,
  bundleContentType,
  readZip,
  validateBundle,
  type BundleFile,
  type ZipLimits,
} from "../miniapps/bundles";
import { nestedPathFor } from "../miniapps/nested";
import { PublishError } from "../miniapps/publish";
import { getRegistryApp, type RegistryApp } from "../miniapps/registry";
import { pushRateLimited, recordOpsEvent } from "../security/limits";
import { discardEmptyDraft, resolveOrCreateDropApp, titleFor } from "./drop";
import { enforceCsp, type LintFinding } from "./lint";
import { draftPreviewUrl } from "./preview";
import { uploadVersion } from "./versions";

/** §10: 50 MiB archive, 5,000 files; the kept subtree still meets the bundle caps. */
export const IMPORT_MAX_ZIP_BYTES = 50 * 1024 * 1024;
export const IMPORT_MAX_FILES = 5_000;
export const IMPORT_ZIP_LIMITS: ZipLimits = {
  maxZipBytes: IMPORT_MAX_ZIP_BYTES,
  maxUnpackedBytes: 200 * 1024 * 1024,
  maxFiles: IMPORT_MAX_FILES,
};

export const WORKFLOW_PATH = ".github/workflows/wzrd-create.yml";

export type ImportMode = "static" | "build";

export class ImportError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "ImportError";
    this.status = status;
  }
}

/* ------------------------------------------------------------------ rows */

const installationRow = z.object({
  installation_id: z.number(),
  user_id: z.string(),
  account_login: z.string(),
  account_type: z.enum(["User", "Organization"]),
  suspended_at: z.string().nullable(),
  removed_at: z.string().nullable(),
});
export type InstallationRow = z.infer<typeof installationRow>;

const linkRow = z.object({
  id: z.string(),
  user_id: z.string(),
  installation_id: z.number(),
  app_id: z.string(),
  repo_id: z.number(),
  full_name: z.string(),
  branch: z.string(),
  dir: z.string(),
  mode: z.enum(["static", "build"]),
  workflow_path: z.string().nullable(),
  last_sha: z.string().nullable(),
  last_synced_at: z.string().nullable(),
  last_error: z.string().nullable(),
  created_at: z.string(),
  /** Written by the import that last saved the row; fences its compensation. */
  import_id: z.string(),
});
export type RepoLink = z.infer<typeof linkRow>;

const LINK_COLUMNS =
  "id, user_id, installation_id, app_id, repo_id, full_name, branch, dir, mode, " +
  "workflow_path, last_sha, last_synced_at, last_error, created_at, import_id";
const INSTALLATION_COLUMNS =
  "installation_id, user_id, account_login, account_type, suspended_at, removed_at";

export async function installationsFor(
  supabase: SupabaseClient,
  userId: string
): Promise<InstallationRow[]> {
  const { data, error } = await supabase
    .from("github_installations")
    .select(INSTALLATION_COLUMNS)
    .eq("user_id", userId)
    .is("removed_at", null)
    .order("created_at", { ascending: true });
  if (error) throw new ImportError(`installation lookup failed: ${error.message}`, 502);
  return z.array(installationRow).parse(data ?? []);
}

export async function installationById(
  supabase: SupabaseClient,
  installationId: number
): Promise<InstallationRow | null> {
  const { data, error } = await supabase
    .from("github_installations")
    .select(INSTALLATION_COLUMNS)
    .eq("installation_id", installationId)
    .maybeSingle();
  if (error) throw new ImportError(`installation lookup failed: ${error.message}`, 502);
  return data ? installationRow.parse(data) : null;
}

/** The owner's live installation, or a 4xx that says why it cannot be used. */
async function usableInstallation(
  supabase: SupabaseClient,
  userId: string,
  installationId: number
): Promise<InstallationRow> {
  const row = await installationById(supabase, installationId);
  if (!row || row.user_id !== userId || row.removed_at) {
    throw new ImportError("connect GitHub first", 404);
  }
  if (row.suspended_at) throw new ImportError("that GitHub installation is suspended", 409);
  return row;
}

/**
 * Record an installation the signed-in owner just completed. The setup
 * redirect's state proves who started it; the App's own view of the
 * installation (fetched with the App JWT, not from the query string) is
 * what gets stored. Re-installs by the same owner refresh the row; an
 * installation id already bound to another account is refused.
 */
export async function recordInstallation(
  supabase: SupabaseClient,
  userId: string,
  installation: { id: number; account: { login: string; type: "User" | "Organization" }; suspended_at: string | null }
): Promise<InstallationRow> {
  const existing = await installationById(supabase, installation.id);
  if (existing && existing.user_id !== userId) {
    throw new ImportError("that GitHub installation belongs to another account", 409);
  }
  const { data, error } = await supabase
    .from("github_installations")
    .upsert(
      {
        installation_id: installation.id,
        user_id: userId,
        account_login: installation.account.login,
        account_type: installation.account.type,
        suspended_at: installation.suspended_at,
        removed_at: null,
      },
      { onConflict: "installation_id" }
    )
    .select(INSTALLATION_COLUMNS)
    .single();
  if (error) throw new ImportError(`installation save failed: ${error.message}`, 502);
  return installationRow.parse(data);
}

export async function markInstallation(
  supabase: SupabaseClient,
  installationId: number,
  patch: { suspended_at?: string | null; removed_at?: string | null }
): Promise<void> {
  const { error } = await supabase
    .from("github_installations")
    .update(patch)
    .eq("installation_id", installationId);
  if (error) throw new ImportError(`installation update failed: ${error.message}`, 502);
}

export async function linksFor(supabase: SupabaseClient, userId: string): Promise<RepoLink[]> {
  const { data, error } = await supabase
    .from("github_repo_links")
    .select(LINK_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  if (error) throw new ImportError(`link lookup failed: ${error.message}`, 502);
  return z.array(linkRow).parse(data ?? []);
}

export async function linksForRepo(
  supabase: SupabaseClient,
  repoId: number
): Promise<RepoLink[]> {
  const { data, error } = await supabase
    .from("github_repo_links")
    .select(LINK_COLUMNS)
    .eq("repo_id", repoId);
  if (error) throw new ImportError(`link lookup failed: ${error.message}`, 502);
  return z.array(linkRow).parse(data ?? []);
}

export async function linkForApp(
  supabase: SupabaseClient,
  userId: string,
  appId: string
): Promise<RepoLink | null> {
  const { data, error } = await supabase
    .from("github_repo_links")
    .select(LINK_COLUMNS)
    .eq("user_id", userId)
    .eq("app_id", appId)
    .maybeSingle();
  if (error) throw new ImportError(`link lookup failed: ${error.message}`, 502);
  return data ? linkRow.parse(data) : null;
}

/** The link (any owner) already fed by this repository, branch and dir. */
async function linkForSource(
  supabase: SupabaseClient,
  repoId: number,
  branch: string,
  dir: string
): Promise<RepoLink | null> {
  const { data, error } = await supabase
    .from("github_repo_links")
    .select(LINK_COLUMNS)
    .eq("repo_id", repoId)
    .eq("branch", branch)
    .eq("dir", dir)
    .maybeSingle();
  if (error) throw new ImportError(`link lookup failed: ${error.message}`, 502);
  return data ? linkRow.parse(data) : null;
}

/**
 * Insert or replace (by app) the link row; the unique source index decides
 * ties. The row comes back carrying this call's fresh `import_id`: every
 * later write this import makes to the row is conditioned on it, so the
 * import that overwrote the row in the meantime is never undone by this one.
 */
async function saveLink(
  supabase: SupabaseClient,
  fields: {
    user_id: string;
    installation_id: number;
    app_id: string;
    repo_id: number;
    full_name: string;
    branch: string;
    dir: string;
    mode: ImportMode;
    workflow_path: string | null;
    last_error: null;
  }
): Promise<RepoLink> {
  const { data, error } = await supabase
    .from("github_repo_links")
    .upsert({ ...fields, import_id: randomUUID() }, { onConflict: "app_id" })
    .select(LINK_COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new ImportError("that repository, branch and directory already feed another app", 409);
    }
    throw new ImportError(`link save failed: ${error.message}`, 502);
  }
  return linkRow.parse(data);
}

const RESTORE_ATTEMPTS = 3;

/**
 * Put a link row back exactly as it was read before a re-import moved it
 * (`saveLink` keeps the row, so this is an update by id), but only while the
 * row still carries this import's `fence`: once another import has written
 * it, the restore is a no-op and that import's link stands. Retried on
 * transient errors; a unique-source refusal means another app took the old
 * source in the meantime and the restore cannot happen. Returns the error
 * it could not get past, null when the row is back or no longer ours.
 */
async function restoreLink(
  supabase: SupabaseClient,
  previous: RepoLink,
  fence: string
): Promise<string | null> {
  const { id, created_at, ...fields } = previous;
  void created_at;
  let lastError = "unknown";
  for (let attempt = 1; attempt <= RESTORE_ATTEMPTS; attempt += 1) {
    const { data, error } = await supabase
      .from("github_repo_links")
      .update(fields)
      .eq("id", id)
      .eq("import_id", fence)
      .select("id");
    if (!error) {
      if ((data ?? []).length === 0) {
        console.log(JSON.stringify({ msg: "repo link restore skipped: superseded", link: id }));
      }
      return null;
    }
    lastError = error.message;
    if (error.code === "23505") break;
    if (attempt < RESTORE_ATTEMPTS) {
      await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
    }
  }
  console.error(
    JSON.stringify({ msg: "repo link restore failed", link: id, app_id: previous.app_id, error: lastError })
  );
  return lastError;
}

/**
 * Remove the row a failed first import wrote, if it is still that row.
 * True when it was; false when another import has since replaced it, in
 * which case the app is theirs to keep.
 */
async function removeOwnLink(supabase: SupabaseClient, link: RepoLink): Promise<boolean> {
  const { data, error } = await supabase
    .from("github_repo_links")
    .delete()
    .eq("id", link.id)
    .eq("import_id", link.import_id)
    .select("id");
  if (error) {
    console.error(JSON.stringify({ msg: "repo link remove failed", link: link.id, error: error.message }));
    return false;
  }
  return (data ?? []).length > 0;
}

/**
 * The import's last write to its row: stamp it (or, for a build link, just
 * touch it) if and only if the row still carries this import's `import_id`.
 * Zero rows means another import of the same app replaced the link while
 * this one was staging or committing; the caller then fails so its
 * compensation runs — which is fenced too, and therefore leaves the newer
 * link exactly as that import wrote it.
 */
async function confirmLink(
  supabase: SupabaseClient,
  link: RepoLink,
  patch: { last_sha?: string; last_synced_at?: string; last_error: null }
): Promise<void> {
  const { data, error } = await supabase
    .from("github_repo_links")
    .update(patch)
    .eq("id", link.id)
    .eq("import_id", link.import_id)
    .select("id");
  if (error) throw new ImportError(`link stamp failed: ${error.message}`, 502);
  if ((data ?? []).length === 0) {
    throw new ImportError("another import of this app replaced the link while this one ran", 409);
  }
}

/** Unlink: the app and its versions stay; pushes stop landing. */
export async function unlinkRepo(
  supabase: SupabaseClient,
  userId: string,
  appId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("github_repo_links")
    .delete()
    .eq("user_id", userId)
    .eq("app_id", appId)
    .select("id");
  if (error) throw new ImportError(`unlink failed: ${error.message}`, 502);
  return (data ?? []).length > 0;
}

async function stampLink(
  supabase: SupabaseClient,
  linkId: string,
  patch: { last_sha?: string; last_synced_at?: string; last_error: string | null }
): Promise<void> {
  const { error } = await supabase.from("github_repo_links").update(patch).eq("id", linkId);
  if (error) {
    console.error(JSON.stringify({ msg: "repo link stamp failed", error: error.message }));
  }
}

/**
 * An account under deletion (users.deleting_at) receives nothing more from
 * its repositories: the webhook path checks this before touching R2 or the
 * registry, because a cascade is about to remove every row it would write.
 */
async function assertAccountOpen(supabase: SupabaseClient, userId: string): Promise<void> {
  const { data, error } = await supabase
    .from("users")
    .select("deleting_at")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw new ImportError(`account lookup failed: ${error.message}`, 502);
  const row = data as { deleting_at: string | null } | null;
  if (!row) throw new ImportError("account not found", 404);
  if (row.deleting_at) throw new ImportError("account is being deleted", 409);
}

/* ------------------------------------------------------------- subtree */

const DIR_RE = /^(?:[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*)?$/;

/** Normalize an owner-supplied subdirectory: no leading/trailing slashes, no dot segments. */
export function normalizeDir(dir: string | undefined): string {
  const trimmed = (dir ?? "").trim().replace(/^\/+|\/+$/g, "");
  if (!DIR_RE.test(trimmed) || trimmed.length > 255) {
    throw new ImportError("directory must be a relative path like site or apps/web/out");
  }
  for (const segment of trimmed.split("/")) {
    if (segment === "." || segment === "..") {
      throw new ImportError("directory must be a relative path like site or apps/web/out");
    }
  }
  return trimmed;
}

const BRANCH_RE = /^[^\s~^:?*[\\]{1,255}$/;

export function normalizeBranch(branch: string): string {
  const trimmed = branch.trim();
  if (!BRANCH_RE.test(trimmed) || trimmed.includes("..") || trimmed.endsWith("/")) {
    throw new ImportError("branch name is not valid");
  }
  return trimmed;
}

export interface Subtree {
  /** Files under `dir`, re-rooted, dot-entries dropped. */
  files: BundleFile[];
  /** Kept-directory files the loader cannot serve (README.md, LICENSE, …). */
  skipped: string[];
}

/**
 * A GitHub zipball wraps the tree in one `<owner>-<repo>-<sha>/` folder.
 * Strip it, keep the subtree at `dir`, drop dot-entries (`.git*`, `.github/`,
 * `.DS_Store` — never part of a site) and set aside files the loader has no
 * content type for, so a README at the root does not fail the import.
 */
export function repoSubtree(archive: BundleFile[], dir: string): Subtree {
  const files: BundleFile[] = [];
  const skipped: string[] = [];
  const prefix = dir ? `${dir}/` : "";
  for (const entry of archive) {
    const slash = entry.path.indexOf("/");
    if (slash < 0) continue; // the wrapper folder itself, or a stray root file
    const inner = entry.path.slice(slash + 1);
    if (!inner || !inner.startsWith(prefix)) continue;
    const rel = inner.slice(prefix.length);
    if (!rel || rel.split("/").some((segment) => segment.startsWith("."))) continue;
    if (!bundleContentType(rel)) {
      skipped.push(rel);
      continue;
    }
    files.push({ path: rel, bytes: entry.bytes });
  }
  return { files, skipped };
}

/** All files under `dir` (including the ones the loader would skip) for the scan. */
function subtreeRaw(archive: BundleFile[], dir: string): BundleFile[] {
  const prefix = dir ? `${dir}/` : "";
  const out: BundleFile[] = [];
  for (const entry of archive) {
    const slash = entry.path.indexOf("/");
    if (slash < 0) continue;
    const inner = entry.path.slice(slash + 1);
    if (!inner.startsWith(prefix)) continue;
    const rel = inner.slice(prefix.length);
    if (rel) out.push({ path: rel, bytes: entry.bytes });
  }
  return out;
}

/* ----------------------------------------------------------- repo scan */

export type PackageManager = "npm" | "pnpm" | "yarn" | "bun";

export interface RepoPlan {
  mode: ImportMode;
  framework: string | null;
  packageManager: PackageManager | null;
  buildCommand: string | null;
  /** Where the build writes the site, relative to `dir`. */
  outputDir: string | null;
  /** Environment variable names the sources read (informational). */
  envVars: string[];
  /** Why the plan is what it is, in the owner's words. */
  notes: string[];
}

const SERVER_DEPS = ["express", "fastify", "koa", "hono", "@nestjs/core", "@hapi/hapi", "socket.io"];
const DB_DEPS = ["pg", "mysql2", "mongoose", "prisma", "@prisma/client", "drizzle-orm", "better-sqlite3", "redis", "ioredis"];
const SECRET_ENV_RE = /(SECRET|PRIVATE|PASSWORD|TOKEN|API_KEY|_KEY)$/i;
const ENV_REF_RE = /\b(?:process\.env|import\.meta\.env)\.([A-Z][A-Z0-9_]{1,63})\b/g;

function parseJson(bytes: Buffer): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(bytes.toString("utf8")) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function depNames(pkg: Record<string, unknown>): Set<string> {
  const names = new Set<string>();
  for (const key of ["dependencies", "devDependencies"]) {
    const block = pkg[key];
    if (block && typeof block === "object") {
      for (const name of Object.keys(block as Record<string, unknown>)) names.add(name);
    }
  }
  return names;
}

function frameworkFor(deps: Set<string>): { framework: string; outputDir: string } | null {
  if (deps.has("next")) return { framework: "Next.js", outputDir: "out" };
  if (deps.has("astro")) return { framework: "Astro", outputDir: "dist" };
  if (deps.has("@sveltejs/kit")) return { framework: "SvelteKit", outputDir: "build" };
  if (deps.has("nuxt")) return { framework: "Nuxt", outputDir: ".output/public" };
  if (deps.has("@angular/core")) return { framework: "Angular", outputDir: "dist" };
  if (deps.has("react-scripts")) return { framework: "Create React App", outputDir: "build" };
  if (deps.has("vite")) return { framework: "Vite", outputDir: "dist" };
  if (deps.has("parcel")) return { framework: "Parcel", outputDir: "dist" };
  if (deps.has("@11ty/eleventy")) return { framework: "Eleventy", outputDir: "_site" };
  return null;
}

/**
 * §10 Repo Scan, static half: decide whether the tree at `dir` is already a
 * site (`static`) or a project that must build first (`build`), and what
 * cannot be a mini-app at all. Reads files; runs nothing.
 */
export function planRepository(tree: BundleFile[]): RepoPlan {
  const byPath = new Map(tree.map((f) => [f.path, f] as const));
  const notes: string[] = [];
  const envVars = new Set<string>();
  for (const file of tree) {
    if (!/\.(m?[jt]sx?|vue|svelte|astro)$/.test(file.path) || file.bytes.length > 512 * 1024) continue;
    if (file.path.startsWith("node_modules/")) continue;
    const text = file.bytes.toString("utf8");
    for (const match of text.matchAll(ENV_REF_RE)) envVars.add(match[1]!);
  }
  const env = [...envVars].sort();

  if (byPath.has("index.html") && !byPath.has("package.json")) {
    notes.push("index.html at the root: the directory is served as-is.");
    return { mode: "static", framework: null, packageManager: null, buildCommand: null, outputDir: null, envVars: env, notes };
  }

  const pkgFile = byPath.get("package.json");
  if (!pkgFile) {
    throw new ImportError(
      "no index.html and no package.json at that directory — point Import at the folder that holds index.html"
    );
  }
  const pkg = parseJson(pkgFile.bytes);
  if (!pkg) throw new ImportError("package.json is not valid JSON");
  const deps = depNames(pkg);
  const scripts = (pkg["scripts"] ?? {}) as Record<string, unknown>;

  const server = SERVER_DEPS.filter((d) => deps.has(d));
  if (server.length > 0) {
    throw new ImportError(
      `this project runs a server (${server.join(", ")}); a mini-app is static files — its backend would need to become Functions`
    );
  }
  const db = DB_DEPS.filter((d) => deps.has(d));
  if (db.length > 0) {
    throw new ImportError(
      `this project opens a database (${db.join(", ")}); a mini-app cannot — that part would need to become Functions`
    );
  }
  const secrets = env.filter((name) => SECRET_ENV_RE.test(name));
  if (secrets.length > 0) {
    throw new ImportError(
      `the sources read secret-looking environment variables (${secrets.join(", ")}); a static build would bake them into public files`
    );
  }

  if (byPath.has("index.html") && typeof scripts["build"] !== "string") {
    notes.push("index.html at the root and no build script: the directory is served as-is.");
    return { mode: "static", framework: null, packageManager: null, buildCommand: null, outputDir: null, envVars: env, notes };
  }
  if (typeof scripts["build"] !== "string") {
    throw new ImportError("package.json has no build script and there is no index.html to serve");
  }

  let packageManager: PackageManager | null = null;
  if (byPath.has("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (byPath.has("yarn.lock")) packageManager = "yarn";
  else if (byPath.has("bun.lockb") || byPath.has("bun.lock")) packageManager = "bun";
  else if (byPath.has("package-lock.json") || byPath.has("npm-shrinkwrap.json")) packageManager = "npm";
  if (!packageManager) {
    throw new ImportError(
      "commit a lockfile (package-lock.json, pnpm-lock.yaml, yarn.lock or bun.lock) — builds install from the lockfile only"
    );
  }
  const fw = frameworkFor(deps);
  if (fw?.framework === "Next.js") {
    notes.push("Next.js must use `output: 'export'` in next.config so the build writes static files to out/.");
  }
  if (fw?.framework === "SvelteKit") {
    notes.push("SvelteKit must use @sveltejs/adapter-static so the build writes static files to build/.");
  }
  if (fw?.framework === "Nuxt") {
    notes.push("Nuxt must be built with `nuxt generate` so the output is static.");
  }
  notes.push(
    `${fw?.framework ?? "The project"} builds in your repository's GitHub Actions and the output is staged here as a draft.`
  );
  return {
    mode: "build",
    framework: fw?.framework ?? null,
    packageManager,
    buildCommand: `${packageManager} run build`,
    outputDir: fw?.outputDir ?? "dist",
    envVars: env,
    notes,
  };
}

/* ------------------------------------------------------------ workflow */

/**
 * One double-quoted YAML scalar, whatever the input: backslashes and quotes
 * escaped, every control character (newlines above all) written as an
 * escape, so a value taken from the repository can only ever be *one*
 * string in *this* position — never a second line, key or step.
 */
function yamlQuote(value: string): string {
  const escaped = value
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t")
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f\u0085\u2028\u2029]/g, (c) =>
      `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`
    );
  return `"${escaped}"`;
}

/**
 * The workflow `build` mode commits to the linked branch. It builds with the
 * repository's own lockfile, zips the output directory, and pushes it with
 * a 5-minute Actions OIDC token for our audience — nothing else is granted
 * (`contents: read`, `id-token: write`) and no secret is created anywhere.
 * `runs-on` is the repository's choice; a Tenki label works the same.
 */
export function workflowYaml(input: {
  branch: string;
  dir: string;
  plan: RepoPlan;
  pushUrl: string;
  audience: string;
}): string {
  const { plan } = input;
  const workdir = input.dir || ".";
  const out = `${workdir}/${plan.outputDir ?? "dist"}`.replace(/^\.\//, "");
  const pm = plan.packageManager ?? "npm";
  const lockfile = {
    npm: "package-lock.json",
    pnpm: "pnpm-lock.yaml",
    yarn: "yarn.lock",
    bun: "bun.lock",
  }[pm];
  const install = {
    npm: "npm ci",
    pnpm: "pnpm install --frozen-lockfile",
    yarn: "yarn install --frozen-lockfile",
    bun: "bun install --frozen-lockfile",
  }[pm];
  const setup: string[] = [];
  if (pm === "pnpm") {
    setup.push("      - uses: pnpm/action-setup@v4");
  }
  if (pm === "bun") {
    setup.push("      - uses: oven-sh/setup-bun@v2");
  } else {
    setup.push(
      "      - uses: actions/setup-node@v4",
      "        with:",
      "          node-version: 22",
      `          cache: ${pm}`,
      `          cache-dependency-path: ${yamlQuote(`${workdir}/${lockfile}`.replace(/^\.\//, ""))}`
    );
  }
  return [
    "# Generated by mini.wzrd.tech/create (Import). Every push to this branch",
    "# builds the site and stages it as a draft; publishing stays a tap on",
    "# mini.wzrd.tech/create. Safe to edit: the build steps are yours.",
    "name: WZRD Create",
    "",
    "on:",
    "  push:",
    `    branches: [${yamlQuote(input.branch)}]`,
    "",
    "permissions:",
    "  contents: read",
    "  id-token: write",
    "",
    "concurrency:",
    "  group: wzrd-create-${{ github.ref }}",
    "  cancel-in-progress: true",
    "",
    "jobs:",
    "  stage-draft:",
    "    runs-on: ubuntu-latest",
    "    timeout-minutes: 15",
    "    steps:",
    "      - uses: actions/checkout@v4",
    ...setup,
    `      - run: ${install}`,
    `        working-directory: ${yamlQuote(workdir)}`,
    `      - run: ${yamlQuote(plan.buildCommand ?? `${pm} run build`)}`,
    `        working-directory: ${yamlQuote(workdir)}`,
    "      - name: Zip the static output",
    `        run: (cd ${yamlQuote(out)} && zip -qr "$RUNNER_TEMP/site.zip" .)`,
    "      - name: Stage a draft on mini.wzrd.tech/create",
    "        run: |",
    `          TOKEN=$(curl -sSf -H "Authorization: bearer $ACTIONS_ID_TOKEN_REQUEST_TOKEN" "$ACTIONS_ID_TOKEN_REQUEST_URL&audience=${input.audience}" | jq -r .value)`,
    `          curl -sSf -X POST -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/zip" --data-binary "@$RUNNER_TEMP/site.zip" ${yamlQuote(input.pushUrl)}`,
    "",
  ].join("\n");
}

/* --------------------------------------------------------------- link */

export interface LinkInput {
  installationId: number;
  fullName: string;
  branch?: string | undefined;
  dir?: string | undefined;
  appname?: string | undefined;
}

export interface ImportResult {
  slug: string;
  appname: string;
  mode: ImportMode;
  full_name: string;
  branch: string;
  dir: string;
  /** Staged at link time (static) — build mode stages on the first Actions run. */
  version: string | null;
  url: string;
  preview_url: string | null;
  findings: LintFinding[];
  skipped: string[];
  plan: RepoPlan;
  workflow_path: string | null;
  status: RegistryApp["status"];
}

function appnameFromRepo(fullName: string): string {
  const repo = fullName.slice(fullName.indexOf("/") + 1);
  return repo
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32)
    .replace(/-+$/g, "");
}

function appUrl(slug: string): string {
  return `${env.miniappOrigin().replace(/\/$/, "")}${nestedPathFor(slug)}`;
}

function pushUrl(): string {
  return `${env.miniappOrigin().replace(/\/$/, "")}/api/create/push`;
}

interface Checkout {
  repo: Repository;
  sha: string;
  archive: BundleFile[];
}

async function checkout(
  installationId: number,
  fullName: string,
  branch: string | null
): Promise<Checkout & { branch: string }> {
  const token = await installationToken(installationId, {
    permissions: { contents: "read", metadata: "read" },
  });
  const repo = await getRepository(token, fullName);
  if (repo.archived) throw new ImportError("that repository is archived", 409);
  const ref = branch ?? repo.default_branch;
  const sha = await branchHeadSha(token, repo.full_name, ref);
  const zip = await downloadZipball(token, repo.full_name, sha, IMPORT_MAX_ZIP_BYTES);
  const archive = readZip(zip, IMPORT_ZIP_LIMITS);
  return { repo, sha, archive, branch: ref };
}

/** Static subtree → validated, linted files, or the bundle/lint error. */
function stageable(archive: BundleFile[], dir: string): {
  files: BundleFile[];
  findings: LintFinding[];
  skipped: string[];
} {
  const { files, skipped } = repoSubtree(archive, dir);
  validateBundle(files);
  const findings = enforceCsp(files);
  return { files, findings, skipped };
}

export interface ImportPlan {
  full_name: string;
  branch: string;
  dir: string;
  sha: string;
  appname: string;
  plan: RepoPlan;
  /** Files the static import would serve / set aside (static mode only). */
  files: number;
  skipped: string[];
  /** What Import will do to the repository: nothing, or commit this file. */
  workflow_path: string | null;
  workflow: string | null;
}

/**
 * §10 Repo Scan as the owner sees it before anything is created or written:
 * the plan, and — for a project that builds — the exact workflow file Import
 * would commit. The Create surface shows this and asks for confirmation;
 * the repository is only ever written after that click.
 */
export async function previewRepository(
  supabase: SupabaseClient,
  userId: string,
  input: LinkInput
): Promise<ImportPlan> {
  await assertAccountOpen(supabase, userId);
  const installation = await usableInstallation(supabase, userId, input.installationId);
  const dir = normalizeDir(input.dir);
  const wanted = input.branch?.trim() ? normalizeBranch(input.branch) : null;
  const { repo, sha, archive, branch } = await checkout(
    installation.installation_id,
    input.fullName,
    wanted
  );
  const plan = planRepository(subtreeRaw(archive, dir));
  const appname = input.appname?.trim() || appnameFromRepo(repo.full_name);
  if (!appname) throw new PublishError("app name required");
  if (plan.mode === "static") {
    const { files, skipped } = repoSubtree(archive, dir);
    validateBundle(files);
    return { full_name: repo.full_name, branch, dir, sha, appname, plan, files: files.length, skipped, workflow_path: null, workflow: null };
  }
  return {
    full_name: repo.full_name,
    branch,
    dir,
    sha,
    appname,
    plan,
    files: 0,
    skipped: [],
    workflow_path: WORKFLOW_PATH,
    workflow: workflowYaml({ branch, dir, plan, pushUrl: pushUrl(), audience: env.githubOidcAudience() }),
  };
}

/**
 * Link a repository to an owned app (creating the app as a draft when new)
 * and, for a static tree, stage its first draft in the same call. For a
 * project that builds, commit the workflow instead; the first draft arrives
 * when that workflow runs. The workflow commit is the one repository write
 * Import ever performs and it requires `commitWorkflow: true` — the owner's
 * confirmation of the preview — or the call refuses before creating anything.
 */
export async function linkRepository(
  supabase: SupabaseClient,
  userId: string,
  input: LinkInput & { commitWorkflow?: boolean | undefined }
): Promise<ImportResult> {
  await assertAccountOpen(supabase, userId);
  const installation = await usableInstallation(supabase, userId, input.installationId);
  const dir = normalizeDir(input.dir);
  const wanted = input.branch?.trim() ? normalizeBranch(input.branch) : null;
  const { repo, sha, archive, branch } = await checkout(
    installation.installation_id,
    input.fullName,
    wanted
  );
  const plan = planRepository(subtreeRaw(archive, dir));
  if (plan.mode === "build" && input.commitWorkflow !== true) {
    throw new ImportError(
      `this project builds first; confirm adding ${WORKFLOW_PATH} to ${branch} to continue`,
      428
    );
  }
  const appname = input.appname?.trim() || appnameFromRepo(repo.full_name);
  if (!appname) throw new PublishError("app name required");

  let staged: { files: BundleFile[]; findings: LintFinding[]; skipped: string[] } | null = null;
  if (plan.mode === "static") {
    // Bundle contract before the registry: a bad tree never creates an app.
    staged = stageable(archive, dir);
  }

  // Another app already fed from this exact source? Refuse before a row is
  // created for this one (the unique index still decides under a race).
  const taken = await linkForSource(supabase, repo.id, branch, dir);
  const { app, created } = await resolveOrCreateDropApp(
    supabase,
    userId,
    { appname, name: titleFor(appname), description: "" },
    "import"
  );
  const existingLink = await linkForApp(supabase, userId, app.id);
  if (existingLink && existingLink.repo_id !== repo.id) {
    if (created) await discardEmptyDraft(supabase, userId, app.id);
    throw new ImportError(`${app.slug} is already linked to ${existingLink.full_name}`, 409);
  }
  if (taken && taken.app_id !== app.id) {
    if (created) await discardEmptyDraft(supabase, userId, app.id);
    throw new ImportError("that repository, branch and directory already feed another app", 409);
  }

  const linkFields = {
    user_id: userId,
    installation_id: installation.installation_id,
    app_id: app.id,
    repo_id: repo.id,
    full_name: repo.full_name,
    branch,
    dir,
    mode: plan.mode,
    workflow_path: plan.mode === "build" ? WORKFLOW_PATH : null,
    last_error: null,
  };

  // The link row is the one write that can be refused for a reason of its
  // own (the unique source index, the database), so it goes first: a refusal
  // here has changed nothing — no draft moved, no workflow committed. Only
  // then do the external effects run, and if one of them fails the row is
  // put back: removed again for a first link (with the app this request
  // created for it), restored field-for-field for a re-link, so the owner
  // is left with the working link they had rather than a half-moved one.
  // Every one of those writes, and the final stamp, is fenced on the
  // `import_id` this request wrote, so two imports of one app cannot undo
  // each other: the later save wins the row, the earlier one reports it.
  let link: RepoLink;
  try {
    link = await saveLink(supabase, linkFields);
  } catch (error) {
    if (created) await discardEmptyDraft(supabase, userId, app.id);
    throw error;
  }
  let version: string | null = null;
  let workflowPath: string | null = null;
  try {
    if (staged) {
      version = await uploadVersion(supabase, app, staged.files, "import", {
        findings: staged.findings,
        promote: false,
      });
      await confirmLink(supabase, link, {
        last_sha: sha,
        last_synced_at: new Date().toISOString(),
        last_error: null,
      });
    } else {
      workflowPath = await commitWorkflow(installation.installation_id, {
        fullName: repo.full_name,
        branch,
        dir,
        plan,
      });
      await confirmLink(supabase, link, { last_error: null });
    }
  } catch (error) {
    if (existingLink) {
      const restoreError = await restoreLink(supabase, existingLink, link.import_id);
      if (restoreError) {
        throw new ImportError(
          `${errorText(error)}; the previous link (${existingLink.full_name}@${existingLink.branch}` +
            `${existingLink.dir ? `/${existingLink.dir}` : ""}) could not be restored: ${restoreError} — import again`,
          502
        );
      }
    } else if (await removeOwnLink(supabase, link)) {
      if (created) await discardEmptyDraft(supabase, userId, app.id);
    }
    throw error;
  }
  await recordOpsEvent(supabase, "import", userId, `${repo.full_name}@${branch}`);

  const after: RegistryApp = version ? { ...app, draft_version: version } : app;
  return {
    slug: app.slug,
    appname: app.appname ?? appname,
    mode: plan.mode,
    full_name: repo.full_name,
    branch,
    dir,
    version,
    url: appUrl(app.slug),
    preview_url: version ? draftPreviewUrl(after) : null,
    findings: staged?.findings ?? [],
    skipped: staged?.skipped ?? [],
    plan,
    workflow_path: workflowPath,
    status: app.status,
  };
}

/** Write (or refresh) the workflow file on the linked branch. */
async function commitWorkflow(
  installationId: number,
  input: { fullName: string; branch: string; dir: string; plan: RepoPlan }
): Promise<string> {
  const token = await installationToken(installationId, {
    permissions: { contents: "write", metadata: "read" },
  });
  const content = Buffer.from(
    workflowYaml({
      branch: input.branch,
      dir: input.dir,
      plan: input.plan,
      pushUrl: pushUrl(),
      audience: env.githubOidcAudience(),
    }),
    "utf8"
  );
  const current = await getFile(token, input.fullName, WORKFLOW_PATH, input.branch);
  if (current && current.content.equals(content)) return WORKFLOW_PATH;
  try {
    await putFile(token, input.fullName, {
      path: WORKFLOW_PATH,
      branch: input.branch,
      message: current
        ? "chore: refresh the WZRD Create workflow"
        : "chore: stage drafts on mini.wzrd.tech/create on push",
      content,
      sha: current?.sha,
    });
  } catch (error) {
    if (error instanceof GitHubError && (error.status === 403 || error.status === 404)) {
      throw new ImportError(
        "the WZRD GitHub App needs write access to add the build workflow — grant it on the installation and import again",
        403
      );
    }
    throw error;
  }
  return WORKFLOW_PATH;
}

/* -------------------------------------------------------------- sync */

/** The linked app, if it can still take a version: exists, owned, not suspended. */
async function linkedApp(supabase: SupabaseClient, link: RepoLink): Promise<RegistryApp> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select("slug")
    .eq("id", link.app_id)
    .eq("owner_user_id", link.user_id)
    .maybeSingle();
  if (error) throw new ImportError(`app lookup failed: ${error.message}`, 502);
  const slug = (data as { slug: string } | null)?.slug;
  if (!slug) throw new ImportError("linked app no longer exists", 404);
  const app = await getRegistryApp(supabase, slug);
  if (!app || app.owner_user_id !== link.user_id) throw new ImportError("linked app no longer exists", 404);
  if (app.status === "suspended") throw new ImportError("that app is suspended", 409);
  return app;
}

export interface SyncResult {
  slug: string;
  version: string;
  sha: string;
  findings: LintFinding[];
}

/**
 * Push webhook → static link: fetch the branch head and stage it as a draft.
 * Any failure is recorded on the link (`last_error`) for the Create surface
 * and rethrown for the caller's log; nothing is retried here (the next push
 * is the retry).
 */
export async function syncStaticLink(
  supabase: SupabaseClient,
  link: RepoLink,
  headSha: string | null
): Promise<SyncResult> {
  try {
    await assertAccountOpen(supabase, link.user_id);
    const installation = await installationById(supabase, link.installation_id);
    if (!installation || installation.removed_at || installation.suspended_at) {
      throw new ImportError("GitHub installation is no longer active", 409);
    }
    const app = await linkedApp(supabase, link);
    // A repository push is an upload on the owner's hourly budget, like a
    // build-mode push; it never spends the daily budget for owner-initiated
    // imports.
    if (await pushRateLimited(supabase, link.user_id)) {
      throw new ImportError("too many pushes this hour", 429);
    }
    const token = await installationToken(link.installation_id, {
      repositoryIds: [link.repo_id],
      permissions: { contents: "read", metadata: "read" },
    });
    const sha = headSha ?? (await branchHeadSha(token, link.full_name, link.branch));
    const zip = await downloadZipball(token, link.full_name, sha, IMPORT_MAX_ZIP_BYTES);
    const archive = readZip(zip, IMPORT_ZIP_LIMITS);
    const plan = planRepository(subtreeRaw(archive, link.dir));
    if (plan.mode !== "static") {
      throw new ImportError(
        "the branch now needs a build; unlink and import again to switch to build mode"
      );
    }
    const { files, findings } = stageable(archive, link.dir);
    const version = await uploadVersion(supabase, app, files, "import", {
      findings,
      promote: false,
    });
    await stampLink(supabase, link.id, {
      last_sha: sha,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    });
    await recordOpsEvent(
      supabase,
      "create.push",
      link.user_id,
      `${link.full_name}@${sha.slice(0, 12)}`
    );
    return { slug: app.slug, version, sha, findings };
  } catch (error) {
    await stampLink(supabase, link.id, { last_error: errorText(error) });
    throw error;
  }
}

export interface PushEvent {
  ref: string;
  after: string;
  deleted?: boolean | undefined;
  repository: { id: number; full_name: string };
  installation?: { id: number } | undefined;
}

/** Links a push lands on: this branch, `static`, fed by the delivering installation. */
export function pushTargets(links: RepoLink[], body: PushEvent): RepoLink[] {
  if (body.deleted) return [];
  return links.filter(
    (link) =>
      link.mode === "static" &&
      link.repo_id === body.repository.id &&
      body.ref === `refs/heads/${link.branch}` &&
      (body.installation === undefined || body.installation.id === link.installation_id)
  );
}

/**
 * The one `build` link a set of Actions OIDC claims may feed: same
 * repository id, the linked branch, and the workflow file Import committed
 * *as checked out from that same branch* (`job_workflow_ref` is
 * `<owner>/<repo>/<path>@<ref>`). A fork, another branch, a renamed
 * workflow, or the linked workflow path taken from any other ref matches
 * nothing.
 */
export function matchBuildLink(
  links: RepoLink[],
  claims: { repository_id: string; ref: string; job_workflow_ref: string }
): RepoLink | null {
  return (
    links.find(
      (link) =>
        link.mode === "build" &&
        link.workflow_path !== null &&
        String(link.repo_id) === claims.repository_id &&
        claims.ref === `refs/heads/${link.branch}` &&
        claims.job_workflow_ref === `${link.full_name}/${link.workflow_path}@refs/heads/${link.branch}`
    ) ?? null
  );
}

/**
 * /api/create/push → build link: the zip the repository's Actions run
 * produced becomes a draft version. The caller has already matched the
 * OIDC claims to this link.
 */
export async function pushBuildOutput(
  supabase: SupabaseClient,
  link: RepoLink,
  zip: Buffer,
  sha: string
): Promise<SyncResult> {
  try {
    await assertAccountOpen(supabase, link.user_id);
    const app = await linkedApp(supabase, link);
    const files = readZip(zip);
    validateBundle(files);
    const findings = enforceCsp(files);
    const version = await uploadVersion(supabase, app, files, "push", {
      findings,
      promote: false,
    });
    await stampLink(supabase, link.id, {
      last_sha: sha,
      last_synced_at: new Date().toISOString(),
      last_error: null,
    });
    await recordOpsEvent(
      supabase,
      "create.push",
      link.user_id,
      `${link.full_name}@${sha.slice(0, 12)}`,
      zip.length
    );
    return { slug: app.slug, version, sha, findings };
  } catch (error) {
    await stampLink(supabase, link.id, { last_error: errorText(error) });
    throw error;
  }
}

function errorText(error: unknown): string {
  if (error instanceof BundleError || error instanceof ImportError || error instanceof PublishError) {
    return error.message.slice(0, 500);
  }
  if (error instanceof Error && error.name === "LintError") return error.message.slice(0, 500);
  return "sync failed";
}

/**
 * Account deletion: uninstall the App from every installation the account
 * connected so GitHub stops delivering for it, then forget the rows (the
 * cascade does that with the user). Best-effort at the vendor — a
 * `removed_at` row is never used again even if the uninstall call fails.
 */
export async function forgetInstallations(
  supabase: SupabaseClient,
  userId: string
): Promise<{ uninstalled: number; failed: number }> {
  const rows = await installationsFor(supabase, userId);
  let uninstalled = 0;
  let failed = 0;
  for (const row of rows) {
    await markInstallation(supabase, row.installation_id, {
      removed_at: new Date().toISOString(),
    });
    try {
      await deleteInstallation(row.installation_id);
      uninstalled += 1;
    } catch {
      failed += 1;
    }
  }
  return { uninstalled, failed };
}
