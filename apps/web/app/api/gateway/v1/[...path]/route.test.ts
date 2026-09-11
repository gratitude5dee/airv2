/**
 * P1-7: reasoning_effort is only injected for model families that accept it
 * — a non-reasoning override model must go upstream without the field.
 * OpenAI reasoning models are served through /responses (chat/completions
 * rejects tools + effort), so their assertions read `reasoning.effort` and
 * the translated `input`/`tools` shape.
 * Also covers the model-family dimension: OpenAI is the default when the
 * entitlement carries no family, each family resolves to its own slug, and
 * GET /v1/models still exposes tier names only (C2).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

interface EntitlementRow {
  speed_tier: string;
  model_family?: string | null;
  monthly_cap_usd: number;
  spend_mtd_usd: number;
  spend_period_start: string;
  suspended_reason: string | null;
}

const entitlement: { row: EntitlementRow } = {
  row: {
    speed_tier: "fast",
    model_family: "openai",
    monthly_cap_usd: 100,
    spend_mtd_usd: 0,
    spend_period_start: new Date().toISOString(),
    suspended_reason: null,
  },
};

/** Rows written into agent_runs by the gateway's meter() — the router trace. */
const meteredRows: Record<string, unknown>[] = [];

vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              table === "boxes"
                ? { data: { user_id: "user-1" } }
                : { data: entitlement.row },
          }),
        }),
        insert: async (row: Record<string, unknown>) => {
          if (table === "agent_runs") meteredRows.push(row);
          return { error: null };
        },
      }),
      rpc: async () => ({ error: null }),
    }) as unknown as SupabaseClient,
}));
// meter() runs through next/server's after(), which needs a request scope
// vitest doesn't provide — run the work inline instead.
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (task: unknown) => void task };
});
vi.mock("@/lib/entitlements/spend", () => ({
  currentPeriodSpend: vi.fn(async () => 0),
}));
vi.mock("@/lib/env", () => ({
  env: {
    modelProviderBaseUrl: () => "https://upstream.test/v1",
    modelProviderApiKey: () => "provider-key",
    openRouterBaseUrl: () => "https://openrouter.test/api/v1",
    openRouterApiKey: () => "openrouter-key",
    gmiInferenceBaseUrl: () => "https://gmi.test/v1",
    gmiCloudApiKey: () => "gmi-key",
    appOrigin: () => "https://app.test",
  },
}));

import { NextRequest } from "next/server";
import { GET, POST } from "./route";

function completionRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://air.test/api/gateway/v1/chat/completions", {
    method: "POST",
    headers: { authorization: "Bearer token-1" },
    body: JSON.stringify(body),
  });
}

async function upstreamCall(
  body: Record<string, unknown>
): Promise<{ url: string; init: RequestInit; body: Record<string, unknown> }> {
  const fetchMock = vi.fn(
    async (_url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
  );
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(completionRequest(body), {
    params: Promise.resolve({ path: ["chat", "completions"] }),
  });
  expect(response.status).toBe(200);
  const call = fetchMock.mock.calls[0];
  const init = call?.[1] as RequestInit;
  return {
    url: String(call?.[0]),
    init,
    body: JSON.parse(String(init?.body)) as Record<string, unknown>,
  };
}

async function upstreamBody(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
  return (await upstreamCall(body)).body;
}

function setEntitlement(patch: Partial<EntitlementRow>): void {
  entitlement.row = { ...entitlement.row, ...patch };
}

describe("gateway reasoning_effort gating (P1-7)", () => {
  beforeEach(() => {
    setEntitlement({ speed_tier: "fast", model_family: "openai" });
    process.env["MODEL_REASONING_FAST"] = "low";
  });
  afterEach(() => {
    delete process.env["MODEL_REASONING_FAST"];
    delete process.env["MODEL_FAST"];
    vi.unstubAllGlobals();
  });

  it("injects the configured effort for reasoning models", async () => {
    const sent = await upstreamBody({ messages: [] });
    expect(sent["model"]).toBe("gpt-5.6-luna");
    expect(sent["reasoning"]).toEqual({ effort: "low" });
  });

  it("carries the configured effort on tool-bearing calls via /responses", async () => {
    const call = await upstreamCall({
      messages: [{ role: "user", content: "hi" }],
      tools: [
        {
          type: "function",
          function: { name: "lookup", parameters: { type: "object" } },
        },
      ],
    });
    expect(call.url).toBe("https://upstream.test/v1/responses");
    const sent = call.body;
    expect(sent["reasoning"]).toEqual({ effort: "low" });
    expect(sent["tools"]).toEqual([
      {
        type: "function",
        name: "lookup",
        parameters: { type: "object" },
      },
    ]);
    expect(sent["input"]).toEqual([
      {
        type: "message",
        role: "user",
        content: [{ type: "input_text", text: "hi" }],
      },
    ]);
    expect(sent["messages"]).toBeUndefined();
    expect(sent["store"]).toBe(false);
  });

  it("lets a caller-set reasoning_effort win over the tier default on /responses", async () => {
    const sent = await upstreamBody({
      messages: [],
      reasoning_effort: "minimal",
    });
    expect(sent["reasoning"]).toEqual({ effort: "minimal" });
  });

  it("maps response_format to the Responses text.format field", async () => {
    const sent = await upstreamBody({
      messages: [],
      response_format: { type: "json_object" },
    });
    expect(sent["text"]).toEqual({ format: { type: "json_object" } });
    expect(sent["response_format"]).toBeUndefined();

    const schema = {
      name: "thing",
      schema: { type: "object", properties: { a: { type: "string" } } },
      strict: true,
    };
    const structured = await upstreamBody({
      messages: [],
      response_format: { type: "json_schema", json_schema: schema },
    });
    expect(structured["text"]).toEqual({
      format: { type: "json_schema", ...schema },
    });
  });

  it("retries a /responses-incompatible upstream once through chat/completions", async () => {
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return String(url).endsWith("/responses")
        ? new Response("not found", { status: 404 })
        : new Response(
            JSON.stringify({
              choices: [{ message: { content: "hi" } }],
              usage: { prompt_tokens: 3, completion_tokens: 2 },
            }),
            { status: 200 }
          );
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      completionRequest({ messages: [], tools: [{ type: "function" }] }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) }
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://upstream.test/v1/chat/completions"
    );
    // The compat lane carries the pre-Responses pin, not an effort field.
    const secondBody = JSON.parse(
      String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)
    ) as Record<string, unknown>;
    expect(secondBody["reasoning_effort"]).toBe("none");
  });

  it("round-trips reasoning items so tool turns resume the model's thought", async () => {
    const reasoningItem = {
      type: "reasoning",
      id: "rs_1",
      summary: [{ type: "summary_text", text: "thinking…" }],
      encrypted_content: "enc-blob",
    };
    const first = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return new Response(
        JSON.stringify({
          id: "resp_1",
          object: "response",
          model: "gpt-5.6-luna",
          status: "completed",
          output: [
            reasoningItem,
            {
              type: "function_call",
              call_id: "call_1",
              name: "lookup",
              arguments: "{}",
            },
          ],
          usage: { input_tokens: 5, output_tokens: 3, total_tokens: 8 },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });
    vi.stubGlobal("fetch", first);
    const r1 = await POST(
      completionRequest({ messages: [{ role: "user", content: "hi" }] }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) }
    );
    const completion = (await r1.json()) as {
      choices: { message: Record<string, unknown> }[];
    };
    const message = completion.choices[0]!.message;
    expect(message["reasoning_details"]).toEqual([
      { type: "air_reasoning_item", item: reasoningItem },
    ]);
    const firstBody = JSON.parse(
      String((first.mock.calls[0]?.[1] as RequestInit).body)
    ) as Record<string, unknown>;
    expect(firstBody["include"]).toEqual(["reasoning.encrypted_content"]);

    // Turn two: the client echoes the assistant message + tool output; the
    // reasoning item must re-enter the input before its function_call.
    const second = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return new Response(JSON.stringify({}), { status: 200 });
    });
    vi.stubGlobal("fetch", second);
    await POST(
      completionRequest({
        messages: [
          { role: "user", content: "hi" },
          message,
          { role: "tool", tool_call_id: "call_1", content: "result" },
        ],
      }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) }
    );
    const secondBody = JSON.parse(
      String((second.mock.calls[0]?.[1] as RequestInit).body)
    ) as { input: { type: string; call_id?: string }[] };
    const types = secondBody.input.map((i) => i.type);
    expect(types).toEqual([
      "message", // user
      "reasoning",
      "function_call",
      "function_call_output",
    ]);
    expect(secondBody.input[1]).toEqual(reasoningItem);
  });

  it("surfaces a failed responses stream as a stream error, not a clean stop", async () => {
    const failedSse =
      'data: {"type":"response.output_text.delta","delta":"partial"}\n\n' +
      'data: {"type":"response.failed","response":{"status":"failed","error":{"message":"kaboom"}}}\n\n' +
      "data: [DONE]\n\n";
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(failedSse, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          })
      )
    );
    const response = await POST(
      completionRequest({ messages: [], stream: true }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) }
    );
    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow(/kaboom/);
  });

  it("errors a stream that ends before a terminal response event", async () => {
    const truncated =
      'data: {"type":"response.output_text.delta","delta":"partial"}\n\n';
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(truncated, {
            status: 200,
            headers: { "Content-Type": "text/event-stream" },
          })
      )
    );
    const response = await POST(
      completionRequest({ messages: [], stream: true }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) }
    );
    expect(response.status).toBe(200);
    await expect(response.text()).rejects.toThrow(/terminal/);
  });

  it("omits reasoning_effort for non-reasoning override models", async () => {
    process.env["MODEL_FAST"] = "gpt-4o-mini";
    const sent = await upstreamBody({ messages: [], max_tokens: 100 });
    expect(sent["model"]).toBe("gpt-4o-mini");
    expect(sent["reasoning_effort"]).toBeUndefined();
    // legacy knobs also stay untouched for non-reasoning models
    expect(sent["max_tokens"]).toBe(100);
    expect(sent["max_completion_tokens"]).toBeUndefined();
  });
});

describe("gateway fast-tier delegation override", () => {
  beforeEach(() => {
    setEntitlement({ speed_tier: "balanced", model_family: "openai" });
    process.env["MODEL_REASONING_FAST"] = "low";
  });
  afterEach(() => {
    delete process.env["MODEL_REASONING_FAST"];
    vi.unstubAllGlobals();
  });

  it("honors a request-body model:fast as a downgrade from the entitled tier", async () => {
    setEntitlement({ speed_tier: "deep" });
    const sent = await upstreamBody({ model: "fast", messages: [] });
    expect(sent["model"]).toBe("gpt-5.6-luna");
    expect(sent["reasoning"]).toEqual({ effort: "low" });
  });

  it("lands fast-lane reasoning even when the entitled tier is balanced", async () => {
    const sent = await upstreamBody({ model: "fast", messages: [] });
    expect(sent["model"]).toBe("gpt-5.6-luna");
    expect(sent["reasoning"]).toEqual({ effort: "low" });
  });

  it("never upgrades: a request-body deep stays on the entitled tier", async () => {
    setEntitlement({ speed_tier: "fast" });
    delete process.env["MODEL_REASONING_FAST"];
    const sent = await upstreamBody({ model: "deep", messages: [] });
    expect(sent["model"]).toBe("gpt-5.6-luna");
    expect(sent["model"]).not.toBe("gpt-5.6-terra");
  });

  it("keeps non-fast requests resolving through the entitlement", async () => {
    setEntitlement({ speed_tier: "deep" });
    const sent = await upstreamBody({ model: "balanced", messages: [] });
    expect(sent["model"]).toBe("gpt-5.6-terra");
  });

  it("defaults MODEL_REASONING_FAST to xhigh", async () => {
    delete process.env["MODEL_REASONING_FAST"];
    const sent = await upstreamBody({ model: "fast", messages: [] });
    expect(sent["reasoning"]).toEqual({ effort: "xhigh" });
  });

  it("lets MODEL_REASONING_FAST='' disable the default", async () => {
    process.env["MODEL_REASONING_FAST"] = "";
    const sent = await upstreamBody({ model: "fast", messages: [] });
    expect(sent["reasoning"]).toBeUndefined();
  });
});

describe("gateway task-router traces", () => {
  beforeEach(() => {
    setEntitlement({ speed_tier: "balanced", model_family: "openai" });
    process.env["MODEL_REASONING_FAST"] = "low";
    meteredRows.length = 0;
  });
  afterEach(() => {
    delete process.env["MODEL_REASONING_FAST"];
    vi.unstubAllGlobals();
  });

  async function completeWithUsage(
    body: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            id: "resp_1",
            object: "response",
            model: "gpt-5.6-luna",
            status: "completed",
            output: [
              {
                type: "message",
                role: "assistant",
                content: [{ type: "output_text", text: "ok" }],
              },
            ],
            usage: { input_tokens: 11, output_tokens: 7, total_tokens: 18 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const response = await POST(completionRequest(body), {
      params: Promise.resolve({ path: ["chat", "completions"] }),
    });
    expect(response.status).toBe(200);
    // meter() is queued via after(); the mock runs it as a floating promise.
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(meteredRows.length).toBe(1);
    return meteredRows[0]!;
  }

  it("stamps the resolved tier, requested model, effort, and latency", async () => {
    const row = await completeWithUsage({ messages: [], model: "fast" });
    expect(row["speed_tier"]).toBe("fast");
    expect(row["requested_model"]).toBe("fast");
    expect(row["reasoning_effort"]).toBe("low");
    expect(row["model"]).toBe("gpt-5.6-luna");
    expect(typeof row["latency_ms"]).toBe("number");
    expect(row["prompt_tokens"]).toBe(11);
    expect(row["completion_tokens"]).toBe(7);
  });

  it("records the entitled tier when the box sends its default model", async () => {
    const row = await completeWithUsage({ messages: [], model: "balanced" });
    expect(row["speed_tier"]).toBe("balanced");
    expect(row["requested_model"]).toBe("balanced");
  });

  it("never writes prompt or message content into the trace row", async () => {
    const row = await completeWithUsage({
      messages: [{ role: "user", content: "top secret prompt" }],
      model: "fast",
    });
    expect(JSON.stringify(row)).not.toContain("top secret");
  });
});

describe("gateway model families", () => {
  beforeEach(() => {
    process.env["MODEL_REASONING_FAST"] = "low";
  });
  afterEach(() => {
    delete process.env["MODEL_REASONING_FAST"];
    vi.unstubAllGlobals();
  });

  it("defaults to the OpenAI family when the entitlement carries none", async () => {
    setEntitlement({ speed_tier: "fast", model_family: null });
    const call = await upstreamCall({ messages: [], max_tokens: 100 });
    expect(call.body["model"]).toBe("gpt-5.6-luna");
    expect(call.body["reasoning"]).toEqual({ effort: "low" });
    expect(call.body["max_output_tokens"]).toBe(100);
    expect(call.body["max_tokens"]).toBeUndefined();
    expect(call.url).toBe("https://upstream.test/v1/responses");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer provider-key");
    expect(headers["HTTP-Referer"]).toBeUndefined();
  });

  it("keeps the OpenAI-only service_tier off OpenRouter requests", async () => {
    process.env["MODEL_SERVICE_TIER_FAST"] = "priority";
    try {
      setEntitlement({ speed_tier: "fast", model_family: "openrouter" });
      expect(
        (await upstreamBody({ messages: [] }))["service_tier"]
      ).toBeUndefined();
      setEntitlement({ model_family: "openai" });
      expect((await upstreamBody({ messages: [] }))["service_tier"]).toBe(
        "priority"
      );
    } finally {
      delete process.env["MODEL_SERVICE_TIER_FAST"];
    }
  });

  it("resolves each Inkling family to its free slug", async () => {
    setEntitlement({ model_family: "inkling" });
    expect((await upstreamBody({ messages: [] }))["model"]).toBe(
      "thinkingmachines/inkling:free"
    );
    setEntitlement({ model_family: "inkling-small" });
    expect((await upstreamBody({ messages: [] }))["model"]).toBe(
      "thinkingmachines/inkling-small:free"
    );
  });

  it("keeps the openai family on the tier-resolved model and provider", async () => {
    setEntitlement({ speed_tier: "deep", model_family: "openai" });
    const call = await upstreamCall({ messages: [] });
    expect(call.body["model"]).toBe("gpt-5.6-terra");
    expect(call.url).toBe("https://upstream.test/v1/responses");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer provider-key");
    expect(headers["HTTP-Referer"]).toBeUndefined();
  });

  it("routes MiniMax families to GMI Cloud", async () => {
    setEntitlement({ speed_tier: "balanced", model_family: "minimax-m3" });
    const call = await upstreamCall({ messages: [] });
    expect(call.body["model"]).toBe("MiniMaxAI/MiniMax-M3");
    expect(call.url).toBe("https://gmi.test/v1/chat/completions");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer gmi-key");
    expect(headers["HTTP-Referer"]).toBeUndefined();
  });

  it("retries a transient GMI error before serving MiniMax", async () => {
    setEntitlement({ speed_tier: "balanced", model_family: "minimax-m3" });
    const completion = {
      choices: [{ message: { role: "assistant", content: "hi" } }],
    };
    const fetchMock = vi.fn(async (url: RequestInfo | URL) => {
      expect(String(url)).toBe("https://gmi.test/v1/chat/completions");
      return fetchMock.mock.calls.length === 1
        ? new Response("temporarily unavailable", { status: 429 })
        : new Response(JSON.stringify(completion), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(completionRequest({ messages: [] }), {
      params: Promise.resolve({ path: ["chat", "completions"] }),
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect((await response.json()).choices[0].message.content).toBe("hi");
  });

  it("falls back to OpenAI after a retryable GMI error repeats", async () => {
    setEntitlement({ speed_tier: "balanced", model_family: "minimax-m3" });
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("gmi.test")
        ? new Response("temporarily unavailable", { status: 429 })
        : new Response(
            JSON.stringify({
              id: "resp_1",
              object: "response",
              model: "gpt-5.6-luna",
              status: "completed",
              output: [
                {
                  type: "message",
                  role: "assistant",
                  content: [{ type: "output_text", text: "hi" }],
                },
              ],
            }),
            { status: 200 }
          )
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(completionRequest({ messages: [] }), {
      params: Promise.resolve({ path: ["chat", "completions"] }),
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe(
      "https://gmi.test/v1/chat/completions"
    );
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://gmi.test/v1/chat/completions"
    );
    expect(String(fetchMock.mock.calls[2]?.[0])).toBe(
      "https://upstream.test/v1/responses"
    );
    expect((await response.json()).choices[0].message.content).toBe("hi");
  });

  it("falls back to the OpenAI tier model when OpenRouter answers empty", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "openrouter" });
    const emptyCompletion = {
      choices: [
        {
          finish_reason: "stop",
          native_finish_reason: "network_error",
          message: { role: "assistant", content: null, reasoning: null },
        },
      ],
    };
    const responsesCompletion = {
      id: "resp_1",
      object: "response",
      model: "gpt-5.6-luna",
      status: "completed",
      output: [
        {
          type: "message",
          role: "assistant",
          content: [{ type: "output_text", text: "hi" }],
        },
      ],
    };
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return String(url).includes("openrouter")
        ? new Response(JSON.stringify(emptyCompletion), { status: 200 })
        : new Response(JSON.stringify(responsesCompletion), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      completionRequest({ messages: [], tools: [{ type: "function" }] }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) }
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const secondBody = JSON.parse(
      String((fetchMock.mock.calls[1]?.[1] as RequestInit).body)
    ) as Record<string, unknown>;
    expect(secondBody["model"]).toBe("gpt-5.6-luna");
    expect(String(fetchMock.mock.calls[1]?.[0])).toBe(
      "https://upstream.test/v1/responses"
    );
    const payload = (await (response as Response).json()) as {
      choices: { message: { content: string } }[];
    };
    expect(payload.choices[0]?.message.content).toBe("hi");
  });

  it("attributes a fallback turn to OpenAI and records the requested family", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "openrouter" });
    meteredRows.length = 0;
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      String(url).includes("openrouter")
        ? new Response("no endpoints found", { status: 404 })
        : new Response(
            JSON.stringify({
              id: "resp_1",
              object: "response",
              model: "gpt-5.6-luna",
              status: "completed",
              output: [
                {
                  type: "message",
                  role: "assistant",
                  content: [{ type: "output_text", text: "hi" }],
                },
              ],
              usage: { input_tokens: 3, output_tokens: 5, total_tokens: 8 },
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          )
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(completionRequest({ messages: [] }), {
      params: Promise.resolve({ path: ["chat", "completions"] }),
    });
    expect(response.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const row = meteredRows[0]!;
    expect(row["model_family"]).toBe("openai");
    expect(row["model"]).toBe("gpt-5.6-luna");
    expect(row["fallback_from"]).toBe("openrouter");
    expect(row["prompt_tokens"]).toBe(3);
    expect(row["completion_tokens"]).toBe(5);
    // OpenAI tier rates, not the family's — the cost follows what served.
    expect(row["cost_usd"]).toBeCloseTo((3 * 0.4 + 5 * 2.4) / 1_000_000, 12);
  });

  it("leaves fallback_from null when the requested family serves", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "openrouter" });
    meteredRows.length = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { role: "assistant", content: "hi" } }],
            usage: { prompt_tokens: 3, completion_tokens: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      )
    );
    const response = await POST(completionRequest({ messages: [] }), {
      params: Promise.resolve({ path: ["chat", "completions"] }),
    });
    expect(response.status).toBe(200);
    await new Promise((resolve) => setTimeout(resolve, 0));
    const row = meteredRows[0]!;
    expect(row["model_family"]).toBe("openrouter");
    expect(row["fallback_from"]).toBeNull();
  });

  it("does not fall back when OpenRouter answers with content", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "openrouter" });
    const completion = {
      choices: [{ message: { role: "assistant", content: "hello" } }],
    };
    const fetchMock = vi.fn(
      async () => new Response(JSON.stringify(completion), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(completionRequest({ messages: [] }), {
      params: Promise.resolve({ path: ["chat", "completions"] }),
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("falls back to OpenAI when a streamed OpenRouter answer carries no deltas", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "openrouter" });
    const emptySse =
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\ndata: [DONE]\n\n';
    const goodSse =
      'data: {"type":"response.output_text.delta","delta":"hi"}\n\ndata: {"type":"response.completed","response":{"id":"resp_1","status":"completed","usage":{"input_tokens":1,"output_tokens":1,"total_tokens":2}}}\n\ndata: [DONE]\n\n';
    const fetchMock = vi.fn(async (url: RequestInfo | URL) =>
      new Response(String(url).includes("openrouter") ? emptySse : goodSse, {
        status: 200,
        headers: { "Content-Type": "text/event-stream" },
      })
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      completionRequest({ messages: [], stream: true }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) }
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(await (response as Response).text()).toContain('"content":"hi"');
  });

  it("replays a streamed OpenRouter answer that has content", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "openrouter" });
    const goodSse =
      'data: {"choices":[{"delta":{"content":"ox"}}]}\n\ndata: [DONE]\n\n';
    const fetchMock = vi.fn(
      async () =>
        new Response(goodSse, {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        })
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(
      completionRequest({ messages: [], stream: true }),
      { params: Promise.resolve({ path: ["chat", "completions"] }) }
    );
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(await (response as Response).text()).toContain('"content":"ox"');
  });

  it("never falls back for the openai family", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "openai" });
    const emptyCompletion = {
      choices: [{ message: { role: "assistant", content: null } }],
    };
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify(emptyCompletion), { status: 200 })
    );
    vi.stubGlobal("fetch", fetchMock);
    const response = await POST(completionRequest({ messages: [] }), {
      params: Promise.resolve({ path: ["chat", "completions"] }),
    });
    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("still exposes only tier names to boxes (C2)", async () => {
    setEntitlement({ model_family: "inkling" });
    const response = await GET(
      new NextRequest("https://air.test/api/gateway/v1/models", {
        headers: { authorization: "Bearer token-1" },
      }),
      { params: Promise.resolve({ path: ["models"] }) }
    );
    const payload = (await response.json()) as {
      data: { id: string }[];
    };
    expect(payload.data.map((m) => m.id)).toEqual([
      "fast",
      "balanced",
      "deep",
    ]);
    expect(JSON.stringify(payload)).not.toContain("inkling");
    expect(JSON.stringify(payload)).not.toContain("stealth");
  });
});
