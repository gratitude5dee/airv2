/**
 * Strict router-plan schema ported from outsideairworker src/schema.ts.
 * Groq strict mode is the primary correctness boundary; parseRouterPlan only
 * narrows untyped HTTP JSON before it reaches the media backend.
 */

export const MODES = ["imagine", "animate", "zap", "chat", "refuse"] as const;
export const ASPECT_RATIOS = [
  "16:9",
  "9:16",
  "1:1",
  "4:3",
  "3:4",
  "21:9",
  "auto",
] as const;
export const QUALITIES = ["low", "medium", "high", "auto"] as const;
export const INPUT_IMAGE_USES = [
  "none",
  "first_frame",
  "reference",
  "edit_source",
] as const;

export type Mode = (typeof MODES)[number];
export type AspectRatio = (typeof ASPECT_RATIOS)[number];
export type Quality = (typeof QUALITIES)[number];
export type InputImageUse = (typeof INPUT_IMAGE_USES)[number];

export interface GenerationParams {
  aspect_ratio: AspectRatio;
  duration: number | null;
  generate_audio: boolean;
  quality: Quality;
  use_input_image_as: InputImageUse;
}

export interface RouterPlan {
  chat_reply: string;
  delivery_line: string;
  expanded_prompt: string;
  mode: Mode;
  needs_input: boolean;
  params: GenerationParams;
}

export const ROUTER_JSON_SCHEMA = {
  type: "object",
  properties: {
    mode: { type: "string", enum: MODES },
    needs_input: { type: "boolean" },
    chat_reply: {
      type: "string",
      description: "What WZRD sends BEFORE generating. <=12 words.",
    },
    delivery_line: {
      type: "string",
      description: "What WZRD sends AFTER the media lands. <=10 words.",
    },
    expanded_prompt: {
      type: "string",
      description: "Empty string when mode is chat or refuse.",
    },
    params: {
      type: "object",
      properties: {
        aspect_ratio: { type: "string", enum: ASPECT_RATIOS },
        duration: {
          type: ["integer", "null"],
          description: "Seconds. null for imagine.",
        },
        quality: { type: "string", enum: QUALITIES },
        generate_audio: { type: "boolean" },
        use_input_image_as: { type: "string", enum: INPUT_IMAGE_USES },
      },
      required: [
        "aspect_ratio",
        "duration",
        "quality",
        "generate_audio",
        "use_input_image_as",
      ],
      additionalProperties: false,
    },
  },
  required: [
    "mode",
    "needs_input",
    "chat_reply",
    "delivery_line",
    "expanded_prompt",
    "params",
  ],
  additionalProperties: false,
} as const;

export const ROUTER_RESPONSE_FORMAT = {
  type: "json_schema",
  json_schema: {
    name: "wzrd_plan",
    strict: true,
    schema: ROUTER_JSON_SCHEMA,
  },
} as const;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const PLAN_KEYS = new Set([
  "mode",
  "needs_input",
  "chat_reply",
  "delivery_line",
  "expanded_prompt",
  "params",
]);
const PARAM_KEYS = new Set([
  "aspect_ratio",
  "duration",
  "quality",
  "generate_audio",
  "use_input_image_as",
]);

const hasOnlyKeys = (
  value: Record<string, unknown>,
  allowed: Set<string>
): boolean => Object.keys(value).every((key) => allowed.has(key));

const inList = <T extends readonly string[]>(
  value: unknown,
  allowed: T
): value is T[number] => typeof value === "string" && allowed.includes(value);

export function parseRouterPlan(value: unknown): RouterPlan {
  if (
    !isRecord(value) ||
    !isRecord(value["params"]) ||
    !hasOnlyKeys(value, PLAN_KEYS) ||
    !hasOnlyKeys(value["params"], PARAM_KEYS)
  ) {
    throw new Error("Router response is missing its plan object");
  }

  const { params } = value;
  if (
    !inList(value["mode"], MODES) ||
    typeof value["needs_input"] !== "boolean" ||
    typeof value["chat_reply"] !== "string" ||
    typeof value["delivery_line"] !== "string" ||
    typeof value["expanded_prompt"] !== "string" ||
    !inList(params["aspect_ratio"], ASPECT_RATIOS) ||
    !inList(params["quality"], QUALITIES) ||
    typeof params["generate_audio"] !== "boolean" ||
    !inList(params["use_input_image_as"], INPUT_IMAGE_USES) ||
    !(
      params["duration"] === null ||
      (typeof params["duration"] === "number" && Number.isInteger(params["duration"]))
    )
  ) {
    throw new Error("Router response does not match the WZRD plan schema");
  }

  return {
    mode: value["mode"],
    needs_input: value["needs_input"],
    chat_reply: value["chat_reply"],
    delivery_line: value["delivery_line"],
    expanded_prompt: value["expanded_prompt"],
    params: {
      aspect_ratio: params["aspect_ratio"],
      duration: params["duration"],
      quality: params["quality"],
      generate_audio: params["generate_audio"],
      use_input_image_as: params["use_input_image_as"],
    },
  };
}

export function isGenerationPlan(plan: RouterPlan): boolean {
  return (
    !plan.needs_input &&
    (plan.mode === "imagine" || plan.mode === "animate" || plan.mode === "zap")
  );
}
