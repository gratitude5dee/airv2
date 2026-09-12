/**
 * creative_jobs bookkeeping (goal.md M16 task 2). Rows carry lifecycle
 * metadata only — never prompt text or media content (C4). Each delivered
 * job inserts a `cost_events` row (kind 'render') so paid renders are never
 * silent; the per-user daily cap is checked before any provider submission.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import type { CreativeMode } from "./parse";

export type CreativeChannel = "web" | "imessage";
/** Router modes plus box-side timeline assembly (MA7 'video_render'), the
 * draw studio's sketch-to-image lane ('draw'), and the freeze studio's
 * camera-trajectory renders ('freeze'). */
export type CreativeJobMode = CreativeMode | "video_render" | "draw" | "freeze";
export type CreativeJobStatus =
  | "routing"
  | "submitted"
  | "polling"
  | "delivered"
  | "failed"
  | "refused"
  | "submit_unknown";

export interface CreativeJob {
  id: string;
  user_id: string;
  channel: CreativeChannel;
  mode: CreativeJobMode;
  status: CreativeJobStatus;
  provider_request_id: string | null;
  prompt_version: string | null;
  error: string | null;
  created_at: string;
  delivered_at: string | null;
  /** Draw-studio linkage (0107) — null on non-draw jobs. */
  draw_session_id?: string | null;
  /** Freeze-studio linkage (0110) — null on non-freeze jobs. */
  freeze_session_id?: string | null;
  freeze_kind?: "sketch" | "render" | null;
  draw_mode?: string | null;
  parent_job_id?: string | null;
  root_job_id?: string | null;
  revision_number?: number | null;
  input_asset_id?: string | null;
  output_asset_id?: string | null;
}

/** Draw-studio linkage columns written at insert (0107); absent elsewhere. */
export interface CreativeJobDrawLinkage {
  drawSessionId: string;
  drawMode?: "fast" | "detailed" | "turbo" | "hq" | undefined;
  parentJobId?: string | undefined;
  rootJobId?: string | undefined;
  revisionNumber?: number | undefined;
  inputAssetId?: string | undefined;
}

/** Freeze-studio linkage written at insert (0110). */
export interface CreativeJobFreezeLinkage {
  freezeSessionId: string;
  /** 'sketch' = source-image generation; 'render' = camera-trajectory video. */
  freezeKind?: "sketch" | "render" | undefined;
  inputAssetId?: string | undefined;
}

export const DAILY_LIMIT_LINE = "you've hit today's creative limit.";

export async function createCreativeJob(
  supabase: SupabaseClient,
  userId: string,
  channel: CreativeChannel,
  mode: CreativeJobMode,
  draw?: CreativeJobDrawLinkage,
  freeze?: CreativeJobFreezeLinkage
): Promise<CreativeJob> {
  const { data, error } = await supabase
    .from("creative_jobs")
    .insert({
      user_id: userId,
      channel,
      mode,
      status: "routing",
      ...(draw
        ? {
            draw_session_id: draw.drawSessionId,
            draw_mode: draw.drawMode ?? null,
            parent_job_id: draw.parentJobId ?? null,
            root_job_id: draw.rootJobId ?? null,
            revision_number: draw.revisionNumber ?? null,
            input_asset_id: draw.inputAssetId ?? null,
          }
        : {}),
      ...(freeze
        ? {
            freeze_session_id: freeze.freezeSessionId,
            freeze_kind: freeze.freezeKind ?? null,
            input_asset_id: freeze.inputAssetId ?? null,
          }
        : {}),
    })
    .select("*")
    .single();
  if (error) {
    throw new Error(`creative job insert failed: ${error.message}`);
  }
  return data as CreativeJob;
}

export async function getCreativeJob(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<CreativeJob | undefined> {
  const { data } = await supabase
    .from("creative_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as CreativeJob | null) ?? undefined;
}

export async function updateCreativeJob(
  supabase: SupabaseClient,
  jobId: string,
  patch: Partial<
    Pick<
      CreativeJob,
      | "status"
      | "provider_request_id"
      | "prompt_version"
      | "error"
      | "delivered_at"
      | "output_asset_id"
    >
  >
): Promise<void> {
  const { error } = await supabase
    .from("creative_jobs")
    .update(patch)
    .eq("id", jobId);
  if (error) {
    console.error(
      JSON.stringify({
        msg: "creative job update failed",
        job_id: jobId,
        error: error.message,
      })
    );
  }
}

/**
 * Atomically claim the polling→delivered transition for a job. Returns true
 * for exactly one caller; concurrent refreshes (or replays after a delivered
 * write) see false and must fall back to the already-delivered artifact.
 */
export async function claimCreativeJobDelivery(
  supabase: SupabaseClient,
  jobId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("creative_jobs")
    .update({ status: "delivered", delivered_at: new Date().toISOString() })
    .eq("id", jobId)
    .neq("status", "delivered")
    .select("id");
  if (error) {
    throw new Error(`creative job claim failed: ${error.message}`);
  }
  return (data ?? []).length > 0;
}

/**
 * True when the user has generation budget left today. Failed/refused jobs
 * don't consume the cap — only jobs that reached (or may have reached) the
 * provider count against it.
 */
export async function underDailyLimit(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("creative_jobs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", dayStart.toISOString())
    .in("status", ["submitted", "polling", "delivered", "submit_unknown"]);
  if (error) {
    throw new Error(`creative daily-cap check failed: ${error.message}`);
  }
  return (count ?? 0) < env.creativeDailyLimit();
}

/** Record the render spend for one delivered generation (goal.md §7.11). */
export async function insertRenderCostEvent(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  kind: "image" | "video"
): Promise<void> {
  const amountCents =
    kind === "image"
      ? env.creativeCostCentsImage()
      : env.creativeCostCentsVideo();
  const { error } = await supabase.from("cost_events").insert({
    user_id: userId,
    kind: "render",
    amount_cents: amountCents,
    ref: `creative:${jobId}`,
  });
  if (error) {
    console.error(
      JSON.stringify({
        msg: "render cost event insert failed",
        user_id: userId,
        job_id: jobId,
        error: error.message,
      })
    );
  }
}
