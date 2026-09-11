/**
 * Chat Completions ↔ Responses API translation for OpenAI reasoning models.
 *
 * gpt-5.x on /chat/completions rejects function tools at any
 * reasoning_effort other than "none", which pinned every tool-bearing agent
 * turn to zero reasoning budget. /responses accepts tools and
 * reasoning.effort together, so OpenAI-family reasoning calls are translated
 * both ways here; boxes keep speaking chat.completions to the gateway.
 */

type Json = Record<string, unknown>;

interface ChatMessage {
  role?: string;
  content?: unknown;
  tool_calls?: {
    id?: string;
    function?: { name?: string; arguments?: unknown };
  }[];
  tool_call_id?: string;
}

function textParts(content: unknown): unknown[] {
  if (typeof content === "string") {
    return content ? [{ type: "input_text", text: content }] : [];
  }
  if (!Array.isArray(content)) return [];
  const parts: unknown[] = [];
  for (const part of content as Json[]) {
    if (part["type"] === "text" && typeof part["text"] === "string") {
      parts.push({ type: "input_text", text: part["text"] });
    } else if (part["type"] === "image_url") {
      const url =
        typeof part["image_url"] === "string"
          ? part["image_url"]
          : (part["image_url"] as Json | undefined)?.["url"];
      if (typeof url === "string") {
        parts.push({ type: "input_image", image_url: url });
      }
    }
  }
  return parts;
}

/** chat.completions request body → /responses request body. */
export function toResponsesRequest(
  chat: Json,
  effort: string | undefined
): Json {
  const input: Json[] = [];
  for (const message of (chat["messages"] as ChatMessage[] | undefined) ??
    []) {
    const role = message.role;
    if (role === "system" || role === "developer" || role === "user") {
      const parts = textParts(message.content);
      if (parts.length > 0) {
        input.push({ type: "message", role, content: parts });
      }
    } else if (role === "assistant") {
      const parts: unknown[] = [];
      if (typeof message.content === "string" && message.content) {
        parts.push({ type: "output_text", text: message.content });
      } else if (Array.isArray(message.content)) {
        for (const part of message.content as Json[]) {
          if (part["type"] === "text" && typeof part["text"] === "string") {
            parts.push({ type: "output_text", text: part["text"] });
          }
        }
      }
      if (parts.length > 0) {
        input.push({ type: "message", role: "assistant", content: parts });
      }
      for (const call of message.tool_calls ?? []) {
        input.push({
          type: "function_call",
          call_id: call.id ?? "",
          name: call.function?.name ?? "",
          arguments:
            typeof call.function?.arguments === "string"
              ? call.function.arguments
              : JSON.stringify(call.function?.arguments ?? {}),
        });
      }
    } else if (role === "tool") {
      input.push({
        type: "function_call_output",
        call_id: message.tool_call_id ?? "",
        output:
          typeof message.content === "string"
            ? message.content
            : JSON.stringify(message.content ?? ""),
      });
    }
  }

  const chatTools = chat["tools"];
  const tools = Array.isArray(chatTools)
    ? (chatTools as Json[]).map((tool) => {
        const fn = (tool["function"] as Json | undefined) ?? {};
        const mapped: Json = {
          type: "function",
          name: fn["name"],
          parameters: fn["parameters"] ?? {},
        };
        if (fn["description"] !== undefined)
          mapped["description"] = fn["description"];
        if (fn["strict"] !== undefined) mapped["strict"] = fn["strict"];
        return mapped;
      })
    : undefined;

  let toolChoice = chat["tool_choice"];
  if (
    toolChoice &&
    typeof toolChoice === "object" &&
    (toolChoice as Json)["type"] === "function"
  ) {
    const fn = (toolChoice as Json)["function"] as Json | undefined;
    toolChoice = { type: "function", name: fn?.["name"] };
  }

  const body: Json = {
    model: chat["model"],
    input,
    // Server-side conversation state would leak one tenant's thread into
    // another's; every call carries its full history instead.
    store: false,
    ...(tools && tools.length > 0 ? { tools } : {}),
    ...(toolChoice !== undefined ? { tool_choice: toolChoice } : {}),
    ...(chat["stream"] === true ? { stream: true } : {}),
    ...(effort ? { reasoning: { effort } } : {}),
    ...(chat["service_tier"] !== undefined
      ? { service_tier: chat["service_tier"] }
      : {}),
  };
  const maxTokens = chat["max_completion_tokens"] ?? chat["max_tokens"];
  if (typeof maxTokens === "number") body["max_output_tokens"] = maxTokens;
  return body;
}

interface ResponsesOutputItem {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: { type?: string; text?: string }[];
  summary?: { type?: string; text?: string }[];
}

function finishReason(res: Json, sawToolCall: boolean): string {
  if (sawToolCall) return "tool_calls";
  const status = res["status"];
  if (status === "incomplete") return "length";
  return "stop";
}

/** /responses JSON → chat.completion JSON. */
export function fromResponsesResponse(res: Json): Json {
  const output = (res["output"] as ResponsesOutputItem[] | undefined) ?? [];
  let content = "";
  let reasoning = "";
  const toolCalls: Json[] = [];
  for (const item of output) {
    if (item.type === "message") {
      for (const part of item.content ?? []) {
        if (part.type === "output_text" && typeof part.text === "string") {
          content += part.text;
        }
      }
    } else if (item.type === "function_call") {
      toolCalls.push({
        id: item.call_id ?? "",
        type: "function",
        function: { name: item.name ?? "", arguments: item.arguments ?? "" },
      });
    } else if (item.type === "reasoning") {
      for (const part of item.summary ?? []) {
        if (part.type === "summary_text" && typeof part.text === "string") {
          reasoning += part.text;
        }
      }
    }
  }
  const message: Json = { role: "assistant", content };
  if (toolCalls.length > 0) message["tool_calls"] = toolCalls;
  if (reasoning) message["reasoning"] = reasoning;
  const usage = res["usage"] as Json | undefined;
  return {
    id:
      typeof res["id"] === "string"
        ? (res["id"] as string).replace(/^resp_/, "chatcmpl_")
        : res["id"],
    object: "chat.completion",
    created: res["created_at"],
    model: res["model"],
    choices: [
      {
        index: 0,
        message,
        finish_reason: finishReason(res, toolCalls.length > 0),
      },
    ],
    ...(usage
      ? {
          usage: {
            prompt_tokens: usage["input_tokens"] ?? 0,
            completion_tokens: usage["output_tokens"] ?? 0,
            total_tokens: usage["total_tokens"] ?? 0,
          },
        }
      : {}),
  };
}

/**
 * /responses SSE → chat.completion.chunk SSE. `response.completed` carries
 * the full response object (usage included); a usage chunk is emitted so the
 * metering tee sees the same shape it watches for on the pass-through path.
 */
export function responsesStreamToChat(
  upstream: ReadableStream<Uint8Array>
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const chunk = (
    id: string,
    created: number,
    model: string,
    delta: Json,
    finish: string | null = null
  ): Uint8Array =>
    encoder.encode(
      `data: ${JSON.stringify({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta, finish_reason: finish }],
      })}\n\n`
    );

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = upstream.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let responseId = "chatcmpl_gateway";
      let responseModel = "";
      let created = Math.floor(Date.now() / 1000);
      let sentRole = false;
      const toolIndexByOutput = new Map<number, number>();
      let sawToolCall = false;

      const emit = (delta: Json, finish: string | null = null): void => {
        controller.enqueue(
          chunk(responseId, created, responseModel, delta, finish)
        );
      };
      const emitUsage = (usage: Json | undefined): void => {
        if (!usage) return;
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({
              id: responseId,
              object: "chat.completion.chunk",
              created,
              model: responseModel,
              choices: [],
              usage: {
                prompt_tokens: usage["input_tokens"] ?? 0,
                completion_tokens: usage["output_tokens"] ?? 0,
                total_tokens: usage["total_tokens"] ?? 0,
              },
            })}\n\n`
          )
        );
      };

      const handleEvent = (event: Json): void => {
        const type = event["type"] as string | undefined;
        const res = event["response"] as Json | undefined;
        if (res) {
          if (typeof res["id"] === "string") responseId = res["id"];
          if (typeof res["model"] === "string") responseModel = res["model"];
          if (typeof res["created_at"] === "number")
            created = res["created_at"];
        }
        if (!sentRole) {
          sentRole = true;
          emit({ role: "assistant" });
        }
        switch (type) {
          case "response.output_text.delta":
            if (typeof event["delta"] === "string" && event["delta"]) {
              emit({ content: event["delta"] });
            }
            break;
          case "response.reasoning_summary_text.delta":
            if (typeof event["delta"] === "string" && event["delta"]) {
              emit({ reasoning: event["delta"] });
            }
            break;
          case "response.output_item.added": {
            const item = event["item"] as Json | undefined;
            const outputIndex = event["output_index"] as number | undefined;
            if (item?.["type"] === "function_call") {
              sawToolCall = true;
              const index = toolIndexByOutput.size;
              if (typeof outputIndex === "number") {
                toolIndexByOutput.set(outputIndex, index);
              }
              emit({
                tool_calls: [
                  {
                    index,
                    id: item["call_id"] ?? "",
                    type: "function",
                    function: { name: item["name"] ?? "", arguments: "" },
                  },
                ],
              });
            }
            break;
          }
          case "response.function_call_arguments.delta": {
            const outputIndex = event["output_index"] as number | undefined;
            const index =
              typeof outputIndex === "number"
                ? (toolIndexByOutput.get(outputIndex) ?? 0)
                : 0;
            if (typeof event["delta"] === "string" && event["delta"]) {
              emit({
                tool_calls: [
                  { index, function: { arguments: event["delta"] } },
                ],
              });
            }
            break;
          }
          case "response.completed":
            emit({}, res ? finishReason(res, sawToolCall) : "stop");
            emitUsage(res?.["usage"] as Json | undefined);
            break;
          case "response.incomplete":
            emit({}, "length");
            emitUsage(res?.["usage"] as Json | undefined);
            break;
          case "response.failed":
            emit({}, "stop");
            break;
          default:
            break;
        }
      };

      try {
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let sep = buffer.indexOf("\n\n");
          while (sep >= 0) {
            const frame = buffer.slice(0, sep);
            buffer = buffer.slice(sep + 2);
            for (const line of frame.split("\n")) {
              if (!line.startsWith("data:")) continue;
              const data = line.slice(5).trim();
              if (!data || data === "[DONE]") continue;
              try {
                handleEvent(JSON.parse(data) as Json);
              } catch {
                // non-JSON keepalive
              }
            }
            sep = buffer.indexOf("\n\n");
          }
        }
      } catch {
        // upstream dropped mid-stream; close out what we have
      } finally {
        reader.releaseLock();
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      }
    },
  });
}
