/**
 * Character-sheet generation shared by the onboarding "selfies"/"avatar"
 * slides and the settings IDENTITY VAULT. Runs the metered "imagine" lane
 * (GPT Image 2): with a selfie reference attached the router lands on
 * gpt-image-2-edit, without one on gpt-image-2-generate.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset } from "../assets/pipeline";
import type { MediaInput } from "../creative/gmi";
import { createCreativeJob } from "../creative/jobs";
import { executeCreativeJob } from "../creative/run";
import type { CreativeCommandTurn } from "../creative/router";
import {
  isVaultRole,
  listIdentityAssets,
  removeIdentityAsset,
  retagIdentityAsset,
  signedIdentityUrl,
  tagIdentityAsset,
  untagIdentityAsset,
  type IdentityAssetView,
} from "./assets";

/** Fixed prompt template — the sheet is bound to the user's @username so
 * downstream image/video generation can reference it. */
export function characterSheetPrompt(username: string): string {
  return (
    `Create a clean character reference sheet for @${username}: ` +
    `a grid of consistent portraits of the same person from the attached ` +
    `reference photo — front, three-quarter, and profile views, plus one ` +
    `smiling and one neutral expression. Neutral studio background, even ` +
    `lighting, photorealistic, consistent identity across all views.`
  );
}

export interface CharacterSheetResult {
  ok: boolean;
  notice: string;
  asset?: CreativeAsset;
  deliveryUrl?: string;
}

/**
 * Step one of the two-step flow: run one metered character-sheet render for
 * the user, attaching their most recent selfie as the identity reference,
 * and hold the delivered asset as a character_sheet_draft awaiting the
 * owner's confirmation (saveCharacterSheetDraft) or discard.
 */
export async function generateCharacterSheet(
  supabase: SupabaseClient,
  userId: string,
  username: string
): Promise<CharacterSheetResult> {
  const identity = await listIdentityAssets(supabase, userId);
  const selfie = identity.find((entry) => entry.role === "selfie");
  const mediaInputs: MediaInput[] = [];
  if (selfie) {
    const url = await signedIdentityUrl(supabase, selfie.asset);
    if (url) mediaInputs.push({ kind: "image", url });
  }
  const text = characterSheetPrompt(username);
  const job = await createCreativeJob(supabase, userId, "web", "imagine");
  const turn: CreativeCommandTurn = {
    mode: "imagine",
    cleanedText: text,
    text,
    mediaInputs,
  };
  const result = await executeCreativeJob(supabase, job.id, userId, turn);
  if (result.status === "delivered" && result.asset) {
    await tagIdentityAsset(
      supabase,
      userId,
      result.asset.id,
      "character_sheet_draft"
    );
    return {
      ok: true,
      notice: "character sheet ready — review it below, then save or discard.",
      asset: result.asset,
      deliveryUrl: result.deliveryUrl,
    };
  }
  return { ok: false, notice: result.line };
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
  const identity = await listIdentityAssets(supabase, userId);
  const draft = identity.find(
    (entry) =>
      entry.asset_id === assetId && entry.role === "character_sheet_draft"
  );
  if (!draft) return false;
  if (
    identity.some((entry) => entry.asset_id === assetId && isVaultRole(entry.role))
  ) {
    // Also referenced from the vault — only drop the draft tag.
    return untagIdentityAsset(
      supabase,
      userId,
      assetId,
      "character_sheet_draft"
    );
  }
  return removeIdentityAsset(supabase, userId, assetId);
}
