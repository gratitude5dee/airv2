/**
 * Minimal fetch-based Groq OpenAI-compatible chat client, ported from
 * outsideairworker src/groq.ts. Control-plane only — the key never reaches
 * a browser or a box (C2).
 */
import { env } from "../env";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

export class CreativeUnconfiguredError extends Error {
  constructor(provider: "GMI" | "Groq") {
    super(`${provider} credentials are not configured`);
    this.name = "CreativeUnconfiguredError";
  }
}

export type GroqContent =
  | string
  | Array<{
      image_url?: { url: string };
      text?: string;
      type: "image_url" | "text";
    }>;

export interface GroqMessage {
  content: GroqContent;
  role: "system" | "user";
}

export type GroqReasoningEffort = "none" | "low" | "medium" | "high";

export interface GroqChatInput {
  maxTokens: number;
  messages: readonly GroqMessage[];
  model: string;
  reasoningEffort?: GroqReasoningEffort;
  responseFormat?: unknown;
  temperature?: number;
  timeoutMs?: number;
}

interface GroqResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
}

export class GroqRequestError extends Error {
  readonly status?: number;
  readonly timedOut: boolean;

  constructor(
    message: string,
    failure: { status?: number; timedOut?: boolean } = {}
  ) {
    super(message);
    this.name = "GroqRequestError";
    this.status = failure.status;
    this.timedOut = failure.timedOut ?? false;
  }
}

/** Kept pure so the exact provider request shape is regression-tested. */
export const buildGroqRequestBody = (
  input: GroqChatInput
): Record<string, unknown> => ({
  model: input.model,
  messages: input.messages,
  max_tokens: input.maxTokens,
  temperature: input.temperature ?? 0.7,
  ...(input.reasoningEffort ? { reasoning_effort: input.reasoningEffort } : {}),
  ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
});

export async function groqChat(input: GroqChatInput): Promise<string> {
  const apiKey = env.groqApiKey();
  if (!apiKey) {
    throw new CreativeUnconfiguredError("Groq");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs ?? 15_000);
  let data: GroqResponse;
  try {
    const response = await fetch(GROQ_CHAT_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildGroqRequestBody(input)),
    });
    if (!response.ok) {
      throw new GroqRequestError(`Groq chat request failed (${response.status})`, {
        status: response.status,
      });
    }
    data = (await response.json()) as GroqResponse;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new GroqRequestError("Groq chat request timed out", {
        timedOut: true,
      });
    }
    if (error instanceof GroqRequestError) {
      throw error;
    }
    throw new GroqRequestError("Groq chat request could not be reached");
  } finally {
    clearTimeout(timeout);
  }

  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    throw new GroqRequestError("Groq declined the request");
  }
  if (!message?.content) {
    throw new GroqRequestError("Groq returned no message content");
  }
  return message.content;
}
