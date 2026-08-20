/**
 * P1-7: reasoning_effort is only injected for model families that accept it
 * — a non-reasoning override model must go upstream without the field.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      from: (table: string) => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () =>
              table === "boxes"
                ? { data: { user_id: "user-1" } }
                : {
                    data: {
                      speed_tier: "fast",
                      monthly_cap_usd: 100,
                      spend_mtd_usd: 0,
                      spend_period_start: new Date().toISOString(),
                      suspended_reason: null,
                    },
                  },
          }),
        }),
      }),
    }) as unknown as SupabaseClient,
}));
vi.mock("@/lib/entitlements/spend", () => ({
  currentPeriodSpend: vi.fn(async () => 0),
}));
vi.mock("@/lib/env", () => ({
  env: {
    modelProviderBaseUrl: () => "https://upstream.test/v1",
    modelProviderApiKey: () => "provider-key",
  },
}));

import { NextRequest } from "next/server";
import { POST } from "./route";

function completionRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://air.test/api/gateway/v1/chat/completions", {
    method: "POST",
    headers: { authorization: "Bearer token-1" },
    body: JSON.stringify(body),
  });
}

async function upstreamBody(
  body: Record<string, unknown>
): Promise<Record<string, unknown>> {
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
  const init = fetchMock.mock.calls[0]?.[1];
  return JSON.parse(String(init?.body)) as Record<string, unknown>;
}

describe("gateway reasoning_effort gating (P1-7)", () => {
  beforeEach(() => {
    process.env.MODEL_REASONING_FAST = "low";
  });
  afterEach(() => {
    delete process.env.MODEL_REASONING_FAST;
    delete process.env.MODEL_FAST;
    vi.unstubAllGlobals();
  });

  it("injects the configured effort for reasoning models", async () => {
    const sent = await upstreamBody({ messages: [] });
    expect(sent.model).toBe("gpt-5.6-luna");
    expect(sent.reasoning_effort).toBe("low");
  });

  it("pins none on tool-bearing calls", async () => {
    const sent = await upstreamBody({
      messages: [],
      tools: [{ type: "function" }],
    });
    expect(sent.reasoning_effort).toBe("none");
  });

  it("omits reasoning_effort for non-reasoning override models", async () => {
    process.env.MODEL_FAST = "gpt-4o-mini";
    const sent = await upstreamBody({ messages: [], max_tokens: 100 });
    expect(sent.model).toBe("gpt-4o-mini");
    expect(sent.reasoning_effort).toBeUndefined();
    // legacy knobs also stay untouched for non-reasoning models
    expect(sent.max_tokens).toBe(100);
    expect(sent.max_completion_tokens).toBeUndefined();
  });
});
