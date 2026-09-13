/**
 * /freeze domain. One freeze_sessions row per card mint; creative_jobs rows
 * carry the paid work — 'sketch' jobs render the source image on the
 * imagine lane (Flare modes, same as /draw) and 'render' jobs run the
 * camera-trajectory video on fal's multi-angle endpoint.
 *
 * Live progress rides creative_jobs.status; freeze_events records only
 * admission and terminal states (C4). The session's one in-flight slot is
 * the same compare-and-set lease as the draw studio.
 */
import { execFile } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import {
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import type { SupabaseClient } from "@supabase/supabase-js";
import ffmpegPath from "ffmpeg-static";
import {
  ASSETS_BUCKET,
  DELIVERY_TTL_SECONDS,
} from "../assets/keys";
import type { CreativeAsset } from "../assets/pipeline";
import {
  createCreativeJob,
  getCreativeJob,
  updateCreativeJob,
} from "../creative/jobs";
import type { CreativeChannel, CreativeJob } from "../creative/jobs";
import type { MediaInput } from "../creative/gmi";
import {
  executeCreativeJob,
  type CreativeRunResult,
} from "../creative/run";
import {
  ingestGeneratedMedia,
  ingestUploadedMedia,
} from "../creative/store";
import { heifToPng, isHeif } from "../identity/heif";
import { guardMediaUpload } from "../storage/guard";
import { directDrawPlan, type DrawMode } from "./draw";
import {
  directFreezePlan,
  getPreset,
  isFreezeDuration,
  isFreezeResolution,
  type CameraKeyframe,
  type FreezeDuration,
  type FreezeResolution,
} from "./freezeRecipe";

export const FREEZE_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_FREEZE_UPLOAD_BYTES = 12 * 1024 * 1024;
export const FREEZE_PROMPT_VERSION = "generation.freeze.v1";

/** Job statuses that still hold the session's single in-flight slot. */
const ACTIVE_JOB_STATUSES: readonly string[] = [
  "routing",
  "submitted",
  "polling",
  "submit_unknown",
];

export class FreezeError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "FreezeError";
    this.code = code;
  }
}

export interface FreezeSession {
  id: string;
  user_id: string;
  space_id: string;
  phone: string;
  status: "active" | "expired";
  source_asset_id: string | null;
  /** Video lane (0111): the owner's source clip + the ≤30s window the
   * stitch keeps, and the absolute source time the frozen frame sits on.
   * Null until a clip-backed source lands — photo/sketch sessions leave
   * all four columns empty and ship only the rendered camera move. */
  clip_asset_id: string | null;
  clip_in: number | null;
  clip_out: number | null;
  freeze_at: number | null;
  active_job_id: string | null;
  latest_job_id: string | null;
  event_sequence: number;
  expires_at: string;
  created_at: string;
}

export interface FreezeEvent {
  id: string;
  session_id: string;
  job_id: string | null;
  sequence: number;
  kind: "state" | "preview" | "completed";
  state: string | null;
  asset_id: string | null;
  preview_index: number | null;
  error_code: string | null;
  created_at: string;
}

export async function createFreezeSession(
  supabase: SupabaseClient,
  input: {
    userId: string;
    spaceId: string;
    phone: string;
    sourceAssetId?: string | undefined;
    expiresAt?: string | undefined;
  }
): Promise<FreezeSession> {
  const { data, error } = await supabase
    .from("freeze_sessions")
    .insert({
      user_id: input.userId,
      space_id: input.spaceId,
      phone: input.phone,
      status: "active",
      source_asset_id: input.sourceAssetId ?? null,
      expires_at:
        input.expiresAt ??
        new Date(Date.now() + FREEZE_SESSION_TTL_MS).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`freeze session insert failed: ${error.message}`);
  return data as FreezeSession;
}

/** Load the owner's session, expiring it on read past its TTL. */
export async function getFreezeSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<FreezeSession | undefined> {
  const { data } = await supabase
    .from("freeze_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const session = (data as FreezeSession | null) ?? undefined;
  if (!session) return undefined;
  if (
    session.status === "active" &&
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    await supabase
      .from("freeze_sessions")
      .update({ status: "expired" })
      .eq("id", session.id);
    session.status = "expired";
  }
  return session;
}

export function requireActiveFreezeSession(
  session: FreezeSession
): FreezeSession {
  if (session.status !== "active") {
    throw new FreezeError("SESSION_EXPIRED", "this freeze session has ended");
  }
  return session;
}

/** Append the next freeze_events row; same sequence-fence as draw_events. */
export async function appendFreezeEvent(
  supabase: SupabaseClient,
  sessionId: string,
  event: {
    jobId?: string | undefined;
    kind: "state" | "preview" | "completed";
    state?: string | undefined;
    assetId?: string | undefined;
    errorCode?: string | undefined;
  }
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const { data: last } = await supabase
      .from("freeze_events")
      .select("sequence")
      .eq("session_id", sessionId)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    const next = ((last?.sequence as number | undefined) ?? -1) + 1;
    const { error } = await supabase.from("freeze_events").insert({
      session_id: sessionId,
      job_id: event.jobId ?? null,
      sequence: next,
      kind: event.kind,
      state: event.state ?? null,
      asset_id: event.assetId ?? null,
      error_code: event.errorCode ?? null,
    });
    if (!error) {
      await supabase
        .from("freeze_sessions")
        .update({ event_sequence: next })
        .eq("id", sessionId)
        .lt("event_sequence", next);
      return;
    }
    if (error.code !== "23505") {
      console.error(
        JSON.stringify({
          msg: "freeze event insert failed",
          session_id: sessionId,
          error: error.message,
        })
      );
      return;
    }
  }
  console.error(
    JSON.stringify({
      msg: "freeze event dropped: sequence retries exhausted",
      session_id: sessionId,
      kind: event.kind,
      state: event.state ?? null,
    })
  );
}

async function signedAssetUrl(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<string | undefined> {
  const { data } = await supabase
    .from("creative_assets")
    .select("storage_key")
    .eq("id", assetId)
    .eq("user_id", userId)
    .maybeSingle();
  const key = data?.storage_key as string | undefined;
  if (!key) return undefined;
  const signed = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(key, DELIVERY_TTL_SECONDS);
  return signed.data?.signedUrl;
}

/**
 * Ingest an upload or camera capture. iPhones shoot HEIC — `isHeif` sniffs
 * the ftyp box (a mislabeled octet-stream still converts), `heifToPng`
 * decodes to the lossless PNG the source stage wants, and the shared ingest
 * dedupes by sha256 into creative_assets.
 */
export async function storeFreezeUpload(
  supabase: SupabaseClient,
  userId: string,
  bytes: Buffer,
  mimeType: string
): Promise<CreativeAsset | null> {
  if (
    bytes.byteLength === 0 ||
    bytes.byteLength > MAX_FREEZE_UPLOAD_BYTES
  ) {
    return null;
  }
  let body = bytes;
  let type = mimeType;
  if (isHeif(mimeType, bytes)) {
    const converted = await heifToPng(bytes).catch(() => undefined);
    if (!converted) return null;
    body = converted;
    type = "image/png";
  }
  if (!["image/jpeg", "image/png", "image/webp"].includes(type)) return null;
  try {
    // MA8 boundary: EXIF/GPS comes off owner bytes here — the still is what
    // ships to fal for the render. The 12 MB cap applies to inbound bytes
    // above; a decoded PNG can legitimately outgrow its compressed HEIC
    // source, so the guard keeps the shared media cap.
    body = guardMediaUpload(body, type);
  } catch {
    return null;
  }
  return await ingestUploadedMedia(supabase, userId, body, type).catch(
    () => null
  );
}

/** Point the session at a new source still — atomically linking (or
 * clearing) the clip window the stitch uses after the render lands. */
export async function setFreezeSource(
  supabase: SupabaseClient,
  session: FreezeSession,
  assetId: string,
  clip?: { assetId: string } & FreezeClipWindow | null
): Promise<void> {
  const { data, error } = await supabase
    .from("freeze_sessions")
    .update({
      source_asset_id: assetId,
      clip_asset_id: clip?.assetId ?? null,
      clip_in: clip?.clipIn ?? null,
      clip_out: clip?.clipOut ?? null,
      freeze_at: clip?.freezeAt ?? null,
    })
    .eq("id", session.id)
    .eq("status", "active")
    .gt("expires_at", new Date().toISOString())
    .select("id");
  if (error) {
    throw new FreezeError("STORE_FAILED", error.message);
  }
  if (!data?.length) {
    throw new FreezeError("SESSION_EXPIRED", "this freeze session has ended");
  }
  session.source_asset_id = assetId;
  session.clip_asset_id = clip?.assetId ?? null;
  session.clip_in = clip?.clipIn ?? null;
  session.clip_out = clip?.clipOut ?? null;
  session.freeze_at = clip?.freezeAt ?? null;
  await appendFreezeEvent(supabase, session.id, {
    kind: "state",
    state: "source",
    assetId,
  });
}

/* ───────────────────────────── clip lane ───────────────────────────── */

/** The clip's body can't cross the action POST (the 12MB cap protects the
 * function's memory), so uploads travel direct-to-storage on a signed URL
 * and the commit below verifies the object before the session links it. */
export const MAX_FREEZE_CLIP_BYTES = 250 * 1024 * 1024;
/** The stitch keeps at most this many source seconds — the client trims
 * longer clips to a window before freeze. */
export const FREEZE_CLIP_WINDOW_S = 30;
const CLIP_MIME_BY_EXT: Record<string, string> = {
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
};
const CLIP_EXT_BY_MIME: Record<string, string> = Object.fromEntries(
  Object.entries(CLIP_MIME_BY_EXT).map(([ext, mime]) => [mime, ext])
);

export interface FreezeClipWindow {
  /** absolute source seconds — the section the finished video keeps */
  clipIn: number;
  clipOut: number;
  /** absolute source time the frozen frame lands on */
  freezeAt: number;
}

/** Mint a signed upload URL for the session's clip — 2h TTL, one object. */
export async function mintFreezeClipUpload(
  supabase: SupabaseClient,
  session: FreezeSession,
  mimeType: string
): Promise<{ clipPath: string; uploadUrl: string }> {
  requireActiveFreezeSession(session);
  const ext = CLIP_EXT_BY_MIME[mimeType];
  if (!ext) {
    throw new FreezeError("BAD_CLIP", "mp4, mov, or webm only");
  }
  const clipPath = `${session.user_id}/freeze-clips/${session.id}/${randomUUID()}.${ext}`;
  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUploadUrl(clipPath);
  if (error || !data?.signedUrl) {
    throw new FreezeError(
      "STORE_FAILED",
      error?.message ?? "clip upload url failed"
    );
  }
  return { clipPath: data.path, uploadUrl: data.signedUrl };
}

/** Head bytes hashed for the clip fingerprint — identical scheme to the
 * client's (slice + size), but computed here over the stored object so the
 * dedupe identity is never client-forged. */
const CLIP_HEAD_BYTES = 8 * 1024 * 1024;
const CLIP_BASENAME = /^[0-9a-f-]{36}\.(mp4|mov|webm)$/;

/** Read the clip's head through a short-lived signed URL. A Range ask is
 * honored by the storage proxy; where it isn't, the stream is cancelled
 * after the head — either way the read never buffers the whole object. */
async function clipFingerprint(
  supabase: SupabaseClient,
  clipPath: string,
  bytes: number
): Promise<string> {
  const { data, error } = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(clipPath, 60);
  if (error || !data?.signedUrl) {
    throw new FreezeError(
      "STORE_FAILED",
      error?.message ?? "clip signing failed"
    );
  }
  const res = await fetch(data.signedUrl, {
    headers: { Range: `bytes=0-${CLIP_HEAD_BYTES - 1}` },
  });
  if (!res.ok || !res.body) {
    throw new FreezeError("CLIP_MISSING", "the clip upload didn't land");
  }
  const reader = res.body.getReader();
  const chunks: Buffer[] = [];
  let read = 0;
  try {
    while (read < CLIP_HEAD_BYTES) {
      const { done, value } = await reader.read();
      if (done || !value) break;
      chunks.push(Buffer.from(value));
      read += value.length;
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  return createHash("sha256")
    .update(Buffer.concat(chunks))
    .update(`:${bytes}`)
    .digest("hex");
}

/** Best-effort removal of a session clip object — registration failures
 * and superseded dedupe uploads drop their object here. The path is
 * re-checked against the session's clip dir so this can never reach
 * outside it. */
export async function deleteFreezeClipObject(
  supabase: SupabaseClient,
  session: FreezeSession,
  clipPath: string
): Promise<void> {
  const dir = `${session.user_id}/freeze-clips/${session.id}`;
  const name = clipPath.startsWith(`${dir}/`)
    ? clipPath.slice(dir.length + 1)
    : "";
  if (!CLIP_BASENAME.test(name)) return;
  await supabase.storage
    .from(ASSETS_BUCKET)
    .remove([clipPath])
    .then(({ error }) => {
      if (error) {
        console.warn(
          JSON.stringify({ msg: "freeze clip cleanup failed", clipPath })
        );
      }
    })
    .catch(() => undefined);
}

/** Verify the uploaded object and register it as a creative asset. The
 * client's sha/bytes are claims, not identity: the size must match the
 * stored object's metadata and the dedupe fingerprint is recomputed
 * server-side from the object's head bytes — then a dedupe hit removes
 * the just-uploaded duplicate object instead of leaking it. */
export async function registerFreezeClip(
  supabase: SupabaseClient,
  session: FreezeSession,
  clip: {
    path: string;
    sha: string;
    bytes: number;
    window: FreezeClipWindow;
  }
): Promise<string> {
  requireActiveFreezeSession(session);
  const dir = `${session.user_id}/freeze-clips/${session.id}`;
  const ext = clip.path.split(".").pop() ?? "";
  const { clipIn, clipOut, freezeAt } = clip.window;
  const name = clip.path.startsWith(`${dir}/`)
    ? clip.path.slice(dir.length + 1)
    : "";
  if (
    !CLIP_MIME_BY_EXT[ext] ||
    // Minted names are one flat uuid file — no nesting, no chosen keys.
    !CLIP_BASENAME.test(name) ||
    !/^[0-9a-f]{64}$/.test(clip.sha) ||
    !(clip.bytes > 0 && clip.bytes <= MAX_FREEZE_CLIP_BYTES) ||
    ![clipIn, clipOut, freezeAt].every(Number.isFinite) ||
    clipIn < 0 ||
    clipOut <= clipIn ||
    clipOut - clipIn > FREEZE_CLIP_WINDOW_S + 0.05 ||
    clipOut > 20 * 60 ||
    freezeAt < clipIn ||
    freezeAt > clipOut
  ) {
    throw new FreezeError("BAD_CLIP", "that clip window doesn't work");
  }
  const { data: objects, error: listErr } = await supabase.storage
    .from(ASSETS_BUCKET)
    .list(dir, { search: name, limit: 5 });
  if (listErr) {
    throw new FreezeError("STORE_FAILED", listErr.message);
  }
  const object = objects?.find((o) => o.name === name);
  if (!object) {
    throw new FreezeError(
      "CLIP_MISSING",
      "the clip upload didn't land — try again"
    );
  }
  // The stored object is the source of truth for size — a forged claim
  // can't sneak a 400MB clip through the 250MB cap or desync the sha.
  const realBytes = Number(
    (object.metadata as { size?: number } | null)?.size ?? 0
  );
  if (realBytes !== clip.bytes) {
    throw new FreezeError("BAD_CLIP", "the clip metadata doesn't match");
  }
  const sha = await clipFingerprint(supabase, clip.path, realBytes);
  const { data: existing } = await supabase
    .from("creative_assets")
    .select("id, storage_key")
    .eq("user_id", session.user_id)
    .eq("sha256", sha)
    .maybeSingle();
  if (existing) {
    // Re-uploading an identical clip reuses the asset — the duplicate
    // object this attempt wrote is dropped, not left to leak per try.
    if (existing.storage_key !== clip.path) {
      await deleteFreezeClipObject(supabase, session, clip.path);
    }
    return existing.id as string;
  }
  const { data: row, error } = await supabase
    .from("creative_assets")
    .insert({
      user_id: session.user_id,
      box_asset_id: `freeze-clip:${session.id}`,
      sha256: sha,
      ext,
      kind: ext,
      bytes: realBytes,
      storage_key: clip.path,
    })
    .select("id")
    .single();
  if (error) {
    await deleteFreezeClipObject(supabase, session, clip.path);
    throw new FreezeError("STORE_FAILED", error.message);
  }
  return row.id as string;
}

/**
 * CAS lease on the session's one in-flight slot. `claimLatest` also moves
 * latest_job_id. A recorded-but-stale slot (terminal/cancelled job) is
 * released by its own id before retrying, so it can't evict a newer claim.
 */
async function claimFreezeSlot(
  supabase: SupabaseClient,
  session: FreezeSession,
  jobId: string,
  claimLatest: boolean
): Promise<boolean> {
  const attempt = () =>
    supabase
      .from("freeze_sessions")
      .update(
        claimLatest
          ? { active_job_id: jobId, latest_job_id: jobId }
          : { active_job_id: jobId }
      )
      .eq("id", session.id)
      // Status and TTL are part of the predicate: a session that expired
      // since this request loaded it must not claim the slot and start
      // paid work.
      .eq("status", "active")
      .gt("expires_at", new Date().toISOString())
      .is("active_job_id", null)
      .select("id");
  let { data } = await attempt();
  if (data?.length) {
    // Keep the in-memory row authoritative with the claim — the studio
    // builds its admit response from `session`, so a job id that's only
    // in the db reads as no active job and the client never starts
    // polling.
    session.active_job_id = jobId;
    if (claimLatest) session.latest_job_id = jobId;
    return true;
  }
  if (session.active_job_id) {
    const active = await getCreativeJob(
      supabase,
      session.user_id,
      session.active_job_id
    );
    if (active && ACTIVE_JOB_STATUSES.includes(active.status)) return false;
    await supabase
      .from("freeze_sessions")
      .update({ active_job_id: null })
      .eq("id", session.id)
      .eq("active_job_id", session.active_job_id);
    session.active_job_id = null;
    ({ data } = await attempt());
    if (data?.length) {
      session.active_job_id = jobId;
      if (claimLatest) session.latest_job_id = jobId;
    }
  }
  return Boolean(data?.length);
}

async function releaseFreezeSlot(
  supabase: SupabaseClient,
  sessionId: string,
  jobId: string
): Promise<void> {
  await supabase
    .from("freeze_sessions")
    .update({ active_job_id: null })
    .eq("id", sessionId)
    .eq("active_job_id", jobId);
}

/**
 * Shared admission: the session must be live, the job row exists, and the
 * in-flight slot is CAS-claimed before any provider work starts. The
 * studio schedules the matching executeFreeze* inside `after()` — the
 * admit response returns the job id immediately, so the client can show
 * the cancel control and poll while a minutes-long render runs.
 */
async function admitFreezeJob(
  supabase: SupabaseClient,
  session: FreezeSession,
  channel: CreativeChannel,
  kind: "sketch" | "render",
  inputAssetId?: string | undefined
): Promise<CreativeJob> {
  requireActiveFreezeSession(session);
  const job = await createCreativeJob(
    supabase,
    session.user_id,
    channel,
    "freeze",
    undefined,
    {
      freezeSessionId: session.id,
      freezeKind: kind,
      ...(inputAssetId ? { inputAssetId } : {}),
    }
  );
  if (!(await claimFreezeSlot(supabase, session, job.id, true))) {
    await updateCreativeJob(supabase, job.id, {
      status: "failed",
      error: "superseded before admission",
    });
    // The claim predicates on still-active-and-unexpired; a zero-row
    // result can mean the session crossed its TTL mid-admission — but
    // expiry is lazy, so `status` alone still reads "active". Check the
    // deadline too before blaming a held slot. A failed read isn't a
    // missing row: surface it as a retryable store error, not expiry.
    const { data: fresh, error: freshErr } = await supabase
      .from("freeze_sessions")
      .select("status, expires_at")
      .eq("id", session.id)
      .maybeSingle();
    if (freshErr) {
      throw new FreezeError("STORE_FAILED", freshErr.message);
    }
    if (
      !fresh ||
      (fresh.status as string) !== "active" ||
      new Date(fresh.expires_at as string).getTime() <= Date.now()
    ) {
      session.status = "expired";
      throw new FreezeError(
        "SESSION_EXPIRED",
        "this freeze session has ended"
      );
    }
    throw new FreezeError(
      "JOB_ALREADY_ACTIVE",
      "another render is still running"
    );
  }
  await appendFreezeEvent(supabase, session.id, {
    jobId: job.id,
    kind: "state",
    state: "admitted",
  });
  return job;
}

/** The terminal bookkeeping both execute paths share. Post-admit session
 * writes stay gated on still-active: an expired session doesn't collect
 * late mutations from a render that outlived it. */
async function finishFreezeRun(
  supabase: SupabaseClient,
  session: FreezeSession,
  job: CreativeJob,
  result: CreativeRunResult
): Promise<void> {
  await appendFreezeEvent(supabase, session.id, {
    jobId: job.id,
    kind: result.status === "delivered" ? "completed" : "state",
    state: result.status,
    assetId: result.asset?.id,
    errorCode:
      result.status === "delivered"
        ? undefined
        : safeFreezeErrorCode(result.line),
  });
  await supabase
    .from("freeze_sessions")
    .update({ latest_job_id: job.id })
    .eq("id", session.id)
    .eq("status", "active");
}

export interface FreezeSketchInput {
  prompt: string;
  mode: DrawMode;
  sketchAssetId?: string | undefined;
  channel: CreativeChannel;
}

/**
 * Admit a sketch-lane generation: the flattened canvas is the edit source
 * (or absent for a prompt-only render) and the delivered image becomes
 * the session's source still. The draw lane's plan builder is reused
 * verbatim — the Flare modes are draw modes.
 */
export async function admitFreezeSketch(
  supabase: SupabaseClient,
  session: FreezeSession,
  input: FreezeSketchInput
): Promise<CreativeJob> {
  if (input.sketchAssetId) {
    const { data: owned } = await supabase
      .from("creative_assets")
      .select("id")
      .eq("id", input.sketchAssetId)
      .eq("user_id", session.user_id)
      .maybeSingle();
    if (!owned) {
      throw new FreezeError(
        "SOURCE_UNAVAILABLE",
        "that sketch isn't available"
      );
    }
  }
  return await admitFreezeJob(
    supabase,
    session,
    input.channel,
    "sketch",
    input.sketchAssetId
  );
}

/**
 * Turn a post-admission setup failure into a terminal state: an admitted
 * job that never reaches the provider still holds the slot until
 * released, and a job left in `routing` would block every later claim.
 */
async function failAdmittedJob(
  supabase: SupabaseClient,
  session: FreezeSession,
  job: CreativeJob,
  error: unknown
): Promise<void> {
  const line = error instanceof Error ? error.message : String(error);
  const current = await getCreativeJob(supabase, session.user_id, job.id);
  if (current && ACTIVE_JOB_STATUSES.includes(current.status)) {
    await updateCreativeJob(supabase, job.id, {
      status: "failed",
      error: line,
    });
  }
  await appendFreezeEvent(supabase, session.id, {
    jobId: job.id,
    kind: "state",
    state: "failed",
    errorCode: safeFreezeErrorCode(line),
  });
}

/** Run an admitted sketch job to delivery (scheduled via `after()`). */
export async function executeFreezeSketch(
  supabase: SupabaseClient,
  session: FreezeSession,
  job: CreativeJob,
  input: Omit<FreezeSketchInput, "channel">
): Promise<CreativeRunResult> {
  // The in-memory row is this request's snapshot — the source the owner saw
  // at admission. A photo uploaded while the sketch runs is a newer choice
  // and must win over the delivered still.
  const sourceAtAdmit = session.source_asset_id;
  try {
    const mediaInputs: MediaInput[] = [];
    if (input.sketchAssetId) {
      const url = await signedAssetUrl(
        supabase,
        session.user_id,
        input.sketchAssetId
      );
      if (!url) {
        throw new FreezeError(
          "SOURCE_UNAVAILABLE",
          "that sketch isn't available"
        );
      }
      mediaInputs.push({ kind: "image", url });
    }
    const result = await executeCreativeJob(
      supabase,
      job.id,
      session.user_id,
      {
        mode: "imagine",
        cleanedText: input.prompt,
        text: input.prompt,
        mediaInputs,
      },
      {
        plan: directDrawPlan(
          input.prompt,
          input.mode,
          mediaInputs.length > 0
        ),
        promptVersion: FREEZE_PROMPT_VERSION,
      }
    );
    await finishFreezeRun(supabase, session, job, result);
    // A delivered sketch becomes the camera stage's source still — only
    // when it still owns the slot AND the source hasn't changed since
    // admission (a mid-flight upload or cancel wins over this delivery).
    if (result.status === "delivered" && result.asset) {
      const update = supabase
        .from("freeze_sessions")
        .update({
          source_asset_id: result.asset.id,
          // A generated still isn't a frame of the old clip — keeping the
          // window would splice the sketch's camera move into footage it
          // has nothing to do with.
          clip_asset_id: null,
          clip_in: null,
          clip_out: null,
          freeze_at: null,
        })
        .eq("id", session.id)
        .eq("status", "active")
        .gt("expires_at", new Date().toISOString())
        .eq("active_job_id", job.id);
      const { data: claimed } = await (sourceAtAdmit
        ? update.eq("source_asset_id", sourceAtAdmit)
        : update.is("source_asset_id", null)
      ).select("id");
      if (claimed?.length === 1) {
        session.source_asset_id = result.asset.id;
        session.clip_asset_id = null;
        session.clip_in = null;
        session.clip_out = null;
        session.freeze_at = null;
      }
    }
    return result;
  } catch (error) {
    await failAdmittedJob(supabase, session, job, error).catch(
      () => undefined
    );
    throw error;
  } finally {
    await releaseFreezeSlot(supabase, session.id, job.id);
  }
}

/** Flush-lane compat: admit + run inline — the caller already owns the
 * burst, so there's no request boundary to honor. */
export async function runFreezeSketch(
  supabase: SupabaseClient,
  session: FreezeSession,
  input: FreezeSketchInput
): Promise<{ job: CreativeJob; result: CreativeRunResult }> {
  const job = await admitFreezeSketch(supabase, session, input);
  const result = await executeFreezeSketch(supabase, session, job, input);
  return { job, result };
}

export interface FreezeRenderInput {
  trajectory: CameraKeyframe[];
  duration: FreezeDuration;
  resolution: FreezeResolution;
  returnsToStart: boolean;
  seed?: number | undefined;
  channel: CreativeChannel;
}

/**
 * Admit a camera-move render. The trajectory (preset id or posted
 * keyframes) is validated before a job exists — a bad path never spends a
 * render. The job rides the fal lane via an injected plan (plan.freeze),
 * so metering, submit/poll, ingest, and the delivery URL are identical to
 * /zap.
 */
export async function admitFreezeRender(
  supabase: SupabaseClient,
  session: FreezeSession,
  input: { channel: CreativeChannel }
): Promise<CreativeJob> {
  const sourceAssetId = session.source_asset_id;
  if (!sourceAssetId) {
    throw new FreezeError("NO_SOURCE", "pick a photo first");
  }
  if (!(await signedAssetUrl(supabase, session.user_id, sourceAssetId))) {
    throw new FreezeError("SOURCE_UNAVAILABLE", "the source photo expired");
  }
  return await admitFreezeJob(
    supabase,
    session,
    input.channel,
    "render",
    sourceAssetId
  );
}

/** Run an admitted render job to delivery (scheduled via `after()`). */
export async function executeFreezeRender(
  supabase: SupabaseClient,
  session: FreezeSession,
  job: CreativeJob,
  input: Omit<FreezeRenderInput, "channel">
): Promise<CreativeRunResult> {
  try {
    // The admitted source wins even if the owner swapped photos mid-flight
    // — input_asset_id was pinned when the slot was claimed. Signing lives
    // inside the try so a transient storage failure still terminalizes the
    // job instead of stranding the slot on a `routing` row.
    const sourceAssetId = job.input_asset_id ?? session.source_asset_id;
    if (!sourceAssetId) {
      throw new FreezeError("NO_SOURCE", "pick a photo first");
    }
    const url = await signedAssetUrl(
      supabase,
      session.user_id,
      sourceAssetId
    );
    if (!url) {
      throw new FreezeError(
        "SOURCE_UNAVAILABLE",
        "the source photo expired"
      );
    }
    const result = await executeCreativeJob(
      supabase,
      job.id,
      session.user_id,
      {
        mode: "zap",
        cleanedText: "freeze",
        text: "freeze",
        mediaInputs: [{ kind: "image", url }],
      },
      {
        plan: directFreezePlan(input),
        promptVersion: FREEZE_PROMPT_VERSION,
      }
    );
    await finishFreezeRun(supabase, session, job, result);
    // A clip-backed source gets the camera move spliced back into the
    // footage at the picked frame — the stitch runs inside the slot so
    // the client keeps waiting until the cut video is the job's output.
    // A failed stitch degrades to the raw camera move rather than
    // failing the whole render.
    if (result.status === "delivered" && result.asset) {
      await stitchFreezeIntoClip(
        supabase,
        session,
        job.id,
        sourceAssetId,
        result.asset
      )
        .catch((error: unknown) =>
          console.error(
            JSON.stringify({
              msg: "freeze stitch failed — delivering the raw camera move",
              session_id: session.id,
              job_id: job.id,
              error: error instanceof Error ? error.message : String(error),
            })
          )
        );
    }
    return result;
  } catch (error) {
    await failAdmittedJob(supabase, session, job, error).catch(
      () => undefined
    );
    throw error;
  } finally {
    await releaseFreezeSlot(supabase, session.id, job.id);
  }
}

/* ───────────────────────── stitch lane ───────────────────────────── */

const execFileAsync = promisify(execFile);

interface MediaProbe {
  duration: number;
  hasAudio: boolean;
  width: number;
  height: number;
}

/** `ffmpeg -i` reports on stderr and exits nonzero — parse, don't spawn a
 * second binary (ffprobe isn't shipped by ffmpeg-static). */
async function probeMedia(file: string): Promise<MediaProbe> {
  const probe: MediaProbe = {
    duration: 0,
    hasAudio: false,
    width: 0,
    height: 0,
  };
  try {
    await execFileAsync(ffmpegPath as string, ["-hide_banner", "-i", file], {
      timeout: 30_000,
    });
  } catch (error) {
    const stderr = String((error as { stderr?: unknown }).stderr ?? "");
    const dm = stderr.match(/Duration: (\d+):(\d+):([\d.]+)/);
    if (dm) {
      probe.duration =
        Number(dm[1]) * 3600 + Number(dm[2]) * 60 + Number(dm[3]);
    }
    probe.hasAudio = /Stream .*Audio:/.test(stderr);
    const vm = stderr.match(/Stream .*Video:.* (\d{2,5})x(\d{2,5})/);
    if (vm) {
      probe.width = Number(vm[1]);
      probe.height = Number(vm[2]);
    }
  }
  return probe;
}

/**
 * The reference editor's edit plan, ported: source[clipIn→freezeAt] +
 * camera move + source[freezeAt→clipOut], all normalized to the camera
 * clip's geometry at 30fps. Sub-frame edges (<1/30s) are dropped instead
 * of producing an empty concat leg; audio legs mirror the video legs,
 * padding silent where a side has no track.
 */
export function buildFreezeEditGraph(
  width: number,
  height: number,
  window: FreezeClipWindow,
  cameraDuration: number,
  sourceAudio: boolean,
  cameraAudio: boolean
): { graph: string; hasAudio: boolean } {
  const clipIn = Math.max(0, window.clipIn);
  const freezeAt = Math.min(
    Math.max(window.freezeAt, clipIn),
    window.clipOut
  );
  const clipOut = window.clipOut;
  const normalize = `scale=${width}:${height},setsar=1,fps=30,format=yuv420p`;
  const graph: string[] = [];
  const segments: string[] = [];
  const audios: string[] = [];
  const hasAudio = sourceAudio || cameraAudio;
  const segmentDuration = freezeAt - clipIn;
  if (segmentDuration >= 1 / 30) {
    graph.push(
      `[0:v]trim=start=${clipIn}:end=${freezeAt},setpts=PTS-STARTPTS,${normalize}[before]`
    );
    segments.push("[before]");
    if (hasAudio) {
      graph.push(
        sourceAudio
          ? `[0:a]atrim=start=${clipIn}:end=${freezeAt},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${segmentDuration}[abefore]`
          : `anullsrc=r=48000:cl=stereo,atrim=duration=${segmentDuration},asetpts=PTS-STARTPTS[abefore]`
      );
      audios.push("[abefore]");
    }
  }
  graph.push(`[1:v]setpts=PTS-STARTPTS,${normalize}[camera]`);
  segments.push("[camera]");
  if (hasAudio) {
    graph.push(
      cameraAudio
        ? `[1:a]asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${cameraDuration}[acamera]`
        : `anullsrc=r=48000:cl=stereo,atrim=duration=${cameraDuration},asetpts=PTS-STARTPTS[acamera]`
    );
    audios.push("[acamera]");
  }
  const afterDuration = clipOut - freezeAt;
  if (afterDuration >= 1 / 30) {
    graph.push(
      `[0:v]trim=start=${freezeAt}:end=${clipOut},setpts=PTS-STARTPTS,${normalize}[after]`
    );
    segments.push("[after]");
    if (hasAudio) {
      graph.push(
        sourceAudio
          ? `[0:a]atrim=start=${freezeAt}:end=${clipOut},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,apad,atrim=duration=${afterDuration}[aafter]`
          : `anullsrc=r=48000:cl=stereo,atrim=duration=${afterDuration},asetpts=PTS-STARTPTS[aafter]`
      );
      audios.push("[aafter]");
    }
  }
  graph.push(`${segments.join("")}concat=n=${segments.length}:v=1:a=0[v]`);
  if (hasAudio) {
    graph.push(`${audios.join("")}concat=n=${audios.length}:v=0:a=1[a]`);
  }
  return { graph: graph.join(";"), hasAudio };
}

/**
 * Delivered camera move → cut back into the source clip at freeze_at.
 * Re-reads the session first: a mid-render source swap clears the clip
 * link, and stitching a detached clip would ship footage the owner
 * already replaced. On success the job's output_asset_id swaps to the
 * stitched asset — the studio + save lanes see only the cut video.
 */
async function stitchFreezeIntoClip(
  supabase: SupabaseClient,
  session: FreezeSession,
  jobId: string,
  pinnedSourceId: string,
  freezeAsset: CreativeAsset
): Promise<void> {
  const { data: fresh } = await supabase
    .from("freeze_sessions")
    .select("source_asset_id, clip_asset_id, clip_in, clip_out, freeze_at")
    .eq("id", session.id)
    .eq("status", "active")
    .maybeSingle();
  // The render animated the still pinned at admission. If the source was
  // swapped mid-render — to a different clip or a plain photo — the
  // current clip describes footage this camera move was never framed
  // against; splice nothing and ship the raw move.
  if (fresh?.source_asset_id !== pinnedSourceId) return;
  const clipAssetId = fresh?.clip_asset_id as string | null;
  const clipIn = fresh?.clip_in as number | null;
  const clipOut = fresh?.clip_out as number | null;
  const freezeAt = fresh?.freeze_at as number | null;
  if (
    !clipAssetId ||
    clipIn === null ||
    clipOut === null ||
    freezeAt === null
  ) {
    return;
  }
  const { data: clipRow } = await supabase
    .from("creative_assets")
    .select("storage_key, ext")
    .eq("id", clipAssetId)
    .eq("user_id", session.user_id)
    .maybeSingle();
  const clipKey = clipRow?.storage_key as string | undefined;
  if (!clipKey || !freezeAsset.storage_key) return;

  const dir = await mkdtemp(path.join(tmpdir(), "fz-"));
  try {
    const [clipDl, freezeDl] = await Promise.all([
      supabase.storage.from(ASSETS_BUCKET).download(clipKey),
      supabase.storage
        .from(ASSETS_BUCKET)
        .download(freezeAsset.storage_key),
    ]);
    if (clipDl.error || !clipDl.data || freezeDl.error || !freezeDl.data) {
      throw new FreezeError(
        "CLIP_MISSING",
        clipDl.error?.message ??
          freezeDl.error?.message ??
          "clip asset download failed"
      );
    }
    const srcPath = path.join(dir, `src.${clipRow?.ext ?? "mp4"}`);
    const camPath = path.join(dir, "cam.mp4");
    const outPath = path.join(dir, "out.mp4");
    await writeFile(srcPath, Buffer.from(await clipDl.data.arrayBuffer()));
    await writeFile(camPath, Buffer.from(await freezeDl.data.arrayBuffer()));

    const [srcProbe, camProbe] = await Promise.all([
      probeMedia(srcPath),
      probeMedia(camPath),
    ]);
    if (camProbe.width <= 0 || camProbe.height <= 0 || camProbe.duration <= 0) {
      return;
    }
    // A file shorter than the remembered window just runs out — clamp the
    // plan to what the probe measured.
    const window: FreezeClipWindow = {
      clipIn,
      clipOut: srcProbe.duration > 0 ? Math.min(clipOut, srcProbe.duration) : clipOut,
      freezeAt,
    };
    if (window.clipOut - window.clipIn < 0.1) return;

    const { graph, hasAudio } = buildFreezeEditGraph(
      camProbe.width,
      camProbe.height,
      window,
      camProbe.duration,
      srcProbe.hasAudio,
      camProbe.hasAudio
    );
    const args = [
      "-y",
      "-hide_banner",
      "-loglevel",
      "error",
      "-i",
      srcPath,
      "-i",
      camPath,
      "-filter_complex",
      graph,
      "-map",
      "[v]",
      ...(hasAudio ? ["-map", "[a]", "-c:a", "aac", "-b:a", "128k"] : []),
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-crf",
      "21",
      "-movflags",
      "+faststart",
      outPath,
    ];
    await execFileAsync(ffmpegPath as string, args, {
      timeout: 300_000,
      maxBuffer: 8 * 1024 * 1024,
    });
    const bytes = await readFile(outPath);
    const stitched = await ingestGeneratedMedia(supabase, session.user_id, {
      bytes,
      mimeType: "video/mp4",
      url: `freeze-stitch:${jobId}`,
    });
    await updateCreativeJob(supabase, jobId, {
      output_asset_id: stitched.id,
    });
    await appendFreezeEvent(supabase, session.id, {
      jobId,
      kind: "completed",
      state: "delivered",
      assetId: stitched.id,
    });
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

/** Resolve a posted render request: preset id or an already-validated
 * custom trajectory. Throws FreezeError BAD_PATH on contract violations. */
export function resolveFreezeRender(input: {
  presetId?: string | undefined;
  trajectory?: CameraKeyframe[] | undefined;
  duration?: number | undefined;
  resolution?: string | undefined;
  seed?: number | undefined;
}): {
  trajectory: CameraKeyframe[];
  duration: FreezeDuration;
  resolution: FreezeResolution;
  returnsToStart: boolean;
  seed?: number | undefined;
} {
  // Defaults cover omitted fields only — a defined value that fails its
  // validator is a malformed render request, not a reason to quietly run a
  // paid render with settings the caller never picked.
  if (input.resolution !== undefined && !isFreezeResolution(input.resolution)) {
    throw new FreezeError("BAD_PATH", "unknown resolution");
  }
  if (input.duration !== undefined && !isFreezeDuration(input.duration)) {
    throw new FreezeError("BAD_PATH", "unknown duration");
  }
  if (
    input.seed !== undefined &&
    !(
      Number.isSafeInteger(input.seed) &&
      input.seed >= 0 &&
      input.seed <= 4_294_967_295
    )
  ) {
    throw new FreezeError("BAD_PATH", "seed must fit in uint32");
  }
  const resolution: FreezeResolution =
    (input.resolution as FreezeResolution | undefined) ?? "768P";
  const seed = input.seed;

  if (input.presetId) {
    const preset = getPreset(input.presetId);
    if (!preset) {
      throw new FreezeError("BAD_PATH", "unknown camera preset");
    }
    // The preset duration is a default — an explicit valid duration wins,
    // so the client can retime a preset without forking its trajectory.
    const duration: FreezeDuration =
      input.duration !== undefined
        ? input.duration
        : preset.duration === 6
          ? 6
          : 5;
    return {
      trajectory: preset.trajectory.map((keyframe) => ({ ...keyframe })),
      duration,
      resolution,
      returnsToStart: preset.returnsToStart,
      ...(seed === undefined ? {} : { seed }),
    };
  }
  if (!input.trajectory) {
    throw new FreezeError("BAD_PATH", "a camera path is required");
  }
  const duration: FreezeDuration =
    (input.duration as FreezeDuration | undefined) ?? 5;
  // A custom path whose last keyframe lands back on the opening pose earns
  // the return clause — the render then holds the opening frame and loops.
  const first = input.trajectory[0]!;
  const last = input.trajectory[input.trajectory.length - 1]!;
  // ±360 is the same bearing as 0 — fold the delta into (-180, 180].
  const azimuthDelta =
    ((((last.azimuth - first.azimuth) % 360) + 540) % 360) - 180;
  const returnsToStart =
    Math.abs(azimuthDelta) < 0.5 &&
    Math.abs(last.elevation - first.elevation) < 0.5 &&
    Math.abs(last.distance - first.distance) < 0.05;
  return {
    trajectory: input.trajectory,
    duration,
    resolution,
    returnsToStart,
    ...(seed === undefined ? {} : { seed }),
  };
}

/** Best-effort cancel: no provider cancel exists, so the job row is marked
 * failed and the slot freed; a late delivery stays recorded on the job. */
export async function cancelActiveFreezeJob(
  supabase: SupabaseClient,
  session: FreezeSession
): Promise<void> {
  if (!session.active_job_id) return;
  await updateCreativeJob(supabase, session.active_job_id, {
    status: "failed",
    error: "cancelled by owner",
  });
  await appendFreezeEvent(supabase, session.id, {
    jobId: session.active_job_id,
    kind: "state",
    state: "cancelled",
  });
  await supabase
    .from("freeze_sessions")
    .update({ active_job_id: null })
    .eq("id", session.id)
    .eq("active_job_id", session.active_job_id);
}

export function safeFreezeErrorCode(line: string): string {
  return createHash("sha256").update(line).digest("hex").slice(0, 16);
}

export interface FreezeJobRow {
  jobId: string;
  kind: "sketch" | "render";
  state: string;
  error: string | null;
  outputAssetId: string | null;
  outputUrl: string | null;
  createdAt: string;
}

/**
 * Status payload the studio polls: new events after `after`, the session's
 * pointers, the signed source preview, and the session's delivered outputs
 * split by lane (sketches = candidate sources, renders = videos).
 */
export async function freezeStatus(
  supabase: SupabaseClient,
  session: FreezeSession,
  after: number
): Promise<{
  events: FreezeEvent[];
  latest: number;
  activeJob: { id: string; status: string; error: string | null } | null;
  latestJobId: string | null;
  sourceAssetId: string | null;
  sourceUrl: string | null;
  sketches: FreezeJobRow[];
  renders: FreezeJobRow[];
  /** the session has a clip linked — the next delivered render splices
   * into the source footage instead of shipping bare */
  hasClip: boolean;
}> {
  const { data } = await supabase
    .from("freeze_events")
    .select("*")
    .eq("session_id", session.id)
    .gt("sequence", after)
    .order("sequence", { ascending: true });
  const events = (data ?? []) as FreezeEvent[];

  let activeJob: { id: string; status: string; error: string | null } | null =
    null;
  if (session.active_job_id) {
    const job = await getCreativeJob(
      supabase,
      session.user_id,
      session.active_job_id
    );
    if (job) activeJob = { id: job.id, status: job.status, error: job.error };
  }

  const sourceUrl = session.source_asset_id
    ? ((await signedAssetUrl(
        supabase,
        session.user_id,
        session.source_asset_id
      )) ?? null)
    : null;

  const { data: jobRows } = await supabase
    .from("creative_jobs")
    .select("id, freeze_kind, status, error, output_asset_id, created_at")
    .eq("user_id", session.user_id)
    .eq("freeze_session_id", session.id)
    .order("created_at", { ascending: true });
  const sketches: FreezeJobRow[] = [];
  const renders: FreezeJobRow[] = [];
  const rows = (jobRows ?? []) as {
    id: string;
    freeze_kind: string | null;
    status: string;
    error: string | null;
    output_asset_id: string | null;
    created_at: string;
  }[];
  // Sign in parallel — a serial await per output row scales the poll's
  // latency with session history.
  const outputUrls = await Promise.all(
    rows.map((row) =>
      row.output_asset_id
        ? signedAssetUrl(supabase, session.user_id, row.output_asset_id)
        : Promise.resolve(undefined)
    )
  );
  for (const [index, row] of rows.entries()) {
    const outputUrl = outputUrls[index] ?? null;
    const entry: FreezeJobRow = {
      jobId: row.id,
      kind: row.freeze_kind === "render" ? "render" : "sketch",
      state: row.status,
      error: row.error,
      outputAssetId: row.output_asset_id,
      outputUrl,
      createdAt: row.created_at,
    };
    if (entry.kind === "render") renders.push(entry);
    else sketches.push(entry);
  }

  const latest = events.length
    ? events[events.length - 1]!.sequence
    : session.event_sequence;
  return {
    events,
    latest,
    activeJob,
    latestJobId: session.latest_job_id,
    sourceAssetId: session.source_asset_id,
    sourceUrl,
    sketches,
    renders,
    hasClip: session.clip_asset_id !== null,
  };
}
