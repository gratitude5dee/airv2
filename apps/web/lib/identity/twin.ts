/**
 * Digital twin operations (onboarding.md §4.5–4.8, §11). Two render paths
 * share one row:
 *
 *   speech video  — ElevenLabs speaks the script in the owner's cloned
 *                   voice → fal MiniMax H3 Max lip-sync animates the approved
 *                   profile image (createTwinSpeechVideo, /twin say)
 *   identity image — GPT Image 2 edit anchored on the profile image
 *                   (createTwinImage, /twin <brief>)
 *
 * plus the optional video-avatar preview the owner enables in onboarding
 * and the legacy HeyGen talking head (createTwinVideo) kept for accounts
 * that trained a HeyGen look. Every path is metered like any creative job
 * (daily cap, cost event), consent-gated server-side, delivered through the
 * validated-download → private asset → signed URL pipeline, and recorded in
 * identity_reference_uses. digital_twins rows carry lifecycle metadata only
 * — media and prompts never land in shared Postgres (C4).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset } from "../assets/pipeline";
import { env } from "../env";
import {
  FalRequestError,
  isFalUnknownOutcome,
} from "../creative/fal";
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
import { CreativeUnconfiguredError } from "../creative/groq";
import {
  createCreativeJob,
  DAILY_LIMIT_LINE,
  insertRenderCostEvent,
  underDailyLimit,
  updateCreativeJob,
  type CreativeChannel,
  type TwinJobKind,
} from "../creative/jobs";
import { fetchSafeGeneratedMedia } from "../creative/media-url";
import type { CreativeCommandTurn } from "../creative/router";
import {
  BUSY_LINE,
  executeCreativeJob,
  FAILED_LINE,
  REFUSAL_LINE,
  SUBMIT_UNKNOWN_LINE,
  UNCONFIGURED_LINE,
} from "../creative/run";
import {
  ingestGeneratedMedia,
  ingestUploadedMedia,
  mintJobDelivery,
} from "../creative/store";
import { guardMediaUpload, MediaGuardError } from "../storage/guard";
import {
  listIdentityAssets,
  signedIdentityUrl,
  tagIdentityAsset,
  type IdentityAssetView,
} from "./assets";
import { CONSENT_LINES, getConsent, type ConsentScope } from "./consent";
import { createHeygenPhotoAvatar } from "./heygen";
import {
  DEFAULT_LIPSYNC_RESOLUTION,
  falTwinLipsyncModel,
  generateTwinLipsync,
} from "./lipsync";
import { getDigitalTwin, patchTwin, type DigitalTwin, type TwinSharing } from "./twinRow";
import { elevenlabsAvailable } from "./voice";
import {
  listVoiceSamples,
  synthesizeTwinSpeech,
  VOICE_NOT_READY_LINE,
} from "./voiceClone";

export type {
  AvatarStatus,
  DigitalTwin,
  DigitalTwinStatus,
  TwinSharing,
  VoiceStatus,
} from "./twinRow";
export { getDigitalTwin } from "./twinRow";

export const CONSENT_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
export const CONSENT_VIDEO_MAX_BYTES = 50 * 1024 * 1024;

export const TWIN_PROFILE_IMAGE_NEEDED_LINE =
  "no approved profile image yet — finish the Photo Booth in onboarding.";
export const TWIN_SCRIPT_MAX_CHARS = 1_000;
export const TWIN_PROMPT_MAX_CHARS = 1_000;
export const TWIN_INTRO_LINE = (username: string): string =>
  `Hi, I'm @${username}'s digital twin. Ask me anything.`;

/** Speech video needs ElevenLabs (voice) and fal (lip-sync) configured. */
export const twinSpeechAvailable = (): boolean =>
  elevenlabsAvailable() && env.falKey() !== null;
/** The video avatar preview needs fal; the voice can come from a sample. */
export const twinAvatarAvailable = (): boolean => env.falKey() !== null;

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
    await tagIdentityAsset(supabase, userId, asset.id, "consent_recording", {
      source: "upload",
    });
    const stored = await patchTwin(supabase, userId, {
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
 * it on the user's twin row — the legacy trained-avatar path when HeyGen is
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
  const stored = await patchTwin(supabase, userId, {
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
 * Legacy talking-head twin video on the GMI queue (HeyGen Avatar IV):
 * metered like every video job, delivered through the same validated
 * download → private asset → signed URL pipeline.
 */
export async function createTwinVideo(
  supabase: SupabaseClient,
  userId: string,
  opts: { avatarImageUrl: string; script: string }
): Promise<TwinRenderResult> {
  const twin = await getDigitalTwin(supabase, userId).catch(() => null);
  const job = await createCreativeJob(supabase, userId, "web", "video_render");
  const fail = async (
    status: "failed" | "refused" | "submit_unknown",
    line: string
  ): Promise<TwinRenderResult> => {
    await updateCreativeJob(supabase, job.id, { status, error: line });
    await patchTwin(supabase, userId, { status: "failed" });
    return { ok: false, notice: line };
  };

  try {
    if (!(await underDailyLimit(supabase, userId))) {
      return await fail("failed", DAILY_LIMIT_LINE);
    }
  } catch {
    return await fail("failed", FAILED_LINE);
  }

  await patchTwin(supabase, userId, { status: "creating" });
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
    await patchTwin(supabase, userId, {
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

/* ────────────────────────────── /twin lane ─────────────────────────────── */

export type TwinJobStatus = "delivered" | "failed" | "refused" | "submit_unknown";

export interface TwinJobResult {
  ok: boolean;
  status: TwinJobStatus;
  /** Written user-facing line: the caption on success, the reason otherwise. */
  line: string;
  asset?: CreativeAsset | undefined;
  deliveryUrl?: string | undefined;
  kind?: "image" | "video" | undefined;
  jobId: string;
}

export interface TwinJobOptions {
  channel: CreativeChannel;
  /** Reuse a job the caller already created (the web lane returns its id first). */
  jobId?: string | undefined;
  /** Metadata-only timing hook — prompts, URLs and payloads never appear. */
  onLifecycle?: ((event: GmiLifecycleEvent) => Promise<void> | void) | undefined;
}

export interface ReferenceUseRow {
  ownerUserId: string;
  assetId: string | null;
  role: string;
  purpose: "image" | "video" | "speech";
}

/** Provenance: which identity assets (and whose) a job consumed. */
export async function recordReferenceUses(
  supabase: SupabaseClient,
  jobId: string,
  callerUserId: string,
  uses: readonly ReferenceUseRow[]
): Promise<void> {
  if (uses.length === 0) return;
  const { error } = await supabase.from("identity_reference_uses").insert(
    uses.map((use) => ({
      job_id: jobId,
      user_id: callerUserId,
      owner_user_id: use.ownerUserId,
      asset_id: use.assetId,
      role: use.role,
      purpose: use.purpose,
    }))
  );
  if (error) {
    console.error(
      JSON.stringify({
        msg: "identity reference use insert failed",
        user_id: callerUserId,
        job_id: jobId,
        error: error.message,
      })
    );
  }
}

async function ensureJob(
  supabase: SupabaseClient,
  userId: string,
  opts: TwinJobOptions,
  kind: TwinJobKind
): Promise<string> {
  if (opts.jobId) return opts.jobId;
  const job = await createCreativeJob(
    supabase,
    userId,
    opts.channel,
    "twin",
    undefined,
    undefined,
    { twinKind: kind }
  );
  return job.id;
}

async function missingConsentLine(
  supabase: SupabaseClient,
  userId: string,
  scopes: readonly ConsentScope[]
): Promise<{ line: string } | { consentIds: Record<ConsentScope, string> }> {
  const consentIds = {} as Record<ConsentScope, string>;
  for (const scope of scopes) {
    const consent = await getConsent(supabase, userId, scope);
    if (!consent) return { line: CONSENT_LINES[scope] };
    consentIds[scope] = consent.id;
  }
  return { consentIds };
}

const approvedProfileImage = async (
  supabase: SupabaseClient,
  userId: string
): Promise<IdentityAssetView | null> =>
  (await listIdentityAssets(supabase, userId)).find(
    (entry) => entry.role === "profile_image" && entry.status === "ready"
  ) ?? null;

const isModerationMessage = (message: string): boolean =>
  /safety|moderat|nsfw|policy|unsafe/i.test(message);

/** Map a fal/ElevenLabs/GMI failure onto a job status and a written line. */
function classifyFailure(error: unknown): { status: TwinJobStatus; line: string } {
  if (error instanceof CreativeUnconfiguredError) {
    return { status: "failed", line: UNCONFIGURED_LINE };
  }
  if (error instanceof GmiCapacityError) return { status: "failed", line: BUSY_LINE };
  if (isFalUnknownOutcome(error) || isAmbiguousSubmission(error)) {
    return { status: "submit_unknown", line: SUBMIT_UNKNOWN_LINE };
  }
  if (error instanceof FalRequestError && isModerationMessage(error.message)) {
    return { status: "refused", line: REFUSAL_LINE };
  }
  return { status: "failed", line: FAILED_LINE };
}

/**
 * Run one lip-sync render for the twin from a speech asset and the approved
 * profile image, and deliver it like any creative job.
 */
async function renderLipsync(
  supabase: SupabaseClient,
  userId: string,
  jobId: string,
  input: { profileImage: IdentityAssetView; speech: CreativeAsset },
  opts: TwinJobOptions
): Promise<TwinJobResult> {
  const fail = async (status: TwinJobStatus, line: string): Promise<TwinJobResult> => {
    await updateCreativeJob(supabase, jobId, { status, error: line });
    return { ok: false, status, line, jobId };
  };
  const [imageUrl, audioUrl] = await Promise.all([
    signedIdentityUrl(supabase, input.profileImage.asset).catch(() => null),
    signedIdentityUrl(supabase, input.speech).catch(() => null),
  ]);
  if (!imageUrl || !audioUrl) {
    return await fail("failed", "couldn't read your twin's assets — try again.");
  }
  const onLifecycle = async (event: GmiLifecycleEvent): Promise<void> => {
    if (event.stage === "submitted" || event.stage === "polling") {
      await updateCreativeJob(supabase, jobId, {
        status: event.stage === "submitted" ? "submitted" : "polling",
        ...(event.requestId ? { provider_request_id: event.requestId } : {}),
      });
    }
    await opts.onLifecycle?.(event);
  };
  let media: GeneratedMedia;
  try {
    media = await generateTwinLipsync(
      { imageUrl, audioUrl, resolution: DEFAULT_LIPSYNC_RESOLUTION },
      DEFAULT_GENERATION_TIMEOUT_MS,
      { onLifecycle }
    );
  } catch (error) {
    const { status, line } = classifyFailure(error);
    return await fail(status, line);
  }
  try {
    const fetched = await fetchSafeGeneratedMedia(media.url, media.kind);
    const asset = await ingestGeneratedMedia(supabase, userId, fetched);
    const delivery = await mintJobDelivery(supabase, asset, jobId);
    await Promise.all([
      updateCreativeJob(supabase, jobId, {
        status: "delivered",
        delivered_at: new Date().toISOString(),
        output_asset_id: asset.id,
      }),
      insertRenderCostEvent(supabase, userId, jobId, "video"),
    ]);
    return {
      ok: true,
      status: "delivered",
      line: "here is your twin",
      asset,
      deliveryUrl: delivery.url,
      kind: "video",
      jobId,
    };
  } catch {
    return await fail("failed", FAILED_LINE);
  }
}

/**
 * `/twin say <script>`: the owner's cloned voice speaks the script and the
 * approved profile image is lip-synced to it. Requires the likeness, voice
 * and video-avatar grants, a ready clone, and an approved profile image.
 */
export async function createTwinSpeechVideo(
  supabase: SupabaseClient,
  userId: string,
  opts: TwinJobOptions & { script: string }
): Promise<TwinJobResult> {
  const jobId = await ensureJob(supabase, userId, opts, "speak");
  const refuse = async (line: string): Promise<TwinJobResult> => {
    await updateCreativeJob(supabase, jobId, { status: "refused", error: line });
    return { ok: false, status: "refused", line, jobId };
  };
  if (!twinSpeechAvailable()) return await refuse(UNCONFIGURED_LINE);
  const script = opts.script.trim().slice(0, TWIN_SCRIPT_MAX_CHARS);
  if (!script) return await refuse("write a line for your twin to say first.");
  const consent = await missingConsentLine(supabase, userId, [
    "likeness",
    "voice",
    "video_avatar",
  ]);
  if ("line" in consent) return await refuse(consent.line);
  const twin = await getDigitalTwin(supabase, userId).catch(() => null);
  if (!twin?.voice_id || twin.voice_status !== "ready") {
    return await refuse(VOICE_NOT_READY_LINE);
  }
  const profileImage = await approvedProfileImage(supabase, userId);
  if (!profileImage) return await refuse(TWIN_PROFILE_IMAGE_NEEDED_LINE);
  try {
    if (!(await underDailyLimit(supabase, userId))) {
      return await refuse(DAILY_LIMIT_LINE);
    }
  } catch {
    return await refuse(FAILED_LINE);
  }

  const speech = await synthesizeTwinSpeech(supabase, userId, script);
  if (!speech.ok) {
    await updateCreativeJob(supabase, jobId, { status: "failed", error: speech.error });
    return { ok: false, status: "failed", line: speech.error, jobId };
  }
  await recordReferenceUses(supabase, jobId, userId, [
    { ownerUserId: userId, assetId: profileImage.asset_id, role: "profile_image", purpose: "speech" },
    { ownerUserId: userId, assetId: speech.asset.id, role: "twin_speech", purpose: "speech" },
  ]);
  return renderLipsync(
    supabase,
    userId,
    jobId,
    { profileImage, speech: speech.asset },
    opts
  );
}

/**
 * `/twin <brief>`: an identity-consistent image anchored on the approved
 * profile image (GPT Image 2 edit). Requires the likeness grant.
 */
export async function createTwinImage(
  supabase: SupabaseClient,
  userId: string,
  opts: TwinJobOptions & { prompt: string }
): Promise<TwinJobResult> {
  const jobId = await ensureJob(supabase, userId, opts, "image");
  const refuse = async (line: string): Promise<TwinJobResult> => {
    await updateCreativeJob(supabase, jobId, { status: "refused", error: line });
    return { ok: false, status: "refused", line, jobId };
  };
  const prompt = opts.prompt.trim().slice(0, TWIN_PROMPT_MAX_CHARS);
  if (!prompt) return await refuse("describe the image you want of your twin.");
  const consent = await missingConsentLine(supabase, userId, ["likeness"]);
  if ("line" in consent) return await refuse(consent.line);
  const reference =
    (await approvedProfileImage(supabase, userId)) ??
    (await listIdentityAssets(supabase, userId)).find(
      (entry) => entry.role === "character_sheet" && entry.status === "ready"
    ) ??
    null;
  if (!reference) return await refuse(TWIN_PROFILE_IMAGE_NEEDED_LINE);
  const url = await signedIdentityUrl(supabase, reference.asset).catch(() => null);
  if (!url) return await refuse("couldn't read your twin's reference image — try again.");
  const text =
    `${prompt} Keep the exact same person as the attached reference image — ` +
    `same face, hair, skin tone and build. No text, no watermark.`;
  const turn: CreativeCommandTurn = {
    mode: "imagine",
    cleanedText: text,
    text,
    mediaInputs: [{ kind: "image", url }],
  };
  await recordReferenceUses(supabase, jobId, userId, [
    { ownerUserId: userId, assetId: reference.asset_id, role: reference.role, purpose: "image" },
  ]);
  const result = await executeCreativeJob(supabase, jobId, userId, turn, {
    promptVersion: "twin-image-v1",
    ...(opts.onLifecycle ? { onLifecycle: opts.onLifecycle } : {}),
  });
  if (result.status === "delivered" && result.asset) {
    return {
      ok: true,
      status: "delivered",
      line: "here is your twin",
      asset: result.asset,
      deliveryUrl: result.deliveryUrl,
      kind: "image",
      jobId,
    };
  }
  return { ok: false, status: result.status, line: result.line, jobId };
}

/**
 * Enable the video avatar: render a short preview (profile image lip-synced
 * to the cloned voice's intro line, or to the newest voice sample when no
 * clone exists yet) and record the configuration on the twin row.
 */
export async function enableVideoAvatar(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  opts: TwinJobOptions
): Promise<TwinJobResult> {
  const jobId = await ensureJob(supabase, userId, opts, "preview");
  const refuse = async (line: string): Promise<TwinJobResult> => {
    await updateCreativeJob(supabase, jobId, { status: "refused", error: line });
    return { ok: false, status: "refused", line, jobId };
  };
  if (!twinAvatarAvailable()) return await refuse(UNCONFIGURED_LINE);
  const consent = await missingConsentLine(supabase, userId, [
    "likeness",
    "video_avatar",
  ]);
  if ("line" in consent) return await refuse(consent.line);
  const profileImage = await approvedProfileImage(supabase, userId);
  if (!profileImage) return await refuse(TWIN_PROFILE_IMAGE_NEEDED_LINE);
  const twin = await getDigitalTwin(supabase, userId).catch(() => null);
  if (twin?.avatar_status === "pending") {
    return await refuse("your video avatar is already rendering — tap Refresh status in a minute.");
  }
  try {
    if (!(await underDailyLimit(supabase, userId))) {
      return await refuse(DAILY_LIMIT_LINE);
    }
  } catch {
    return await refuse(FAILED_LINE);
  }

  // Audio: the clone's intro line when the voice is ready, else a sample.
  let speech: CreativeAsset | null = null;
  let speechRole = "twin_speech";
  if (twin?.voice_id && twin.voice_status === "ready") {
    const spoken = await synthesizeTwinSpeech(supabase, userId, TWIN_INTRO_LINE(username));
    if (!spoken.ok) return await refuse(spoken.error);
    speech = spoken.asset;
  } else {
    const sample = (await listVoiceSamples(supabase, userId))[0];
    if (!sample) {
      return await refuse(
        "add a voice sample or create a voice clone first — the avatar needs something to say."
      );
    }
    speech = sample.asset;
    speechRole = "voice_sample";
  }

  await patchTwin(supabase, userId, {
    avatar_provider: "fal",
    avatar_status: "pending",
    avatar_error: null,
    avatar_consent_id: consent.consentIds.video_avatar,
    likeness_consent_id: consent.consentIds.likeness,
    avatar_config: {
      model: falTwinLipsyncModel(),
      resolution: DEFAULT_LIPSYNC_RESOLUTION,
      voice: twin?.voice_status === "ready" ? "clone" : "sample",
    },
  });
  await recordReferenceUses(supabase, jobId, userId, [
    { ownerUserId: userId, assetId: profileImage.asset_id, role: "profile_image", purpose: "video" },
    { ownerUserId: userId, assetId: speech.id, role: speechRole, purpose: "video" },
  ]);
  const result = await renderLipsync(
    supabase,
    userId,
    jobId,
    { profileImage, speech },
    opts
  );
  await patchTwin(supabase, userId, {
    avatar_status: result.ok ? "ready" : "failed",
    avatar_error: result.ok ? null : result.line.slice(0, 200),
    ...(result.asset ? { avatar_preview_asset_id: result.asset.id } : {}),
  });
  return result.ok
    ? { ...result, line: "video avatar ready — this is how your twin will speak." }
    : result;
}

/** Turn the video avatar off: config and preview pointer cleared. */
export async function disableVideoAvatar(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  return patchTwin(supabase, userId, {
    avatar_status: "off",
    avatar_error: null,
    avatar_preview_asset_id: null,
    avatar_config: {},
  });
}

/** Who may reference @username in their own generations. */
export async function setTwinSharing(
  supabase: SupabaseClient,
  userId: string,
  sharing: TwinSharing
): Promise<boolean> {
  return patchTwin(supabase, userId, { sharing });
}

/** A short, written status of the twin — for `/twin @name` and the summary. */
export function describeTwin(
  username: string,
  twin: DigitalTwin | null,
  hasProfileImage: boolean
): string {
  const parts = [
    hasProfileImage ? "profile image ✓" : "no profile image yet",
    twin?.voice_status === "ready"
      ? "voice ✓"
      : twin?.voice_status === "pending"
        ? "voice pending verification"
        : "no voice clone",
    twin?.avatar_status === "ready"
      ? "video avatar ✓"
      : twin?.avatar_status === "pending"
        ? "video avatar rendering"
        : "video avatar off",
  ];
  return `@${username} — ${parts.join(" · ")}.`;
}
