/**
 * /draw domain (ported from mayor-coast's Convex draw mutations — see
 * convex/creative.ts admitDrawGeneration / animateDrawJob / listDrawEvents).
 *
 * One draw_sessions row per card mint; creative_jobs rows carry the render
 * work (mode 'draw' for sketch-to-image, 'zap' for animate). The revision
 * chain hangs off parent_job_id/root_job_id: a refine generation inherits
 * the parent's output asset as its edit source and numbers itself
 * parent.revision+1. Live progress rides creative_jobs.status — draw_events
 * only records admission and terminal states.
 *
 * Execution reuses the metered GMI lane via a pre-built plan: /draw is its
 * own routing decision, so the Groq compile and vision pass never run; the
 * render lands on the owner's imagine/edit lane model with the mode's
 * quality. mayor-coast's fal z-image turbo has no GMI analog — 'turbo'
 * maps to low quality on the same lanes.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASSETS_BUCKET,
  DELIVERY_TTL_SECONDS,
  masterKey,
} from "../assets/keys";
import type { CreativeAsset } from "../assets/pipeline";
import { createCreativeJob, getCreativeJob, updateCreativeJob } from "../creative/jobs";
import type { CreativeChannel, CreativeJob } from "../creative/jobs";
import type { MediaInput } from "../creative/gmi";
import { executeCreativeJob, type CreativeRunResult } from "../creative/run";
import type { RouterPlan } from "../creative/schema";

export const DRAW_MODES = ["fast", "detailed", "turbo", "hq"] as const;
export type DrawMode = (typeof DRAW_MODES)[number];
export const DEFAULT_DRAW_MODE: DrawMode = "fast";

export const DRAW_MODE_LABELS: Record<DrawMode, string> = {
  fast: "Flare Fast",
  detailed: "Flare Detailed",
  turbo: "Turbo",
  hq: "Sunburst HQ",
};

/** draw_mode → GMI quality (see header: modes pick quality, not models). */
const DRAW_MODE_QUALITY: Record<DrawMode, "low" | "medium" | "high"> = {
  fast: "low",
  detailed: "medium",
  turbo: "low",
  hq: "high",
};

export function isDrawMode(value: string): value is DrawMode {
  return (DRAW_MODES as readonly string[]).includes(value);
}

export const DRAW_SESSION_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_DRAW_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_DRAW_IMPORT_BYTES = 10 * 1024 * 1024;

/** Default motion brief when the owner animates without words. */
export const DEFAULT_MOTION_PROMPT =
  "Natural cinematic motion while preserving the original composition.";

/** Job statuses that still hold the session's single in-flight slot. */
const ACTIVE_JOB_STATUSES: readonly string[] = [
  "routing",
  "submitted",
  "polling",
  "submit_unknown",
];

export class DrawError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "DrawError";
    this.code = code;
  }
}

export interface DrawSession {
  id: string;
  user_id: string;
  space_id: string;
  phone: string;
  status: "active" | "expired";
  active_job_id: string | null;
  latest_job_id: string | null;
  event_sequence: number;
  initial_asset_id: string | null;
  initial_prompt_sent: boolean;
  expires_at: string;
  created_at: string;
}

export interface DrawEvent {
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

export async function createDrawSession(
  supabase: SupabaseClient,
  input: {
    userId: string;
    spaceId: string;
    phone: string;
    initialAssetId?: string | undefined;
    expiresAt?: string | undefined;
  }
): Promise<DrawSession> {
  const { data, error } = await supabase
    .from("draw_sessions")
    .insert({
      user_id: input.userId,
      space_id: input.spaceId,
      phone: input.phone,
      status: "active",
      initial_asset_id: input.initialAssetId ?? null,
      expires_at:
        input.expiresAt ??
        new Date(Date.now() + DRAW_SESSION_TTL_MS).toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`draw session insert failed: ${error.message}`);
  return data as DrawSession;
}

/**
 * Load the session for an owner, expiring it on read when past TTL. Throws
 * DrawError SESSION_EXPIRED for a dead or foreign session — the studio
 * surfaces "reopen the card".
 */
export async function getDrawSession(
  supabase: SupabaseClient,
  userId: string,
  sessionId: string
): Promise<DrawSession | undefined> {
  const { data } = await supabase
    .from("draw_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();
  const session = (data as DrawSession | null) ?? undefined;
  if (!session) return undefined;
  if (
    session.status === "active" &&
    new Date(session.expires_at).getTime() <= Date.now()
  ) {
    await supabase
      .from("draw_sessions")
      .update({ status: "expired" })
      .eq("id", session.id);
    session.status = "expired";
  }
  return session;
}

export function requireActiveSession(session: DrawSession): DrawSession {
  if (session.status !== "active") {
    throw new DrawError("SESSION_EXPIRED", "this draw session has ended");
  }
  return session;
}

/**
 * Append the next draw_events row and bump the session counter. The
 * (session_id, sequence) unique constraint fences concurrent writers; a
 * collision retries against the fresh sequence.
 */
export async function appendDrawEvent(
  supabase: SupabaseClient,
  sessionId: string,
  event: {
    jobId?: string | undefined;
    kind: "state" | "preview" | "completed";
    state?: string | undefined;
    assetId?: string | undefined;
    previewIndex?: number | undefined;
    errorCode?: string | undefined;
  }
): Promise<void> {
  for (let attempt = 0; attempt < 5; attempt++) {
    // Derive from the committed event rows, not the session counter: a
    // writer that lost the unique race reads the counter before the
    // winner bumps it and would retry the occupied sequence forever. The
    // winner's committed row is visible immediately, so re-reading
    // draw_events converges on the next free sequence.
    const { data: last } = await supabase
      .from("draw_events")
      .select("sequence")
      .eq("session_id", sessionId)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    const next = ((last?.sequence as number | undefined) ?? -1) + 1;
    const { error } = await supabase.from("draw_events").insert({
      session_id: sessionId,
      job_id: event.jobId ?? null,
      sequence: next,
      kind: event.kind,
      state: event.state ?? null,
      asset_id: event.assetId ?? null,
      preview_index: event.previewIndex ?? null,
      error_code: event.errorCode ?? null,
    });
    if (!error) {
      // Best-effort counter for clients that read the session row; never
      // regress a higher value written by a later event.
      await supabase
        .from("draw_sessions")
        .update({ event_sequence: next })
        .eq("id", sessionId)
        .lt("event_sequence", next);
      return;
    }
    if (error.code !== "23505") {
      console.error(
        JSON.stringify({
          msg: "draw event insert failed",
          session_id: sessionId,
          error: error.message,
        })
      );
      return;
    }
  }
  console.error(
    JSON.stringify({
      msg: "draw event dropped: sequence retries exhausted",
      session_id: sessionId,
      kind: event.kind,
      state: event.state ?? null,
    })
  );
}

const MAX_DRAW_PROMPT_CHARS = 2000;
const FALLBACK_SKETCH_PROMPT =
  "Turn this sketch into a polished finished image while preserving its composition.";

/** Image-model input: no control/format characters, collapsed whitespace,
 * bounded length. Newlines in a textarea prompt are prose, not structure. */
export function sanitizeDrawPrompt(prompt: string): string {
  return prompt
    .replace(/[\p{Cc}\p{Cf}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, MAX_DRAW_PROMPT_CHARS);
}

/**
 * The plan a draw generation renders from — the studio IS the router. An
 * image input means edit-source semantics (GMI routes it to the edit lane
 * model); the mode only moves the quality parameter.
 */
export function directDrawPlan(
  prompt: string,
  mode: DrawMode,
  hasImage: boolean
): RouterPlan {
  const cleaned = sanitizeDrawPrompt(prompt);
  return {
    mode: "imagine",
    needs_input: false,
    chat_reply: hasImage ? "editing your sketch" : "drawing your idea",
    delivery_line: "here is your image",
    // A bare "polish this image" upload still needs an instruction — an
    // empty expanded_prompt renders as a literal blank in the template.
    expanded_prompt: cleaned || (hasImage ? FALLBACK_SKETCH_PROMPT : cleaned),
    params: {
      aspect_ratio: "1:1",
      duration: null,
      generate_audio: false,
      quality: DRAW_MODE_QUALITY[mode],
      use_input_image_as: hasImage ? "edit_source" : "none",
    },
  };
}

/**
 * Admit one draw generation (mayor-coast admitDrawGeneration): the session
 * owns one in-flight slot, a parent revision contributes its output asset
 * as the edit source and roots the chain, and the session's active/latest
 * pointers move to the new job. Throws DrawError on a rule violation.
 */
export async function admitDrawGeneration(
  supabase: SupabaseClient,
  session: DrawSession,
  input: {
    prompt: string;
    mode: DrawMode;
    inputAssetId?: string | undefined;
    parentJobId?: string | undefined;
    resetContext?: boolean | undefined;
    channel: CreativeChannel;
  }
): Promise<CreativeJob> {
  requireActiveSession(session);

  // A caller-supplied edit source must belong to this owner — the job row
  // persists the reference, so a foreign asset id would be cross-tenant.
  if (input.inputAssetId) {
    const { data: owned } = await supabase
      .from("creative_assets")
      .select("id")
      .eq("id", input.inputAssetId)
      .eq("user_id", session.user_id)
      .maybeSingle();
    if (!owned) {
      throw new DrawError(
        "PARENT_UNAVAILABLE",
        "that image isn't available"
      );
    }
  }

  let parentJobId: string | undefined;
  let rootJobId: string | undefined;
  let revisionNumber = 1;
  let inputAssetId = input.inputAssetId;

  if (input.parentJobId && !input.resetContext) {
    const parent = await getCreativeJob(
      supabase,
      session.user_id,
      input.parentJobId
    );
    if (
      !parent ||
      parent.draw_session_id !== session.id ||
      parent.status !== "delivered" ||
      !parent.output_asset_id
    ) {
      throw new DrawError(
        "PARENT_UNAVAILABLE",
        "that result is no longer available to refine"
      );
    }
    parentJobId = parent.id;
    rootJobId = parent.root_job_id ?? parent.id;
    revisionNumber = (parent.revision_number ?? 1) + 1;
    inputAssetId = inputAssetId ?? parent.output_asset_id;
  }

  const job = await createCreativeJob(
    supabase,
    session.user_id,
    input.channel,
    "draw",
    {
      drawSessionId: session.id,
      drawMode: input.mode,
      ...(parentJobId ? { parentJobId } : {}),
      ...(rootJobId ? { rootJobId } : {}),
      revisionNumber,
      ...(inputAssetId ? { inputAssetId } : {}),
    }
  );
  if (!rootJobId) {
    // The root of a chain points at itself so revisions select on one column.
    rootJobId = job.id;
    await updateCreativeJobRoot(supabase, job.id, job.id);
    job.root_job_id = job.id;
  }

  // The session's in-flight slot is a compare-and-set lease: claim only an
  // empty slot, release a stale one by its recorded id first. A cancelled
  // job that finishes late can never free a successor's slot.
  if (!(await claimDrawSlot(supabase, session, job.id, true))) {
    await updateCreativeJob(supabase, job.id, {
      status: "failed",
      error: "superseded before admission",
    });
    throw new DrawError(
      "JOB_ALREADY_ACTIVE",
      "another image is still generating"
    );
  }
  await appendDrawEvent(supabase, session.id, {
    jobId: job.id,
    kind: "state",
    state: "admitted",
  });
  return { ...job, root_job_id: rootJobId };
}

async function updateCreativeJobRoot(
  supabase: SupabaseClient,
  jobId: string,
  rootJobId: string
): Promise<void> {
  const { error } = await supabase
    .from("creative_jobs")
    .update({ root_job_id: rootJobId })
    .eq("id", jobId);
  if (error) {
    console.error(
      JSON.stringify({
        msg: "draw job root update failed",
        job_id: jobId,
        error: error.message,
      })
    );
  }
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
 * Run an admitted draw job through the GMI lane and reconcile the session:
 * on delivery the output lands on the job + a 'completed' event; on any
 * other terminal result a 'state' event carries the outcome. The session's
 * active slot always frees. The prompt rides the call — it is never
 * persisted on the job row (C4).
 */
export async function runDrawJob(
  supabase: SupabaseClient,
  session: DrawSession,
  job: CreativeJob,
  prompt: string
): Promise<CreativeRunResult> {
  const mode = isDrawMode(String(job.draw_mode ?? ""))
    ? (job.draw_mode as DrawMode)
    : DEFAULT_DRAW_MODE;

  const mediaInputs: MediaInput[] = [];
  if (job.input_asset_id) {
    const url = await signedAssetUrl(
      supabase,
      session.user_id,
      job.input_asset_id
    );
    if (url) mediaInputs.push({ kind: "image", url });
  }

  const cleanPrompt = sanitizeDrawPrompt(prompt);
  const result = await executeCreativeJob(
    supabase,
    job.id,
    session.user_id,
    {
      mode: "imagine",
      cleanedText: cleanPrompt,
      text: prompt,
      mediaInputs,
    },
    {
      plan: directDrawPlan(cleanPrompt, mode, mediaInputs.length > 0),
      promptVersion: DRAW_PROMPT_VERSION,
    }
  );

  if (result.status === "delivered") {
    await appendDrawEvent(supabase, session.id, {
      jobId: job.id,
      kind: "completed",
      state: "delivered",
      assetId: result.asset?.id,
    });
  } else {
    await appendDrawEvent(supabase, session.id, {
      jobId: job.id,
      kind: "state",
      state: result.status,
      errorCode: safeDrawErrorCode(result.line),
    });
  }
  // Clear by identity — a successor may already own the slot.
  await supabase
    .from("draw_sessions")
    .update({ active_job_id: null, latest_job_id: job.id })
    .eq("id", session.id)
    .eq("active_job_id", job.id);
  return result;
}

/**
 * CAS lease on the session's one in-flight slot. `claimLatest` also moves
 * latest_job_id (generation only — an animation must not anchor the
 * revision strip). A recorded-but-stale slot (terminal/cancelled job) is
 * released by its own id before retrying, so it can't evict a newer claim.
 */
async function claimDrawSlot(
  supabase: SupabaseClient,
  session: DrawSession,
  jobId: string,
  claimLatest: boolean
): Promise<boolean> {
  const attempt = () =>
    supabase
      .from("draw_sessions")
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
      .from("draw_sessions")
      .update({ active_job_id: null })
      .eq("id", session.id)
      .eq("active_job_id", session.active_job_id);
    ({ data } = await attempt());
  }
  return Boolean(data?.length);
}

/** Release the lease — only if this job still owns it. */
async function releaseDrawSlot(
  supabase: SupabaseClient,
  sessionId: string,
  jobId: string
): Promise<void> {
  await supabase
    .from("draw_sessions")
    .update({ active_job_id: null })
    .eq("id", sessionId)
    .eq("active_job_id", jobId);
}

export const DRAW_PROMPT_VERSION = "generation.draw.v1";

/**
 * mayor-coast admitted a 'zap' command for animate (H3 image-to-video takes
 * the output as its first frame) — same lane here. Not a revision: the video
 * hangs off the chain as a draw event, not a draw_mode job.
 */
export async function animateDrawJob(
  supabase: SupabaseClient,
  session: DrawSession,
  jobId: string,
  motionPrompt?: string
): Promise<{ job: CreativeJob; result: CreativeRunResult }> {
  requireActiveSession(session);
  const source = await getCreativeJob(supabase, session.user_id, jobId);
  if (
    !source ||
    source.draw_session_id !== session.id ||
    source.status !== "delivered" ||
    !source.output_asset_id
  ) {
    throw new DrawError(
      "JOB_NOT_READY",
      "that result isn't ready to animate"
    );
  }
  const url = await signedAssetUrl(
    supabase,
    session.user_id,
    source.output_asset_id
  );
  if (!url) {
    throw new DrawError("PARENT_EXPIRED", "the source image expired");
  }
  const prompt =
    sanitizeDrawPrompt(motionPrompt ?? "") || DEFAULT_MOTION_PROMPT;
  const job = await createCreativeJob(
    supabase,
    session.user_id,
    "web",
    "zap",
    { drawSessionId: session.id }
  );
  // The same in-flight lease as generation: without it two open copies of
  // one card could each run a paid animation, or an animation could race
  // a fresh draw. latest_job_id stays with the revisions — not the zap.
  if (!(await claimDrawSlot(supabase, session, job.id, false))) {
    await updateCreativeJob(supabase, job.id, {
      status: "failed",
      error: "superseded before admission",
    });
    throw new DrawError(
      "JOB_ALREADY_ACTIVE",
      "another image is still generating"
    );
  }
  try {
    const result = await executeCreativeJob(
      supabase,
      job.id,
      session.user_id,
      {
        mode: "zap",
        cleanedText: prompt,
        text: prompt,
        mediaInputs: [{ kind: "image", url }],
      }
    );
    await appendDrawEvent(supabase, session.id, {
      jobId: job.id,
      kind: result.status === "delivered" ? "completed" : "state",
      state: result.status,
      assetId: result.asset?.id,
      errorCode:
        result.status === "delivered"
          ? undefined
          : safeDrawErrorCode(result.line),
    });
    return { job, result };
  } finally {
    await releaseDrawSlot(supabase, session.id, job.id);
  }
}

/** Best-effort cancel: GMI has no provider cancel, so the job row is marked
 * failed and the slot freed; a late delivery stays recorded on the job. */
export async function cancelActiveDrawJob(
  supabase: SupabaseClient,
  session: DrawSession
): Promise<void> {
  if (!session.active_job_id) return;
  await updateCreativeJob(supabase, session.active_job_id, {
    status: "failed",
    error: "cancelled by owner",
  });
  await appendDrawEvent(supabase, session.id, {
    jobId: session.active_job_id,
    kind: "state",
    state: "cancelled",
  });
  await supabase
    .from("draw_sessions")
    .update({ active_job_id: null })
    .eq("id", session.id)
    .eq("active_job_id", session.active_job_id);
}

export function safeDrawErrorCode(line: string): string {
  return createHash("sha256").update(line).digest("hex").slice(0, 16);
}

/**
 * Status payload the studio polls (mayor-coast listDrawEvents +
 * listDrawRevisions): new events after `after`, the session's pointers, and
 * the revision chains with a signed preview URL per delivered output.
 */
export async function drawStatus(
  supabase: SupabaseClient,
  session: DrawSession,
  after: number
): Promise<{
  events: DrawEvent[];
  latest: number;
  activeJob: { id: string; status: string; error: string | null } | null;
  latestJobId: string | null;
  initialAssetUrl: string | null;
  latestAnimation: { jobId: string; url: string } | null;
  revisions: DrawRevision[];
}> {
  const { data } = await supabase
    .from("draw_events")
    .select("*")
    .eq("session_id", session.id)
    .gt("sequence", after)
    .order("sequence", { ascending: true });
  const events = (data ?? []) as DrawEvent[];

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

  const revisions = await listDrawRevisions(supabase, session);
  const initialAssetUrl = session.initial_asset_id
    ? ((await signedAssetUrl(
        supabase,
        session.user_id,
        session.initial_asset_id
      )) ?? null)
    : null;

  // Animations are zap-mode jobs — outside the draw revision chain — so
  // the latest delivered one is projected separately or a reload would
  // lose the video (preview + save target) entirely.
  const { data: animation } = await supabase
    .from("creative_jobs")
    .select("id, output_asset_id")
    .eq("user_id", session.user_id)
    .eq("draw_session_id", session.id)
    .eq("mode", "zap")
    .eq("status", "delivered")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const animationUrl = animation?.output_asset_id
    ? ((await signedAssetUrl(
        supabase,
        session.user_id,
        animation.output_asset_id
      )) ?? null)
    : null;
  const latestAnimation =
    animation && animationUrl
      ? { jobId: animation.id, url: animationUrl }
      : null;

  const latest = events.length
    ? events[events.length - 1]!.sequence
    : session.event_sequence;
  return {
    events,
    latest,
    activeJob,
    latestJobId: session.latest_job_id,
    initialAssetUrl,
    latestAnimation,
    revisions,
  };
}

export interface DrawRevision {
  jobId: string;
  parentJobId: string | null;
  rootJobId: string;
  revisionNumber: number;
  mode: string | null;
  state: string;
  outputAssetId: string | null;
  outputUrl: string | null;
  inputUrl: string | null;
  createdAt: string;
}

async function listDrawRevisions(
  supabase: SupabaseClient,
  session: DrawSession
): Promise<DrawRevision[]> {
  const { data } = await supabase
    .from("creative_jobs")
    .select(
      "id, parent_job_id, root_job_id, revision_number, draw_mode, status, " +
        "input_asset_id, output_asset_id, created_at"
    )
    .eq("user_id", session.user_id)
    .eq("draw_session_id", session.id)
    .eq("mode", "draw")
    .order("created_at", { ascending: true });
  const rows = (data ?? []) as unknown as {
    id: string;
    parent_job_id: string | null;
    root_job_id: string | null;
    revision_number: number | null;
    draw_mode: string | null;
    status: string;
    input_asset_id: string | null;
    output_asset_id: string | null;
    created_at: string;
  }[];
  const revisions: DrawRevision[] = [];
  for (const row of rows) {
    const outputUrl = row.output_asset_id
      ? ((await signedAssetUrl(
          supabase,
          session.user_id,
          row.output_asset_id
        )) ?? null)
      : null;
    const inputUrl = row.input_asset_id
      ? ((await signedAssetUrl(
          supabase,
          session.user_id,
          row.input_asset_id
        )) ?? null)
      : null;
    revisions.push({
      jobId: row.id,
      parentJobId: row.parent_job_id,
      rootJobId: row.root_job_id ?? row.id,
      revisionNumber: row.revision_number ?? 1,
      mode: row.draw_mode,
      state: row.status,
      outputAssetId: row.output_asset_id,
      outputUrl,
      inputUrl,
      createdAt: row.created_at,
    });
  }
  return revisions;
}

const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

/**
 * Store the studio's flattened canvas (PNG data URL) as a content-addressed
 * asset — same contract as the image app's sketch upload (image.tsx
 * storeSketchAsset): bounded bytes, PNG magic checked, sha256 dedupe.
 */
export async function storeDrawUpload(
  supabase: SupabaseClient,
  userId: string,
  dataUrl: string
): Promise<CreativeAsset | null> {
  const prefix = "data:image/png;base64,";
  if (!dataUrl.startsWith(prefix)) return null;
  let buffer: Buffer;
  try {
    buffer = Buffer.from(dataUrl.slice(prefix.length), "base64");
  } catch {
    return null;
  }
  if (
    // 8-byte signature + IHDR immediately after + IEND trailer — the
    // structural minimum a real PNG decoder requires, not just magic bytes.
    buffer.byteLength < 45 ||
    buffer.byteLength > MAX_DRAW_UPLOAD_BYTES ||
    !buffer.subarray(0, 8).equals(PNG_SIGNATURE) ||
    buffer.subarray(12, 16).toString("latin1") !== "IHDR" ||
    buffer
      .subarray(buffer.byteLength - 8, buffer.byteLength - 4)
      .toString("latin1") !== "IEND"
  ) {
    return null;
  }
  const digest = createHash("sha256").update(buffer).digest("hex");
  const existing = await supabase
    .from("creative_assets")
    .select("*")
    .eq("user_id", userId)
    .eq("sha256", digest)
    .maybeSingle();
  if (existing.data) return existing.data as CreativeAsset;
  const key = masterKey(userId, digest, "png");
  const upload = await supabase.storage
    .from(ASSETS_BUCKET)
    .upload(key, buffer, { contentType: "image/png", upsert: true });
  if (upload.error) return null;
  const inserted = await supabase
    .from("creative_assets")
    .insert({
      user_id: userId,
      box_asset_id: `draw:${digest.slice(0, 16)}`,
      sha256: digest,
      ext: "png",
      kind: "png",
      bytes: buffer.byteLength,
      storage_key: key,
    })
    .select("*")
    .single();
  return (inserted.data as CreativeAsset | null) ?? null;
}
