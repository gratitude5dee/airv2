/**
 * Digital-twin consent (onboarding.md §4.2, §8). A grant is a row in
 * twin_consents scoped to what the user allows — generating images of their
 * likeness, cloning their voice, rendering a video avatar — stamped with the
 * policy version they saw and the surface they agreed on. One live grant per
 * scope (partial unique index); revoking sets revoked_at and the dependent
 * features switch off immediately. Every service that uploads, generates,
 * clones or lip-syncs checks here server-side; the UI checkbox alone never
 * unlocks anything.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Bump when the consent copy materially changes; old grants stay valid. */
export const CONSENT_POLICY_VERSION = "2026-09-twin-v1";

export const CONSENT_SCOPES = ["likeness", "voice", "video_avatar"] as const;
export type ConsentScope = (typeof CONSENT_SCOPES)[number];
export type ConsentSurface = "onboarding" | "settings" | "api";

export function isConsentScope(value: string): value is ConsentScope {
  return (CONSENT_SCOPES as readonly string[]).includes(value);
}

export interface TwinConsent {
  id: string;
  user_id: string;
  scope: ConsentScope;
  policy_version: string;
  surface: ConsentSurface;
  evidence_asset_id: string | null;
  granted_at: string;
  revoked_at: string | null;
}

/** First-person attestations — the checkbox text is the consent. */
export const CONSENT_COPY: Record<
  ConsentScope,
  { title: string; statement: string; detail: string }
> = {
  likeness: {
    title: "Likeness",
    statement:
      "I am the person in the photos I add here, and I allow my agent to generate images and videos of my likeness for me.",
    detail:
      "Required for the character sheet, profile image and any @username reference. Photos are processed by OpenAI GPT Image 2 (via GMI Cloud) and fal.ai / MiniMax for video.",
  },
  voice: {
    title: "Voice clone",
    statement:
      "This is my own voice, and I allow my agent to create a voice clone of it and speak as me when I ask.",
    detail:
      "Optional. Samples are sent to ElevenLabs to create an Instant Voice Clone. Nothing is cloned until you tap Create voice clone; deleting the clone removes it at ElevenLabs.",
  },
  video_avatar: {
    title: "Video avatar",
    statement:
      "I allow my agent to render a talking video of my likeness using my approved profile image and my voice.",
    detail:
      "Optional. Renders on fal.ai (MiniMax H3 Max lip-sync). Every video is labelled as synthetic.",
  },
};

/** User-facing lines when a required scope is missing. */
export const CONSENT_LINES: Record<ConsentScope, string> = {
  likeness:
    "allow likeness generation on the Consent step first — nothing is generated without it.",
  voice:
    "voice cloning needs your explicit opt-in on the Consent step first.",
  video_avatar:
    "the video avatar needs your explicit opt-in on the Consent step first.",
};

export class ConsentRequiredError extends Error {
  constructor(readonly scope: ConsentScope) {
    super(CONSENT_LINES[scope]);
    this.name = "ConsentRequiredError";
  }
}

const COLUMNS =
  "id, user_id, scope, policy_version, surface, evidence_asset_id, granted_at, revoked_at";

/** Live grants only (revoked rows stay for audit but never authorize). */
export async function listConsents(
  supabase: SupabaseClient,
  userId: string
): Promise<TwinConsent[]> {
  const { data } = await supabase
    .from("twin_consents")
    .select(COLUMNS)
    .eq("user_id", userId)
    .is("revoked_at", null)
    .order("granted_at", { ascending: false });
  return ((data ?? []) as TwinConsent[]).filter((row) =>
    isConsentScope(row.scope)
  );
}

export function consentFor(
  consents: readonly TwinConsent[],
  scope: ConsentScope
): TwinConsent | null {
  return consents.find((row) => row.scope === scope) ?? null;
}

export async function getConsent(
  supabase: SupabaseClient,
  userId: string,
  scope: ConsentScope
): Promise<TwinConsent | null> {
  const { data } = await supabase
    .from("twin_consents")
    .select(COLUMNS)
    .eq("user_id", userId)
    .eq("scope", scope)
    .is("revoked_at", null)
    .maybeSingle();
  return (data as TwinConsent | null) ?? null;
}

export async function hasConsent(
  supabase: SupabaseClient,
  userId: string,
  scope: ConsentScope
): Promise<boolean> {
  return (await getConsent(supabase, userId, scope)) !== null;
}

/** Throws ConsentRequiredError unless a live grant exists; returns it. */
export async function requireConsent(
  supabase: SupabaseClient,
  userId: string,
  scope: ConsentScope
): Promise<TwinConsent> {
  const consent = await getConsent(supabase, userId, scope);
  if (!consent) throw new ConsentRequiredError(scope);
  return consent;
}

/**
 * Grant a scope. Idempotent: an existing live grant is returned untouched
 * (its policy version is what the user actually agreed to). A concurrent
 * double-tap loses the partial unique index race and re-reads the winner.
 */
export async function grantConsent(
  supabase: SupabaseClient,
  userId: string,
  scope: ConsentScope,
  opts: { surface: ConsentSurface; evidenceAssetId?: string | undefined }
): Promise<TwinConsent | null> {
  const existing = await getConsent(supabase, userId, scope);
  if (existing) return existing;
  const { data, error } = await supabase
    .from("twin_consents")
    .insert({
      user_id: userId,
      scope,
      policy_version: CONSENT_POLICY_VERSION,
      surface: opts.surface,
      evidence_asset_id: opts.evidenceAssetId ?? null,
    })
    .select(COLUMNS)
    .single();
  if (error) {
    if (error.code === "23505") return await getConsent(supabase, userId, scope);
    return null;
  }
  return data as TwinConsent;
}

/** Revoke a scope. True when a live grant was closed. */
export async function revokeConsent(
  supabase: SupabaseClient,
  userId: string,
  scope: ConsentScope
): Promise<boolean> {
  const { data, error } = await supabase
    .from("twin_consents")
    .update({ revoked_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("scope", scope)
    .is("revoked_at", null)
    .select("id");
  return !error && (data ?? []).length > 0;
}
