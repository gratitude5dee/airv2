/**
 * luna-fast prompt compiler for the /zap lane. The inference gateway route
 * itself is box-facing (it authenticates a per-box GATEWAY_TOKEN and meters
 * into agent_runs), so a server-side creative compile talks to the same
 * upstream with the same server-side resolution the gateway performs: the
 * fast tier's real model (gpt-5.6-luna), OpenAI `service_tier: "fast"`, and
 * the GPT-5.6 parameter normalization (max_completion_tokens, no sampling
 * knobs). Control-plane only — the key never reaches a browser or a box (C2).
 */
import { env } from "../env";
import {
  modelForTier,
  reasoningForTier,
  serviceTierForTier,
} from "../entitlements/models";
import { CreativeUnconfiguredError, type GroqChatInput } from "./groq";

/** The `fast` speed tier's model, resolved the same way the gateway does. */
export const lunaModel = (): string => modelForTier("fast");

interface LunaResponse {
  choices?: Array<{
    message?: {
      content?: string | null;
      refusal?: string | null;
    };
  }>;
}

export class LunaRequestError extends Error {
  readonly status?: number | undefined;
  readonly timedOut: boolean;

  constructor(
    message: string,
    failure: { status?: number; timedOut?: boolean } = {},
  ) {
    super(message);
    this.name = "LunaRequestError";
    this.status = failure.status;
    this.timedOut = failure.timedOut ?? false;
  }
}

/**
 * Kept pure so the exact provider request shape is regression-tested.
 * gpt-5.6 rejects `max_tokens` and any non-default sampling parameter, so
 * the router's temperature is dropped rather than sent and refused.
 */
export const buildLunaRequestBody = (
  input: GroqChatInput,
): Record<string, unknown> => {
  const reasoning = input.reasoningEffort ?? reasoningForTier("fast");
  return {
    model: input.model,
    messages: input.messages,
    max_completion_tokens: input.maxTokens,
    // Priority processing unless the deployment configured another tier.
    service_tier: serviceTierForTier("fast") ?? "fast",
    ...(reasoning ? { reasoning_effort: reasoning } : {}),
    ...(input.responseFormat ? { response_format: input.responseFormat } : {}),
  };
};

/** Same contract as groqChat: strict JSON in, message content out. */
export async function lunaChat(input: GroqChatInput): Promise<string> {
  let apiKey: string;
  let baseUrl: string;
  try {
    apiKey = env.modelProviderApiKey();
    baseUrl = env.modelProviderBaseUrl();
  } catch {
    // The creative lane degrades to a written line instead of failing hard.
    throw new CreativeUnconfiguredError("OpenAI");
  }
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    input.timeoutMs ?? 15_000,
  );
  let data: LunaResponse;
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      redirect: "error",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(buildLunaRequestBody(input)),
    });
    if (!response.ok) {
      throw new LunaRequestError(
        `luna chat request failed (${response.status})`,
        { status: response.status },
      );
    }
    data = (await response.json()) as LunaResponse;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new LunaRequestError("luna chat request timed out", {
        timedOut: true,
      });
    }
    if (error instanceof LunaRequestError) {
      throw error;
    }
    throw new LunaRequestError("luna chat request could not be reached");
  } finally {
    clearTimeout(timeout);
  }

  const message = data.choices?.[0]?.message;
  if (message?.refusal) {
    throw new LunaRequestError("luna declined the request");
  }
  if (!message?.content) {
    throw new LunaRequestError("luna returned no message content");
  }
  return message.content;
}
