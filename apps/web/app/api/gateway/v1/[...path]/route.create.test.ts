/**
 * MC4 (goal-create-v11 §9.1): the Create tier family. `create-<tier>`
 * clamps to the entitlement (never upgrades), resolves on
 * CREATE_TIER_MODELS / MODEL_CREATE_* only, is always served by OpenAI, is
 * attributed to the active project, and stops with `429 create_budget`
 * when the project's budget is spent.
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

const state: {
  entitlement: EntitlementRow;
  activeRun: { label: string } | null;
  budgetUsd: number | null;
  spentRows: { cost_usd: number }[];
} = {
  entitlement: {
    speed_tier: "balanced",
    model_family: "inkling",
    monthly_cap_usd: 100,
    spend_mtd_usd: 0,
    spend_period_start: new Date().toISOString(),
    suspended_reason: null,
  },
  activeRun: { label: "create:alice-countdown" },
  budgetUsd: 5,
  spentRows: [],
};

const meteredRows: Record<string, unknown>[] = [];

/** PostgREST-style chain: every filter returns the same builder; the
 * terminal (`maybeSingle` or `await`) answers by table. */
function table(name: string): Record<string, unknown> {
  const answer = (): { data: unknown } => {
    switch (name) {
      case "boxes":
        return { data: { user_id: "user-1" } };
      case "entitlements":
        return { data: state.entitlement };
      case "agent_runs":
        return { data: state.spentRows };
      case "mini_apps":
        return {
          data:
            state.budgetUsd === null
              ? null
              : { create_budget_usd: state.budgetUsd },
        };
      default:
        return { data: null };
    }
  };
  const builder: Record<string, unknown> = {};
  for (const f of ["select", "eq", "like", "not", "gte", "order", "limit"]) {
    builder[f] = () => builder;
  }
  builder["maybeSingle"] = async () =>
    name === "agent_runs" ? { data: state.activeRun } : answer();
  builder["then"] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(answer()).then(resolve);
  builder["insert"] = async (row: Record<string, unknown>) => {
    if (name === "agent_runs") meteredRows.push(row);
    return { error: null };
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      from: (name: string) => table(name),
      rpc: async () => ({ error: null }),
    }) as unknown as SupabaseClient,
}));
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
import { POST } from "./route";

function completionRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest("https://air.test/api/gateway/v1/chat/completions", {
    method: "POST",
    headers: { authorization: "Bearer token-1" },
    body: JSON.stringify(body),
  });
}

async function complete(
  body: Record<string, unknown>
): Promise<{ response: Response; url: string | null; sent: Record<string, unknown> | null }> {
  const fetchMock = vi.fn(async () =>
    new Response(
      JSON.stringify({
        choices: [{ message: { content: "ok" } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    )
  );
  vi.stubGlobal("fetch", fetchMock);
  const response = await POST(completionRequest(body), {
    params: Promise.resolve({ path: ["chat", "completions"] }),
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  const call = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit?] | undefined;
  return {
    response,
    url: call ? String(call[0]) : null,
    sent: call ? (JSON.parse(String(call[1]?.body)) as Record<string, unknown>) : null,
  };
}

describe("gateway Create tier family (MC4 §9.1)", () => {
  beforeEach(() => {
    state.entitlement = { ...state.entitlement, speed_tier: "balanced", model_family: "inkling" };
    state.activeRun = { label: "create:alice-countdown" };
    state.budgetUsd = 5;
    state.spentRows = [];
    meteredRows.length = 0;
  });
  afterEach(() => {
    for (const key of [
      "MODEL_CREATE_FAST",
      "MODEL_CREATE_BALANCED",
      "MODEL_CREATE_DEEP",
      "MODEL_BALANCED",
      "MODEL_DEEP",
    ]) {
      delete process.env[key];
    }
    vi.unstubAllGlobals();
  });

  it("clamps create-deep to a Balanced owner's tier and serves the Create slug", async () => {
    const { response, sent } = await complete({ messages: [], model: "create-deep" });
    expect(response.status).toBe(200);
    expect(sent?.["model"]).toBe("gpt-5.6-terra");
    expect(meteredRows[0]?.["speed_tier"]).toBe("balanced");
    expect(meteredRows[0]?.["requested_model"]).toBe("create-deep");
  });

  it("never upgrades: create-balanced for a Fast owner lands on fast", async () => {
    state.entitlement = { ...state.entitlement, speed_tier: "fast" };
    const { sent } = await complete({ messages: [], model: "create-balanced" });
    expect(sent?.["model"]).toBe("gpt-5.6-luna");
    expect(meteredRows[0]?.["speed_tier"]).toBe("fast");
  });

  it("downgrades create-fast for a Deep owner", async () => {
    state.entitlement = { ...state.entitlement, speed_tier: "deep" };
    const { sent } = await complete({ messages: [], model: "create-fast" });
    expect(sent?.["model"]).toBe("gpt-5.6-luna");
  });

  it("is served by OpenAI regardless of the owner's chat family", async () => {
    const { url } = await complete({ messages: [], model: "create-balanced" });
    expect(url).toContain("https://upstream.test/v1");
    expect(url).not.toContain("openrouter");
    expect(meteredRows[0]?.["model_family"]).toBe("openai");
  });

  it("reads MODEL_CREATE_* and ignores the ordinary MODEL_* overrides", async () => {
    process.env["MODEL_BALANCED"] = "not-for-create";
    process.env["MODEL_CREATE_BALANCED"] = "gpt-5.6-sol";
    const { sent } = await complete({ messages: [], model: "create-balanced" });
    expect(sent?.["model"]).toBe("gpt-5.6-sol");
  });

  it("leaves a plain model:fast delegation on the ordinary family", async () => {
    state.entitlement = { ...state.entitlement, model_family: "openai" };
    process.env["MODEL_CREATE_FAST"] = "gpt-5.6-sol";
    const { sent } = await complete({ messages: [], model: "fast" });
    expect(sent?.["model"]).toBe("gpt-5.6-luna");
  });

  it("attributes the completion to the active project", async () => {
    await complete({ messages: [], model: "create-balanced" });
    expect(meteredRows[0]?.["label"]).toBe("create:alice-countdown");
    expect(meteredRows[0]?.["outcome"]).toBe("gateway_completion");
  });

  it("does not label non-Create completions", async () => {
    await complete({ messages: [], model: "balanced" });
    expect(meteredRows[0]?.["label"]).toBeUndefined();
  });

  it("returns exactly 429 insufficient_quota / create_budget when the budget is spent", async () => {
    state.spentRows = [{ cost_usd: 3 }, { cost_usd: 2.5 }];
    const { response, url } = await complete({ messages: [], model: "create-balanced" });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "insufficient_quota",
      reason: "create_budget",
    });
    expect(url).toBeNull();
    expect(meteredRows.length).toBe(0);
  });

  it("serves while spend is under the budget", async () => {
    state.spentRows = [{ cost_usd: 4.99 }];
    const { response } = await complete({ messages: [], model: "create-balanced" });
    expect(response.status).toBe(200);
  });

  it("does not budget-gate a Create call with no active project", async () => {
    state.activeRun = null;
    state.spentRows = [{ cost_usd: 99 }];
    const { response } = await complete({ messages: [], model: "create-balanced" });
    expect(response.status).toBe(200);
    expect(meteredRows[0]?.["label"]).toBeUndefined();
  });
});
