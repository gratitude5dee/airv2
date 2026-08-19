/**
 * MA7 #7 — video_render through the existing creative job flow. The box's
 * creative plugin owns the actual ffmpeg assembly (no render bytes transit
 * Postgres); the control plane only meters it: daily cap before submission,
 * creative_jobs lifecycle row, and a cost_events row on delivery.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { AssetPipelineError, ingestAsset, pluginFetch } from "../assets/pipeline";
import { armStopAfter, ensureBoxAwake, StartLimitError } from "../orchestrator/boxes";
import {
  claimCreativeJobDelivery,
  createCreativeJob,
  DAILY_LIMIT_LINE,
  getCreativeJob,
  insertRenderCostEvent,
  underDailyLimit,
  updateCreativeJob,
} from "./jobs";
import { mintJobDelivery, signedDeliveryForJob } from "./store";
import type { VideoDoc } from "../miniapps/creativeDocs";

export interface RenderStart {
  jobId: string | null;
  line: string;
}

/** Submit the timeline to the box plugin as a metered video_render job. */
export async function startVideoRender(
  supabase: SupabaseClient,
  userId: string,
  doc: VideoDoc
): Promise<RenderStart> {
  if (doc.clips.length === 0) {
    return { jobId: null, line: "add at least one clip before rendering." };
  }
  if (!(await underDailyLimit(supabase, userId))) {
    return { jobId: null, line: DAILY_LIMIT_LINE };
  }
  const job = await createCreativeJob(supabase, userId, "web", "video_render");
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const response = await pluginFetch(supabase, box, "POST", "jobs", {
      kind: "video_render",
      brief: doc.title || "timeline render",
      timeline: {
        clips: doc.clips.map((clip) => ({
          asset_id: clip.assetId,
          trim_start: clip.trimStart,
          trim_end: clip.trimEnd,
          caption: clip.caption,
        })),
        ...(doc.audioAssetId ? { audio_asset_id: doc.audioAssetId } : {}),
      },
    });
    if (!response.ok) {
      await response.body?.cancel();
      await updateCreativeJob(supabase, job.id, {
        status: "failed",
        error: `plugin refused render (${response.status})`,
      });
      return {
        jobId: null,
        line:
          response.status === 400
            ? "the box rejected this timeline — check that every clip references an existing asset."
            : "the render couldn't start — try again in a moment.",
      };
    }
    const submitted = (await response.json()) as { job_id?: string };
    if (!submitted.job_id) {
      await updateCreativeJob(supabase, job.id, {
        status: "failed",
        error: "plugin returned no job id",
      });
      return { jobId: null, line: "the render couldn't start — try again in a moment." };
    }
    await updateCreativeJob(supabase, job.id, {
      status: "polling",
      provider_request_id: submitted.job_id,
    });
    return { jobId: job.id, line: "render started — it will appear below when done." };
  } catch (error) {
    await updateCreativeJob(supabase, job.id, {
      status: "failed",
      error: error instanceof Error ? error.message : "render submit failed",
    });
    if (error instanceof StartLimitError) {
      return { jobId: null, line: "your box can't start right now — try again shortly." };
    }
    return { jobId: null, line: "the render couldn't start — try again in a moment." };
  } finally {
    // ensureBoxAwake nulls stop_after before it can fail; re-arm on every exit.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export interface RenderView {
  status: string;
  line: string;
  /** Short-TTL signed URL of the delivered render, when available. */
  url: string | null;
}

/**
 * One non-blocking poll: if the job finished in the box, ingest the output
 * through the existing asset pipeline (metadata-stripped, size-capped),
 * mint the delivery, and record the render cost event.
 */
export async function refreshVideoRender(
  supabase: SupabaseClient,
  userId: string,
  jobId: string
): Promise<RenderView> {
  const job = await getCreativeJob(supabase, userId, jobId);
  if (!job) {
    return { status: "unknown", line: "no render found for this document yet.", url: null };
  }
  if (job.status === "delivered") {
    const delivery = await signedDeliveryForJob(supabase, userId, job.id);
    return {
      status: "delivered",
      line: "latest render:",
      url: delivery?.url ?? null,
    };
  }
  if (job.status === "failed") {
    return {
      status: "failed",
      line: job.error
        ? `the last render failed: ${job.error}`
        : "the last render failed — adjust the timeline and try again.",
      url: null,
    };
  }
  if (!job.provider_request_id) {
    return { status: job.status, line: "render is starting…", url: null };
  }
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const response = await pluginFetch(
      supabase,
      box,
      "GET",
      `jobs/${encodeURIComponent(job.provider_request_id)}`
    );
    if (!response.ok) {
      await response.body?.cancel();
      return { status: job.status, line: "render is running…", url: null };
    }
    const payload = (await response.json()) as {
      state?: string;
      error?: string | null;
      outputs?: { id: string; kind: string }[];
    };
    if (payload.state === "failed") {
      await updateCreativeJob(supabase, job.id, {
        status: "failed",
        error: payload.error ?? "render failed in the box",
      });
      return {
        status: "failed",
        line: payload.error
          ? `the render failed: ${payload.error}`
          : "the render failed — adjust the timeline and try again.",
        url: null,
      };
    }
    if (payload.state !== "done") {
      return { status: job.status, line: "render is running…", url: null };
    }
    // Plugin asset `kind` is the file extension; the timeline renderer
    // writes a single out.mp4.
    const output = (payload.outputs ?? []).find(
      (o) => o.kind === "mp4" || o.kind === "mov"
    );
    if (!output) {
      await updateCreativeJob(supabase, job.id, {
        status: "failed",
        error: "render finished without a video output",
      });
      return { status: "failed", line: "the render produced no video output.", url: null };
    }
    // Claim the delivered transition first so concurrent refreshes import
    // and charge at most once; losers re-sign the existing delivery.
    if (!(await claimCreativeJobDelivery(supabase, job.id))) {
      const delivery = await signedDeliveryForJob(supabase, userId, job.id);
      return {
        status: "delivered",
        line: delivery ? "latest render:" : "finalizing the render — refresh in a moment.",
        url: delivery?.url ?? null,
      };
    }
    try {
      const asset = await ingestAsset(supabase, userId, box, output.id);
      const delivery = await mintJobDelivery(supabase, asset, job.id);
      await insertRenderCostEvent(supabase, userId, job.id, "video");
      return { status: "delivered", line: "latest render:", url: delivery.url };
    } catch (error) {
      if (error instanceof AssetPipelineError && error.permanent) {
        // Permanent import failure (size cap, bad export) — don't retry forever.
        await updateCreativeJob(supabase, job.id, {
          status: "failed",
          error: error.message,
        });
        return {
          status: "failed",
          line: `the render finished but couldn't be imported: ${error.message}`,
          url: null,
        };
      }
      // Transient failure mid-import: release the claim so a later view retries.
      await updateCreativeJob(supabase, job.id, {
        status: "polling",
        delivered_at: null,
      });
      throw error;
    }
  } catch {
    return {
      status: job.status,
      line: "couldn't reach the box to check the render — refresh in a moment.",
      url: null,
    };
  } finally {
    // ensureBoxAwake nulls stop_after before it can fail; re-arm on every exit.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
