/**
 * Account settings writes shared by the /api/settings routes and the MA5
 * settings/onboarding mini-apps — one code path per setting, so no surface
 * grows its own mutation logic (goal.md §MA5 #14).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ModelFamily } from "../entitlements/models";
import type { ThemeId } from "../miniapps/themes";
import type { BackgroundId } from "../miniapps/backgrounds";
import { provisionEmail } from "../provisioning/email";
import { switchHarness } from "../provisioning/provision";
import { registeredTemplate } from "../fleet/channels";
import { renameBox } from "../box/client";
import { isReservedWord } from "../miniapps/reserved";
import {
  AGENT_HARNESSES,
  DEFAULT_HARNESS,
  toAgentHarness,
  type AgentHarness,
} from "../agent/harness";
import type { ComputeEnvironment } from "../compute/environments";

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

/** The harness the user's compute currently runs (boxes.harness). */
export async function currentHarness(
  supabase: SupabaseClient,
  userId: string
): Promise<AgentHarness> {
  const { data } = await supabase
    .from("boxes")
    .select("harness")
    .eq("user_id", userId)
    .maybeSingle();
  return toAgentHarness((data as { harness?: string | null } | null)?.harness);
}

/**
 * Which harnesses can be provisioned on an environment right now: the default
 * always (it has the static template fallback); every other harness only once
 * a template is registered for the pair — the same gate the coming-soon
 * environments sit behind.
 */
export async function availableHarnesses(
  supabase: SupabaseClient,
  environment: ComputeEnvironment
): Promise<Record<AgentHarness, boolean>> {
  const entries = await Promise.all(
    AGENT_HARNESSES.map(async (harness) => {
      if (harness === DEFAULT_HARNESS) return [harness, true] as const;
      const pointer = await registeredTemplate(
        supabase,
        "prod",
        environment,
        harness
      ).catch(() => null);
      return [harness, pointer !== null] as const;
    })
  );
  return Object.fromEntries(entries) as Record<AgentHarness, boolean>;
}

/**
 * Switches the user's agent harness. The choice lives on the boxes row, and
 * a box only ever runs one harness, so a change rebuilds the compute
 * (switchHarness) — the rebuilt row carries the new value. Same harness is a
 * no-op success.
 */
export async function setHarness(
  supabase: SupabaseClient,
  userId: string,
  harness: AgentHarness
): Promise<boolean> {
  if ((await currentHarness(supabase, userId)) === harness) return true;
  try {
    await switchHarness(supabase, userId, harness);
    return true;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "harness switch failed",
        user_id: userId,
        harness,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return false;
  }
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

/** Writes users.miniapp_theme — a THEMES id, applied to every mini-app. */
export async function setMiniappTheme(
  supabase: SupabaseClient,
  userId: string,
  themeId: ThemeId
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({ miniapp_theme: themeId })
    .eq("id", userId);
  return !error;
}

/** Writes users.miniapp_background — a BACKGROUNDS id, the backdrop layer
 * behind every mini-app ('theme' keeps the theme's own). */
export async function setMiniappBackground(
  supabase: SupabaseClient,
  userId: string,
  backgroundId: BackgroundId
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({ miniapp_background: backgroundId })
    .eq("id", userId);
  return !error;
}

/**
 * Reorders `submitted` within `saved`, keeping unsubmitted slugs in their
 * saved positions. Surfaces arrange different subsets of the shared order
 * (the web rail shows installed apps only; the Home mini-app orders all
 * published apps), so a subset save must not drop the other surface's
 * arrangement. Submitted slugs unknown to `saved` append at the end.
 */
export function mergeHomeOrder(saved: string[], submitted: string[]): string[] {
  const submittedSet = new Set(submitted);
  const refill = submitted.filter((slug) => saved.includes(slug));
  const extras = submitted.filter((slug) => !saved.includes(slug));
  let next = 0;
  const merged = saved.map((slug) =>
    submittedSet.has(slug) ? (refill[next++] ?? slug) : slug
  );
  return [...merged, ...extras];
}

/** Writes users.miniapp_home_order — Home launcher slugs in the user's
 * chosen order (empty keeps the default). Callers validate the slugs. */
export async function setMiniappHomeOrder(
  supabase: SupabaseClient,
  userId: string,
  slugs: string[]
): Promise<boolean> {
  const { error } = await supabase
    .from("users")
    .update({ miniapp_home_order: slugs })
    .eq("id", userId);
  return !error;
}

export const MODEL_FAMILIES = [
  "ox-alpha",
  "openai",
  "anthropic",
  "minimax-m3",
  "minimax-m2.7",
  "openrouter",
  "venice",
  "inkling",
  "inkling-small",
] as const;

/** Human labels for the family pickers. */
export const MODEL_FAMILY_LABELS: Record<ModelFamily, string> = {
  "ox-alpha": "GLM 5.3 Flash",
  openai: "GPT 5.6 Family",
  anthropic: "Anthropic",
  "minimax-m3": "MiniMax M3",
  "minimax-m2.7": "MiniMax M2.7",
  openrouter: "OpenRouter",
  venice: "Venice",
  inkling: "Inkling (free)",
  "inkling-small": "Inkling Small (free)",
};

/** Writes entitlements.model_family — a family name, never a model ID. */
export async function setModelFamily(
  supabase: SupabaseClient,
  userId: string,
  family: ModelFamily
): Promise<boolean> {
  const { error } = await supabase
    .from("entitlements")
    .update({ model_family: family })
    .eq("user_id", userId);
  return !error;
}

/** Writes entitlements.openrouter_model — a catalog slug, validated by the
 * caller (isOpenRouterModel) and re-validated at the gateway. */
export async function setOpenRouterModel(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<boolean> {
  const { error } = await supabase
    .from("entitlements")
    .update({ openrouter_model: slug })
    .eq("user_id", userId);
  return !error;
}

/** Writes entitlements.venice_model — a catalog slug, validated by the
 * caller (isVeniceModel) and re-validated at the gateway. */
export async function setVeniceModel(
  supabase: SupabaseClient,
  userId: string,
  slug: string
): Promise<boolean> {
  const { error } = await supabase
    .from("entitlements")
    .update({ venice_model: slug })
    .eq("user_id", userId);
  return !error;
}
