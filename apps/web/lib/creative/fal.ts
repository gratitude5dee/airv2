/**
 * fal.ai client for the /zap lane: MiniMax H3 Max, submitted through fal's
 * queue with `subscribe` (submit + poll in one call). Control-plane only —
 * FAL_KEY lives in Vercel env, never in a box or a browser (C2).
 *
 * H3 Max exposes two sibling endpoints and no reference-image parameter:
 * text-to-video takes `aspect_ratio`, image-to-video derives the ratio from
 * `image_url` (first frame) and optionally interpolates to `end_image_url`
 * (last frame). Attached *video* is not an input this model accepts, so a
 * /zap with video renders from the compiled prompt alone.
 */
import {
  createFalClient,
  type FalClient,
  type QueueStatus,
} from "@fal-ai/client";
import { env } from "../env";
import { asRecord } from "../records";
import type {
  CreativeTurn,
  GeneratedMedia,
  GmiLifecycleEvent,
  MediaInput,
} from "./gmi";
import { CreativeUnconfiguredError } from "./groq";
import { assertSafeGeneratedMediaUrl, generatedMediaHosts } from "./media-url";
import type { RouterPlan } from "./schema";

export const FAL_ZAP_TEXT_TO_VIDEO = "minimax/h3-max/text-to-video";
export const FAL_ZAP_IMAGE_TO_VIDEO = "minimax/h3-max/image-to-video";

/** H3 Max accepts 5–15s; /zap stays at the short end for delivery latency. */
const MIN_DURATION_SECONDS = 5;
const MAX_DURATION_SECONDS = 10;
const POLL_INTERVAL_MS = 1_000;

export interface FalGenerationRequest {
  kind: "video";
  model: string;
  input: Record<string, unknown>;
}

export interface FalGenerationOptions {
  onLifecycle?: (event: GmiLifecycleEvent) => Promise<void> | void;
  /** Injected in tests; production uses a key-configured singleton client. */
  client?: FalClient;
}

export class FalRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FalRequestError";
  }
}

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const falAspectRatioFor = (
  ratio: RouterPlan["params"]["aspect_ratio"],
): string => (ratio === "auto" ? "16:9" : ratio);

const imagesOf = (turn: CreativeTurn): readonly MediaInput[] =>
  turn.mediaInputs.filter((media) => media.kind === "image");

/** Pure input builder, kept separate from queue I/O for deterministic tests. */
export function buildFalZapRequest(
  plan: RouterPlan,
  turn: CreativeTurn,
): FalGenerationRequest {
  const images = imagesOf(turn);
  const shared = {
    prompt: plan.expanded_prompt,
    duration: clamp(
      plan.params.duration ?? MIN_DURATION_SECONDS,
      MIN_DURATION_SECONDS,
      MAX_DURATION_SECONDS,
    ),
    resolution: "768P",
    prompt_expansion_mode: "balanced",
  };

  const firstFrame = images[0];
  if (!firstFrame) {
    return {
      kind: "video",
      model: FAL_ZAP_TEXT_TO_VIDEO,
      input: {
        ...shared,
        aspect_ratio: falAspectRatioFor(plan.params.aspect_ratio),
      },
    };
  }

  // The ratio follows the first frame here, so aspect_ratio is not sent. A
  // second reference becomes the last frame (first-to-last keyframing).
  const lastFrame = images[1];
  return {
    kind: "video",
    model: FAL_ZAP_IMAGE_TO_VIDEO,
    input: {
      ...shared,
      image_url: firstFrame.url,
      ...(lastFrame ? { end_image_url: lastFrame.url } : {}),
    },
  };
}

let singleton: FalClient | undefined;

const falClient = (): FalClient => {
  const credentials = env.falKey();
  if (!credentials) {
    throw new CreativeUnconfiguredError("fal");
  }
  singleton ??= createFalClient({ credentials });
  return singleton;
};

const videoUrlOf = (data: unknown): string | undefined => {
  const video = asRecord(asRecord(data)?.["video"]);
  const url = video?.["url"];
  return typeof url === "string" && url.length > 0 ? url : undefined;
};

/** Submits one /zap render and returns the queue's finished video artifact. */
export async function generateZapVideo(
  plan: RouterPlan,
  turn: CreativeTurn,
  timeoutMs: number,
  options?: FalGenerationOptions,
): Promise<GeneratedMedia> {
  const request = buildFalZapRequest(plan, turn);
  const client = options?.client ?? falClient();
  const emit = async (event: GmiLifecycleEvent): Promise<void> => {
    await options?.onLifecycle?.(event);
  };
  await emit({ stage: "submitting", kind: "video", model: request.model });

  let requestId: string | undefined;
  let data: unknown;
  try {
    const result = await client.subscribe(request.model, {
      input: request.input,
      pollInterval: POLL_INTERVAL_MS,
      timeout: timeoutMs,
      onEnqueue: (id: string) => {
        requestId = id;
        void emit({
          stage: "submitted",
          kind: "video",
          model: request.model,
          requestId: id,
        });
      },
      onQueueUpdate: (status: QueueStatus) => {
        if (status.status === "IN_PROGRESS") {
          requestId = status.request_id;
          void emit({
            stage: "polling",
            kind: "video",
            model: request.model,
            requestId: status.request_id,
          });
        }
      },
    });
    requestId = result.requestId ?? requestId;
    data = result.data;
  } catch (error) {
    // Provider messages carry moderation/safety reasons the caller maps to a
    // refusal, but never a payload, a prompt, or a credential.
    throw new FalRequestError(
      error instanceof Error ? error.message : "fal generation failed",
    );
  }

  const url = videoUrlOf(data);
  if (!url) {
    throw new FalRequestError("fal succeeded without a video URL");
  }
  const media: GeneratedMedia = {
    kind: "video",
    url: assertSafeGeneratedMediaUrl(url, generatedMediaHosts()),
  };
  await emit({
    stage: "artifact_ready",
    kind: "video",
    model: request.model,
    ...(requestId ? { requestId } : {}),
  });
  return media;
}
