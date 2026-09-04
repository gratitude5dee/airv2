/**
 * V11 §13.1 versions ledger. Every build, drop, import, and push inserts one
 * miniapp_versions row — digest, size, file count, findings, never content
 * (CR14). Rows are immutable except `published_at`, `retired_at`, `qa_score`.
 * `mini_apps.draft_version` and `mini_apps.bundle_version` point into it.
 *
 * Retention (§13.1): a published version lives 30 days after it is
 * superseded; the five most recent unpublished drafts per app are kept;
 * everything else is garbage-collected — R2 prefix, vendor artifacts, then
 * the row.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  deployStaticVersion,
  promoteVersion,
  syncManifest,
} from "../functions/deploy";
import {
  bundleKey,
  readZip,
  storeBundle,
  validateBundle,
  type BundleFile,
} from "../miniapps/bundles";
import type { CreateLane, RegistryApp } from "../miniapps/registry";
import { recordOpsEvent } from "../security/limits";
import { deletePrefix, r2Configured } from "../storage/r2";

export class VersionError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "VersionError";
    this.status = status;
  }
}

export const VERSION_RE = /^v[0-9]{10,16}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
export const RETAIN_SUPERSEDED_DAYS = 30;
export const RETAIN_DRAFTS = 5;

export interface Finding {
  file: string;
  line?: number | undefined;
  rule: string;
  hint: string;
}

export interface VersionRow {
  id: string;
  app_id: string;
  user_id: string;
  version: string;
  lane: CreateLane;
  bundle_sha256: string;
  bundle_bytes: number;
  file_count: number;
  worker_sha256: string | null;
  kit_version: string | null;
  findings: Finding[];
  qa_score: number | null;
  created_at: string;
  published_at: string | null;
  retired_at: string | null;
}

const FindingSchema = z.object({
  file: z.string(),
  line: z.number().int().optional(),
  rule: z.string(),
  hint: z.string(),
});

const VersionSchema = z.object({
  id: z.string(),
  app_id: z.string(),
  user_id: z.string(),
  version: z.string().regex(VERSION_RE),
  lane: z.enum(["drop", "vibe", "import", "push"]),
  bundle_sha256: z.string().regex(SHA256_RE),
  bundle_bytes: z.coerce.number(),
  file_count: z.coerce.number(),
  worker_sha256: z.string().regex(SHA256_RE).nullable(),
  kit_version: z.string().nullable(),
  findings: z.array(FindingSchema).catch([]),
  qa_score: z.number().nullable(),
  created_at: z.string(),
  published_at: z.string().nullable(),
  retired_at: z.string().nullable(),
});

export const VERSION_COLUMNS =
  "id, app_id, user_id, version, lane, bundle_sha256, bundle_bytes, " +
  "file_count, worker_sha256, kit_version, findings, qa_score, created_at, " +
  "published_at, retired_at";

export function parseVersionRow(value: unknown): VersionRow | null {
  const parsed = VersionSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Content digest over the sorted (path, bytes) list — independent of zip order. */
export function bundleDigest(files: BundleFile[]): {
  sha256: string;
  bytes: number;
  fileCount: number;
} {
  const hash = createHash("sha256");
  let bytes = 0;
  for (const file of [...files].sort((a, b) => a.path.localeCompare(b.path))) {
    hash.update(file.path).update("\0").update(file.bytes).update("\0");
    bytes += file.bytes.length;
  }
  return { sha256: hash.digest("hex"), bytes, fileCount: files.length };
}

export function newVersionId(now = Date.now()): string {
  return `v${now}`;
}

export interface RecordVersionInput {
  appId: string;
  userId: string;
  version: string;
  lane: CreateLane;
  files: BundleFile[];
  workerSha256?: string | null;
  kitVersion?: string | null;
  findings?: Finding[];
}

export async function recordVersion(
  supabase: SupabaseClient,
  input: RecordVersionInput
): Promise<VersionRow> {
  const digest = bundleDigest(input.files);
  const { data, error } = await supabase
    .from("miniapp_versions")
    .insert({
      app_id: input.appId,
      user_id: input.userId,
      version: input.version,
      lane: input.lane,
      bundle_sha256: digest.sha256,
      bundle_bytes: digest.bytes,
      file_count: digest.fileCount,
      worker_sha256: input.workerSha256 ?? null,
      kit_version: input.kitVersion ?? null,
      findings: input.findings ?? [],
    })
    .select(VERSION_COLUMNS)
    .single();
  if (error) throw new Error(`version insert failed: ${error.message}`);
  const row = parseVersionRow(data);
  if (!row) throw new Error("version insert returned an invalid row");
  return row;
}

/**
 * Validate + store a zip for an owned app as a new version: files to
 * apps/<slug>/<version>/ on R2, the draft Worker on the app origin (when the
 * lane is configured), one miniapp_versions row, and the registry pointers.
 * Uploading a draft app never publishes; uploading to an already-published
 * app replaces what is live, exactly as the MA3 upload did, so the live
 * Worker is promoted in the same call to keep both origins on one version.
 */
export async function uploadVersion(
  supabase: SupabaseClient,
  app: RegistryApp,
  zip: Buffer,
  lane: CreateLane = "push"
): Promise<string> {
  if (!app.owner_user_id) throw new VersionError("app not found", 404);
  const files = readZip(zip);
  validateBundle(files);
  const version = newVersionId();
  await storeBundle(app.slug, version, files);
  const deployed = await deployStaticVersion({
    slug: app.slug,
    version,
    ownerUserId: app.owner_user_id,
    files,
    target: "draft",
  });
  await recordVersion(supabase, {
    appId: app.id,
    userId: app.owner_user_id,
    version,
    lane,
    files,
    workerSha256: deployed?.workerSha256 ?? null,
  });
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("mini_apps")
    .update({
      bundle_version: version,
      draft_version: version,
      lane,
      updated_at: now,
    })
    .eq("id", app.id);
  if (error) throw new Error(`bundle version update failed: ${error.message}`);
  if (app.status === "published" && deployed) {
    await promoteVersion(app, version);
    await supabase
      .from("miniapp_versions")
      .update({ published_at: now })
      .eq("app_id", app.id)
      .eq("version", version);
    if (app.bundle_version && app.bundle_version !== version) {
      await supabase
        .from("miniapp_versions")
        .update({ retired_at: now })
        .eq("app_id", app.id)
        .eq("version", app.bundle_version)
        .is("retired_at", null);
    }
  } else if (app.status === "published") {
    await syncManifest({
      ...app,
      bundle_version: version,
      draft_version: version,
    });
  }
  console.log(
    JSON.stringify({
      msg: "miniapp bundle uploaded",
      slug: app.slug,
      version,
      lane,
      files: files.length,
      app_origin: deployed !== null,
    })
  );
  return version;
}

export async function getVersion(
  supabase: SupabaseClient,
  appId: string,
  version: string
): Promise<VersionRow | null> {
  if (!VERSION_RE.test(version)) return null;
  const { data, error } = await supabase
    .from("miniapp_versions")
    .select(VERSION_COLUMNS)
    .eq("app_id", appId)
    .eq("version", version)
    .maybeSingle();
  if (error) throw new Error(`version lookup failed: ${error.message}`);
  return parseVersionRow(data);
}

export async function listVersions(
  supabase: SupabaseClient,
  appId: string,
  limit = 50
): Promise<VersionRow[]> {
  const { data, error } = await supabase
    .from("miniapp_versions")
    .select(VERSION_COLUMNS)
    .eq("app_id", appId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`version list failed: ${error.message}`);
  return (data ?? [])
    .map(parseVersionRow)
    .filter((row): row is VersionRow => row !== null);
}

/**
 * Point `bundle_version` at `version` and stamp the ledger: the new row gets
 * `published_at`, the previously live row (if different) gets `retired_at`.
 */
export async function pointLiveAt(
  supabase: SupabaseClient,
  app: RegistryApp,
  version: string
): Promise<void> {
  const now = new Date().toISOString();
  const previous = app.bundle_version;
  const { error } = await supabase
    .from("mini_apps")
    .update({ bundle_version: version, updated_at: now })
    .eq("id", app.id);
  if (error) throw new Error(`live pointer move failed: ${error.message}`);
  await supabase
    .from("miniapp_versions")
    .update({ published_at: now, retired_at: null })
    .eq("app_id", app.id)
    .eq("version", version);
  if (previous && previous !== version) {
    await supabase
      .from("miniapp_versions")
      .update({ retired_at: now })
      .eq("app_id", app.id)
      .eq("version", previous)
      .is("retired_at", null);
  }
}

/**
 * §13.3 rollback: an owner action that moves `bundle_version`, the live
 * script, and the KV manifest to a prior version. The caller has already
 * resolved `app` through `ownedApp`. Refuses versions this app never built
 * and versions whose artifacts were already garbage-collected.
 */
export async function rollbackTo(
  supabase: SupabaseClient,
  app: RegistryApp,
  version: string
): Promise<VersionRow> {
  if (!app.owner_user_id) throw new VersionError("app not found", 404);
  if (app.status !== "published") {
    throw new VersionError("only a published app can be rolled back", 409);
  }
  const target = await getVersion(supabase, app.id, version);
  if (!target) throw new VersionError("version not found", 404);
  if (target.version === app.bundle_version) {
    throw new VersionError("that version is already live", 409);
  }
  await promoteVersion(app, target.version);
  await pointLiveAt(supabase, app, target.version);
  await syncManifest({ ...app, bundle_version: target.version });
  await recordOpsEvent(supabase, "rollback", app.owner_user_id, app.slug);
  console.log(
    JSON.stringify({
      msg: "miniapp rolled back",
      user_id: app.owner_user_id,
      slug: app.slug,
      from: app.bundle_version,
      to: target.version,
    })
  );
  return target;
}

interface SweepCandidate {
  id: string;
  app_id: string;
  version: string;
  published_at: string | null;
  retired_at: string | null;
  created_at: string;
  slug: string | null;
  bundle_version: string | null;
  draft_version: string | null;
}

/**
 * Retention sweep (cron): delete R2 artifacts and rows for superseded
 * versions past the window and drafts beyond the five newest, never touching
 * the live or draft pointer of any app. Returns the number of versions
 * removed.
 */
export async function sweepVersions(
  supabase: SupabaseClient,
  now = new Date()
): Promise<number> {
  const { data, error } = await supabase
    .from("miniapp_versions")
    .select(
      "id, app_id, version, published_at, retired_at, created_at, " +
        "mini_apps!inner(slug, bundle_version, draft_version)"
    )
    .order("created_at", { ascending: false })
    .limit(5000);
  if (error) throw new Error(`version sweep read failed: ${error.message}`);
  const candidates: SweepCandidate[] = [];
  for (const raw of data ?? []) {
    const row = raw as unknown as Record<string, unknown>;
    const joined = (Array.isArray(row["mini_apps"])
      ? row["mini_apps"][0]
      : row["mini_apps"]) as Record<string, unknown> | undefined;
    if (
      typeof row["id"] !== "string" ||
      typeof row["app_id"] !== "string" ||
      typeof row["version"] !== "string" ||
      typeof row["created_at"] !== "string"
    ) {
      continue;
    }
    candidates.push({
      id: row["id"],
      app_id: row["app_id"],
      version: row["version"],
      created_at: row["created_at"],
      published_at:
        typeof row["published_at"] === "string" ? row["published_at"] : null,
      retired_at:
        typeof row["retired_at"] === "string" ? row["retired_at"] : null,
      slug: typeof joined?.["slug"] === "string" ? joined["slug"] : null,
      bundle_version:
        typeof joined?.["bundle_version"] === "string"
          ? joined["bundle_version"]
          : null,
      draft_version:
        typeof joined?.["draft_version"] === "string"
          ? joined["draft_version"]
          : null,
    });
  }
  const cutoff = now.getTime() - RETAIN_SUPERSEDED_DAYS * 86_400_000;
  const draftsSeen = new Map<string, number>();
  const doomed: SweepCandidate[] = [];
  for (const row of candidates) {
    if (row.version === row.bundle_version || row.version === row.draft_version) {
      continue;
    }
    if (row.published_at) {
      if (row.retired_at && Date.parse(row.retired_at) < cutoff) doomed.push(row);
      continue;
    }
    const seen = draftsSeen.get(row.app_id) ?? 0;
    draftsSeen.set(row.app_id, seen + 1);
    if (seen >= RETAIN_DRAFTS) doomed.push(row);
  }
  let removed = 0;
  for (const row of doomed) {
    if (row.slug && r2Configured()) {
      await deletePrefix(bundleKey(row.slug, row.version, ""));
    }
    const { error: deleteError } = await supabase
      .from("miniapp_versions")
      .delete()
      .eq("id", row.id);
    if (deleteError) {
      console.error(
        JSON.stringify({
          msg: "version sweep delete failed",
          version: row.version,
          error: deleteError.message,
        })
      );
      continue;
    }
    removed += 1;
  }
  if (removed > 0) {
    console.log(JSON.stringify({ msg: "version sweep", removed }));
  }
  return removed;
}
