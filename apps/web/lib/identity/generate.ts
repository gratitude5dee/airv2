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
  listIdentityAssets,
  signedIdentityUrl,
  tagIdentityAsset,
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
 * Run one metered character-sheet render for the user, attaching their most
 * recent selfie as the identity reference, and tag the delivered asset as a
 * character_sheet identity reference.
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
    await tagIdentityAsset(supabase, userId, result.asset.id, "character_sheet");
    return {
      ok: true,
      notice: "character sheet ready.",
      asset: result.asset,
      deliveryUrl: result.deliveryUrl,
    };
  }
  return { ok: false, notice: result.line };
}
