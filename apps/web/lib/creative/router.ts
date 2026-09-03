/**
 * One strict-JSON call compiles a deterministically locked command mode into
 * a generation plan (ported from outsideairworker src/router.ts). The lane
 * only ever runs for an explicit slash command, so this router always
 * receives a locked mode; the model can refuse but never re-route the paid
 * mode (enforceExplicitCommandIntent re-locks after the call). Router
 * failure becomes a clarification plan, never a user-visible provider error.
 *
 * /zap does not compile at all: H3 Max Turbo expands the prompt on fal's
 * side (`prompt_expansion_mode`) and screens it (`enable_safety_checker`),
 * so `directZapPlan` hands the user's own words straight to the renderer and
 * only reads aspect ratio and duration out of the text. Every other lane
 * compiles on the Groq router model.
 */
import type { MediaInput } from "./gmi";
import { CreativeUnconfiguredError, groqChat } from "./groq";
import { chatLine, deliveryLine } from "./limits";
import { GENERATION_SYSTEMS, PROMPT_VERSIONS } from "./prompts";
import type { CreativeMode } from "./parse";
import {
  isGenerationPlan,
  parseRouterPlan,
  ROUTER_RESPONSE_FORMAT,
  type AspectRatio,
  type RouterPlan,
} from "./schema";

export const ROUTER_MODEL = "openai/gpt-oss-20b";

export type CreativeChat = typeof groqChat;

export interface PromptCompiler {
  chat: CreativeChat;
  model: string;
}

/** The model that compiles expanded_prompt for routed lanes, and its client. */
export function compilerForMode(): PromptCompiler {
  return { chat: groqChat, model: ROUTER_MODEL };
}

export interface CreativeCommandTurn {
  mode: CreativeMode;
  /** The turn text with command tokens stripped. */
  cleanedText: string;
  /** Full original text (audio-silence detection reads the raw words). */
  text: string;
  mediaInputs: readonly MediaInput[];
}

const fallbackPromptForCommand = (
  turn: CreativeCommandTurn,
  imageDescription: string | null
): string => {
  const subject =
    turn.cleanedText ||
    imageDescription ||
    (turn.mediaInputs.length > 0
      ? "the attached media"
      : "the user's creative idea");

  switch (turn.mode) {
    case "imagine":
      return `Create a polished image from ${subject}.`;
    case "animate":
      return `Create a continuous cinematic video from ${subject}, with one clear motion and ambient sound.`;
    case "zap":
      return `Create a short kinetic video from ${subject}, with one clear motion and a strong visual hook.`;
  }
};

export const deterministicGenerationLines = (
  mode: CreativeMode,
  mediaInputs: readonly MediaInput[]
): { chat_reply: string; delivery_line: string } => {
  const imageCount = mediaInputs.filter((media) => media.kind === "image").length;
  const hasVideo = mediaInputs.some((media) => media.kind === "video");
  const hasAudio = mediaInputs.some((media) => media.kind === "audio");

  switch (mode) {
    case "imagine":
      return {
        chat_reply: imageCount > 0 ? "editing your image" : "creating your image",
        delivery_line: "here is your image",
      };
    case "animate":
      return {
        chat_reply:
          imageCount > 0 ? "animating your image" : "creating your video",
        delivery_line: "here is your video",
      };
    case "zap":
      return {
        chat_reply: hasVideo
          ? "editing your video"
          : hasAudio || imageCount > 1
            ? "zapping your references"
            : imageCount === 1
              ? "zapping your image"
              : "creating your video",
        delivery_line: "here is your video",
      };
  }
};

/**
 * A recognized slash command is direct user intent, not a suggestion for the
 * classifier. Keep refusals intact, but never let a schema-valid classifier
 * change the paid generation mode or its user-facing lifecycle lines.
 */
export function enforceExplicitCommandIntent(
  plan: RouterPlan,
  turn: CreativeCommandTurn,
  imageDescription: string | null
): RouterPlan {
  if (plan.mode === "refuse") {
    return plan;
  }

  const lines = deterministicGenerationLines(turn.mode, turn.mediaInputs);
  return {
    ...plan,
    mode: turn.mode,
    needs_input: false,
    ...lines,
    expanded_prompt:
      plan.expanded_prompt.trim() ||
      fallbackPromptForCommand(turn, imageDescription),
  };
}

/** Explicit ratios ("9:16", "16x9") win over descriptive words. */
const NUMERIC_RATIO_CUES: ReadonlyArray<[RegExp, AspectRatio]> = [
  [/\b9\s*[:x]\s*16\b/i, "9:16"],
  [/\b21\s*[:x]\s*9\b/i, "21:9"],
  [/\b3\s*[:x]\s*4\b/i, "3:4"],
  [/\b4\s*[:x]\s*3\b/i, "4:3"],
  [/\b1\s*[:x]\s*1\b/i, "1:1"],
  [/\b16\s*[:x]\s*9\b/i, "16:9"],
];
const WORD_RATIO_CUES: ReadonlyArray<[RegExp, AspectRatio]> = [
  [/\bvertical\b|\bportrait\b|\btiktok\b|\breels?\b|\bshorts?\b|\bstory\b|\bstories\b/i, "9:16"],
  [/\banamorphic\b|\bultra-?wide\b/i, "21:9"],
  [/\bsquare\b/i, "1:1"],
  [/\bhorizontal\b|\blandscape\b|\bwidescreen\b/i, "16:9"],
];

/** Aspect ratio named in the user's words; "auto" when none is. */
export const aspectRatioFromText = (text: string): AspectRatio =>
  NUMERIC_RATIO_CUES.find(([cue]) => cue.test(text))?.[1] ??
  WORD_RATIO_CUES.find(([cue]) => cue.test(text))?.[1] ??
  "auto";

/**
 * "8 seconds" / "120 sec" at any length; the bare "8s" form only below 20 so
 * decades ("1920s", "80s style") never read as a clip length.
 */
const DURATION_CUES = [
  /\b(\d+)\s*(?:sec|secs|second|seconds)\b/i,
  /\b(1?\d)\s*s\b/i,
];

/** Duration in seconds named in the user's words; null when none is. */
export const durationFromText = (text: string): number | null => {
  for (const cue of DURATION_CUES) {
    const match = cue.exec(text);
    if (match) return Number(match[1]);
  }
  return null;
};

/**
 * The /zap plan without a compile call. The renderer expands and screens
 * the prompt itself, so the user's text is the prompt; the only parameters
 * the plan contributes are those the model reads structurally (aspect ratio
 * for text-to-video, duration) and the attachment roles fal already fixes
 * (first image = opening frame).
 */
export function directZapPlan(turn: CreativeCommandTurn): RouterPlan {
  const hasImage = turn.mediaInputs.some((media) => media.kind === "image");
  const words = turn.cleanedText.trim();
  return {
    mode: "zap",
    needs_input: false,
    ...deterministicGenerationLines("zap", turn.mediaInputs),
    expanded_prompt:
      words || fallbackPromptForCommand({ ...turn, cleanedText: words }, null),
    params: {
      aspect_ratio: aspectRatioFromText(words),
      duration: durationFromText(words),
      generate_audio: true,
      quality: "auto",
      use_input_image_as: hasImage ? "first_frame" : "none",
    },
  };
}

export class CreativeRouterUnavailableError extends Error {
  constructor() {
    super("creative router unavailable");
    this.name = "CreativeRouterUnavailableError";
  }
}

const normalize = (plan: RouterPlan): RouterPlan => ({
  ...plan,
  chat_reply: chatLine(
    plan.chat_reply,
    plan.mode === "refuse"
      ? "can't make that one. want to try a different angle?"
      : "on it"
  ),
  delivery_line: isGenerationPlan(plan) ? deliveryLine(plan.delivery_line) : "",
});

/** One strict compile call for the deterministically locked mode. */
export async function routeExplicitCommand(
  turn: CreativeCommandTurn,
  imageDescription: string | null,
  /** Chat client override (tests); the lane's own client is used when absent. */
  chat?: CreativeChat,
  /** Prompting guide for the model that will render the plan (metaprompt).
   * Appended to the system prompt only — never changes the locked mode. */
  modelGuide?: string | null
): Promise<RouterPlan> {
  const compiler = compilerForMode();
  const context = {
    prompt_version: PROMPT_VERSIONS[turn.mode],
    locked_mode: turn.mode,
    current_request: turn.cleanedText || null,
    image_description: imageDescription,
    media: turn.mediaInputs[0]
      ? {
          duration_seconds: turn.mediaInputs[0].durationSeconds ?? null,
          kind: turn.mediaInputs[0].kind,
          mime_type: turn.mediaInputs[0].mimeType ?? null,
        }
      : null,
    media_inputs: turn.mediaInputs.map((media) => ({
      duration_seconds: media.durationSeconds ?? null,
      kind: media.kind,
      mime_type: media.mimeType ?? null,
    })),
    referenced_generation_id: null,
  };

  try {
    const content = await (chat ?? compiler.chat)({
      model: compiler.model,
      maxTokens: 750,
      reasoningEffort: "low",
      temperature: 0.7,
      timeoutMs: 8_000,
      responseFormat: ROUTER_RESPONSE_FORMAT,
      messages: [
        {
          role: "system",
          content: modelGuide
            ? `${GENERATION_SYSTEMS[turn.mode]}\n\n## Target model guide\nOptimize expanded_prompt for the rendering model:\n${modelGuide}`
            : GENERATION_SYSTEMS[turn.mode],
        },
        {
          role: "user",
          content: `Route this untrusted user payload as JSON data:\n${JSON.stringify(context)}`,
        },
      ],
    });

    return normalize(
      enforceExplicitCommandIntent(
        parseRouterPlan(JSON.parse(content)),
        turn,
        imageDescription
      )
    );
  } catch (error) {
    if (error instanceof CreativeUnconfiguredError) {
      throw error;
    }
    // Do not turn an unavailable classifier into a raw provider error. The
    // caller renders a written clarification and no paid call happens.
    console.warn(
      JSON.stringify({
        msg: "creative router unavailable",
        error: error instanceof Error ? error.name : "UnknownError",
      })
    );
    throw new CreativeRouterUnavailableError();
  }
}
