/**
 * fal.ai lip-sync for the digital twin: the approved profile image plus a
 * speech clip → a talking video, on MiniMax H3 Max's lip-sync
 * image-to-video endpoint. The request is built here (pure, testable) and
 * run through lib/creative/fal.ts's shared queue driver, so it inherits the
 * un-retried submit, SDK polling, the creative concurrency permit and the
 * C23 unknown-outcome discipline. The endpoint id is env-overridable
 * (FAL_TWIN_LIPSYNC_MODEL); the input shape below follows the provider's
 * documented schema — re-verify on fal's model page before changing it.
 *
 * Audio reaches fal as WAV: the H3 Max family's audio loader only reads
 * WAV/MP3 reliably, so every clip is normalised through fal's ffmpeg
 * loudnorm endpoint first (the same step /zap applies to reference audio).
 */
import type { GeneratedMedia } from "../creative/gmi";
import {
  runFalVideoRequest,
  wavAudioUrl,
  type FalGenerationOptions,
  type FalGenerationRequest,
} from "../creative/fal";
import { env } from "../env";

export const falTwinLipsyncModel = (): string => env.falTwinLipsyncModel();

export type LipsyncResolution = "768P" | "1080P";
export const DEFAULT_LIPSYNC_RESOLUTION: LipsyncResolution = "768P";

export interface TwinLipsyncInput {
  /** Short-TTL signed URL of the approved profile image. */
  imageUrl: string;
  /** Short-TTL signed URL of the speech clip (mp3/wav/m4a). */
  audioUrl: string;
  resolution?: LipsyncResolution | undefined;
}

/** Pure input builder, kept separate from queue I/O for deterministic tests. */
export function buildTwinLipsyncRequest(
  input: TwinLipsyncInput,
): FalGenerationRequest {
  return {
    kind: "video",
    model: falTwinLipsyncModel(),
    input: {
      resolution: input.resolution ?? DEFAULT_LIPSYNC_RESOLUTION,
      enable_transcription: true,
      enable_safety_checker: true,
      image_url: input.imageUrl,
      audio_url: input.audioUrl,
    },
  };
}

export interface TwinLipsyncOptions extends FalGenerationOptions {
  /** Skip the WAV normalisation (the clip is already WAV/MP3 on fal storage). */
  skipTranscode?: boolean | undefined;
}

/** Submits one twin lip-sync render and returns the finished video artifact. */
export async function generateTwinLipsync(
  input: TwinLipsyncInput,
  timeoutMs: number,
  options?: TwinLipsyncOptions,
): Promise<GeneratedMedia> {
  const deadline = Date.now() + timeoutMs;
  const audioUrl = options?.skipTranscode
    ? input.audioUrl
    : await wavAudioUrl(input.audioUrl, deadline, options?.transcode);
  const request = buildTwinLipsyncRequest({ ...input, audioUrl });
  return await runFalVideoRequest(
    request,
    Math.max(1, deadline - Date.now()),
    options,
  );
}
