/**
 * V11 §11.6: every published app is one Worker in the dispatch namespace,
 * one code path. A Drop/Vibe app ships the platform's static stub as its
 * main module plus an ASSETS binding; a Functions app (MC5) swaps the stub
 * for the built module. `<slug>` is live, `<slug>-draft` is the owner's
 * preview. Publishing and rollback re-upload the same digest to the live
 * name and move the KV pointer — no wrangler, no working tree (CR10).
 *
 * The lane is optional: when the app-origin env is unset every function here
 * is a no-op returning null and callers keep the legacy R2 render.
 *
 * CR16 deploy/delete protocol: every origin write (Worker put, manifest
 * write) first claims the app via miniapp_claim_app_origin (refused once the
 * app or its owner's account is under deletion; sets app_origin_deployed_at,
 * first deploy wins) and claims again after the vendor write — a deletion
 * that began in between finds the origin torn down again by the writer
 * itself. The claim is the durable record that an origin may be serving;
 * account deletion refuses to proceed without the lane whenever it is set.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import {
  bundleContentType,
  bundleKey,
  FUNCTIONS_MAIN,
  FUNCTIONS_MODULE_DIR,
  functionsModuleKey,
  type BundleFile,
} from "../miniapps/bundles";
import {
  parseRegistryApp,
  REGISTRY_COLUMNS,
  type RegistryApp,
} from "../miniapps/registry";
import { getObject, listKeys, r2Configured } from "../storage/r2";
import { loadFunctions, moduleAllowed, resourcesFor, type FunctionsRow } from "./backend";
import {
  cloudflareConfigured,
  deleteDispatchScript,
  listDispatchScripts,
  putDispatchScript,
  uploadAssets,
  type AssetFile,
  type ScriptBinding,
} from "./cloudflare";
import { appPrincipal } from "./identity";
import {
  deleteManifest,
  readManifest,
  writeManifest,
  type AppManifest,
  type ManifestRuntime,
} from "./manifest";
import { resourceId } from "./provision";
import { STATIC_STUB_MAIN, STATIC_STUB_MODULE } from "./staticStub";
import { appOriginConfigured } from "./tokens";

export const WORKER_COMPATIBILITY_DATE = "2026-01-01";
export const FUNCTIONS_CPU_MS = { free: 50, paid: 200 } as const;
export const FUNCTIONS_SUBREQUESTS = 20;

export type DeployTarget = "live" | "draft";

/** The app row is gone or under deletion: nothing may be deployed for it. */
export class AppOriginRefusedError extends Error {
  constructor(slug: string) {
    super(`app ${slug} is being deleted`);
    this.name = "AppOriginRefusedError";
  }
}

export function appOriginLaneReady(): boolean {
  return (
    appOriginConfigured() &&
    cloudflareConfigured() &&
    env.cfManifestKvId() !== null
  );
}

export function scriptNameFor(slug: string, target: DeployTarget): string {
  return target === "live" ? slug : `${slug}-draft`;
}

export function toAssetFiles(files: BundleFile[]): AssetFile[] {
  return files.map((file) => ({
    path: file.path.startsWith("/") ? file.path : `/${file.path}`,
    bytes: file.bytes,
    contentType: bundleContentType(file.path) ?? "application/octet-stream",
  }));
}

/** Rehydrate a version's files from its R2 prefix (for publish/rollback). */
export async function loadBundleFiles(
  slug: string,
  version: string
): Promise<BundleFile[]> {
  if (!r2Configured()) return [];
  return (await loadRelease(slug, version)).files;
}

/**
 * A version's assets plus its Functions module (§11.6), from one listing of
 * the version prefix. The module sits under the prefix's dot-directory, which
 * no bundle path can name, so it is purged with the version and never served
 * as an asset.
 */
export async function loadRelease(
  slug: string,
  version: string
): Promise<{ files: BundleFile[]; module: Buffer | null }> {
  if (!r2Configured()) return { files: [], module: null };
  const prefix = bundleKey(slug, version, "");
  const moduleKey = functionsModuleKey(slug, version);
  const keys = await listKeys(prefix, 1000);
  const files: BundleFile[] = [];
  let fnModule: Buffer | null = null;
  for (const key of keys) {
    const object = await getObject(key);
    if (!object) continue;
    if (key === moduleKey) fnModule = object.body;
    else if (!key.slice(prefix.length).startsWith(FUNCTIONS_MODULE_DIR)) {
      files.push({ path: key.slice(prefix.length), bytes: object.body });
    }
  }
  return { files, module: fnModule };
}

export interface StaticDeploy {
  appId: string;
  slug: string;
  version: string;
  ownerUserId: string;
  files: BundleFile[];
  target: DeployTarget;
  /** The version's Functions module; read from the version prefix when
   * omitted (a redeploy), `null` for a version built without one. */
  module?: Buffer | null;
}

async function ownerPlan(supabase: SupabaseClient, userId: string): Promise<"free" | "paid"> {
  const { data } = await supabase
    .from("entitlements")
    .select("plan")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as { plan?: unknown } | null)?.plan === "paid" ? "paid" : "free";
}

/**
 * §11.1 binding table, nothing else: the user Worker sees `ASSETS`, its own
 * `DB`/`KV` when approved (live) or declared (draft) and provisioned, and the
 * owner-set `secret_text`s the upload keeps in place. No R2, no service
 * binding, no platform key — ever (CR6).
 */
export function functionsBindings(
  row: FunctionsRow,
  target: DeployTarget
): ScriptBinding[] {
  const bindings: ScriptBinding[] = [{ type: "assets", name: "ASSETS" }];
  const wants = resourcesFor(row, target);
  const db = resourceId(row, "db");
  const kv = resourceId(row, "kv");
  if (wants.db && db) bindings.push({ type: "d1", name: "DB", id: db });
  if (wants.kv && kv) bindings.push({ type: "kv_namespace", name: "KV", namespace_id: kv });
  return bindings;
}

async function appOriginOpen(
  supabase: SupabaseClient,
  appId: string,
  stage: "claim" | "confirm"
): Promise<boolean> {
  const { data, error } = await supabase.rpc("miniapp_claim_app_origin", {
    p_app_id: appId,
  });
  if (error) throw new Error(`app origin ${stage} failed: ${error.message}`);
  return data === true;
}

async function claimAppOrigin(
  supabase: SupabaseClient,
  appId: string,
  slug: string
): Promise<void> {
  if (!(await appOriginOpen(supabase, appId, "claim"))) {
    throw new AppOriginRefusedError(slug);
  }
}

/**
 * Origin resources are keyed by slug, and a slug outlives its row: once the
 * account is gone the username is free and a new owner can recreate the same
 * `<username>-<appname>`. A stale writer must therefore never tear down a
 * slug that a different row now owns — that row's own claim/confirm protocol
 * governs the origin from then on. The read here cannot be atomic with the
 * vendor delete; the gap is closed in the database, where a deployed app's
 * slug stays on hold (miniapp_slug_holds) for longer than any request can
 * run after its row is deleted, so no new row can take the slug while a
 * writer like this one may still be in flight.
 */
async function teardownUnlessReassigned(
  supabase: SupabaseClient,
  appId: string,
  slug: string
): Promise<void> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select("id")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`app origin owner check failed: ${error.message}`);
  const owner = (data as { id: string } | null)?.id ?? null;
  if (owner !== null && owner !== appId) {
    console.warn(
      JSON.stringify({ msg: "app origin slug reassigned; teardown skipped", app: slug })
    );
    return;
  }
  await teardownAppOrigin(slug);
}

/**
 * After a vendor write: if deletion began since the claim, everything just
 * written is torn down here (the deleter may already have run its teardown).
 * A read failure leaves the write standing — the claim is on record, so a
 * later deletion still tears it down.
 */
async function confirmAppOrigin(
  supabase: SupabaseClient,
  appId: string,
  slug: string
): Promise<void> {
  if (await appOriginOpen(supabase, appId, "confirm")) return;
  await teardownUnlessReassigned(supabase, appId, slug);
  throw new AppOriginRefusedError(slug);
}

/** Manifest write under the same claim/confirm protocol as a Worker put. */
async function writeManifestGuarded(
  supabase: SupabaseClient,
  app: Pick<RegistryApp, "id" | "slug">,
  manifest: AppManifest
): Promise<void> {
  await claimAppOrigin(supabase, app.id, app.slug);
  await writeManifest(manifest);
  await confirmAppOrigin(supabase, app.id, app.slug);
}

/**
 * Upload a static bundle as a Worker. Returns the worker digest, or null when
 * the lane is unconfigured (caller stays on the legacy R2 path). Throws
 * AppOriginRefusedError when the app is being deleted.
 */
export async function deployStaticVersion(
  supabase: SupabaseClient,
  input: StaticDeploy
): Promise<{ workerSha256: string } | null> {
  if (!appOriginLaneReady()) return null;
  await claimAppOrigin(supabase, input.appId, input.slug);
  const script = scriptNameFor(input.slug, input.target);
  // The module runs only where the backend row allows it for this target
  // (§11.6: draft follows the declaration, live the approved manifest; the
  // kill switch blocks both). Otherwise the version serves as a static app.
  const fnModule =
    input.module === undefined
      ? (await loadRelease(input.slug, input.version)).module
      : input.module;
  const backend = fnModule ? await loadFunctions(supabase, input.appId) : null;
  const runsFunctions =
    fnModule !== null && backend !== null && moduleAllowed(backend, input.target);
  const assets = await uploadAssets(
    script,
    toAssetFiles(input.files),
    input.ownerUserId
  );
  const tags = [
    `owner:${input.ownerUserId}`,
    `app:${input.slug}`,
    `version:${input.version}`,
  ];
  const { digest } =
    runsFunctions && backend
      ? await putDispatchScript({
          script,
          mainModule: FUNCTIONS_MAIN,
          modules: [
            {
              name: FUNCTIONS_MAIN,
              content: fnModule.toString("utf8"),
              type: "application/javascript+module",
            },
          ],
          bindings: functionsBindings(backend, input.target),
          keepSecrets: true,
          tags,
          compatibilityDate: WORKER_COMPATIBILITY_DATE,
          limits: {
            cpu_ms: FUNCTIONS_CPU_MS[await ownerPlan(supabase, input.ownerUserId)],
            subrequests: FUNCTIONS_SUBREQUESTS,
          },
          assetsJwt: assets.jwt,
        })
      : await putDispatchScript({
          script,
          mainModule: STATIC_STUB_MAIN,
          modules: [
            {
              name: STATIC_STUB_MAIN,
              content: STATIC_STUB_MODULE,
              type: "application/javascript+module",
            },
          ],
          bindings: [{ type: "assets", name: "ASSETS" }],
          keepSecrets: true,
          tags,
          compatibilityDate: WORKER_COMPATIBILITY_DATE,
          limits: { cpu_ms: 50, subrequests: 0 },
          assetsJwt: assets.jwt,
        });
  console.log(
    JSON.stringify({
      msg: "app worker deployed",
      app: input.slug,
      version: input.version,
      target: input.target,
      files: input.files.length,
      functions: runsFunctions,
    })
  );
  await confirmAppOrigin(supabase, input.appId, input.slug);
  return { workerSha256: digest };
}

/**
 * What the Dispatcher hands the Outbound Worker (§11.3): the approved egress
 * list and budget — never the declaration — the resource flags, and the
 * opaque runtime-token reference. Absent until a backend is declared.
 */
export function runtimeFor(row: FunctionsRow | null): ManifestRuntime | undefined {
  if (!row || row.status === "disabled") return undefined;
  const approved = row.approved_manifest;
  return {
    egress: approved?.egress ?? [],
    budget_usd: approved?.dailyCapUsd ?? 0,
    db: approved?.db === true,
    kv: approved?.kv === true,
    token_ref: row.runtime_token_id,
    draft: moduleAllowed(row, "draft"),
    killed: row.killed_at !== null,
  };
}

export function manifestFor(app: RegistryApp, backend: FunctionsRow | null = null): AppManifest {
  const status: AppManifest["status"] =
    app.status === "suspended"
      ? "suspended"
      : app.status === "published"
        ? "published"
        : "draft";
  const runtime = runtimeFor(backend);
  return {
    slug: app.slug,
    status,
    live: app.status === "published" ? app.bundle_version : null,
    draft: app.draft_version,
    owner_ref: app.owner_user_id ? appPrincipal(app.owner_user_id, app.id) : "",
    functions: app.functions_enabled && (runtime === undefined || !runtime.killed),
    updated_at: new Date().toISOString(),
    ...(runtime ? { runtime } : {}),
  };
}

/** The backend row for the manifest; a read failure is fail-closed only when
 * the app has a backend to lose (a static app's manifest needs no row). */
async function backendForManifest(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<FunctionsRow | null> {
  try {
    return await loadFunctions(supabase, app.id);
  } catch (error) {
    if (app.functions_enabled) throw error;
    return null;
  }
}

/** The registry row's manifest with the backend row folded in. */
export async function currentManifest(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<AppManifest> {
  return manifestFor(app, await backendForManifest(supabase, app));
}

/**
 * Write the KV pointer for an app from its registry row. No-op when
 * unconfigured. Throws AppOriginRefusedError when the app is being deleted.
 */
export async function syncManifest(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<boolean> {
  if (!appOriginLaneReady() || !app.owner_user_id) return false;
  await writeManifestGuarded(supabase, app, await currentManifest(supabase, app));
  return true;
}

/**
 * Fail-closed suspension order (§13.3): the app origin dies first, then the
 * registry row flips, so there is never a window where discovery is gone
 * but the Worker still answers.
 */
export async function suspendOnAppOrigin(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<void> {
  if (!appOriginLaneReady() || !app.owner_user_id) return;
  await writeManifestGuarded(supabase, app, {
    ...(await currentManifest(supabase, app)),
    status: "suspended",
    live: null,
  });
}

/** Tenant teardown for /api/admin/delete (CR16): both scripts + the pointer. */
export async function teardownAppOrigin(slug: string): Promise<void> {
  if (!appOriginLaneReady()) return;
  await deleteManifest(slug);
  await deleteDispatchScript(scriptNameFor(slug, "live"));
  await deleteDispatchScript(scriptNameFor(slug, "draft"));
}

/**
 * Publish or roll back: the live script receives the version's files (same
 * digest as the draft that was previewed) and the pointer moves.
 */
export async function promoteVersion(
  supabase: SupabaseClient,
  app: RegistryApp,
  version: string
): Promise<{ workerSha256: string } | null> {
  if (!appOriginLaneReady() || !app.owner_user_id) return null;
  const { files, module } = await loadRelease(app.slug, version);
  if (files.length === 0) {
    throw new Error(`version ${version} has no stored bundle for ${app.slug}`);
  }
  const deployed = await deployStaticVersion(supabase, {
    appId: app.id,
    slug: app.slug,
    version,
    ownerUserId: app.owner_user_id,
    files,
    module,
    target: "live",
  });
  try {
    await writeManifestGuarded(supabase, app, {
      ...(await currentManifest(supabase, app)),
      status: "published",
      live: version,
    });
  } catch (error) {
    // The live Worker already serves `version` while the pointer still names
    // the previous release: never leave that standing. Deletion → the origin
    // goes (the deleter may abort before its own teardown); anything else →
    // the Worker returns to the release the pointer names.
    if (error instanceof AppOriginRefusedError) {
      await teardownUnlessReassigned(supabase, app.id, app.slug).catch(() => null);
    } else {
      await restoreLiveWorker(supabase, app, version).catch(() => null);
    }
    throw error;
  }
  return deployed;
}

async function restoreLiveWorker(
  supabase: SupabaseClient,
  app: RegistryApp,
  attempted: string
): Promise<void> {
  const previous = app.status === "published" ? app.bundle_version : null;
  if (previous === attempted) return;
  if (!previous || !app.owner_user_id) {
    await deleteDispatchScript(scriptNameFor(app.slug, "live"));
    return;
  }
  const { files, module } = await loadRelease(app.slug, previous);
  if (files.length === 0) return;
  await deployStaticVersion(supabase, {
    appId: app.id,
    slug: app.slug,
    version: previous,
    ownerUserId: app.owner_user_id,
    files,
    module,
    target: "live",
  });
}

/**
 * A manifest that disagrees with the registry and is younger than this is an
 * upload mid-flight (the manifest is written before the pointer swap), not
 * drift. Uploads are bounded well below it by the bundle caps.
 */
export const ORIGIN_DRIFT_GRACE_MS = 10 * 60_000;

const RECONCILE_PAGE = 200;
const REPAIR_ATTEMPTS = 3;

/**
 * Durable reconciliation of the app origin with the registry (cron). An
 * upload that lost its pointer swap and then could not re-read the registry
 * leaves the Dispatcher on a release the registry does not name; so can any
 * crash between a vendor write and the registry commit. For every app that
 * ever had a Worker, the served manifest is compared with the registry row;
 * where they disagree past the grace window the live Worker, the draft
 * Worker and the manifest are put back on the registry's releases. Apps
 * with no manifest (never written, or torn down by deletion) are left alone.
 * No-op when the lane is unconfigured.
 */
export async function reconcileAppOrigins(
  supabase: SupabaseClient,
  now = new Date()
): Promise<{ repaired: number }> {
  if (!appOriginLaneReady()) return { repaired: 0 };
  let repaired = 0;
  // Keyset pages on id: rows marked or removed behind the cursor while the
  // sweep runs cannot shift what is still ahead of it, as an offset would.
  let after: string | null = null;
  for (;;) {
    let page = supabase
      .from("mini_apps")
      .select(REGISTRY_COLUMNS)
      .not("app_origin_deployed_at", "is", null);
    if (after) page = page.gt("id", after);
    const { data, error } = await page
      .order("id", { ascending: true })
      .limit(RECONCILE_PAGE);
    if (error) throw new Error(`app origin reconcile failed: ${error.message}`);
    const rows = data ?? [];
    repaired += await reconcilePage(supabase, rows, now);
    if (rows.length < RECONCILE_PAGE) break;
    const last = (rows[rows.length - 1] as { id?: unknown }).id;
    if (typeof last !== "string" || (after !== null && last <= after)) {
      throw new Error("app origin reconcile failed: page without a usable cursor");
    }
    after = last;
  }
  if (repaired > 0) {
    console.log(JSON.stringify({ msg: "app origins reconciled", repaired }));
  }
  return { repaired };
}

async function reconcilePage(
  supabase: SupabaseClient,
  rows: unknown[],
  now: Date
): Promise<number> {
  let repaired = 0;
  for (const raw of rows) {
    const app = parseRegistryApp(raw);
    if (!app || !app.owner_user_id) continue;
    try {
      if (await reconcileAppOrigin(supabase, app, now)) repaired += 1;
    } catch (error) {
      // Deletion owns the origin now; the deleter tears it down.
      if (error instanceof AppOriginRefusedError) continue;
      console.error(
        JSON.stringify({
          msg: "app origin reconcile failed",
          slug: app.slug,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  return repaired;
}

function originAgrees(served: AppManifest, expected: AppManifest): boolean {
  return (
    served.status === expected.status &&
    served.live === expected.live &&
    served.draft === expected.draft
  );
}

async function reconcileAppOrigin(
  supabase: SupabaseClient,
  app: RegistryApp,
  now: Date
): Promise<boolean> {
  const served = await readManifest(app.slug);
  if (!served) return false;
  if (originAgrees(served, manifestFor(app))) return false;
  const manifestAge = now.getTime() - Date.parse(served.updated_at);
  const registryAge = now.getTime() - Date.parse(app.updated_at);
  if (
    !Number.isFinite(manifestAge) ||
    manifestAge < ORIGIN_DRIFT_GRACE_MS ||
    (Number.isFinite(registryAge) && registryAge < ORIGIN_DRIFT_GRACE_MS)
  ) {
    return false;
  }
  await repairAppOrigin(supabase, app, served);
  return true;
}

/**
 * Put the origin on `app`'s releases, then fence. Every pointer commit bumps
 * mini_apps.updated_at and every swap (an upload's CAS, `miniapp_point_live`)
 * requires it unchanged since its read, so a conditional touch of updated_at
 * after the vendor writes settles every race: a writer that commits before
 * the touch is seen here (the touch finds the row moved on), and one that
 * read before the touch loses its own swap and restores from the registry.
 * Seen → the row is re-read and the origin put on what it says now, without
 * grace, since this repair may have written over that commit's Workers.
 */
async function repairAppOrigin(
  supabase: SupabaseClient,
  app: RegistryApp,
  served: AppManifest
): Promise<void> {
  let current = app;
  let known: AppManifest | null = served;
  for (let attempt = 1; attempt <= REPAIR_ATTEMPTS; attempt += 1) {
    await putOriginOn(supabase, current, known);
    if (await touchAppOrigin(supabase, current)) {
      const registry = manifestFor(current);
      console.log(
        JSON.stringify({
          msg: "app origin reconciled",
          slug: app.slug,
          served: { status: served.status, live: served.live, draft: served.draft },
          registry: { status: registry.status, live: registry.live, draft: registry.draft },
          attempt,
        })
      );
      return;
    }
    const fresh = await readRegistryRow(supabase, app.id);
    if (!fresh || !fresh.owner_user_id) return;
    current = fresh;
    known = null;
  }
  console.error(
    JSON.stringify({
      msg: "app origin repair unfenced; pointers kept moving, next sweep re-checks",
      slug: app.slug,
    })
  );
}

/** Live Worker, draft Worker and manifest onto `app`'s releases; `known` null → all of them. */
async function putOriginOn(
  supabase: SupabaseClient,
  app: RegistryApp,
  known: AppManifest | null
): Promise<void> {
  const expected = manifestFor(app);
  if (expected.live && (!known || known.live !== expected.live)) {
    await promoteVersion(supabase, app, expected.live);
  }
  if (expected.draft && (!known || known.draft !== expected.draft) && app.owner_user_id) {
    const { files, module } = await loadRelease(app.slug, expected.draft);
    if (files.length > 0) {
      await deployStaticVersion(supabase, {
        appId: app.id,
        slug: app.slug,
        version: expected.draft,
        ownerUserId: app.owner_user_id,
        files,
        module,
        target: "draft",
      });
    }
  }
  await syncManifest(supabase, app);
}

async function touchAppOrigin(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<boolean> {
  const { data, error } = await supabase
    .from("mini_apps")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", app.id)
    .eq("updated_at", app.updated_at)
    .select("id");
  if (error) throw new Error(`app origin fence failed: ${error.message}`);
  return (data ?? []).length > 0;
}

async function readRegistryRow(
  supabase: SupabaseClient,
  appId: string
): Promise<RegistryApp | null> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select(REGISTRY_COLUMNS)
    .eq("id", appId)
    .maybeSingle();
  if (error) throw new Error(`registry read failed: ${error.message}`);
  return data ? parseRegistryApp(data) : null;
}

const DRAFT_SUFFIX = "-draft";

/** The app slugs a dispatch script name may belong to (`-draft` is a legal slug tail). */
function slugCandidates(script: string): string[] {
  return script.endsWith(DRAFT_SUFFIX)
    ? [script, script.slice(0, -DRAFT_SUFFIX.length)]
    : [script];
}

/**
 * Reconcile the deploy marks against the vendor inventory: every script in
 * the dispatch namespace names an app (`<slug>` or `<slug>-draft`); every app
 * a script can name gets app_origin_deployed_at set if it lacks it. Covers
 * Workers put before the mark existed. Scripts naming no app are reported so
 * ops can remove them. No-op when the lane is unconfigured.
 */
export async function reconcileAppOriginMarks(
  supabase: SupabaseClient
): Promise<{ marked: number; unmatched: string[] }> {
  if (!appOriginLaneReady()) return { marked: 0, unmatched: [] };
  const scripts = await listDispatchScripts();
  const slugs = [...new Set(scripts.flatMap(slugCandidates))];
  if (slugs.length === 0) return { marked: 0, unmatched: [] };
  const { data, error } = await supabase
    .from("mini_apps")
    .select("id, slug, app_origin_deployed_at")
    .in("slug", slugs);
  if (error) throw new Error(`app origin reconcile failed: ${error.message}`);
  const rows = (data ?? []) as Array<{
    id: string;
    slug: string;
    app_origin_deployed_at: string | null;
  }>;
  const known = new Set(rows.map((row) => row.slug));
  const unmatched = scripts.filter(
    (script) => !slugCandidates(script).some((slug) => known.has(slug))
  );
  const unmarked = rows.filter((row) => row.app_origin_deployed_at === null);
  if (unmarked.length > 0) {
    const { error: markError } = await supabase
      .from("mini_apps")
      .update({ app_origin_deployed_at: new Date().toISOString() })
      .in(
        "id",
        unmarked.map((row) => row.id)
      )
      .is("app_origin_deployed_at", null);
    if (markError) {
      throw new Error(`app origin reconcile failed: ${markError.message}`);
    }
  }
  if (unmatched.length > 0) {
    console.error(
      JSON.stringify({
        msg: "dispatch scripts without an app row",
        scripts: unmatched,
      })
    );
  }
  return { marked: unmarked.length, unmatched };
}
