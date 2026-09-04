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
  appOriginLaneReady,
  deployStaticVersion,
  loadBundleFiles,
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
  /** Hard findings never reach a version row (CR12); absent means soft. */
  severity?: "hard" | "soft" | undefined;
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
  purged_at: string | null;
}

const FindingSchema = z.object({
  file: z.string(),
  line: z.number().int().optional(),
  rule: z.string(),
  hint: z.string(),
  severity: z.enum(["hard", "soft"]).optional(),
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
  purged_at: z.string().nullable().default(null),
});

export const VERSION_COLUMNS =
  "id, app_id, user_id, version, lane, bundle_sha256, bundle_bytes, " +
  "file_count, worker_sha256, kit_version, findings, qa_score, created_at, " +
  "published_at, retired_at, purged_at";

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
  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message)) {
      throw new VersionError("another upload is in progress; retry", 409);
    }
    throw new Error(`version insert failed: ${error.message}`);
  }
  const row = parseVersionRow(data);
  if (!row) throw new Error("version insert returned an invalid row");
  return row;
}

export interface UploadVersionOptions {
  /** Soft lint findings to store on the row (CR12: hard ones never get here). */
  findings?: Finding[] | undefined;
  /**
   * `false` stages a draft on an already-published app without moving what
   * is live (CR4: the agent stages, the owner publishes). Default `true`
   * keeps the MA3 upload semantics — live follows the upload.
   */
  promote?: boolean | undefined;
}

/**
 * Validate + store a bundle for an owned app as a new version: files to
 * apps/<slug>/<version>/ on R2, the draft Worker on the app origin (when the
 * lane is configured), one miniapp_versions row, and the registry pointers.
 * Accepts a zip or files already unpacked by `readZip`; either way the
 * bundle contract (`validateBundle`) runs here, so no caller can skip it.
 * Uploading a draft app never publishes; uploading to an already-published
 * app replaces what is live, exactly as the MA3 upload did, so the live
 * Worker is promoted in the same call to keep both origins on one version —
 * unless `promote: false`, which leaves live alone and only moves the draft.
 */
export async function uploadVersion(
  supabase: SupabaseClient,
  app: RegistryApp,
  bundle: Buffer | BundleFile[],
  lane: CreateLane = "push",
  options: UploadVersionOptions = {}
): Promise<string> {
  if (!app.owner_user_id) throw new VersionError("app not found", 404);
  const files = Buffer.isBuffer(bundle) ? readZip(bundle) : bundle;
  validateBundle(files);
  const goesLive = app.status === "published" && options.promote !== false;
  // The ledger row is written first: the unique (app_id, version) index is
  // what makes the R2 prefix exclusively ours, so two same-millisecond uploads
  // can never interleave files under one version.
  const version = newVersionId();
  const row = await recordVersion(supabase, {
    appId: app.id,
    userId: app.owner_user_id,
    version,
    lane,
    files,
    findings: options.findings ?? [],
  });
  let deployed: { workerSha256: string } | null = null;
  try {
    await storeBundle(app.slug, version, files);
    if (appOriginLaneReady()) await markAppOriginDeployed(supabase, app);
    deployed = await deployStaticVersion({
      slug: app.slug,
      version,
      ownerUserId: app.owner_user_id,
      files,
      target: "draft",
    });
    if (deployed) {
      // The hand-off keys on this digest: a version without it stays on the
      // legacy renderer, so a lost write is a failed upload, not a warning.
      const { error: digestError } = await supabase
        .from("miniapp_versions")
        .update({ worker_sha256: deployed.workerSha256 })
        .eq("id", row.id);
      if (digestError) {
        throw new Error(`worker digest write failed: ${digestError.message}`);
      }
    }
    // Published apps: the live Worker moves before the registry pointer, so
    // a failed promotion leaves both origins on the previous version.
    if (goesLive && deployed) {
      await promoteVersion(app, version);
    }
  } catch (error) {
    await discardVersion(supabase, app, row.id, version);
    throw error;
  }
  const now = new Date().toISOString();
  // Compare-and-swap on the pointers this call observed: two concurrent
  // uploads then agree on one winner, and the loser undoes its promotion
  // instead of leaving the Worker and the registry on different releases.
  // A staged draft on a live app moves only the draft pointer.
  const stageOnly = app.status === "published" && !goesLive;
  let move = supabase
    .from("mini_apps")
    .update({
      ...(stageOnly ? {} : { bundle_version: version }),
      draft_version: version,
      lane,
      updated_at: now,
    })
    .eq("id", app.id);
  move = app.bundle_version
    ? move.eq("bundle_version", app.bundle_version)
    : move.is("bundle_version", null);
  move = app.draft_version
    ? move.eq("draft_version", app.draft_version)
    : move.is("draft_version", null);
  const { data: moved, error } = await move.select("id");
  if (error || !moved || moved.length === 0) {
    // The Workers already moved; put them back on whatever the registry now
    // says is selected so neither origin serves a release the registry does
    // not name (the draft Worker is shared, so the loser's deploy may have
    // landed after the winner's), then surface the registry failure.
    if (deployed) {
      const current = error
        ? { bundle_version: app.bundle_version, draft_version: app.draft_version }
        : await currentPointers(supabase, app.id);
      if (goesLive && current.bundle_version) {
        await promoteVersion(app, current.bundle_version).catch(() => null);
      }
      if (current.draft_version && current.draft_version !== version) {
        await redeployDraft(app, current.draft_version).catch(() => null);
      }
    }
    await discardVersion(supabase, app, row.id, version);
    if (error) throw new Error(`bundle version update failed: ${error.message}`);
    throw new VersionError("another upload finished first; retry", 409);
  }
  if (goesLive) {
    // The ledger tracks what is live on whichever lane serves it; the legacy
    // R2 renderer follows bundle_version too, so its releases are published
    // and retired exactly like Worker releases (retention depends on it).
    await stampLive(supabase, app.id, version, app.bundle_version, now);
  }
  // The Dispatcher reads pointers from the manifest, and it serves a draft
  // Worker only when the manifest names it (CR13) — so every upload that
  // reached the app origin, or that moved live, rewrites the pointer.
  if (goesLive || deployed) {
    await syncManifest({
      ...app,
      bundle_version: stageOnly ? app.bundle_version : version,
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
      findings: options.findings?.length ?? 0,
      app_origin: deployed !== null,
      staged: stageOnly,
    })
  );
  return version;
}

/**
 * The app row remembers that a Worker was ever put for it (CR16). The mark
 * goes in before the deploy, and a lost write fails the upload: account
 * deletion reads this column to decide whether an origin may still serve,
 * and version rows cannot carry that fact because a failed upload discards
 * its row after the draft Worker is already up.
 */
async function markAppOriginDeployed(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<void> {
  const { error } = await supabase
    .from("mini_apps")
    .update({ app_origin_deployed_at: new Date().toISOString() })
    .eq("id", app.id)
    .is("app_origin_deployed_at", null);
  if (error) {
    throw new Error(`app origin deploy mark failed: ${error.message}`);
  }
}

/**
 * Undo a reserved version that never became a pointer, in the same
 * tombstone order as the retention sweep: mark the row purged (it stops
 * being selectable), delete the R2 prefix, then the row. A failure after the
 * tombstone leaves a row the next sweep finishes, so a lost R2 delete never
 * strands files with no record of them.
 */
async function discardVersion(
  supabase: SupabaseClient,
  app: RegistryApp,
  rowId: string,
  version: string
): Promise<void> {
  try {
    const { data, error } = await supabase.rpc("miniapp_tombstone_version", {
      p_id: rowId,
    });
    if (error) throw new Error(error.message);
    if (data !== true) return;
    if (r2Configured()) {
      await deletePrefix(bundleKey(app.slug, version, ""));
    }
    const { error: rowError } = await supabase
      .from("miniapp_versions")
      .delete()
      .eq("id", rowId);
    if (rowError) throw new Error(rowError.message);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "version discard incomplete; sweep will finish it",
        slug: app.slug,
        version,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

async function currentLiveVersion(
  supabase: SupabaseClient,
  appId: string
): Promise<string | null> {
  return (await currentPointers(supabase, appId)).bundle_version;
}

async function currentPointers(
  supabase: SupabaseClient,
  appId: string
): Promise<{ bundle_version: string | null; draft_version: string | null }> {
  const { data } = await supabase
    .from("mini_apps")
    .select("bundle_version, draft_version")
    .eq("id", appId)
    .maybeSingle();
  const row = data as { bundle_version?: unknown; draft_version?: unknown } | null;
  return {
    bundle_version: typeof row?.bundle_version === "string" ? row.bundle_version : null,
    draft_version: typeof row?.draft_version === "string" ? row.draft_version : null,
  };
}

/** Put the shared draft Worker back on the version the registry selects. */
async function redeployDraft(app: RegistryApp, version: string): Promise<void> {
  if (!app.owner_user_id) return;
  const files = await loadBundleFiles(app.slug, version);
  if (files.length === 0) return;
  await deployStaticVersion({
    slug: app.slug,
    version,
    ownerUserId: app.owner_user_id,
    files,
    target: "draft",
  });
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
    .is("purged_at", null)
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
    .is("purged_at", null)
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
 * One transaction (`miniapp_point_live`) that compares the pointer with the
 * value `app` observed and re-checks that `version` is still selectable, so
 * neither a concurrent pointer move nor a retention tombstone can slip in
 * between the read and the write. Throws a 409 `VersionError` when it lost.
 */
export async function pointLiveAt(
  supabase: SupabaseClient,
  app: RegistryApp,
  version: string
): Promise<void> {
  const { data, error } = await supabase.rpc("miniapp_point_live", {
    p_app_id: app.id,
    p_version: version,
    p_expected: app.bundle_version,
  });
  if (error) throw new Error(`live pointer move failed: ${error.message}`);
  if (data !== true) {
    throw new VersionError(
      "live version changed underneath this request; retry",
      409
    );
  }
}

async function stampLive(
  supabase: SupabaseClient,
  appId: string,
  version: string,
  previous: string | null,
  now: string
): Promise<void> {
  await supabase
    .from("miniapp_versions")
    .update({ published_at: now, retired_at: null })
    .eq("app_id", appId)
    .eq("version", version);
  if (previous && previous !== version) {
    await supabase
      .from("miniapp_versions")
      .update({ retired_at: now })
      .eq("app_id", appId)
      .eq("version", previous)
      .is("retired_at", null);
  }
}

/**
 * §13.3 rollback: an owner action that moves `bundle_version`, the live
 * script, and the KV manifest to a prior *published* version. The caller has
 * already resolved `app` through `ownedApp`. Refuses versions this app never
 * built, drafts that never went live, and versions whose artifacts were
 * already garbage-collected.
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
  if (!target.published_at) {
    throw new VersionError("only a previously published version can go live", 409);
  }
  if (target.version === app.bundle_version) {
    throw new VersionError("that version is already live", 409);
  }
  await promoteVersion(app, target.version);
  try {
    await pointLiveAt(supabase, app, target.version);
  } catch (error) {
    // The Worker is on the target but the registry names another release —
    // the previous one, or whatever a concurrent move won with; put the
    // Worker back on that so both origins agree before failing.
    const current =
      error instanceof VersionError
        ? await currentLiveVersion(supabase, app.id).catch(() => app.bundle_version)
        : app.bundle_version;
    if (current) {
      await promoteVersion(app, current).catch(() => null);
    }
    throw error;
  }
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
  purged_at: string | null;
  created_at: string;
  slug: string | null;
  bundle_version: string | null;
  draft_version: string | null;
}

const SWEEP_COLUMNS =
  "id, app_id, version, published_at, retired_at, purged_at, created_at, " +
  "mini_apps!inner(slug, bundle_version, draft_version)";
export const SWEEP_PAGE = 1000;

function toSweepCandidate(raw: unknown): SweepCandidate | null {
  const row = raw as Record<string, unknown>;
  const joined = (Array.isArray(row["mini_apps"])
    ? row["mini_apps"][0]
    : row["mini_apps"]) as Record<string, unknown> | undefined;
  if (
    typeof row["id"] !== "string" ||
    typeof row["app_id"] !== "string" ||
    typeof row["version"] !== "string" ||
    typeof row["created_at"] !== "string"
  ) {
    return null;
  }
  const str = (value: unknown): string | null =>
    typeof value === "string" ? value : null;
  return {
    id: row["id"],
    app_id: row["app_id"],
    version: row["version"],
    created_at: row["created_at"],
    published_at: str(row["published_at"]),
    retired_at: str(row["retired_at"]),
    purged_at: str(row["purged_at"]),
    slug: str(joined?.["slug"]),
    bundle_version: str(joined?.["bundle_version"]),
    draft_version: str(joined?.["draft_version"]),
  };
}

/**
 * Every version row, newest first, in keyset pages — the per-app draft count
 * needs the global order, and a fixed cap would strand rows older than it.
 */
async function* allVersions(
  supabase: SupabaseClient
): AsyncGenerator<SweepCandidate> {
  let before: string | null = null;
  for (;;) {
    let query = supabase
      .from("miniapp_versions")
      .select(SWEEP_COLUMNS)
      .order("created_at", { ascending: false })
      .limit(SWEEP_PAGE);
    if (before) query = query.lt("created_at", before);
    const { data, error } = await query;
    if (error) throw new Error(`version sweep read failed: ${error.message}`);
    const rows = data ?? [];
    for (const raw of rows) {
      const row = toSweepCandidate(raw);
      if (row) yield row;
    }
    if (rows.length < SWEEP_PAGE) return;
    const last = toSweepCandidate(rows[rows.length - 1]);
    if (!last || last.created_at === before) return;
    before = last.created_at;
  }
}

/**
 * Remove one doomed version in tombstone order: the row is marked purged
 * first (rollback and the ledger stop seeing it), then the R2 prefix goes,
 * then the row. A crash between any two steps leaves a tombstone the next
 * sweep resumes from — never a selectable row whose artifacts are gone.
 */
async function purgeVersion(
  supabase: SupabaseClient,
  row: SweepCandidate
): Promise<boolean> {
  // Every version's files live under its R2 prefix; without R2 the row is
  // the only record of them, so it must outlive this sweep.
  if (!r2Configured()) {
    throw new Error("R2 not configured; version artifacts cannot be deleted");
  }
  if (!row.purged_at) {
    // The tombstone re-checks the pointers under the registry row lock: a
    // rollback that selected this version since the sweep read it wins, and
    // the sweep leaves the row alone.
    const { data, error } = await supabase.rpc("miniapp_tombstone_version", {
      p_id: row.id,
    });
    if (error) throw new Error(error.message);
    if (data !== true) return false;
  }
  if (row.slug) {
    await deletePrefix(bundleKey(row.slug, row.version, ""));
  }
  const { error } = await supabase
    .from("miniapp_versions")
    .delete()
    .eq("id", row.id);
  if (error) throw new Error(error.message);
  return true;
}

/**
 * Retention sweep (cron): delete R2 artifacts and rows for superseded
 * versions past the window and drafts beyond the five newest, never touching
 * the live or draft pointer of any app. Tombstoned rows from an earlier,
 * interrupted sweep are finished first. Returns the number of versions
 * removed.
 */
export async function sweepVersions(
  supabase: SupabaseClient,
  now = new Date()
): Promise<number> {
  const cutoff = now.getTime() - RETAIN_SUPERSEDED_DAYS * 86_400_000;
  const draftsSeen = new Map<string, number>();
  const doomed: SweepCandidate[] = [];
  for await (const row of allVersions(supabase)) {
    if (row.purged_at) {
      doomed.push(row);
      continue;
    }
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
    try {
      if (await purgeVersion(supabase, row)) removed += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "version sweep purge failed",
          version: row.version,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  if (removed > 0) {
    console.log(JSON.stringify({ msg: "version sweep", removed }));
  }
  return removed;
}
