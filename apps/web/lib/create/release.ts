/**
 * V12 §6.3 the dev channel (CR17, CR22, CR23). A dev release is one version
 * the owner explicitly promoted to `link.wzrd.tech/<u>/<a>`: served by the
 * `<slug>-dev` Worker, unlisted, guest-readable, time-boxed to
 * CREATE_DEV_TTL_DAYS and revocable by one owner command or one admin
 * action. Promotion re-uploads the version's digest to the dev script (the
 * promoteVersion pattern in lib/functions/deploy.ts), writes the manifest's
 * dev pointer and stamps `mini_apps.dev_*`. Postgres holds the pointer and
 * its timestamps only; the bundle lives on the app origin.
 *
 * CR22 gate, checked here so every caller (route, iMessage command, admin)
 * gets the same answer: zero hard findings, qa_score ≥ CREATE_DEV_MIN_QA and
 * every declared test passing. A production publish never revokes dev; the
 * owner or the expiry sweep does.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { deleteDispatchScript } from "../functions/cloudflare";
import {
  appOriginLaneReady,
  deployStaticVersion,
  loadRelease,
  scriptNameFor,
  syncManifest,
} from "../functions/deploy";
import { nestedPathFor } from "../miniapps/nested";
import {
  parseRegistryApp,
  REGISTRY_COLUMNS,
  type RegistryApp,
} from "../miniapps/registry";
import { recordOpsEvent, type OpsEventKind } from "../security/limits";
import { createConfig } from "./config";
import { getVersion, VERSION_RE, type VersionRow } from "./versions";

// 0117 admits these kinds in ops_events; the OpsEventKind union lives in
// lib/security/limits.ts (another lane's file — see the lane's open issues).
const DEV_RELEASE_KIND: OpsEventKind = "dev_release";
const DEV_REVOKE_KIND: OpsEventKind = "dev_revoke";

export type DevReleaseReason =
  | "hard_findings"
  | "qa_score"
  | "tests_failing"
  | "no_bundle";

export class ReleaseError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly reasons: DevReleaseReason[] = []
  ) {
    super(message);
    this.name = "ReleaseError";
  }
}

export interface DevRelease {
  channel: "dev";
  version: string;
  url: string;
  expires_at: string;
}

/** `https://link.wzrd.tech/<u>/<a>` — the dev URL for a registry slug (§6). */
export function devUrl(app: Pick<RegistryApp, "slug">): string {
  return `${env.linkappOrigin()}${nestedPathFor(app.slug)}`;
}

/** True while the dev pointer is set and its expiry is still ahead of `now`. */
export function devReleaseActive(
  app: Pick<RegistryApp, "dev_version" | "dev_expires_at">,
  now = new Date()
): boolean {
  if (!app.dev_version || !app.dev_expires_at) return false;
  const expires = Date.parse(app.dev_expires_at);
  return Number.isFinite(expires) && expires > now.getTime();
}

function optionalCount(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/**
 * CR22: why a version may not go to dev, or `[]` when it may. The tests
 * columns arrive with 0118 (`tests_total`, `tests_passed`); a row without
 * them declares no tests and only the findings and QA legs apply.
 */
export function devGateReasons(row: VersionRow): DevReleaseReason[] {
  const reasons: DevReleaseReason[] = [];
  if (row.findings.some((finding) => finding.severity === "hard")) {
    reasons.push("hard_findings");
  }
  if (row.qa_score === null || row.qa_score < createConfig.devMinQaScore()) {
    reasons.push("qa_score");
  }
  const extra = row as Partial<Record<"tests_total" | "tests_passed", unknown>>;
  const total = optionalCount(extra.tests_total);
  if (total !== null && optionalCount(extra.tests_passed) !== total) {
    reasons.push("tests_failing");
  }
  return reasons;
}

async function writeDevPointer(
  supabase: SupabaseClient,
  app: RegistryApp,
  patch: {
    dev_version: string | null;
    dev_released_at: string | null;
    dev_expires_at: string | null;
  }
): Promise<RegistryApp> {
  const { data, error } = await supabase
    .from("mini_apps")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", app.id)
    .select(REGISTRY_COLUMNS)
    .maybeSingle();
  if (error) throw new Error(`dev pointer write failed: ${error.message}`);
  const fresh = data ? parseRegistryApp(data) : null;
  if (!fresh) throw new ReleaseError("app not found", 404);
  return fresh;
}

function expiryFrom(now: Date): string {
  return new Date(now.getTime() + createConfig.devTtlDays() * 86_400_000).toISOString();
}

/**
 * Promote `version` to the dev channel (§6.3). Throws ReleaseError 409
 * `not_ready` with the CR22 reasons, 404 for an unknown version, 503 when
 * the app-origin lane is unconfigured (nothing can serve a dev release then).
 */
export async function promoteToDev(
  supabase: SupabaseClient,
  app: RegistryApp,
  version: string,
  now = new Date()
): Promise<DevRelease> {
  if (!appOriginLaneReady() || !app.owner_user_id) {
    throw new ReleaseError("dev channel unavailable", 503);
  }
  if (!VERSION_RE.test(version)) throw new ReleaseError("invalid version", 400);
  const row = await getVersion(supabase, app.id, version);
  if (!row) throw new ReleaseError("version not found", 404);
  const reasons = devGateReasons(row);
  if (reasons.length > 0) throw new ReleaseError("not_ready", 409, reasons);

  const { files, module } = await loadRelease(app.slug, version);
  if (files.length === 0) throw new ReleaseError("not_ready", 409, ["no_bundle"]);
  await deployStaticVersion(supabase, {
    appId: app.id,
    slug: app.slug,
    version,
    ownerUserId: app.owner_user_id,
    files,
    module,
    target: "dev",
  });
  const expiresAt = expiryFrom(now);
  const fresh = await writeDevPointer(supabase, app, {
    dev_version: version,
    dev_released_at: now.toISOString(),
    dev_expires_at: expiresAt,
  });
  await syncManifest(supabase, fresh);
  await recordOpsEvent(supabase, DEV_RELEASE_KIND, app.owner_user_id, app.slug);
  console.log(
    JSON.stringify({
      msg: "dev release promoted",
      user_id: app.owner_user_id,
      app: app.slug,
      version,
      expires_at: expiresAt,
    })
  );
  return { channel: "dev", version, url: devUrl(app), expires_at: expiresAt };
}

/** Renewal is the same promotion of the current dev version with a fresh expiry (§6.3). */
export async function renewDev(
  supabase: SupabaseClient,
  app: RegistryApp,
  now = new Date()
): Promise<DevRelease> {
  if (!app.dev_version) throw new ReleaseError("no dev release", 409);
  return promoteToDev(supabase, app, app.dev_version, now);
}

/**
 * Revoke the dev release: the `-dev` Worker goes first (fail-closed, like
 * suspension), then the pointers are nulled and the manifest follows.
 * Idempotent — revoking an app without a dev release is a no-op that
 * returns `null`.
 */
export async function revokeDev(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<{ version: string } | null> {
  const previous = app.dev_version ?? null;
  if (appOriginLaneReady()) {
    await deleteDispatchScript(scriptNameFor(app.slug, "dev"));
  }
  const fresh = await writeDevPointer(supabase, app, {
    dev_version: null,
    dev_released_at: null,
    dev_expires_at: null,
  });
  if (previous === null) return null;
  await syncManifest(supabase, fresh);
  await recordOpsEvent(supabase, DEV_REVOKE_KIND, app.owner_user_id, app.slug);
  console.log(
    JSON.stringify({
      msg: "dev release revoked",
      user_id: app.owner_user_id,
      app: app.slug,
      version: previous,
    })
  );
  return { version: previous };
}

export const EXPIRE_PAGE = 200;

/**
 * The expiry sweep (CR17): every dev release whose `dev_expires_at` has
 * passed is revoked. One page per call — the cron re-runs; a failure on one
 * app is logged and the sweep moves on.
 */
export async function expireDevReleases(
  supabase: SupabaseClient,
  now = new Date()
): Promise<{ revoked: number }> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select(REGISTRY_COLUMNS)
    .not("dev_version", "is", null)
    .lte("dev_expires_at", now.toISOString())
    .limit(EXPIRE_PAGE);
  if (error) throw new Error(`dev expiry sweep failed: ${error.message}`);
  let revoked = 0;
  for (const raw of data ?? []) {
    const app = parseRegistryApp(raw);
    if (!app) continue;
    try {
      if (await revokeDev(supabase, app)) revoked += 1;
    } catch (err) {
      console.error(
        JSON.stringify({
          msg: "dev release expiry failed",
          app: app.slug,
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  }
  if (revoked > 0) console.log(JSON.stringify({ msg: "dev releases expired", revoked }));
  return { revoked };
}
