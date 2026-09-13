/**
 * Creative job executor shared by the web SSE lane and the iMessage lane.
 * Drives one job through routing → provider submit/poll → validated download
 * → asset pipeline, recording lifecycle transitions in creative_jobs
 * (metadata only — no prompts, no media, no provider URLs).
 *
 * Explicit slash commands never pay a routing turn: the direct plan hands
 * the user's own words plus structurally-read parameters (aspect ratio,
 * duration, attachment role) to the lane renderer — /zap on fal (MiniMax H3
 * Max Turbo), /imagine and /animate on the GMI queue. Every lane returns the
 * same GeneratedMedia, so download, ingestion, and native-video delivery are
 * identical.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset } from "../assets/pipeline";
import {
  DEFAULT_GENERATION_TIMEOUT_MS,
  generate,
  GmiCapacityError,
  GmiJobError,
  GmiTimeoutError,
  isAmbiguousSubmission,
  isModerationFailure,
  resumeGeneration,
  type CreativeTurn,
  type GeneratedMedia,
  type GmiLifecycleEvent,
} from "./gmi";
import {
  generateZapVideo,
  isFalUnknownOutcome,
  zapReferenceProblem,
} from "./fal";
import { CreativeUnconfiguredError } from "./groq";
import { insertRenderCostEvent, updateCreativeJob, underDailyLimit, DAILY_LIMIT_LINE } from "./jobs";
import { fetchSafeGeneratedMedia } from "./media-url";
import { loadCreativePrefs } from "./model-prefs";
import { getProviderKey } from "../providers/keys";
import { PROMPT_VERSIONS } from "./prompts";
import {
  directCreativePlan,
  directZapPlan,
  type CreativeCommandTurn,
} from "./router";
import type { RouterPlan } from "./schema";
import { ingestGeneratedMedia, mintJobDelivery } from "./store";

export const REFUSAL_LINE =
  "can't make that one. want to try a different angle?";
export const BUSY_LINE = "i'm juggling a few. try again in a sec.";

export const UNCONFIGURED_LINE = "creative generation isn't set up yet.";
export const FAILED_LINE = "that one didn't come out. try again?";
export const SUBMIT_UNKNOWN_LINE =
  "not sure that went through. i won't retry automatically.";

export interface CreativeRunResult {
  status: "delivered" | "failed" | "refused" | "submit_unknown";
  /** Written user-facing line for non-delivered outcomes. */
  line: string;
  asset?: CreativeAsset;
  deliveryUrl?: string;
  kind?: "image" | "video";
  deliveryLine?: string;
}

export interface CreativeJobOptions {
  /**
   * Pre-built plan (draw studio): the caller already made the routing
   * decision, so the vision pre-pass and the Groq compile are skipped; the
   * render still runs on the user's lane prefs and personal key.
   */
  plan?: RouterPlan;
  /** prompt_version written to the job row (defaults to the turn mode's). */
  promptVersion?: string;
}

/**
 * Execute one creative job end to end. The caller has already created the
 * creative_jobs row (status 'routing') and verified the sender is allowed
 * to spend (tier-2 senders never reach this function).
 */
export async function executeCreativeJob(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  turn: CreativeCommandTurn,
  options?: CreativeJobOptions
): Promise<CreativeRunResult> {
  const fail = async (
    status: "failed" | "refused" | "submit_unknown",
    line: string
  ): Promise<CreativeRunResult> => {
    await updateCreativeJob(supabase, jobId, { status, error: line });
    return { status, line };
  };

  await updateCreativeJob(supabase, jobId, {
    prompt_version: options?.promptVersion ?? PROMPT_VERSIONS[turn.mode],
  });

  // Daily cap is checked before any provider call (goal.md §7.11).
  try {
    if (!(await underDailyLimit(supabase, userId))) {
      return await fail("failed", DAILY_LIMIT_LINE);
    }
  } catch {
    return await fail("failed", FAILED_LINE);
  }

  // A personal GMI key is meaningless on the fal lane, so /zap always renders
  // on the platform key and always books a platform cost event.
  const onFal = turn.mode === "zap";

  let plan: RouterPlan;
  let prefs: Awaited<ReturnType<typeof loadCreativePrefs>> | undefined;
  let personalGmiKey: string | null = null;
  if (onFal) {
    const problem = zapReferenceProblem(turn);
    if (problem) {
      return await fail("refused", problem);
    }
    // A caller-built plan (/freeze's camera-trajectory render) skips the
    // default zap plan the same way the GMI lanes do.
    plan = options?.plan ?? directZapPlan(turn);
  } else {
    // The user's lane model choices (Settings) and, when saved, their
    // personal GMI key. Both degrade to platform defaults on any failure.
    prefs = await loadCreativePrefs(supabase, userId).catch(() => undefined);
    personalGmiKey = await getProviderKey(supabase, userId, "gmi").catch(
      () => null
    );
    plan = options?.plan ?? directCreativePlan(turn);
  }

  const creativeTurn: CreativeTurn = {
    text: turn.text,
    mediaInputs: turn.mediaInputs,
  };
  const onLifecycle = async (event: GmiLifecycleEvent): Promise<void> => {
    if (event.stage === "submitted") {
      await updateCreativeJob(supabase, jobId, {
        status: "submitted",
        ...(event.requestId ? { provider_request_id: event.requestId } : {}),
      });
    } else if (event.stage === "polling") {
      await updateCreativeJob(supabase, jobId, {
        status: "polling",
        ...(event.requestId ? { provider_request_id: event.requestId } : {}),
      });
    }
  };

  const generationOptions = {
    onLifecycle,
    ...(personalGmiKey ? { apiKey: personalGmiKey } : {}),
  };
  let media: GeneratedMedia;
  try {
    media = onFal
      ? await generateZapVideo(plan, creativeTurn, DEFAULT_GENERATION_TIMEOUT_MS, {
          onLifecycle,
        })
      : await generate(
          plan,
          creativeTurn,
          DEFAULT_GENERATION_TIMEOUT_MS,
          generationOptions,
          prefs
        );
  } catch (error) {
    if (error instanceof CreativeUnconfiguredError) {
      return await fail("failed", UNCONFIGURED_LINE);
    }
    if (error instanceof GmiTimeoutError) {
      // A known request ID may be resumed by polling only — never resubmit.
      try {
        media = await resumeGeneration(
          error,
          DEFAULT_GENERATION_TIMEOUT_MS,
          generationOptions
        );
      } catch {
        return await fail("failed", FAILED_LINE);
      }
    } else if (error instanceof GmiCapacityError) {
      return await fail("failed", BUSY_LINE);
    } else if (error instanceof GmiJobError && isModerationFailure(error)) {
      return await fail("refused", REFUSAL_LINE);
    } else if (isAmbiguousSubmission(error) || isFalUnknownOutcome(error)) {
      // The provider may or may not have accepted the work (C23). Persist
      // the ambiguity; never automatically resubmit.
      return await fail("submit_unknown", SUBMIT_UNKNOWN_LINE);
    } else {
      return await fail("failed", FAILED_LINE);
    }
  }

  try {
    const fetched = await fetchSafeGeneratedMedia(media.url, media.kind);
    const asset = await ingestGeneratedMedia(supabase, userId, fetched);
    const delivery = await mintJobDelivery(supabase, asset, jobId);
    await updateCreativeJob(supabase, jobId, {
      status: "delivered",
      delivered_at: new Date().toISOString(),
      output_asset_id: asset.id,
    });
    // A render on the user's personal GMI key is their own provider spend —
    // no platform cost event (the job still counts toward the daily cap).
    if (onFal || !personalGmiKey) {
      await insertRenderCostEvent(supabase, userId, jobId, media.kind);
    }
    return {
      status: "delivered",
      line: plan.delivery_line || "made this for you",
      deliveryLine: plan.delivery_line || "made this for you",
      asset,
      deliveryUrl: delivery.url,
      kind: media.kind,
    };
  } catch {
    return await fail("failed", FAILED_LINE);
  }
}
