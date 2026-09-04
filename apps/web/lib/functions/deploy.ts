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
 * CR16 deploy/delete protocol: every Worker put first claims the app row via
 * miniapp_claim_app_origin (refused once mini_apps.deleting_at is set; sets
 * app_origin_deployed_at, first deploy wins), and re-reads deleting_at after
 * the vendor write — a deletion that began in between finds the origin torn
 * down again by the deploy itself. The claim is the durable record that an
 * origin may be serving; account deletion refuses to proceed without the lane
 * whenever it is set.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { bundleContentType, bundleKey, type BundleFile } from "../miniapps/bundles";
import type { RegistryApp } from "../miniapps/registry";
import { getObject, listKeys, r2Configured } from "../storage/r2";
import {
  cloudflareConfigured,
  deleteDispatchScript,
  listDispatchScripts,
  putDispatchScript,
  uploadAssets,
  type AssetFile,
} from "./cloudflare";
import { appPrincipal } from "./identity";
import { deleteManifest, writeManifest, type AppManifest } from "./manifest";
import { STATIC_STUB_MAIN, STATIC_STUB_MODULE } from "./staticStub";
import { appOriginConfigured } from "./tokens";

export const WORKER_COMPATIBILITY_DATE = "2026-01-01";

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
  const prefix = bundleKey(slug, version, "");
  const keys = await listKeys(prefix, 1000);
  const files: BundleFile[] = [];
  for (const key of keys) {
    const object = await getObject(key);
    if (!object) continue;
    files.push({ path: key.slice(prefix.length), bytes: object.body });
  }
  return files;
}

export interface StaticDeploy {
  appId: string;
  slug: string;
  version: string;
  ownerUserId: string;
  files: BundleFile[];
  target: DeployTarget;
}

async function claimAppOrigin(
  supabase: SupabaseClient,
  appId: string,
  slug: string
): Promise<void> {
  const { data, error } = await supabase.rpc("miniapp_claim_app_origin", {
    p_app_id: appId,
  });
  if (error) throw new Error(`app origin claim failed: ${error.message}`);
  if (data !== true) throw new AppOriginRefusedError(slug);
}

/**
 * After the vendor write: if deletion began since the claim, the Worker just
 * put is torn down here (the deleter may already have run its teardown). A
 * read failure leaves the deploy standing — the claim is on record, so a
 * later deletion still tears it down.
 */
async function confirmAppOrigin(
  supabase: SupabaseClient,
  appId: string,
  slug: string
): Promise<void> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select("deleting_at")
    .eq("id", appId)
    .maybeSingle();
  if (error) throw new Error(`app origin confirm failed: ${error.message}`);
  const row = data as { deleting_at: string | null } | null;
  if (row && row.deleting_at === null) return;
  await teardownAppOrigin(slug);
  throw new AppOriginRefusedError(slug);
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
  const assets = await uploadAssets(
    script,
    toAssetFiles(input.files),
    input.ownerUserId
  );
  const { digest } = await putDispatchScript({
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
    tags: [
      `owner:${input.ownerUserId}`,
      `app:${input.slug}`,
      `version:${input.version}`,
    ],
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
    })
  );
  await confirmAppOrigin(supabase, input.appId, input.slug);
  return { workerSha256: digest };
}

export function manifestFor(app: RegistryApp): AppManifest {
  const status: AppManifest["status"] =
    app.status === "suspended"
      ? "suspended"
      : app.status === "published"
        ? "published"
        : "draft";
  return {
    slug: app.slug,
    status,
    live: app.status === "published" ? app.bundle_version : null,
    draft: app.draft_version,
    owner_ref: app.owner_user_id ? appPrincipal(app.owner_user_id, app.id) : "",
    functions: app.functions_enabled,
    updated_at: new Date().toISOString(),
  };
}

/** Write the KV pointer for an app from its registry row. No-op when unconfigured. */
export async function syncManifest(app: RegistryApp): Promise<boolean> {
  if (!appOriginLaneReady() || !app.owner_user_id) return false;
  await writeManifest(manifestFor(app));
  return true;
}

/**
 * Fail-closed suspension order (§13.3): the app origin dies first, then the
 * registry row flips, so there is never a window where discovery is gone
 * but the Worker still answers.
 */
export async function suspendOnAppOrigin(app: RegistryApp): Promise<void> {
  if (!appOriginLaneReady() || !app.owner_user_id) return;
  await writeManifest({ ...manifestFor(app), status: "suspended", live: null });
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
  const files = await loadBundleFiles(app.slug, version);
  if (files.length === 0) {
    throw new Error(`version ${version} has no stored bundle for ${app.slug}`);
  }
  const deployed = await deployStaticVersion(supabase, {
    appId: app.id,
    slug: app.slug,
    version,
    ownerUserId: app.owner_user_id,
    files,
    target: "live",
  });
  await writeManifest({
    ...manifestFor(app),
    status: "published",
    live: version,
  });
  return deployed;
}

/**
 * Reconcile the deploy marks against the vendor inventory: every script in
 * the dispatch namespace names an app (`<slug>` or `<slug>-draft`); apps
 * found there get app_origin_deployed_at set if they lack it. Covers Workers
 * put before the mark existed. Scripts naming no app are reported so ops can
 * remove them. No-op when the lane is unconfigured.
 */
export async function reconcileAppOriginMarks(
  supabase: SupabaseClient
): Promise<{ marked: number; unmatched: string[] }> {
  if (!appOriginLaneReady()) return { marked: 0, unmatched: [] };
  const scripts = await listDispatchScripts();
  const slugs = [
    ...new Set(
      scripts.map((name) =>
        name.endsWith("-draft") ? name.slice(0, -"-draft".length) : name
      )
    ),
  ];
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
  const unmatched = slugs.filter((slug) => !known.has(slug));
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
