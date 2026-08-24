/**
 * HeyGen Avatar IV digital twin, driven through the existing GMI request
 * queue (no net-new provider client). digital_twins rows carry lifecycle
 * metadata only — the consent recording and the delivered talking-head
 * video live as private assets, never in shared Postgres (C4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset } from "../assets/pipeline";
import {
  buildHeygenAvatarRequest,
  DEFAULT_GENERATION_TIMEOUT_MS,
  generateCompiledRequest,
  GmiCapacityError,
  GmiJobError,
  GmiTimeoutError,
  isAmbiguousSubmission,
  isModerationFailure,
  resumeGeneration,
  type GeneratedMedia,
  type GmiLifecycleEvent,
} from "../creative/gmi";
import {
  createCreativeJob,
  DAILY_LIMIT_LINE,
  insertRenderCostEvent,
  underDailyLimit,
  updateCreativeJob,
} from "../creative/jobs";
import { fetchSafeGeneratedMedia } from "../creative/media-url";
import {
  BUSY_LINE,
  FAILED_LINE,
  REFUSAL_LINE,
  SUBMIT_UNKNOWN_LINE,
} from "../creative/run";
import {
  ingestGeneratedMedia,
  ingestUploadedMedia,
  mintJobDelivery,
} from "../creative/store";
import { guardMediaUpload, MediaGuardError } from "../storage/guard";
import { createHeygenPhotoAvatar } from "./heygen";

export type DigitalTwinStatus =
  | "avatar_only"
  | "consented"
  | "creating"
  | "ready"
  | "failed";

export interface DigitalTwin {
  id: string;
  user_id: string;
  provider: string;
  provider_twin_id: string | null;
  provider_avatar_id: string | null;
  provider_group_id: string | null;
  provider_voice_id: string | null;
  consent_video_key: string | null;
  video_asset_id: string | null;
  status: DigitalTwinStatus;
  created_at: string;
  updated_at: string;
}

export const CONSENT_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
export const CONSENT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export async function getDigitalTwin(
  supabase: SupabaseClient,
  userId: string
): Promise<DigitalTwin | null> {
  const { data } = await supabase
    .from("digital_twins")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return (data as DigitalTwin | null) ?? null;
}

async function upsertTwin(
  supabase: SupabaseClient,
  userId: string,
  patch: Partial<
    Pick<
      DigitalTwin,
      | "provider_twin_id"
      | "provider_avatar_id"
      | "provider_group_id"
      | "provider_voice_id"
      | "consent_video_key"
      | "video_asset_id"
      | "status"
    >
  >
): Promise<boolean> {
  const { error } = await supabase.from("digital_twins").upsert(
    {
      user_id: userId,
      provider: "heygen",
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: "user_id" }
  );
  return !error;
}

/**
 * Store the owner's consent recording through the same guarded private
 * upload path as identity images and record the consent on the twin row.
 */
export async function uploadTwinConsent(
  supabase: SupabaseClient,
  userId: string,
  file: File
): Promise<{ ok: true } | { ok: false; error: string }> {
  const contentType = file.type.toLowerCase();
  if (!CONSENT_VIDEO_TYPES.has(contentType)) {
    return { ok: false, error: "consent recording must be an mp4 or webm video." };
  }
  let bytes: Buffer;
  try {
    bytes = guardMediaUpload(Buffer.from(await file.arrayBuffer()), contentType, {
      maxBytes: CONSENT_VIDEO_MAX_BYTES,
    });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof MediaGuardError
          ? error.message
          : "that upload didn't pass validation.",
    };
  }
  try {
    const asset = await ingestUploadedMedia(supabase, userId, bytes, contentType);
    const stored = await upsertTwin(supabase, userId, {
      consent_video_key: asset.storage_key,
      status: "consented",
    });
    if (!stored) return { ok: false, error: "couldn't record consent — try again." };
    return { ok: true };
  } catch {
    return { ok: false, error: "upload failed — try again in a minute." };
  }
}

/**
 * Mint a HeyGen avatar ID (photo look) from an identity image and persist
 * it on the user's twin row — the preferred avatar path when HeyGen is
 * configured. Optional: rendering falls back to the raw photo through GMI.
 */
export async function createUserHeygenAvatar(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  imageUrl: string
): Promise<{ ok: true; avatarId: string } | { ok: false; error: string }> {
  const result = await createHeygenPhotoAvatar({
    name: `@${username}`,
    imageUrl,
  });
  if (!result.ok) return result;
  const stored = await upsertTwin(supabase, userId, {
    provider_avatar_id: result.identity.avatarId,
    provider_group_id: result.identity.groupId,
    provider_voice_id: result.identity.voiceId,
  });
  if (!stored) {
    return { ok: false, error: "Couldn't save the avatar — try again." };
  }
  return { ok: true, avatarId: result.identity.avatarId };
}

export interface TwinRenderResult {
  ok: boolean;
  notice: string;
  asset?: CreativeAsset;
  deliveryUrl?: string;
}

/**
 * Render the talking-head twin video: metered like every video job (daily
 * cap before submission, video cost event on delivery), delivered through
 * the same validated-download → private asset → signed URL pipeline.
 */
export async function createTwinVideo(
  supabase: SupabaseClient,
  userId: string,
  opts: { avatarImageUrl: string; script: string }
): Promise<TwinRenderResult> {
  // Prefer the user's trained HeyGen avatar ID (with its cloned/default
  // voice) when one exists; otherwise render straight from the photo.
  const twin = await getDigitalTwin(supabase, userId).catch(() => null);
  const job = await createCreativeJob(supabase, userId, "web", "video_render");
  const fail = async (
    status: "failed" | "refused" | "submit_unknown",
    line: string
  ): Promise<TwinRenderResult> => {
    await updateCreativeJob(supabase, job.id, { status, error: line });
    await upsertTwin(supabase, userId, { status: "failed" });
    return { ok: false, notice: line };
  };

  try {
    if (!(await underDailyLimit(supabase, userId))) {
      return await fail("failed", DAILY_LIMIT_LINE);
    }
  } catch {
    return await fail("failed", FAILED_LINE);
  }

  await upsertTwin(supabase, userId, { status: "creating" });
  const request = buildHeygenAvatarRequest({
    ...(twin?.provider_avatar_id
      ? { avatarId: twin.provider_avatar_id }
      : { avatarImageUrl: opts.avatarImageUrl }),
    script: opts.script,
    ...(twin?.provider_voice_id ? { voiceId: twin.provider_voice_id } : {}),
  });
  let providerTwinId: string | null = null;
  const onLifecycle = async (event: GmiLifecycleEvent): Promise<void> => {
    if (event.stage === "submitted" || event.stage === "polling") {
      if (event.requestId) providerTwinId = event.requestId;
      await updateCreativeJob(supabase, job.id, {
        status: event.stage === "submitted" ? "submitted" : "polling",
        ...(event.requestId ? { provider_request_id: event.requestId } : {}),
      });
    }
  };

  let media: GeneratedMedia;
  try {
    media = await generateCompiledRequest(request, DEFAULT_GENERATION_TIMEOUT_MS, {
      onLifecycle,
    });
  } catch (error) {
    if (error instanceof GmiTimeoutError) {
      try {
        media = await resumeGeneration(error, DEFAULT_GENERATION_TIMEOUT_MS, {
          onLifecycle,
        });
      } catch {
        return await fail("failed", FAILED_LINE);
      }
    } else if (error instanceof GmiCapacityError) {
      return await fail("failed", BUSY_LINE);
    } else if (error instanceof GmiJobError && isModerationFailure(error)) {
      return await fail("refused", REFUSAL_LINE);
    } else if (isAmbiguousSubmission(error)) {
      return await fail("submit_unknown", SUBMIT_UNKNOWN_LINE);
    } else {
      return await fail("failed", FAILED_LINE);
    }
  }

  try {
    const fetched = await fetchSafeGeneratedMedia(media.url, media.kind);
    const asset = await ingestGeneratedMedia(supabase, userId, fetched);
    const delivery = await mintJobDelivery(supabase, asset, job.id);
    await updateCreativeJob(supabase, job.id, {
      status: "delivered",
      delivered_at: new Date().toISOString(),
    });
    await insertRenderCostEvent(supabase, userId, job.id, "video");
    await upsertTwin(supabase, userId, {
      status: "ready",
      video_asset_id: asset.id,
      ...(providerTwinId ? { provider_twin_id: providerTwinId } : {}),
    });
    return {
      ok: true,
      notice: "digital twin video ready.",
      asset,
      deliveryUrl: delivery.url,
    };
  } catch {
    return await fail("failed", FAILED_LINE);
  }
}
