/**
 * Per-user creative model choice (Settings → CREATIVE MODELS), one pick per
 * lane: /imagine, /edit (an /imagine with an attached image), /animate, and
 * /zap. The default in each lane is the model the lane already shipped
 * with; every alternate is validated against this catalog on write and on
 * read, so a stale row can never route a paid job to an arbitrary model.
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
      slug: "flux-1-dev",
      label: "Flux",
      guide:
        "Concise comma-separated visual tags after a one-sentence scene. Strong at photorealism and graphic composition; specify camera (e.g. 85mm portrait) and lighting explicitly. Avoid long prose.",
    },
    {
      slug: "seedream-4-0",
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
      slug: "nano-banana",
      label: "Nano Banana",
      guide:
        "Short imperative edit instruction. One change per request works best; identity preservation is strong, so reference 'the person in the image' rather than re-describing them.",
    },
    {
      slug: "reve-edit",
      label: "Reve",
      guide:
        "Precise spatial language: name the region ('top-left sign', 'the jacket'), then the replacement. Good at typography edits — quote exact replacement text.",
    },
    {
      slug: "qwen-image-edit",
      label: "Qwen Edit",
      guide:
        "Plain-language instruction plus a short description of the desired result. Handles style transfer well ('repaint in watercolor'); state 'keep composition unchanged' when it matters.",
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
      slug: "seedance-2-5",
      label: "Seedance 2.5",
      guide:
        "Same shot-direction structure as 2.0 with better multi-shot coherence — you may specify up to two cuts ('cut to close-up'). Name audio cues explicitly.",
    },
    {
      slug: "ltx-2",
      label: "LTX",
      guide:
        "Fast, motion-first generations. Lead with the movement verb and keep the scene simple: one subject, one camera move, flat lighting descriptions work best.",
    },
    {
      slug: "happyhorse-video",
      label: "Happyhorse",
      guide:
        "Stylized/expressive motion. Describe mood and energy ('bouncy, playful loop') alongside the action; strong for character animation and loops.",
    },
    {
      slug: "h3-video",
      label: "H3",
      guide:
        "High-fidelity realism. Write like a cinematographer: lens, depth of field, and natural physics ('handheld 35mm, shallow focus'); avoid surreal instructions.",
    },
  ],
  zap: [
    {
      slug: "gemini-omni-flash-preview",
      label: "Google Omni",
      guide:
        "Tight kinetic 3–6s instruction: one subject, one motion, one visual hook. With attached video, phrase it as an edit instruction; reference images are shared visual context.",
    },
  ],
};

export const DEFAULT_LANE_MODELS: Record<CreativeLane, string> = {
  imagine: "gpt-image-2-generate",
  edit: "gpt-image-2-edit",
  animate: "seedance-2-0-fast-260128",
  zap: "gemini-omni-flash-preview",
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
  userId: string
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
  slug: string
): Promise<boolean> {
  if (!isLaneModel(lane, slug)) return false;
  const { error } = await supabase.from("creative_prefs").upsert(
    {
      user_id: userId,
      [`${lane}_model`]: slug,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id" }
  );
  return !error;
}
