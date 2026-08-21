/**
 * Account settings writes shared by the /api/settings routes and the MA5
 * settings/onboarding mini-apps — one code path per setting, so no surface
 * grows its own mutation logic (goal.md §MA5 #14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { provisionEmail } from "../provisioning/email";
import { renameBox } from "../box/client";
import { isReservedWord } from "../miniapps/reserved";

export const USERNAME_PATTERN = /^[a-z0-9_]{2,24}$/;

export type UsernameResult =
  | { ok: true; username: string; address: string | null }
  | { ok: false; error: "invalid" | "taken" | "update_failed" }
  | { ok: false; error: "cooldown"; eligible: string | null };

/**
 * Username (M3 step 6): case-insensitive unique (citext), reserved words,
 * 30-day cooldown enforced by the DB trigger. On success the AgentMail inbox
 * is (re)provisioned — a provisioning failure is logged, not fatal.
 */
export async function setUsername(
  supabase: SupabaseClient,
  userId: string,
  raw: string
): Promise<UsernameResult> {
  const username = raw.toLowerCase().trim();
  if (!USERNAME_PATTERN.test(username) || isReservedWord(username)) {
    return { ok: false, error: "invalid" };
  }
  // MA3 both-directions collision check: a username may not claim a word
  // that is already a registry slug (bare first-party slugs are also in the
  // reserved list; this catches anything registered since).
  const { data: slugClash } = await supabase
    .from("mini_apps")
    .select("id")
    .eq("slug", username)
    .maybeSingle();
  if (slugClash) {
    return { ok: false, error: "invalid" };
  }
  const { error } = await supabase
    .from("users")
    .update({ username })
    .eq("id", userId);
  if (error) {
    if (error.message.includes("username_cooldown_active")) {
      return { ok: false, error: "cooldown", eligible: error.details ?? null };
    }
    if (error.code === "23505") {
      return { ok: false, error: "taken" };
    }
    return { ok: false, error: "update_failed" };
  }
  // Name the box after its owner so the fleet is navigable in the ascii
  // dashboard. Best-effort: a rename failure never blocks the username.
  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id")
    .eq("user_id", userId)
    .maybeSingle();
  const providerBoxId = (box?.provider_box_id as string | null) ?? null;
  if (providerBoxId) {
    try {
      await renameBox(providerBoxId, `air-${username}`);
    } catch (renameError) {
      console.error(
        JSON.stringify({
          msg: "box rename failed",
          user_id: userId,
          error:
            renameError instanceof Error
              ? renameError.message
              : String(renameError),
        })
      );
    }
  }
  let address: string | null = null;
  try {
    const email = await provisionEmail(supabase, userId, username);
    address = email.address;
  } catch (provisionError) {
    console.error(
      JSON.stringify({
        msg: "email provisioning failed",
        user_id: userId,
        error:
          provisionError instanceof Error
            ? provisionError.message
            : String(provisionError),
      })
    );
  }
  return { ok: true, username, address };
}

export const SPEED_TIERS = ["fast", "balanced", "deep"] as const;
export type SpeedTier = (typeof SPEED_TIERS)[number];

export function isSpeedTier(value: string): value is SpeedTier {
  return (SPEED_TIERS as readonly string[]).includes(value);
}

/** Writes entitlements.speed_tier — a tier name, never a model ID (M6). */
export async function setSpeedTier(
  supabase: SupabaseClient,
  userId: string,
  tier: SpeedTier
): Promise<boolean> {
  const { error } = await supabase
    .from("entitlements")
    .update({ speed_tier: tier })
    .eq("user_id", userId);
  return !error;
}
