/**
 * GMI Cloud request-queue client, ported from outsideairworker src/gmi.ts.
 * Submit → poll (2s) with a 420s end-to-end budget, a global concurrency
 * semaphore (CREATIVE_MAX_CONCURRENCY, clamp 1–4), and the C23 discipline:
 * an ambiguous submission is never blindly resubmitted — only a known
 * request ID may be resumed, by polling.
 *
 * Model IDs and payload shapes are pinned by the provider — keep them
 * verbatim (REQUIRED_GMI_MODEL_PARAMETERS in preflight.ts).
 */
import { env } from "../env";
import { asRecord as toRecord } from "../records";
import { CreativeUnconfiguredError } from "./groq";
import { assertSafeGeneratedMediaUrl, generatedMediaHosts } from "./media-url";
import { DEFAULT_LANE_MODELS, type CreativePrefs } from "./model-prefs";
import type { RouterPlan } from "./schema";

const POLL_INTERVAL_MS = 2_000;
/**
 * End-to-end time allowed for one submitted image or video job. This is
 * deliberately independent from routing deadlines: both submission and media
 * generation may legitimately take several minutes.
 */
export const DEFAULT_GENERATION_TIMEOUT_MS = 420_000;
const REQUEST_TIMEOUT_MS = 20_000;
const PENDING_STATUSES = new Set([
  "created",
  "queued",
  "dispatched",
  "processing",
]);

export interface MediaInput {
  kind: "image" | "video";
  url: string;
  mimeType?: string;
  durationSeconds?: number;
}

export interface CreativeTurn {
  text: string;
  mediaInputs: readonly MediaInput[];
}

export interface GeneratedMedia {
  kind: "image" | "video";
  url: string;
}

type GmiPayload = Record<string, unknown>;

interface GmiWaiter {
  resolve: () => void;
  timeout: ReturnType<typeof setTimeout>;
}

let activeGmiGenerations = 0;
const gmiWaiters: GmiWaiter[] = [];

export class GmiCapacityError extends Error {
  constructor() {
    super("GMI is at its concurrent-work limit");
    this.name = "GmiCapacityError";
  }
}

const acquireGmiSlot = async (timeoutMs: number): Promise<void> => {
  if (activeGmiGenerations < env.creativeMaxConcurrency()) {
    activeGmiGenerations += 1;
    return;
  }
  await new Promise<void>((resolve, reject) => {
    const waiter: GmiWaiter = {
      resolve: () => {
        clearTimeout(waiter.timeout);
        resolve();
      },
      timeout: setTimeout(() => {
        const index = gmiWaiters.indexOf(waiter);
        if (index >= 0) {
          gmiWaiters.splice(index, 1);
          reject(new GmiCapacityError());
        }
      }, timeoutMs),
    };
    gmiWaiters.push(waiter);
  });
};

const releaseGmiSlot = (): void => {
  const next = gmiWaiters.shift();
  if (next) {
    // Hand the existing permit to the next waiter without a race that could
    // briefly admit more work than the configured global concurrency.
    next.resolve();
    return;
  }
  activeGmiGenerations -= 1;
};

const withGmiSlot = async <T>(
  task: () => Promise<T>,
  timeoutMs: number,
): Promise<T> => {
  await acquireGmiSlot(timeoutMs);
  try {
    return await task();
  } finally {
    releaseGmiSlot();
  }
};

export interface GmiGenerationRequest {
  kind: GeneratedMedia["kind"];
  model: string;
  payload: GmiPayload;
}

export type GmiLifecycleStage =
  "artifact_ready" | "polling" | "submitted" | "submitting";

/**
 * Metadata-only generation progress. Deliberately excludes prompts, payloads,
 * input URLs, and generated artifact URLs so persistence and diagnostics can
 * safely observe the provider lifecycle (C4).
 */
export interface GmiLifecycleEvent {
  stage: GmiLifecycleStage;
  kind: GeneratedMedia["kind"];
  model?: string;
  requestId?: string;
}

export interface GmiGenerationOptions {
  onLifecycle?: (event: GmiLifecycleEvent) => Promise<void> | void;
  /** Personal GMI key (Settings) — the user's own token spend. Falls back
   * to the platform key when absent. Never logged, never persisted. */
  apiKey?: string;
}

export type GmiRequestStage = "decode" | "poll" | "submit";

export interface GmiRequestFailure {
  stage: GmiRequestStage;
  status?: number;
  timedOut?: boolean;
}

export class GmiRequestError extends Error {
  readonly stage: GmiRequestStage;
  readonly status?: number | undefined;
  readonly timedOut: boolean;

  constructor(message: string, failure: GmiRequestFailure) {
    super(message);
    this.name = "GmiRequestError";
    this.stage = failure.stage;
    this.status = failure.status;
    this.timedOut = failure.timedOut ?? false;
  }
}

export class GmiJobError extends Error {
  constructor(
    readonly jobStatus: "cancelled" | "failed",
    message: string,
  ) {
    super(message);
    this.name = "GmiJobError";
  }
}

export class GmiTimeoutError extends Error {
  constructor(
    readonly requestId: string,
    readonly mediaKind: GeneratedMedia["kind"],
  ) {
    super("GMI request timed out");
    this.name = "GmiTimeoutError";
  }
}

/**
 * The submission's outcome is unknown: the request may or may not have been
 * accepted upstream, and no request ID came back. The caller must persist
 * `submit_unknown` and never automatically resubmit (C23).
 */
export const isAmbiguousSubmission = (error: unknown): boolean =>
  error instanceof GmiRequestError &&
  error.stage === "submit" &&
  (error.timedOut || error.status === undefined);

const asRecord = (value: unknown): Record<string, unknown> | undefined =>
  toRecord(value) ?? undefined;

const stringField = (
  value: Record<string, unknown> | undefined,
  key: string,
): string | undefined => {
  const candidate = value?.[key];
  return typeof candidate === "string" && candidate.length > 0
    ? candidate
    : undefined;
};

const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(max, value));

const imageSizeFor = (ratio: RouterPlan["params"]["aspect_ratio"]): string => {
  if (["9:16", "3:4"].includes(ratio)) {
    return "1024x1536";
  }
  if (["16:9", "4:3", "21:9"].includes(ratio)) {
    return "1536x1024";
  }
  return "1024x1024";
};

const qualityFor = (quality: RouterPlan["params"]["quality"]): string =>
  quality === "auto" ? "medium" : quality;

const seedanceRatioFor = (
  ratio: RouterPlan["params"]["aspect_ratio"],
): string => (ratio === "auto" ? "16:9" : ratio);

const zapAspectRatioFor = (
  ratio: RouterPlan["params"]["aspect_ratio"],
): "16:9" | "9:16" | "auto" =>
  ratio === "16:9" || ratio === "9:16" ? ratio : "auto";

/** Pure payload builder, kept separate from queue I/O for deterministic tests. */
export function buildGenerationRequest(
  plan: RouterPlan,
  turn: CreativeTurn,
  prefs?: CreativePrefs,
): GmiGenerationRequest {
  const models = prefs ?? DEFAULT_LANE_MODELS;
  const prompt = plan.expanded_prompt;
  const imageInputs = turn.mediaInputs.filter(
    (media) => media.kind === "image",
  );
  const videoInputs = turn.mediaInputs.filter(
    (media) => media.kind === "video",
  );

  if (plan.mode === "imagine") {
    const size = imageSizeFor(plan.params.aspect_ratio);
    const quality = qualityFor(plan.params.quality);
    const editSource = imageInputs[0];
    if (editSource) {
      // Each edit model advertises a different schema (GMI model details):
      // reve takes `reference_image`, Gemini flash image takes `image`, and
      // gpt-image-2-edit takes the full image/size/quality shape.
      const model = models.edit;
      if (model === "reve-edit-20250915") {
        return {
          kind: "image",
          model,
          payload: { prompt, reference_image: editSource.url },
        };
      }
      if (model === "gemini-3.1-flash-image") {
        return {
          kind: "image",
          model,
          payload: { prompt, image: editSource.url },
        };
      }
      return {
        kind: "image",
        model,
        payload: { prompt, image: editSource.url, size, quality, n: 1 },
      };
    }
    const model = models.imagine;
    if (model === "Flux2-Dev") {
      const [width, height] = size.split("x").map(Number);
      return { kind: "image", model, payload: { prompt, width, height } };
    }
    if (model === "seedream-4-0-250828") {
      return {
        kind: "image",
        model,
        payload: { prompt, size, watermark: false },
      };
    }
    return {
      kind: "image",
      model,
      payload: { prompt, size, quality, output_format: "png", n: 1 },
    };
  }

  if (plan.mode === "animate") {
    const duration = clamp(plan.params.duration ?? 8, 4, 15);
    const userRequestedSilence =
      /\b(?:silent|mute(?:d)?|without (?:sound|audio)|no (?:sound|audio))\b/i.test(
        turn.text,
      );
    const model = models.animate;
    // The brief requires audio by default. Only an explicit user request
    // for silence can override it; the router's boolean is advisory.
    const audio = !userRequestedSilence;
    // Non-seedance video models advertise different schemas (GMI model
    // details): LTX has no ratio/watermark, Happyhorse calls audio `audio`,
    // and MiniMax-H3 takes `first_frame_image` with no audio flag.
    if (model === "ltx-2-fast-text-to-video") {
      return {
        kind: "video",
        model,
        payload: {
          prompt,
          duration,
          resolution: "720p",
          generate_audio: audio,
        },
      };
    }
    if (model === "happyhorse-1.1-t2v") {
      return {
        kind: "video",
        model,
        payload: {
          prompt,
          duration,
          resolution: "720p",
          audio,
          watermark: false,
        },
      };
    }
    if (model === "MiniMax-H3") {
      return {
        kind: "video",
        model,
        payload: {
          prompt,
          duration,
          resolution: "720p",
          ratio: seedanceRatioFor(plan.params.aspect_ratio),
          ...(imageInputs[0] ? { first_frame_image: imageInputs[0].url } : {}),
        },
      };
    }
    return {
      kind: "video",
      model,
      payload: {
        prompt,
        duration,
        resolution: "720p",
        ratio: seedanceRatioFor(plan.params.aspect_ratio),
        generate_audio: audio,
        watermark: false,
        ...(imageInputs[0] ? { first_frame: imageInputs[0].url } : {}),
      },
    };
  }

  if (plan.mode === "zap") {
    const hasVideo = videoInputs.length > 0;
    return {
      kind: "video",
      model: models.zap,
      payload: {
        prompt,
        ...(imageInputs.length > 0
          ? {
              reference_image: imageInputs
                .slice(0, 5)
                .map((media) => media.url),
            }
          : {}),
        ...(hasVideo
          ? { video: videoInputs.slice(0, 3).map((media) => media.url) }
          : {}),
        durationSeconds: hasVideo
          ? "auto"
          : plan.params.duration === null
            ? "auto"
            : clamp(plan.params.duration, 3, 10),
        aspectRatio: zapAspectRatioFor(plan.params.aspect_ratio),
        resolution: "720p",
      },
    };
  }

  throw new Error(`Cannot generate media for router mode "${plan.mode}"`);
}

export type HeygenAvatarOptions = {
  script: string;
  voiceId?: string;
  dimension?: { width: number; height: number };
  durationSeconds?: number;
} & (
  | { avatarId: string; avatarImageUrl?: undefined }
  | { avatarId?: undefined; avatarImageUrl: string }
);

/**
 * Pure request builder for the HeyGen Avatar IV talking-head model. The
 * queue advertises exactly `video_inputs` (required), `dimension`, and
 * `duration` (verified against GMI's model-details endpoint); each segment
 * carries a character — a trained HeyGen avatar ID when the user has one,
 * otherwise a direct photo — and a text-to-speech voice per HeyGen's
 * /v2/video/generate contract.
 */
export function buildHeygenAvatarRequest(
  opts: HeygenAvatarOptions,
): GmiGenerationRequest {
  return {
    kind: "video",
    model: "heygen-avatar-v4",
    payload: {
      video_inputs: [
        {
          character: opts.avatarId
            ? { type: "avatar", avatar_id: opts.avatarId }
            : { type: "photo", image_url: opts.avatarImageUrl },
          voice: {
            type: "text",
            input_text: opts.script,
            ...(opts.voiceId ? { voice_id: opts.voiceId } : {}),
          },
        },
      ],
      dimension: opts.dimension ?? { width: 1280, height: 720 },
      ...(opts.durationSeconds ? { duration: opts.durationSeconds } : {}),
    },
  };
}

export async function generateCompiledRequest(
  request: GmiGenerationRequest,
  timeoutMs = DEFAULT_GENERATION_TIMEOUT_MS,
  options?: GmiGenerationOptions,
): Promise<GeneratedMedia> {
  const deadline = Date.now() + timeoutMs;
  return await withGmiSlot(
    async () => {
      if (Date.now() >= deadline) {
        throw new GmiCapacityError();
      }
      await emitLifecycle(options, {
        stage: "submitting",
        kind: request.kind,
        model: request.model,
      });
      const submitBudgetMs = deadline - Date.now();
      if (submitBudgetMs <= 0) {
        throw new GmiRequestError("GMI request timed out", {
          stage: "submit",
          timedOut: true,
        });
      }
      const response = await fetchQueueJson(
        env.gmiRequestQueueUrl(),
        {
          method: "POST",
          headers: queueHeaders(options?.apiKey),
          body: JSON.stringify({
            model: request.model,
            payload: request.payload,
          }),
        },
        submitBudgetMs,
        "submit",
      );

      const status = statusFor(response);
      const requestId = requestIdFor(response);
      await emitLifecycle(options, {
        stage: "submitted",
        kind: request.kind,
        model: request.model,
        ...(requestId ? { requestId } : {}),
      });
      if (status === "success") {
        const url = extractMediaUrl(response);
        if (url) {
          const media = {
            url: assertSafeGeneratedMediaUrl(url, generatedMediaHosts()),
            kind: request.kind,
          };
          await emitLifecycle(options, {
            stage: "artifact_ready",
            kind: request.kind,
            model: request.model,
            ...(requestId ? { requestId } : {}),
          });
          return media;
        }
      }
      if (status === "failed" || status === "cancelled") {
        throw new GmiJobError(status, errorMessageFor(response));
      }

      if (!requestId) {
        // The caller must mark this submission ambiguous. A retry must never
        // blindly pay for a duplicate request when the provider gave no ID.
        throw new GmiRequestError("GMI submit response is missing request_id", {
          stage: "submit",
        });
      }
      return await poll(
        requestId,
        request.kind,
        deadline,
        options,
        request.model,
      );
    },
    Math.max(1, deadline - Date.now()),
  );
}

/** Normalizes the image and video models' different successful outcome shapes. */
export function extractMediaUrl(response: unknown): string | undefined {
  const outcome = asRecord(asRecord(response)?.outcome);
  const direct = stringField(outcome, "video_url");
  if (direct) {
    return direct;
  }
  const mediaUrls = outcome?.media_urls;
  if (!Array.isArray(mediaUrls)) {
    return undefined;
  }
  for (const item of mediaUrls) {
    const url = stringField(asRecord(item), "url");
    if (url) {
      return url;
    }
  }
  return undefined;
}

const statusFor = (response: unknown): string | undefined => {
  const status = stringField(asRecord(response), "status");
  return status?.toLowerCase();
};

const requestIdFor = (response: unknown): string | undefined =>
  stringField(asRecord(response), "request_id");

const errorMessageFor = (response: unknown): string => {
  const record = asRecord(response);
  const outcome = asRecord(record?.outcome);
  return (
    stringField(record, "message") ??
    stringField(record, "error") ??
    stringField(outcome, "message") ??
    "GMI generation failed"
  );
};

const wait = async (milliseconds: number): Promise<void> =>
  await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

const emitLifecycle = async (
  options: GmiGenerationOptions | undefined,
  event: GmiLifecycleEvent,
): Promise<void> => {
  await options?.onLifecycle?.(event);
};

const isTransientPollFailure = (error: unknown): boolean =>
  error instanceof TypeError ||
  (error instanceof GmiRequestError &&
    (error.status === undefined ||
      error.status === 408 ||
      error.status === 429 ||
      error.status >= 500));

const queueHeaders = (apiKeyOverride?: string): Record<string, string> => {
  const apiKey = apiKeyOverride ?? env.gmiCloudApiKey();
  if (!apiKey) {
    throw new CreativeUnconfiguredError("GMI");
  }
  // The platform organization header only applies to the platform key.
  const organizationId = apiKeyOverride ? null : env.gmiOrganizationId();
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    ...(organizationId ? { "X-Organization-ID": organizationId } : {}),
  };
};

const fetchQueueJson = async (
  url: string,
  init: RequestInit,
  timeoutMs = REQUEST_TIMEOUT_MS,
  stage: GmiRequestStage,
): Promise<unknown> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    // Queue responses are control-plane data, not a media CDN. Never follow a
    // redirect from a configurable queue URL with its bearer credential.
    const response = await fetch(url, {
      ...init,
      redirect: "error",
      signal: controller.signal,
    });
    if (!response.ok) {
      throw new GmiRequestError(`GMI request failed (${response.status})`, {
        stage,
        status: response.status,
      });
    }
    try {
      return await response.json();
    } catch {
      throw new GmiRequestError("GMI returned invalid JSON", {
        stage,
        status: response.status,
      });
    }
  } catch (error) {
    if (error instanceof GmiRequestError) {
      throw error;
    }
    if (controller.signal.aborted) {
      throw new GmiRequestError("GMI request timed out", {
        stage,
        timedOut: true,
      });
    }
    throw new GmiRequestError("GMI request could not be reached", { stage });
  } finally {
    clearTimeout(timeout);
  }
};

async function poll(
  requestId: string,
  mediaKind: GeneratedMedia["kind"],
  deadline: number,
  options?: GmiGenerationOptions,
  model?: string,
): Promise<GeneratedMedia> {
  let transientFailures = 0;

  await emitLifecycle(options, {
    stage: "polling",
    kind: mediaKind,
    requestId,
    ...(model ? { model } : {}),
  });

  while (Date.now() < deadline) {
    let response: unknown;
    try {
      response = await fetchQueueJson(
        `${env.gmiRequestQueueUrl()}/${encodeURIComponent(requestId)}`,
        { headers: queueHeaders(options?.apiKey) },
        Math.max(1, Math.min(REQUEST_TIMEOUT_MS, deadline - Date.now())),
        "poll",
      );
      transientFailures = 0;
    } catch (error) {
      if (Date.now() >= deadline) {
        throw new GmiTimeoutError(requestId, mediaKind);
      }
      if (isTransientPollFailure(error) && transientFailures < 3) {
        transientFailures += 1;
        const backoff = 500 * 2 ** (transientFailures - 1);
        await wait(Math.min(backoff, Math.max(1, deadline - Date.now())));
        continue;
      }
      throw error;
    }
    const status = statusFor(response);

    if (status === "success") {
      const url = extractMediaUrl(response);
      if (!url) {
        throw new GmiRequestError("GMI succeeded without a media URL", {
          stage: "decode",
        });
      }
      const media = {
        url: assertSafeGeneratedMediaUrl(url, generatedMediaHosts()),
        kind: mediaKind,
      };
      await emitLifecycle(options, {
        stage: "artifact_ready",
        kind: mediaKind,
        requestId,
        ...(model ? { model } : {}),
      });
      return media;
    }
    if (status === "failed" || status === "cancelled") {
      throw new GmiJobError(status, errorMessageFor(response));
    }
    if (!status || !PENDING_STATUSES.has(status)) {
      throw new GmiRequestError(
        `Unexpected GMI request status: ${status ?? "missing"}`,
        { stage: "poll" },
      );
    }
    await wait(Math.min(POLL_INTERVAL_MS, Math.max(1, deadline - Date.now())));
  }

  throw new GmiTimeoutError(requestId, mediaKind);
}

export async function generate(
  plan: RouterPlan,
  turn: CreativeTurn,
  timeoutMs = DEFAULT_GENERATION_TIMEOUT_MS,
  options?: GmiGenerationOptions,
  prefs?: CreativePrefs,
): Promise<GeneratedMedia> {
  return await generateCompiledRequest(
    buildGenerationRequest(plan, turn, prefs),
    timeoutMs,
    options,
  );
}

/**
 * Resume a known queue job by polling only — never by resubmitting (C23).
 */
export async function resumeGeneration(
  error: GmiTimeoutError,
  timeoutMs = DEFAULT_GENERATION_TIMEOUT_MS,
  options?: GmiGenerationOptions,
): Promise<GeneratedMedia> {
  const deadline = Date.now() + timeoutMs;
  return await withGmiSlot(
    async () => await poll(error.requestId, error.mediaKind, deadline, options),
    Math.max(1, deadline - Date.now()),
  );
}

export const isModerationFailure = (error: unknown): boolean =>
  error instanceof Error &&
  /moderation|policy|safety|content[- ]policy/i.test(error.message);
