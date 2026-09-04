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
 */
import { env } from "../env";
import { bundleContentType, bundleKey, type BundleFile } from "../miniapps/bundles";
import type { RegistryApp } from "../miniapps/registry";
import { getObject, listKeys, r2Configured } from "../storage/r2";
import {
  cloudflareConfigured,
  deleteDispatchScript,
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
  slug: string;
  version: string;
  ownerUserId: string;
  files: BundleFile[];
  target: DeployTarget;
}

/**
 * Upload a static bundle as a Worker. Returns the worker digest, or null when
 * the lane is unconfigured (caller stays on the legacy R2 path).
 */
export async function deployStaticVersion(
  input: StaticDeploy
): Promise<{ workerSha256: string } | null> {
  if (!appOriginLaneReady()) return null;
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
  app: RegistryApp,
  version: string
): Promise<{ workerSha256: string } | null> {
  if (!appOriginLaneReady() || !app.owner_user_id) return null;
  const files = await loadBundleFiles(app.slug, version);
  if (files.length === 0) {
    throw new Error(`version ${version} has no stored bundle for ${app.slug}`);
  }
  const deployed = await deployStaticVersion({
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
