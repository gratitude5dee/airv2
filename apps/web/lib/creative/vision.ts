/**
 * Vision pre-pass ported from outsideairworker src/vision.ts: one Groq call
 * (qwen/qwen3.6-27b), ≤3 images, output clamped to 40 words. Non-fatal at
 * the call site — a failed description degrades routing, never the turn.
 */
import { groqChat } from "./groq";
import { cleanLine } from "./limits";
import { VISION_SYSTEM } from "./prompts";

const VISION_MODEL = "qwen/qwen3.6-27b";
const MAX_VISION_IMAGES = 3;

/** Returns a compact visual caption for one or more inbound image references. */
export async function describeImage(
  input: string | readonly string[],
  chat: typeof groqChat = groqChat
): Promise<string> {
  const urls = (typeof input === "string" ? [input] : [...input]).slice(
    0,
    MAX_VISION_IMAGES
  );
  if (urls.length === 0) {
    throw new Error("Vision requires at least one image URL");
  }
  const response = await chat({
    model: VISION_MODEL,
    maxTokens: 100,
    temperature: 0.2,
    reasoningEffort: "none",
    timeoutMs: 8_000,
    messages: [
      { role: "system", content: VISION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              urls.length === 1
                ? "Describe this image."
                : "Describe these image references together.",
          },
          ...urls.map((url) => ({
            type: "image_url" as const,
            image_url: { url },
          })),
        ],
      },
    ],
  });

  const words = cleanLine(response).split(" ").filter(Boolean).slice(0, 40);
  if (words.length === 0) {
    throw new Error("Vision model returned an empty image description");
  }
  return words.join(" ");
}
