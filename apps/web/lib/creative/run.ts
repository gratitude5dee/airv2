/**
 * Creative job executor shared by the web SSE lane and the iMessage lane.
 * Drives one job through routing → provider submit/poll → validated download
 * → asset pipeline, recording lifecycle transitions in creative_jobs
 * (metadata only — no prompts, no media, no provider URLs).
 *
 * /zap renders on fal (MiniMax H3 Max Turbo) straight from the user's words —
 * no vision pass, no compile call — because the model expands and screens the
 * prompt itself. Every other lane runs the vision pre-pass and the Groq
 * router, then renders on the GMI queue. Both paths return the same
 * GeneratedMedia, so download, ingestion, and native-video delivery are
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
import { guideForModel, loadCreativePrefs } from "./model-prefs";
import { getProviderKey } from "../providers/keys";
import { PROMPT_VERSIONS } from "./prompts";
import {
  CreativeRouterUnavailableError,
  directZapPlan,
  routeExplicitCommand,
  type CreativeCommandTurn,
} from "./router";
import type { RouterPlan } from "./schema";
import { ingestGeneratedMedia, mintJobDelivery } from "./store";
import { describeImage } from "./vision";

export const REFUSAL_LINE =
  "can't make that one. want to try a different angle?";
export const BUSY_LINE = "i'm juggling a few. try again in a sec.";
export const ROUTER_DOWN_LINE = "creative brain is offline. try again soon.";
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

/**
 * Execute one creative job end to end. The caller has already created the
 * creative_jobs row (status 'routing') and verified the sender is allowed
 * to spend (tier-2 senders never reach this function).
 */
export async function executeCreativeJob(
  supabase: SupabaseClient,
  jobId: string,
  userId: string,
  turn: CreativeCommandTurn
): Promise<CreativeRunResult> {
  const fail = async (
    status: "failed" | "refused" | "submit_unknown",
    line: string
  ): Promise<CreativeRunResult> => {
    await updateCreativeJob(supabase, jobId, { status, error: line });
    return { status, line };
  };

  await updateCreativeJob(supabase, jobId, {
    prompt_version: PROMPT_VERSIONS[turn.mode],
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
    plan = directZapPlan(turn);
  } else {
    // Non-fatal vision pre-pass over attached images.
    let imageDescription: string | null = null;
    const imageUrls = turn.mediaInputs
      .filter((media) => media.kind === "image")
      .map((media) => media.url);
    if (imageUrls.length > 0) {
      imageDescription = await describeImage(imageUrls).catch(() => null);
    }

    // The user's lane model choices (Settings) and, when saved, their
    // personal GMI key. Both degrade to platform defaults on any failure.
    prefs = await loadCreativePrefs(supabase, userId).catch(() => undefined);
    personalGmiKey = await getProviderKey(supabase, userId, "gmi").catch(
      () => null
    );
    // Metaprompt: the guide for the model this turn will render on. /imagine
    // with an attached image runs the edit lane's model.
    const laneModel = prefs
      ? turn.mode === "imagine"
        ? turn.mediaInputs.some((media) => media.kind === "image")
          ? prefs.edit
          : prefs.imagine
        : prefs[turn.mode]
      : null;
    const modelGuide = laneModel ? guideForModel(laneModel) : null;

    try {
      plan = await routeExplicitCommand(
        turn,
        imageDescription,
        undefined,
        modelGuide
      );
    } catch (error) {
      if (error instanceof CreativeUnconfiguredError) {
        return await fail("failed", UNCONFIGURED_LINE);
      }
      if (error instanceof CreativeRouterUnavailableError) {
        return await fail("failed", ROUTER_DOWN_LINE);
      }
      return await fail("failed", ROUTER_DOWN_LINE);
    }
    if (plan.mode === "refuse") {
      return await fail("refused", REFUSAL_LINE);
    }
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
