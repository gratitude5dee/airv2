/**
 * fal.ai client for the /zap lane: MiniMax H3 Max on fal's request queue.
 * Control-plane only — FAL_KEY lives in Vercel env, never in a box or a
 * browser (C2).
 *
 * The queue is driven manually (submit → poll by ID → result) instead of
 * `client.subscribe`: the SDK retries the non-idempotent submit POST on
 * transport errors, which can pay for duplicate renders. The submit here is
 * a single un-retried request; only reads (status/result, safe to repeat)
 * go through the SDK. C23 applies as on GMI: an ambiguous submission is
 * never resubmitted, and a known request ID is never downgraded to a
 * retryable failure.
 *
 * H3 Max exposes two sibling endpoints and no reference-image parameter:
 * text-to-video takes `aspect_ratio`, image-to-video derives the ratio from
 * `image_url` (first frame) and optionally interpolates to `end_image_url`
 * (last frame). Attached *video* is not an input this model accepts, so a
 * /zap with video renders from the compiled prompt alone.
 */
import { createFalClient, type FalClient } from "@fal-ai/client";
import { env } from "../env";
import { asRecord } from "../records";
import type {
  CreativeTurn,
  GeneratedMedia,
  GmiLifecycleEvent,
  MediaInput,
} from "./gmi";
import { GmiCapacityError, withCreativeSlot } from "./gmi";
import { CreativeUnconfiguredError } from "./groq";
import { assertSafeGeneratedMediaUrl, generatedMediaHosts } from "./media-url";
import type { RouterPlan } from "./schema";

export const FAL_ZAP_TEXT_TO_VIDEO = "minimax/h3-max/text-to-video";
export const FAL_ZAP_IMAGE_TO_VIDEO = "minimax/h3-max/image-to-video";

/** H3 Max accepts 5–15s; /zap stays at the short end for delivery latency. */
const MIN_DURATION_SECONDS = 5;
const MAX_DURATION_SECONDS = 10;
const POLL_INTERVAL_MS = 1_000;
const SUBMIT_TIMEOUT_MS = 20_000;
const FAL_QUEUE_BASE_URL = "https://queue.fal.run";

export interface FalGenerationRequest {
  kind: "video";
  model: string;
  input: Record<string, unknown>;
}

/** The read-only queue surface generateZapVideo needs; injected in tests. */
export interface FalQueueReader {
  status: (
    endpointId: string,
    options: { requestId: string; abortSignal?: AbortSignal },
  ) => Promise<{ status: string }>;
  result: (
    endpointId: string,
    options: { requestId: string; abortSignal?: AbortSignal },
  ) => Promise<{ data: unknown }>;
}

export interface FalGenerationOptions {
  onLifecycle?: (event: GmiLifecycleEvent) => Promise<void> | void;
  /** Injected in tests; production uses a key-configured singleton client. */
  queue?: FalQueueReader;
  /** Injected in tests; production submits with global fetch. */
  submit?: typeof fetch;
}

/** The request was definitively rejected before any work was enqueued. */
export class FalRequestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FalRequestError";
  }
}

/**
 * The submission's outcome is unknown: fal may or may not have accepted the
 * work, and no request ID came back. The caller must persist `submit_unknown`
 * and never automatically resubmit (C23).
 */
export class FalSubmitUnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FalSubmitUnknownError";
  }
}

/**
 * fal confirmed the request ID, but its completion could not be determined
 * (poll/result failures or the end-to-end budget elapsing). The paid render
 * may still be running, so this is terminal-unknown, not a retryable failure.
 */
export class FalEnqueuedError extends Error {
  constructor(
    readonly requestId: string,
    message: string,
  ) {
    super(message);
    this.name = "FalEnqueuedError";
  }
}

/** Errors whose outcome is undetermined — persisted as submit_unknown. */
export const isFalUnknownOutcome = (error: unknown): boolean =>
  error instanceof FalSubmitUnknownError || error instanceof FalEnqueuedError;

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

const falKeyOrThrow = (): string => {
  const credentials = env.falKey();
  if (!credentials) {
    throw new CreativeUnconfiguredError("fal");
  }
  return credentials;
};

const falQueue = (): FalQueueReader => {
  singleton ??= createFalClient({ credentials: falKeyOrThrow() });
  return singleton.queue;
};

const videoUrlOf = (data: unknown): string | undefined => {
  const video = asRecord(asRecord(data)?.["video"]);
  const url = video?.["url"];
  return typeof url === "string" && url.length > 0 ? url : undefined;
};

/**
 * One un-retried submit POST. A definitive rejection (any HTTP response
 * without a request ID) is a FalRequestError; a transport error or timeout,
 * where fal may have accepted the work, is a FalSubmitUnknownError.
 */
const submitZapRequest = async (
  request: FalGenerationRequest,
  submit: typeof fetch,
  deadline: number,
): Promise<string> => {
  const credentials = falKeyOrThrow();
  // Lifecycle persistence may have consumed the budget since the permit
  // check; an expired budget must never dispatch a paid POST, and a locally
  // expired pre-submit budget is a capacity failure, not an ambiguous
  // provider outcome.
  if (Date.now() >= deadline) {
    throw new GmiCapacityError();
  }
  let response: Response;
  try {
    response = await submit(`${FAL_QUEUE_BASE_URL}/${request.model}`, {
      method: "POST",
      headers: {
        Authorization: `Key ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(request.input),
      signal: budgetSignal(deadline, SUBMIT_TIMEOUT_MS),
    });
  } catch {
    throw new FalSubmitUnknownError(
      "fal submit outcome is unknown (no response)",
    );
  }
  if (!response.ok) {
    throw new FalRequestError(`fal rejected the request (${response.status})`);
  }
  const body: unknown = await response.json().catch(() => undefined);
  const requestId = asRecord(body)?.["request_id"];
  if (typeof requestId !== "string" || requestId.length === 0) {
    throw new FalSubmitUnknownError("fal accepted without a request_id");
  }
  return requestId;
};

const wait = async (milliseconds: number): Promise<void> =>
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/** A signal bounded by the remaining end-to-end budget (and an optional cap). */
const budgetSignal = (deadline: number, capMs = Infinity): AbortSignal =>
  AbortSignal.timeout(Math.max(1, Math.min(capMs, deadline - Date.now())));

/**
 * The fal SDK's internal retry backoff sleeps are not abortable, so an
 * abort signal alone cannot stop a queue read from holding the creative
 * permit past the budget. Racing the read against the deadline caps the
 * hold; the abandoned read's own signal still fires so it dies quietly.
 */
const raceDeadline = async <T>(
  deadline: number,
  work: Promise<T>,
): Promise<T> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const cutoff = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error("fal queue read exceeded the generation budget")),
      Math.max(1, deadline - Date.now()),
    );
  });
  try {
    return await Promise.race([work, cutoff]);
  } finally {
    clearTimeout(timer);
    work.catch(() => undefined);
  }
};

const httpStatusOf = (error: unknown): number | undefined => {
  const status = asRecord(error)?.["status"];
  return typeof status === "number" ? status : undefined;
};

/**
 * Statuses that say nothing about the render itself — the read may succeed
 * later, so the enqueued render's outcome stays unknown, never retryable.
 */
const TRANSIENT_RESULT_STATUSES = new Set([408, 425, 429]);

/**
 * Result reads are safe to repeat (the SDK retries them). A definitive 4xx
 * here is the provider's verdict on the finished job — moderation, invalid
 * input — so it fails the job; anything else leaves the enqueued render's
 * outcome unknown.
 */
const resultOrThrow = async (
  queue: FalQueueReader,
  model: string,
  requestId: string,
  deadline: number,
): Promise<unknown> => {
  try {
    return (
      await raceDeadline(
        deadline,
        queue.result(model, {
          requestId,
          abortSignal: budgetSignal(deadline),
        }),
      )
    ).data;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "fal result lookup failed";
    const status = httpStatusOf(error);
    if (
      status !== undefined &&
      status >= 400 &&
      status < 500 &&
      !TRANSIENT_RESULT_STATUSES.has(status)
    ) {
      // Provider messages carry moderation/safety reasons, but never a
      // payload, a prompt, or a credential.
      throw new FalRequestError(message);
    }
    throw new FalEnqueuedError(requestId, message);
  }
};

/** Submits one /zap render and returns the queue's finished video artifact. */
export async function generateZapVideo(
  plan: RouterPlan,
  turn: CreativeTurn,
  timeoutMs: number,
  options?: FalGenerationOptions,
): Promise<GeneratedMedia> {
  const request = buildFalZapRequest(plan, turn);
  const deadline = Date.now() + timeoutMs;
  // Paid renders share the provider-neutral creative concurrency permit.
  return await withCreativeSlot(
    async () => {
      // A permit granted at the wire buys nothing: an expired budget must not
      // submit a paid render.
      if (Date.now() >= deadline) {
        throw new GmiCapacityError();
      }
      return await runZapRequest(request, deadline, options);
    },
    Math.max(1, deadline - Date.now()),
  );
}

const runZapRequest = async (
  request: FalGenerationRequest,
  deadline: number,
  options?: FalGenerationOptions,
): Promise<GeneratedMedia> => {
  const queue = options?.queue ?? falQueue();
  const submit = options?.submit ?? fetch;
  // Every emit is awaited in order, so no lifecycle write can land after
  // this function returns and overwrite a terminal creative_jobs status.
  const emit = async (event: GmiLifecycleEvent): Promise<void> => {
    await options?.onLifecycle?.(event);
  };
  await emit({ stage: "submitting", kind: "video", model: request.model });

  const requestId = await submitZapRequest(request, submit, deadline);
  await emit({
    stage: "submitted",
    kind: "video",
    model: request.model,
    requestId,
  });

  let inProgress = false;
  try {
    for (;;) {
      const status = await raceDeadline(
        deadline,
        queue.status(request.model, {
          requestId,
          abortSignal: budgetSignal(deadline),
        }),
      );
      if (status.status === "COMPLETED") {
        break;
      }
      if (status.status === "IN_PROGRESS" && !inProgress) {
        inProgress = true;
        await emit({
          stage: "polling",
          kind: "video",
          model: request.model,
          requestId,
        });
      }
      if (Date.now() + POLL_INTERVAL_MS >= deadline) {
        throw new FalEnqueuedError(
          requestId,
          "fal render did not finish within the generation budget",
        );
      }
      await wait(POLL_INTERVAL_MS);
    }
  } catch (error) {
    if (error instanceof FalEnqueuedError) {
      throw error;
    }
    // One last result lookup before declaring the enqueued render's outcome
    // unknown — the poll failure may be transient while the job finished.
    const data = await resultOrThrow(queue, request.model, requestId, deadline);
    return await finishZapRequest(data, request, requestId, emit);
  }

  const data = await resultOrThrow(queue, request.model, requestId, deadline);
  return await finishZapRequest(data, request, requestId, emit);
};

const finishZapRequest = async (
  data: unknown,
  request: FalGenerationRequest,
  requestId: string,
  emit: (event: GmiLifecycleEvent) => Promise<void>,
): Promise<GeneratedMedia> => {
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
    requestId,
  });
  return media;
};
