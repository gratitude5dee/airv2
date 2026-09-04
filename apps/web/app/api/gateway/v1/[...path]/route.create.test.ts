/**
 * MC4 (goal-create-v11 §9.1): the Create tier family. `create-<tier>:<slug>`
 * clamps to the entitlement (never upgrades), resolves on
 * CREATE_TIER_MODELS / MODEL_CREATE_* only, is always served by OpenAI, is
 * attributed to the project the request names — which must be one of the
 * owner's open or just-closed Create runs — and stops with
 * `429 create_budget` when that project's budget is spent.
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

interface RunRow {
  user_id: string;
  label: string;
  /** Run rows carry a trigger; metered completion rows do not. */
  trigger?: string | null;
  hermes_run_id?: string | null;
  [column: string]: unknown;
}

const state: {
  entitlement: EntitlementRow;
  /** Open / recently closed Create runs, as `createRunAttributable` sees them. */
  runs: RunRow[];
  /** Project budgets by slug (owner user-1); absent → no such app. */
  budgets: Record<string, number>;
  /** Metered `gateway_completion` rows by label. */
  spent: Record<string, { cost_usd: number }[]>;
} = {
  entitlement: {
    speed_tier: "balanced",
    model_family: "inkling",
    monthly_cap_usd: 100,
    spend_mtd_usd: 0,
    spend_period_start: new Date().toISOString(),
    suspended_reason: null,
  },
  runs: [],
  budgets: {},
  spent: {},
};

const meteredRows: Record<string, unknown>[] = [];

/** PostgREST-style chain: every filter returns the same builder and `eq`
 * filters are remembered, so the terminal (`maybeSingle` or `await`) can
 * answer by table *and* by the row the query asked for. */
function table(name: string): Record<string, unknown> {
  const eqs: Record<string, unknown> = {};
  const answer = (): { data: unknown } => {
    switch (name) {
      case "boxes":
        return { data: { user_id: "user-1" } };
      case "entitlements":
        return { data: state.entitlement };
      case "agent_runs": {
        const label = String(eqs["label"]);
        return { data: state.spent[label] ?? [] };
      }
      case "mini_apps": {
        const slug = String(eqs["slug"]);
        const budget = state.budgets[slug];
        return {
          data:
            budget === undefined || eqs["owner_user_id"] !== "user-1"
              ? null
              : { create_budget_usd: budget },
        };
      }
      default:
        return { data: null };
    }
  };
  const notNull: string[] = [];
  const builder: Record<string, unknown> = {};
  for (const f of ["select", "like", "is", "or", "gte", "order", "limit"]) {
    builder[f] = () => builder;
  }
  builder["eq"] = (column: string, value: unknown) => {
    eqs[column] = value;
    return builder;
  };
  builder["not"] = (column: string, operator: string, value: unknown) => {
    if (operator === "is" && value === null) notNull.push(column);
    return builder;
  };
  builder["maybeSingle"] = async () => {
    if (name !== "agent_runs") return answer();
    const run = state.runs.find(
      (row) =>
        row.user_id === eqs["user_id"] &&
        row.label === eqs["label"] &&
        notNull.every((column) => row[column] !== null)
    );
    return { data: run ? { id: "row-1" } : null };
  };
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

const COUNTDOWN = "create-balanced:alice-countdown";

describe("gateway Create tier family (MC4 §9.1)", () => {
  beforeEach(() => {
    state.entitlement = { ...state.entitlement, speed_tier: "balanced", model_family: "inkling" };
    state.runs = [{ user_id: "user-1", label: "create:alice-countdown" }];
    state.budgets = { "alice-countdown": 5 };
    state.spent = {};
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
    const { response, sent } = await complete({ messages: [], model: "create-deep:alice-countdown" });
    expect(response.status).toBe(200);
    expect(sent?.["model"]).toBe("gpt-5.6-terra");
    expect(meteredRows[0]?.["speed_tier"]).toBe("balanced");
    expect(meteredRows[0]?.["requested_model"]).toBe("create-deep:alice-countdown");
  });

  it("never upgrades: create-balanced for a Fast owner lands on fast", async () => {
    state.entitlement = { ...state.entitlement, speed_tier: "fast" };
    const { sent } = await complete({ messages: [], model: COUNTDOWN });
    expect(sent?.["model"]).toBe("gpt-5.6-luna");
    expect(meteredRows[0]?.["speed_tier"]).toBe("fast");
  });

  it("downgrades create-fast for a Deep owner", async () => {
    state.entitlement = { ...state.entitlement, speed_tier: "deep" };
    const { sent } = await complete({ messages: [], model: "create-fast:alice-countdown" });
    expect(sent?.["model"]).toBe("gpt-5.6-luna");
  });

  it("is served by OpenAI regardless of the owner's chat family", async () => {
    const { url } = await complete({ messages: [], model: COUNTDOWN });
    expect(url).toContain("https://upstream.test/v1");
    expect(url).not.toContain("openrouter");
    expect(meteredRows[0]?.["model_family"]).toBe("openai");
  });

  it("reads MODEL_CREATE_* and ignores the ordinary MODEL_* overrides", async () => {
    process.env["MODEL_BALANCED"] = "not-for-create";
    process.env["MODEL_CREATE_BALANCED"] = "gpt-5.6-sol";
    const { sent } = await complete({ messages: [], model: COUNTDOWN });
    expect(sent?.["model"]).toBe("gpt-5.6-sol");
  });

  it("leaves a plain model:fast delegation on the ordinary family", async () => {
    state.entitlement = { ...state.entitlement, model_family: "openai" };
    process.env["MODEL_CREATE_FAST"] = "gpt-5.6-sol";
    const { sent } = await complete({ messages: [], model: "fast" });
    expect(sent?.["model"]).toBe("gpt-5.6-luna");
  });

  it("attributes the completion to the project the request names", async () => {
    await complete({ messages: [], model: COUNTDOWN });
    expect(meteredRows[0]?.["label"]).toBe("create:alice-countdown");
    expect(meteredRows[0]?.["outcome"]).toBe("gateway_completion");
  });

  it("does not label non-Create completions", async () => {
    await complete({ messages: [], model: "balanced" });
    expect(meteredRows[0]?.["label"]).toBeUndefined();
  });

  it("returns exactly 429 insufficient_quota / create_budget when the budget is spent", async () => {
    state.spent = { "create:alice-countdown": [{ cost_usd: 3 }, { cost_usd: 2.5 }] };
    const { response, url } = await complete({ messages: [], model: COUNTDOWN });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "insufficient_quota",
      reason: "create_budget",
    });
    expect(url).toBeNull();
    expect(meteredRows.length).toBe(0);
  });

  it("serves while spend is under the budget", async () => {
    state.spent = { "create:alice-countdown": [{ cost_usd: 4.99 }] };
    const { response } = await complete({ messages: [], model: COUNTDOWN });
    expect(response.status).toBe(200);
  });

  it("refuses create-* with no open or recent Create run (403 create_run_required)", async () => {
    state.runs = [];
    const { response, url } = await complete({ messages: [], model: COUNTDOWN });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", reason: "create_run_required" });
    expect(url).toBeNull();
    expect(meteredRows.length).toBe(0);
  });

  it("still serves plain tiers with no Create run open", async () => {
    state.runs = [];
    const { response } = await complete({ messages: [], model: "fast" });
    expect(response.status).toBe(200);
    expect(meteredRows[0]?.["label"]).toBeUndefined();
  });

  describe("per-project attribution", () => {
    beforeEach(() => {
      state.runs = [
        { user_id: "user-1", label: "create:alice-countdown" },
        { user_id: "user-1", label: "create:alice-recipes" },
      ];
      state.budgets = { "alice-countdown": 5, "alice-recipes": 5 };
    });

    it("meters two concurrent projects under their own labels", async () => {
      await complete({ messages: [], model: COUNTDOWN });
      await complete({ messages: [], model: "create-balanced:alice-recipes" });
      await complete({ messages: [], model: COUNTDOWN });
      expect(meteredRows.map((row) => row["label"])).toEqual([
        "create:alice-countdown",
        "create:alice-recipes",
        "create:alice-countdown",
      ]);
    });

    it("an exhausted project is refused while the other keeps serving", async () => {
      state.spent = { "create:alice-countdown": [{ cost_usd: 5 }] };
      const countdown = await complete({ messages: [], model: COUNTDOWN });
      expect(countdown.response.status).toBe(429);
      expect(countdown.url).toBeNull();
      const recipes = await complete({ messages: [], model: "create-balanced:alice-recipes" });
      expect(recipes.response.status).toBe(200);
      expect(meteredRows.map((row) => row["label"])).toEqual(["create:alice-recipes"]);
    });

    it("refuses a project of the owner's that has no Create run (403)", async () => {
      state.budgets = { ...state.budgets, "alice-notes": 5 };
      const { response, url } = await complete({ messages: [], model: "create-balanced:alice-notes" });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "forbidden", reason: "create_run_required" });
      expect(url).toBeNull();
    });

    it("refuses another owner's project even while their run is open (403)", async () => {
      state.runs = [...state.runs, { user_id: "user-2", label: "create:bob-countdown" }];
      state.budgets = { ...state.budgets, "bob-countdown": 5 };
      const { response, url } = await complete({ messages: [], model: "create-balanced:bob-countdown" });
      expect(response.status).toBe(403);
      expect(url).toBeNull();
      expect(meteredRows.length).toBe(0);
    });

    it("a run row opened before its Hermes run is linked already attributes", async () => {
      state.runs = [
        { user_id: "user-1", label: "create:alice-countdown", trigger: "web", hermes_run_id: null },
      ];
      const { response } = await complete({ messages: [], model: COUNTDOWN });
      expect(response.status).toBe(200);
      expect(meteredRows.map((row) => row["label"])).toEqual(["create:alice-countdown"]);
    });

    it("metered completion rows (no trigger) never make a project attributable", async () => {
      state.runs = [
        { user_id: "user-1", label: "create:alice-countdown", trigger: null, hermes_run_id: null },
      ];
      const { response, url } = await complete({ messages: [], model: COUNTDOWN });
      expect(response.status).toBe(403);
      expect(url).toBeNull();
      expect(meteredRows.length).toBe(0);
    });

    it("refuses create-<tier> with no project rather than serving it unlabelled (400)", async () => {
      for (const model of ["create-balanced", "create-balanced:", "create-balanced:Alice", "create-turbo:alice-countdown"]) {
        const { response, url } = await complete({ messages: [], model });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: "invalid_request",
          reason: "create_project_required",
        });
        expect(url).toBeNull();
      }
      expect(meteredRows.length).toBe(0);
    });
  });
});
