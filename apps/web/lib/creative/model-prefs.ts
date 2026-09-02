/**
 * Per-user creative model choice (Settings → CREATIVE MODELS), one pick per
 * lane: /imagine, /edit (an /imagine with an attached image), /animate, and
 * /zap. The default in each lane is the model the lane already shipped
 * with; every alternate is validated against this catalog on write and on
 * read, so a stale row can never route a paid job to an arbitrary model.
 *
 * Slugs are verified against GMI's live model listing
 * (GET <queue>/models); each model's payload is adapted to its advertised
 * parameter schema in gmi.ts buildGenerationRequest. The /zap lane is the
 * exception: it renders on fal.ai, so its slug is a fal endpoint family and
 * its payload is built in fal.ts.
 *
 * Each catalog entry carries a short prompting guide, mirrored in
 * prompt-guides/prompt.md — the router appends the selected model's guide
 * to its system prompt so the compiled brief is optimized for the model
 * that will actually render it (metaprompting).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const CREATIVE_LANES = ["imagine", "edit", "animate", "zap"] as const;
export type CreativeLane = (typeof CREATIVE_LANES)[number];

export const LANE_LABELS: Record<CreativeLane, string> = {
  imagine: "/imagine — image",
  edit: "/edit — image edit",
  animate: "/animate — video",
  zap: "/zap — video edit",
};

export interface CreativeLaneModel {
  slug: string;
  label: string;
  guide: string;
}

export const LANE_MODELS: Record<CreativeLane, readonly CreativeLaneModel[]> = {
  imagine: [
    {
      slug: "gpt-image-2-generate",
      label: "OpenAI Image 2",
      guide:
        "Dense natural-language brief. Order subject → action → setting → lighting → lens/medium → palette → mood. Excellent rendered text: put exact copy in double quotes. No negative prompts.",
    },
    {
      slug: "Flux2-Dev",
      label: "Flux",
      guide:
        "Concise comma-separated visual tags after a one-sentence scene. Strong at photorealism and graphic composition; specify camera (e.g. 85mm portrait) and lighting explicitly. Avoid long prose.",
    },
    {
      slug: "seedream-4-0-250828",
      label: "Seedream",
      guide:
        "Cinematic one-paragraph description. Leads with style keywords (e.g. editorial photo, anime key visual), then subject and setting. Handles multi-subject scenes well; keep text rendering minimal.",
    },
  ],
  edit: [
    {
      slug: "gpt-image-2-edit",
      label: "OpenAI Image 2 Edit",
      guide:
        "Describe only the change, preserving everything else: 'same person, same lighting, replace X with Y'. Name what must stay identical (face, pose, background) before the edit.",
    },
    {
      slug: "gemini-3.1-flash-image",
      label: "Nano Banana (Gemini Flash Image)",
      guide:
        "Short imperative edit instruction. One change per request works best; identity preservation is strong, so reference 'the person in the image' rather than re-describing them.",
    },
    {
      slug: "reve-edit-20250915",
      label: "Reve",
      guide:
        "Precise spatial language: name the region ('top-left sign', 'the jacket'), then the replacement. Good at typography edits — quote exact replacement text.",
    },
  ],
  animate: [
    {
      slug: "seedance-2-0-fast-260128",
      label: "Seedance 2.0",
      guide:
        "Shot direction: subject action → one camera move → environmental motion → light behavior → ambient sound. One continuous motion per shot; with a first frame, describe only what changes.",
    },
    {
      slug: "seedance-2-5-260628",
      label: "Seedance 2.5",
      guide:
        "Same shot-direction structure as 2.0 with better multi-shot coherence — you may specify up to two cuts ('cut to close-up'). Name audio cues explicitly.",
    },
    {
      slug: "ltx-2-fast-text-to-video",
      label: "LTX",
      guide:
        "Fast, motion-first generations. Lead with the movement verb and keep the scene simple: one subject, one camera move, flat lighting descriptions work best.",
    },
    {
      slug: "happyhorse-1.1-t2v",
      label: "Happyhorse",
      guide:
        "Stylized/expressive motion. Describe mood and energy ('bouncy, playful loop') alongside the action; strong for character animation and loops.",
    },
    {
      slug: "MiniMax-H3",
      label: "H3 (MiniMax)",
      guide:
        "High-fidelity realism. Write like a cinematographer: lens, depth of field, and natural physics ('handheld 35mm, shallow focus'); avoid surreal instructions.",
    },
  ],
  zap: [
    {
      slug: "minimax/h3-max",
      label: "H3 Max Turbo (MiniMax, fal)",
      guide:
        'Direct one-shot film direction, 5–10s; direct the sound as deliberately as the picture. Give each reference an explicit job: first image is the opening frame, a second image is the closing frame, others are context. Write shot, subject action, one camera move with lens and film language ("handheld 35mm push-in, fine grain"), lighting, style, then audio as a plain instruction ("audio: rain on metal, one low synth pulse, no dialogue"). Name the framing in words — "horizontal" for 16:9, "vertical" for 9:16. Use a timed beat list ("0-2s …, 2-5s …") when the shot has distinct beats and time audio to the beats. Renders legible text: quote exact on-screen copy and say how the type animates. Long concrete briefs are fine; avoid negatives and tag soup.',
    },
  ],
};

export const DEFAULT_LANE_MODELS: Record<CreativeLane, string> = {
  imagine: "gpt-image-2-generate",
  edit: "gpt-image-2-edit",
  animate: "seedance-2-0-fast-260128",
  zap: "minimax/h3-max",
};

export type CreativePrefs = Record<CreativeLane, string>;

export function isCreativeLane(value: string): value is CreativeLane {
  return (CREATIVE_LANES as readonly string[]).includes(value);
}

export function isLaneModel(lane: CreativeLane, slug: string): boolean {
  return LANE_MODELS[lane].some((model) => model.slug === slug);
}

/** The selected model's prompting guide, for router metaprompting. */
export function guideForModel(slug: string): string | null {
  for (const lane of CREATIVE_LANES) {
    const match = LANE_MODELS[lane].find((model) => model.slug === slug);
    if (match) return match.guide;
  }
  return null;
}

/** Reads the user's lane choices, falling back to each lane's default. */
export async function loadCreativePrefs(
  supabase: SupabaseClient,
  userId: string,
): Promise<CreativePrefs> {
  const { data } = await supabase
    .from("creative_prefs")
    .select("imagine_model, edit_model, animate_model, zap_model")
    .eq("user_id", userId)
    .maybeSingle();
  const resolve = (lane: CreativeLane, value: unknown): string => {
    const slug = typeof value === "string" ? value : "";
    return isLaneModel(lane, slug) ? slug : DEFAULT_LANE_MODELS[lane];
  };
  return {
    imagine: resolve("imagine", data?.imagine_model),
    edit: resolve("edit", data?.edit_model),
    animate: resolve("animate", data?.animate_model),
    zap: resolve("zap", data?.zap_model),
  };
}

export async function setCreativeModel(
  supabase: SupabaseClient,
  userId: string,
  lane: CreativeLane,
  slug: string,
): Promise<boolean> {
  if (!isLaneModel(lane, slug)) return false;
  const { error } = await supabase.from("creative_prefs").upsert(
    {
      user_id: userId,
      [`${lane}_model`]: slug,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" },
  );
  return !error;
}
