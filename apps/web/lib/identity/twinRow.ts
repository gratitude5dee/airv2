/**
 * The digital_twins row (0061 + 0121): one per user, lifecycle metadata and
 * provider handles only — never media, prompts or signed URLs (C4). Shared
 * by lib/identity/twin.ts (renders), voiceClone.ts (ElevenLabs) and
 * resolve.ts (@username) so no module grows its own upsert.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type DigitalTwinStatus =
  | "avatar_only"
  | "consented"
  | "creating"
  | "ready"
  | "failed";
export type VoiceStatus = "none" | "pending" | "ready" | "failed" | "revoked";
export type AvatarStatus = "off" | "pending" | "ready" | "failed";
export type TwinSharing = "private" | "public";

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
  // 0121 — consent links, voice clone, video avatar, sharing
  likeness_consent_id: string | null;
  voice_provider: string | null;
  voice_id: string | null;
  voice_status: VoiceStatus;
  voice_error: string | null;
  voice_consent_id: string | null;
  voice_source_asset_ids: string[];
  voice_idempotency_key: string | null;
  voice_created_at: string | null;
  voice_deleted_at: string | null;
  avatar_provider: string | null;
  avatar_status: AvatarStatus;
  avatar_config: Record<string, unknown>;
  avatar_preview_asset_id: string | null;
  avatar_error: string | null;
  avatar_consent_id: string | null;
  sharing: TwinSharing;
}

export type TwinPatch = Partial<
  Omit<DigitalTwin, "id" | "user_id" | "created_at" | "updated_at">
>;

const VOICE_STATUSES: readonly VoiceStatus[] = [
  "none",
  "pending",
  "ready",
  "failed",
  "revoked",
];
const AVATAR_STATUSES: readonly AvatarStatus[] = [
  "off",
  "pending",
  "ready",
  "failed",
];

/** Rows written before 0121 (or by older mocks) lack the new columns. */
export function normalizeTwin(raw: unknown): DigitalTwin | null {
  if (typeof raw !== "object" || raw === null) return null;
  const row = raw as Partial<DigitalTwin> & Record<string, unknown>;
  if (typeof row.user_id !== "string") return null;
  const voiceStatus = row.voice_status;
  const avatarStatus = row.avatar_status;
  return {
    id: typeof row.id === "string" ? row.id : "",
    user_id: row.user_id,
    provider: typeof row.provider === "string" ? row.provider : "heygen",
    provider_twin_id: row.provider_twin_id ?? null,
    provider_avatar_id: row.provider_avatar_id ?? null,
    provider_group_id: row.provider_group_id ?? null,
    provider_voice_id: row.provider_voice_id ?? null,
    consent_video_key: row.consent_video_key ?? null,
    video_asset_id: row.video_asset_id ?? null,
    status: row.status ?? "avatar_only",
    created_at: typeof row.created_at === "string" ? row.created_at : "",
    updated_at: typeof row.updated_at === "string" ? row.updated_at : "",
    likeness_consent_id: row.likeness_consent_id ?? null,
    voice_provider: row.voice_provider ?? null,
    voice_id: row.voice_id ?? null,
    voice_status:
      typeof voiceStatus === "string" &&
      (VOICE_STATUSES as readonly string[]).includes(voiceStatus)
        ? (voiceStatus as VoiceStatus)
        : "none",
    voice_error: row.voice_error ?? null,
    voice_consent_id: row.voice_consent_id ?? null,
    voice_source_asset_ids: Array.isArray(row.voice_source_asset_ids)
      ? row.voice_source_asset_ids.filter(
          (value): value is string => typeof value === "string"
        )
      : [],
    voice_idempotency_key: row.voice_idempotency_key ?? null,
    voice_created_at: row.voice_created_at ?? null,
    voice_deleted_at: row.voice_deleted_at ?? null,
    avatar_provider: row.avatar_provider ?? null,
    avatar_status:
      typeof avatarStatus === "string" &&
      (AVATAR_STATUSES as readonly string[]).includes(avatarStatus)
        ? (avatarStatus as AvatarStatus)
        : "off",
    avatar_config:
      typeof row.avatar_config === "object" && row.avatar_config !== null
        ? (row.avatar_config as Record<string, unknown>)
        : {},
    avatar_preview_asset_id: row.avatar_preview_asset_id ?? null,
    avatar_error: row.avatar_error ?? null,
    avatar_consent_id: row.avatar_consent_id ?? null,
    sharing: row.sharing === "public" ? "public" : "private",
  };
}

export async function getDigitalTwin(
  supabase: SupabaseClient,
  userId: string
): Promise<DigitalTwin | null> {
  const { data } = await supabase
    .from("digital_twins")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  return normalizeTwin(data);
}

/** Upsert a patch onto the user's twin row (created on first write). */
export async function patchTwin(
  supabase: SupabaseClient,
  userId: string,
  patch: TwinPatch
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
