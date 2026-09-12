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
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
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
import { ingestUploadedMedia } from "../creative/store";
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

/** Point the session at a new source still. */
export async function setFreezeSource(
  supabase: SupabaseClient,
  session: FreezeSession,
  assetId: string
): Promise<void> {
  await supabase
    .from("freeze_sessions")
    .update({ source_asset_id: assetId })
    .eq("id", session.id)
    .eq("status", "active");
  await appendFreezeEvent(supabase, session.id, {
    kind: "state",
    state: "source",
    assetId,
  });
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
      .is("active_job_id", null)
      .select("id");
  let { data } = await attempt();
  if (data?.length) return true;
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
    ({ data } = await attempt());
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

/** Run an admitted sketch job to delivery (scheduled via `after()`). */
export async function executeFreezeSketch(
  supabase: SupabaseClient,
  session: FreezeSession,
  job: CreativeJob,
  input: Omit<FreezeSketchInput, "channel">
): Promise<CreativeRunResult> {
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
    // A delivered sketch becomes the camera stage's source still.
    if (result.status === "delivered" && result.asset) {
      await supabase
        .from("freeze_sessions")
        .update({ source_asset_id: result.asset.id })
        .eq("id", session.id)
        .eq("status", "active");
      session.source_asset_id = result.asset.id;
    }
    return result;
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
  // The admitted source wins even if the owner swapped photos mid-flight —
  // input_asset_id was pinned when the slot was claimed.
  const sourceAssetId = job.input_asset_id ?? session.source_asset_id;
  if (!sourceAssetId) {
    throw new FreezeError("NO_SOURCE", "pick a photo first");
  }
  const url = await signedAssetUrl(supabase, session.user_id, sourceAssetId);
  if (!url) {
    throw new FreezeError("SOURCE_UNAVAILABLE", "the source photo expired");
  }
  try {
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
    return result;
  } finally {
    await releaseFreezeSlot(supabase, session.id, job.id);
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
  const resolution =
    input.resolution !== undefined && isFreezeResolution(input.resolution)
      ? input.resolution
      : "768P";
  // Seed rides a paid provider call — keep it inside the uint32 window
  // rather than letting an out-of-range value reach admission.
  const seed =
    input.seed !== undefined &&
    Number.isSafeInteger(input.seed) &&
    input.seed >= 0 &&
    input.seed <= 4_294_967_295
      ? input.seed
      : undefined;

  if (input.presetId) {
    const preset = getPreset(input.presetId);
    if (!preset) {
      throw new FreezeError("BAD_PATH", "unknown camera preset");
    }
    // The preset duration is a default — an explicit valid duration wins,
    // so the client can retime a preset without forking its trajectory.
    const duration: FreezeDuration =
      input.duration !== undefined && isFreezeDuration(input.duration)
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
  const duration =
    input.duration !== undefined && isFreezeDuration(input.duration)
      ? input.duration
      : 5;
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
  for (const row of (jobRows ?? []) as {
    id: string;
    freeze_kind: string | null;
    status: string;
    error: string | null;
    output_asset_id: string | null;
    created_at: string;
  }[]) {
    const outputUrl = row.output_asset_id
      ? ((await signedAssetUrl(
          supabase,
          session.user_id,
          row.output_asset_id
        )) ?? null)
      : null;
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
  };
}
