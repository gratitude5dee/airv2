/**
 * P1-7: reasoning_effort is only injected for model families that accept it
 * — a non-reasoning override model must go upstream without the field.
 * Also covers the model-family dimension: Ox Alpha is the default when the
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
    expect(sent["reasoning_effort"]).toBe("low");
  });

  it("pins none on tool-bearing calls", async () => {
    const sent = await upstreamBody({
      messages: [],
      tools: [{ type: "function" }],
    });
    expect(sent["reasoning_effort"]).toBe("none");
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
    expect(sent["reasoning_effort"]).toBe("low");
  });

  it("lands fast-lane reasoning even when the entitled tier is balanced", async () => {
    const sent = await upstreamBody({ model: "fast", messages: [] });
    expect(sent["model"]).toBe("gpt-5.6-luna");
    expect(sent["reasoning_effort"]).toBe("low");
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

  it("defaults MODEL_REASONING_FAST to low so the fast lane is actually fast", async () => {
    delete process.env["MODEL_REASONING_FAST"];
    const sent = await upstreamBody({ model: "fast", messages: [] });
    expect(sent["reasoning_effort"]).toBe("low");
  });

  it("lets MODEL_REASONING_FAST='' disable the default", async () => {
    process.env["MODEL_REASONING_FAST"] = "";
    const sent = await upstreamBody({ model: "fast", messages: [] });
    expect(sent["reasoning_effort"]).toBeUndefined();
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
            choices: [{ message: { content: "ok" } }],
            usage: { prompt_tokens: 11, completion_tokens: 7 },
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

  it("falls back to Ox Alpha when the entitlement carries no family", async () => {
    setEntitlement({ speed_tier: "fast", model_family: null });
    const call = await upstreamCall({ messages: [], max_tokens: 100 });
    expect(call.body["model"]).toBe("stealth/ox-alpha");
    // OpenAI-only params are never injected for an OpenRouter slug
    expect(call.body["reasoning_effort"]).toBeUndefined();
    expect(call.body["max_tokens"]).toBe(100);
    expect(call.body["max_completion_tokens"]).toBeUndefined();
    expect(call.url).toBe("https://openrouter.test/api/v1/chat/completions");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer openrouter-key");
    expect(headers["HTTP-Referer"]).toBe("https://app.test");
  });

  it("keeps the OpenAI-only service_tier off OpenRouter requests", async () => {
    process.env["MODEL_SERVICE_TIER_FAST"] = "priority";
    try {
      setEntitlement({ speed_tier: "fast", model_family: "ox-alpha" });
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
    expect(call.url).toBe("https://upstream.test/v1/chat/completions");
    const headers = call.init.headers as Record<string, string>;
    expect(headers["Authorization"]).toBe("Bearer provider-key");
    expect(headers["HTTP-Referer"]).toBeUndefined();
  });

  it("falls back to the OpenAI tier model when OpenRouter answers empty", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "ox-alpha" });
    const emptyCompletion = {
      choices: [
        {
          finish_reason: "stop",
          native_finish_reason: "network_error",
          message: { role: "assistant", content: null, reasoning: null },
        },
      ],
    };
    const goodCompletion = {
      choices: [{ message: { role: "assistant", content: "hi" } }],
    };
    const fetchMock = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
      void init;
      return String(url).includes("openrouter")
        ? new Response(JSON.stringify(emptyCompletion), { status: 200 })
        : new Response(JSON.stringify(goodCompletion), { status: 200 });
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
      "https://upstream.test/v1/chat/completions"
    );
    const payload = (await (response as Response).json()) as {
      choices: { message: { content: string } }[];
    };
    expect(payload.choices[0]?.message.content).toBe("hi");
  });

  it("does not fall back when OpenRouter answers with content", async () => {
    setEntitlement({ speed_tier: "fast", model_family: "ox-alpha" });
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
    setEntitlement({ speed_tier: "fast", model_family: "ox-alpha" });
    const emptySse =
      'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\ndata: [DONE]\n\n';
    const goodSse =
      'data: {"choices":[{"delta":{"content":"hi"}}]}\n\ndata: [DONE]\n\n';
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
    setEntitlement({ speed_tier: "fast", model_family: "ox-alpha" });
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
