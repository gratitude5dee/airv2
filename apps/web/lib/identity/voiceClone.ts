/**
 * Voice clone lifecycle for the digital twin (onboarding.md §4.5, §6).
 * Server-side only: reads the owner's approved voice samples out of the
 * private bucket, calls ElevenLabs IVC once, and records the handle on
 * digital_twins. Explicit consent (`voice` scope) is checked here — never
 * only in the UI — and a retry with the same sample set never mints a
 * second provider voice (idempotency key = sha256 of the sorted sample
 * asset ids). Partial failures clean up: if the row write fails after the
 * provider created the voice, the voice is deleted again best-effort.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset } from "../assets/pipeline";
import { CreativeUnconfiguredError } from "../creative/groq";
import { ingestGeneratedAudio } from "../creative/store";
import {
  downloadIdentityAsset,
  listIdentityAssets,
  MAX_VOICE_SAMPLES,
  type IdentityAssetView,
} from "./assets";
import { ConsentRequiredError, getConsent, revokeConsent } from "./consent";
import { getDigitalTwin, patchTwin } from "./twinRow";
import {
  createInstantVoiceClone,
  deleteVoice,
  ElevenLabsError,
  elevenlabsAvailable,
  synthesizeSpeech,
  type ElevenLabsOptions,
} from "./voice";

export const VOICE_PROVIDER = "elevenlabs";

export const VOICE_UNCONFIGURED_LINE =
  "voice cloning isn't configured on this deployment.";
export const VOICE_SAMPLES_NEEDED_LINE =
  "add at least one voice sample first — a quiet 30 seconds of you talking works best.";
export const VOICE_NOT_READY_LINE =
  "no voice clone yet — opt in on the Voice step and tap Create voice clone.";

export type VoiceCloneResult =
  | { ok: true; status: "ready" | "pending"; voiceId: string }
  | { ok: false; error: string };

export function voiceIdempotencyKey(sampleAssetIds: readonly string[]): string {
  return createHash("sha256")
    .update([...sampleAssetIds].sort().join("\n"))
    .digest("hex");
}

/** Newest samples first, capped to what one clone request should carry. */
export async function listVoiceSamples(
  supabase: SupabaseClient,
  userId: string
): Promise<IdentityAssetView[]> {
  const identity = await listIdentityAssets(supabase, userId);
  return identity
    .filter((entry) => entry.role === "voice_sample" && entry.status === "ready")
    .slice(0, MAX_VOICE_SAMPLES);
}

const contentTypeOf = (asset: CreativeAsset): string =>
  ({
    mp3: "audio/mpeg",
    m4a: "audio/mp4",
    wav: "audio/wav",
    ogg: "audio/ogg",
    webm: "audio/webm",
    aac: "audio/aac",
  })[asset.ext] ?? "application/octet-stream";

/**
 * Create (or return) the owner's Instant Voice Clone. Consent-gated,
 * idempotent per sample set, one provider call per attempt.
 */
export async function createUserVoiceClone(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  options?: ElevenLabsOptions
): Promise<VoiceCloneResult> {
  if (!elevenlabsAvailable()) return { ok: false, error: VOICE_UNCONFIGURED_LINE };
  const consent = await getConsent(supabase, userId, "voice");
  if (!consent) return { ok: false, error: new ConsentRequiredError("voice").message };
  const samples = await listVoiceSamples(supabase, userId);
  if (samples.length === 0) return { ok: false, error: VOICE_SAMPLES_NEEDED_LINE };
  const sampleIds = samples.map((entry) => entry.asset_id);
  const key = voiceIdempotencyKey(sampleIds);

  const twin = await getDigitalTwin(supabase, userId).catch(() => null);
  if (
    twin?.voice_id &&
    twin.voice_idempotency_key === key &&
    (twin.voice_status === "ready" || twin.voice_status === "pending")
  ) {
    return { ok: true, status: twin.voice_status, voiceId: twin.voice_id };
  }
  // A different sample set replaces the clone: the old provider voice is
  // deleted first so an account never accumulates stale clones.
  if (twin?.voice_id && twin.voice_idempotency_key !== key) {
    await deleteVoice(twin.voice_id, options).catch(() => false);
  }

  const files: Array<{ bytes: Buffer; mimeType: string; filename: string }> = [];
  for (const sample of samples) {
    const bytes = await downloadIdentityAsset(supabase, sample.asset).catch(
      () => null
    );
    if (!bytes) continue;
    files.push({
      bytes,
      mimeType: contentTypeOf(sample.asset),
      filename: `sample-${sample.asset.sha256.slice(0, 8)}.${sample.asset.ext}`,
    });
  }
  if (files.length === 0) {
    return { ok: false, error: "couldn't read your voice samples — upload them again." };
  }

  const started = await patchTwin(supabase, userId, {
    voice_provider: VOICE_PROVIDER,
    voice_status: "pending",
    voice_error: null,
    voice_consent_id: consent.id,
    voice_source_asset_ids: sampleIds,
    voice_idempotency_key: key,
    voice_deleted_at: null,
  });
  if (!started) return { ok: false, error: "couldn't save the voice request — try again." };

  let created: { voiceId: string; requiresVerification: boolean };
  try {
    created = await createInstantVoiceClone(
      {
        name: `@${username} twin`,
        files,
        description: `AirV2 digital twin voice for @${username}`,
        removeBackgroundNoise: false,
        labels: { source: "airv2-onboarding" },
      },
      options
    );
  } catch (error) {
    const message =
      error instanceof ElevenLabsError
        ? `voice clone failed — ${error.message}`
        : error instanceof CreativeUnconfiguredError
          ? VOICE_UNCONFIGURED_LINE
          : "voice clone failed — try again in a minute.";
    await patchTwin(supabase, userId, {
      voice_status: "failed",
      voice_error: message.slice(0, 200),
    });
    return { ok: false, error: message };
  }

  const status: "ready" | "pending" = created.requiresVerification
    ? "pending"
    : "ready";
  const stored = await patchTwin(supabase, userId, {
    voice_id: created.voiceId,
    voice_status: status,
    voice_error: null,
    voice_created_at: new Date().toISOString(),
  });
  if (!stored) {
    // Never leave an orphaned provider voice behind a failed write.
    await deleteVoice(created.voiceId, options).catch(() => false);
    await patchTwin(supabase, userId, {
      voice_status: "failed",
      voice_error: "couldn't save the voice — try again.",
    }).catch(() => false);
    return { ok: false, error: "couldn't save the voice — try again." };
  }
  return { ok: true, status, voiceId: created.voiceId };
}

/**
 * Delete the clone at the provider and mark it revoked locally. Optionally
 * also revokes the `voice` consent scope (the onboarding "Revoke" button).
 */
export async function revokeUserVoiceClone(
  supabase: SupabaseClient,
  userId: string,
  opts: { revokeConsent?: boolean | undefined } = {},
  options?: ElevenLabsOptions
): Promise<boolean> {
  const twin = await getDigitalTwin(supabase, userId).catch(() => null);
  if (twin?.voice_id && elevenlabsAvailable()) {
    const gone = await deleteVoice(twin.voice_id, options).catch(() => false);
    if (!gone) return false;
  }
  const ok = await patchTwin(supabase, userId, {
    voice_id: null,
    voice_status: "revoked",
    voice_error: null,
    voice_deleted_at: new Date().toISOString(),
  });
  if (ok && opts.revokeConsent) {
    await revokeConsent(supabase, userId, "voice").catch(() => false);
  }
  return ok;
}

export type TwinSpeechResult =
  | { ok: true; asset: CreativeAsset }
  | { ok: false; error: string };

/**
 * Speak a script in the owner's cloned voice and keep the clip as a private
 * asset (the lip-sync lane reads it back through a signed URL).
 */
export async function synthesizeTwinSpeech(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  options?: ElevenLabsOptions
): Promise<TwinSpeechResult> {
  if (!elevenlabsAvailable()) return { ok: false, error: VOICE_UNCONFIGURED_LINE };
  const consent = await getConsent(supabase, userId, "voice");
  if (!consent) return { ok: false, error: new ConsentRequiredError("voice").message };
  const twin = await getDigitalTwin(supabase, userId).catch(() => null);
  if (!twin?.voice_id || twin.voice_status !== "ready") {
    return { ok: false, error: VOICE_NOT_READY_LINE };
  }
  try {
    const speech = await synthesizeSpeech(
      { voiceId: twin.voice_id, text },
      options
    );
    const asset = await ingestGeneratedAudio(
      supabase,
      userId,
      speech.bytes,
      speech.mimeType
    );
    return { ok: true, asset };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof ElevenLabsError
          ? `speech failed — ${error.message}`
          : "speech failed — try again in a minute.",
    };
  }
}
