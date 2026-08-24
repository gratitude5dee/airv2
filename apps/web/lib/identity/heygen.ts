/**
 * Direct HeyGen avatar creation (POST /v3/avatars). Used only to mint a
 * per-user avatar ID (a "look") from an identity photo — the preferred
 * avatar path when HEYGEN_API_KEY is configured. Video rendering never
 * happens here; it stays on the GMI request queue (heygen-avatar-v4).
 * Optional by design: without the key, users fall back to selecting an
 * uploaded photo and rendering through GMI directly.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

export const heygenAvailable = (): boolean => env.heygenApiKey() !== null;

export interface HeygenAvatarIdentity {
  avatarId: string;
  groupId: string | null;
  voiceId: string | null;
}

/**
 * Create a HeyGen photo avatar from a (signed, short-TTL) image URL and
 * return the new look ID. The response's avatar_item.id is what video
 * creation accepts as avatar_id.
 */
export async function createHeygenPhotoAvatar(opts: {
  name: string;
  imageUrl: string;
}): Promise<
  { ok: true; identity: HeygenAvatarIdentity } | { ok: false; error: string }
> {
  const apiKey = env.heygenApiKey();
  if (!apiKey) return { ok: false, error: "HeyGen isn't configured." };
  let response: Response;
  try {
    response = await fetch(`${env.heygenApiUrl()}/v3/avatars`, {
      method: "POST",
      headers: {
        "X-Api-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        type: "photo",
        name: opts.name.slice(0, 80),
        file: { type: "url", url: opts.imageUrl },
      }),
    });
  } catch {
    return { ok: false, error: "Couldn't reach HeyGen — try again." };
  }
  if (!response.ok) {
    console.log(
      JSON.stringify({
        msg: "heygen avatar create failed",
        status: response.status,
      })
    );
    return { ok: false, error: "Avatar creation failed — try again." };
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    return { ok: false, error: "Avatar creation failed — try again." };
  }
  const item = (body as { data?: { avatar_item?: Record<string, unknown> } })
    ?.data?.avatar_item;
  const avatarId = typeof item?.id === "string" ? item.id : null;
  if (!avatarId) {
    return { ok: false, error: "Avatar creation failed — try again." };
  }
  return {
    ok: true,
    identity: {
      avatarId,
      groupId: typeof item?.group_id === "string" ? item.group_id : null,
      voiceId:
        typeof item?.default_voice_id === "string"
          ? item.default_voice_id
          : null,
    },
  };
}

/** The user's stored HeyGen avatar (look) ID, if one has been created. */
export async function getHeygenAvatarId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("digital_twins")
    .select("provider_avatar_id")
    .eq("user_id", userId)
    .maybeSingle();
  return (data?.provider_avatar_id as string | undefined) ?? null;
}
