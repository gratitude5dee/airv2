/**
 * Identity image generation shared by the onboarding "generated identity"
 * panel, the settings IDENTITY VAULT and the /twin image lane. Everything
 * runs the metered "imagine" lane (GPT Image 2 through the GMI queue — the
 * codebase's native OpenAI image integration): with a reference attached
 * the router lands on gpt-image-2-edit, without one on gpt-image-2-generate.
 *
 * Three artefacts, all bound to the user's @username and all consent-gated
 * (likeness scope, checked server-side):
 *   character sheet  — multi-view reference grid; from photos or from a
 *                      written description of an original agent identity
 *   profile image    — one reusable hero portrait, approved by the owner
 *   alternates       — optional extra looks derived from the profile image
 * Generated drafts never enter the vault until the owner approves them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset } from "../assets/pipeline";
import type { MediaInput } from "../creative/gmi";
import { createCreativeJob } from "../creative/jobs";
import { directCreativePlan, type CreativeCommandTurn } from "../creative/router";
import { executeCreativeJob } from "../creative/run";
import {
  isVaultRole,
  listIdentityAssets,
  removeIdentityAsset,
  retagIdentityAsset,
  signedIdentityUrl,
  tagIdentityAsset,
  untagIdentityAsset,
  type IdentityAssetView,
  type IdentityRole,
} from "./assets";
import { CONSENT_LINES, hasConsent } from "./consent";
import { selectedReferenceSheet } from "./references";

/** Bump when a template changes; written to creative_jobs.prompt_version. */
export const IDENTITY_PROMPT_VERSION = "identity-v3";

export const DESCRIPTION_MAX_CHARS = 500;
export const STYLE_MAX_CHARS = 200;

const IDENTITY_LOCK =
  "Keep the exact same person across every view: same face, hair, skin tone, build and age. No text, no watermark.";

/** Fixed prompt template — the sheet is bound to the user's @username so
 * downstream image/video generation can reference it. */
export function characterSheetPrompt(
  username: string,
  description?: string
): string {
  const subject = description?.trim()
    ? `an original character described as: ${description.trim()}`
    : `the same person from the attached private reference sheet`;
  return (
    `Create a clean character reference sheet for @${username}: ` +
    `a grid of consistent portraits of ${subject} — front, three-quarter, ` +
    `and profile views, plus one smiling and one neutral expression. ` +
    `Neutral studio background, even lighting, photorealistic. ${IDENTITY_LOCK}`
  );
}

/** One reusable hero portrait, derived from the best reference. */
export function profileImagePrompt(username: string, style?: string): string {
  const look = style?.trim()
    ? style.trim()
    : "editorial studio portrait, soft key light, shallow depth of field, calm confident expression";
  return (
    `A single high-quality profile portrait of @${username}, the person in the ` +
    `attached reference: head and shoulders, looking at camera, ${look}. ` +
    IDENTITY_LOCK
  );
}

export interface CharacterSheetResult {
  ok: boolean;
  notice: string;
  asset?: CreativeAsset | undefined;
  deliveryUrl?: string | undefined;
  jobId?: string | undefined;
}

/** The best image to anchor a generation on, in priority order. */
export async function referenceImageForGeneration(
  supabase: SupabaseClient,
  userId: string,
  prefer: readonly IdentityRole[] = [
    "profile_image",
    "character_sheet",
    "reference_sheet",
    "selfie",
    "alt_image",
  ]
): Promise<IdentityAssetView | null> {
  const identity = await listIdentityAssets(supabase, userId);
  for (const role of prefer) {
    const hit = identity.find(
      (entry) => entry.role === role && entry.status === "ready"
    );
    if (hit) return hit;
  }
  return null;
}

async function mediaInputFor(
  supabase: SupabaseClient,
  reference: IdentityAssetView | null
): Promise<MediaInput[]> {
  if (!reference) return [];
  const url = await signedIdentityUrl(supabase, reference.asset).catch(() => null);
  return url ? [{ kind: "image", url }] : [];
}

/** One metered high-quality render on the imagine lane. */
async function renderIdentityImage(
  supabase: SupabaseClient,
  userId: string,
  text: string,
  mediaInputs: MediaInput[]
): Promise<
  | { ok: true; asset: CreativeAsset; deliveryUrl?: string | undefined; jobId: string }
  | { ok: false; notice: string; jobId: string }
> {
  const job = await createCreativeJob(supabase, userId, "web", "imagine");
  const turn: CreativeCommandTurn = {
    mode: "imagine",
    cleanedText: text,
    text,
    mediaInputs,
  };
  const plan = directCreativePlan(turn);
  plan.params = { ...plan.params, quality: "high", aspect_ratio: "1:1" };
  const result = await executeCreativeJob(supabase, job.id, userId, turn, {
    plan,
    promptVersion: IDENTITY_PROMPT_VERSION,
  });
  if (result.status === "delivered" && result.asset) {
    return {
      ok: true,
      asset: result.asset,
      deliveryUrl: result.deliveryUrl,
      jobId: job.id,
    };
  }
  return { ok: false, notice: result.line, jobId: job.id };
}

/**
 * Step one of the two-step flow: run one metered character-sheet render for
 * the user — anchored on their best reference photo, or on a written
 * description when they are designing an original agent identity — and
 * hold the delivered asset as a character_sheet_draft awaiting the owner's
 * confirmation (saveCharacterSheetDraft) or discard.
 */
export async function generateCharacterSheet(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  opts: { description?: string | undefined } = {}
): Promise<CharacterSheetResult> {
  if (!(await hasConsent(supabase, userId, "likeness"))) {
    return { ok: false, notice: CONSENT_LINES.likeness };
  }
  const description = opts.description?.trim().slice(0, DESCRIPTION_MAX_CHARS);
  const reference = description
    ? null
    : await selectedReferenceSheet(supabase, userId);
  if (!description && !reference) {
    return {
      ok: false,
      notice: "choose 1–6 photos in Reference media before generating a character sheet.",
    };
  }
  const text = characterSheetPrompt(username, description);
  const rendered = await renderIdentityImage(
    supabase,
    userId,
    text,
    await mediaInputFor(supabase, reference)
  );
  if (!rendered.ok) return { ok: false, notice: rendered.notice, jobId: rendered.jobId };
  await tagIdentityAsset(supabase, userId, rendered.asset.id, "character_sheet_draft", {
    source: "generated",
  });
  return {
    ok: true,
    notice: "character sheet ready — review it below, then save or discard.",
    asset: rendered.asset,
    deliveryUrl: rendered.deliveryUrl,
    jobId: rendered.jobId,
  };
}

/** The user's pending character-sheet draft, if any (newest first). */
export async function getCharacterSheetDraft(
  supabase: SupabaseClient,
  userId: string
): Promise<IdentityAssetView | null> {
  const identity = await listIdentityAssets(supabase, userId);
  return (
    identity.find((entry) => entry.role === "character_sheet_draft") ?? null
  );
}

/** Step two: confirm a draft into the vault as a character_sheet. */
export async function saveCharacterSheetDraft(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  return retagIdentityAsset(
    supabase,
    userId,
    assetId,
    "character_sheet_draft",
    "character_sheet"
  );
}

/** Step two (reject): drop a draft and revoke its delivery URLs. The
 * private master object stays content-addressed under the user's prefix. */
export async function discardCharacterSheetDraft(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  return discardDraft(supabase, userId, assetId, "character_sheet_draft");
}

/**
 * Render the reusable profile image from the best reference (character
 * sheet first, then a selfie) and hold it as a profile_image_draft.
 */
export async function generateProfileImage(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  opts: { style?: string | undefined } = {}
): Promise<CharacterSheetResult> {
  if (!(await hasConsent(supabase, userId, "likeness"))) {
    return { ok: false, notice: CONSENT_LINES.likeness };
  }
  const reference = await referenceImageForGeneration(supabase, userId, [
    "character_sheet",
    "profile_image",
    "reference_sheet",
    "selfie",
    "alt_image",
  ]);
  if (!reference) {
    return {
      ok: false,
      notice: "add a photo or generate a character sheet first — the profile image is derived from it.",
    };
  }
  const style = opts.style?.trim().slice(0, STYLE_MAX_CHARS);
  const rendered = await renderIdentityImage(
    supabase,
    userId,
    profileImagePrompt(username, style),
    await mediaInputFor(supabase, reference)
  );
  if (!rendered.ok) return { ok: false, notice: rendered.notice, jobId: rendered.jobId };
  await tagIdentityAsset(supabase, userId, rendered.asset.id, "profile_image_draft", {
    source: "generated",
  });
  return {
    ok: true,
    notice: "profile image ready — approve it to make it your twin's face, or discard it.",
    asset: rendered.asset,
    deliveryUrl: rendered.deliveryUrl,
    jobId: rendered.jobId,
  };
}

/** The pending profile-image draft, if any. */
export async function getProfileImageDraft(
  supabase: SupabaseClient,
  userId: string
): Promise<IdentityAssetView | null> {
  const identity = await listIdentityAssets(supabase, userId);
  return identity.find((entry) => entry.role === "profile_image_draft") ?? null;
}

/**
 * Approve a draft as *the* profile image. The previous profile image (one
 * per user) is kept as an alternate rather than lost.
 */
export async function approveProfileImageDraft(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  const identity = await listIdentityAssets(supabase, userId);
  const draft = identity.find(
    (entry) => entry.asset_id === assetId && entry.role === "profile_image_draft"
  );
  if (!draft) return false;
  const current = identity.find((entry) => entry.role === "profile_image");
  if (current && current.asset_id !== assetId) {
    const demoted = await retagIdentityAsset(
      supabase,
      userId,
      current.asset_id,
      "profile_image",
      "alt_image"
    );
    if (!demoted) return false;
  }
  return retagIdentityAsset(
    supabase,
    userId,
    assetId,
    "profile_image_draft",
    "profile_image"
  );
}

export async function discardProfileImageDraft(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  return discardDraft(supabase, userId, assetId, "profile_image_draft");
}

/**
 * An extra look derived from the approved profile image — lands straight in
 * the vault as an alternate (the owner already approved the face).
 */
export async function generateAltImage(
  supabase: SupabaseClient,
  userId: string,
  username: string,
  opts: { style?: string | undefined } = {}
): Promise<CharacterSheetResult> {
  if (!(await hasConsent(supabase, userId, "likeness"))) {
    return { ok: false, notice: CONSENT_LINES.likeness };
  }
  const reference = await referenceImageForGeneration(supabase, userId, [
    "profile_image",
    "character_sheet",
  ]);
  if (!reference) {
    return { ok: false, notice: "approve a profile image first — alternates are derived from it." };
  }
  const style = opts.style?.trim().slice(0, STYLE_MAX_CHARS);
  const rendered = await renderIdentityImage(
    supabase,
    userId,
    profileImagePrompt(username, style ?? "a different outfit and setting, same person"),
    await mediaInputFor(supabase, reference)
  );
  if (!rendered.ok) return { ok: false, notice: rendered.notice, jobId: rendered.jobId };
  await tagIdentityAsset(supabase, userId, rendered.asset.id, "alt_image", {
    source: "generated",
  });
  return {
    ok: true,
    notice: "alternate look saved to your vault.",
    asset: rendered.asset,
    deliveryUrl: rendered.deliveryUrl,
    jobId: rendered.jobId,
  };
}

async function discardDraft(
  supabase: SupabaseClient,
  userId: string,
  assetId: string,
  role: IdentityRole
): Promise<boolean> {
  const identity = await listIdentityAssets(supabase, userId);
  const draft = identity.find(
    (entry) => entry.asset_id === assetId && entry.role === role
  );
  if (!draft) return false;
  if (
    identity.some((entry) => entry.asset_id === assetId && isVaultRole(entry.role))
  ) {
    // Also referenced from the vault — only drop the draft tag.
    return untagIdentityAsset(supabase, userId, assetId, role);
  }
  return removeIdentityAsset(supabase, userId, assetId);
}
