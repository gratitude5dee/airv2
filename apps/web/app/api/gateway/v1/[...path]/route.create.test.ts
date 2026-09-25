/**
 * MC4 (goal-create-v11 §9.1): the Create tier family. `create-<tier>:<slug>`
 * clamps to the entitlement (never upgrades), resolves on
 * CREATE_TIER_MODELS / MODEL_CREATE_* only, is served by the provider of the
 * resolved slug (V12 §7.1: GMI for Astra/GLM, OpenAI for an OpenAI override)
 * regardless of the owner's chat family, is attributed to the project the
 * request names — which must be one of the owner's open or just-closed
 * Create runs — and stops with `429 create_budget` when that project's
 * budget is spent. V12 §7.3: an optional `#<stage>` is metered as
 * `agent_runs.create_stage`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

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

const db = new FakeSupabase();

const metered = () =>
  db.inserts.filter((i) => i.table === "agent_runs").map((i) => i.row);

/** agent_runs serves both the attribution read (open/recent Create runs) and
 * the spend read (metered completion rows); the columns the route's real
 * filters touch are seeded so the clauses actually filter. */
const setRuns = (rows: Record<string, unknown>[]) => {
  db.tables["agent_runs"] = rows.map((row) => ({
    trigger: "web",
    started_at: new Date().toISOString(),
    ended_at: null,
    hermes_run_id: null,
    ...row,
  }));
};
const setSpent = (label: string, costs: Record<string, unknown>[]) => {
  db.tables["agent_runs"] = [
    ...(db.tables["agent_runs"] ?? []),
    ...costs.map((row) => ({
      user_id: "user-1",
      label,
      outcome: "gateway_completion",
      ...row,
    })),
  ];
};
const setBudgets = (budgets: Record<string, number>, owner = "user-1") => {
  db.tables["mini_apps"] = [
    ...(db.tables["mini_apps"] ?? []),
    ...Object.entries(budgets).map(([slug, usd]) => ({
      slug,
      owner_user_id: owner,
      create_budget_usd: usd,
    })),
  ];
};
const setEntitlement = (patch: Record<string, unknown>) => {
  state.entitlement = { ...state.entitlement, ...patch };
  db.tables["entitlements"] = [{ user_id: "user-1", ...state.entitlement }];
};

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.client(),
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
    gmiInferenceBaseUrl: () => "https://gmi.test/v1",
    gmiCloudApiKey: () => "gmi-key",
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
const GLM = "zai-org/GLM-5.3-Flash";
const ASTRA = "openai/gpt-6-astra";

describe("gateway Create tier family (MC4 §9.1)", () => {
  beforeEach(() => {
    db.reset();
    db.tables["boxes"] = [{ user_id: "user-1", gateway_token: "token-1" }];
    setEntitlement({ speed_tier: "balanced", model_family: "inkling" });
    setRuns([{ user_id: "user-1", label: "create:alice-countdown" }]);
    setBudgets({ "alice-countdown": 5 });
  });
  afterEach(() => {
    for (const key of [
      "MODEL_CREATE_FAST",
      "MODEL_CREATE_BALANCED",
      "MODEL_CREATE_DEEP",
      "MODEL_BALANCED",
      "MODEL_DEEP",
      "GMI_CREATE_BUILD_EFFORT",
      "GMI_GLM_EFFORT",
    ]) {
      delete process.env[key];
    }
    vi.unstubAllGlobals();
  });

  it("clamps create-deep to a Balanced owner's tier and serves the Create slug", async () => {
    const { response, sent } = await complete({ messages: [], model: "create-deep:alice-countdown" });
    expect(response.status).toBe(200);
    expect(sent?.["model"]).toBe(GLM);
    expect(metered()[0]?.["speed_tier"]).toBe("balanced");
    expect(metered()[0]?.["requested_model"]).toBe("create-deep:alice-countdown");
  });

  it("never upgrades: create-balanced for a Fast owner lands on fast", async () => {
    setEntitlement({ speed_tier: "fast"  });
    const { sent } = await complete({ messages: [], model: COUNTDOWN });
    expect(sent?.["model"]).toBe(GLM);
    expect(metered()[0]?.["speed_tier"]).toBe("fast");
  });

  it("downgrades create-fast for a Deep owner", async () => {
    setEntitlement({ speed_tier: "deep"  });
    const { sent } = await complete({ messages: [], model: "create-fast:alice-countdown" });
    expect(sent?.["model"]).toBe(GLM);
  });

  it("is served by the slug's provider regardless of the owner's chat family (§7.1)", async () => {
    const { url, sent } = await complete({ messages: [], model: COUNTDOWN });
    expect(url).toBe("https://gmi.test/v1/chat/completions");
    expect(url).not.toContain("openrouter");
    expect(sent?.["model"]).toBe(GLM);
    expect(metered()[0]?.["model_family"]).toBe("gmi");
    expect(metered()[0]?.["model"]).toBe(GLM);
  });

  describe("V12 §7.1 — Astra plans, GLM builds (CR18)", () => {
    it("create-deep for a Deep owner serves openai/gpt-6-astra through the GMI base URL", async () => {
      setEntitlement({ speed_tier: "deep"  });
      const { response, url, sent } = await complete({
        messages: [],
        model: "create-deep:alice-countdown",
      });
      expect(response.status).toBe(200);
      expect(url).toBe("https://gmi.test/v1/chat/completions");
      expect(sent?.["model"]).toBe(ASTRA);
      // The Planner sends no effort.
      expect(sent?.["reasoning_effort"]).toBeUndefined();
      expect(metered()[0]?.["model_family"]).toBe("gmi");
      expect(metered()[0]?.["model"]).toBe(ASTRA);
      expect(metered()[0]?.["speed_tier"]).toBe("deep");
    });

    it("create-balanced serves GLM with reasoning_effort medium, winning over the fleet GLM default", async () => {
      process.env["GMI_GLM_EFFORT"] = "xhigh";
      const { sent } = await complete({ messages: [], model: COUNTDOWN });
      expect(sent?.["model"]).toBe(GLM);
      expect(sent?.["reasoning_effort"]).toBe("medium");
      expect(metered()[0]?.["reasoning_effort"]).toBe("medium");
    });

    it("GMI_CREATE_BUILD_EFFORT re-pins the Builder's effort; the Reviewer stays low", async () => {
      process.env["GMI_CREATE_BUILD_EFFORT"] = "high";
      const balanced = await complete({ messages: [], model: COUNTDOWN });
      expect(balanced.sent?.["reasoning_effort"]).toBe("high");
      const fast = await complete({ messages: [], model: "create-fast:alice-countdown" });
      expect(fast.sent?.["model"]).toBe(GLM);
      expect(fast.sent?.["reasoning_effort"]).toBe("low");
    });

    it("an OpenAI slug override routes to OpenAI and meters on the openai family", async () => {
      setEntitlement({ speed_tier: "deep"  });
      process.env["MODEL_CREATE_DEEP"] = "gpt-5.6-terra";
      const { response, url, sent } = await complete({
        messages: [],
        model: "create-deep:alice-countdown",
      });
      expect(response.status).toBe(200);
      expect(url).toBe("https://upstream.test/v1/responses");
      expect(url).not.toContain("gmi.test");
      expect(sent?.["model"]).toBe("gpt-5.6-terra");
      expect(metered()[0]?.["model_family"]).toBe("openai");
    });

    it("meters the #<stage> suffix as create_stage and strips it before resolution (§7.3)", async () => {
      const { response, sent } = await complete({
        messages: [],
        model: "create-balanced:alice-countdown#build",
      });
      expect(response.status).toBe(200);
      expect(sent?.["model"]).toBe(GLM);
      expect(metered()[0]?.["create_stage"]).toBe("build");
      expect(metered()[0]?.["label"]).toBe("create:alice-countdown");
      expect(metered()[0]?.["requested_model"]).toBe("create-balanced:alice-countdown#build");
      await complete({ messages: [], model: COUNTDOWN });
      expect(metered()[1]?.["create_stage"]).toBeNull();
    });

    it("refuses a malformed #<stage> with 400 rather than serving it unattributed", async () => {
      for (const model of [
        "create-balanced:alice-countdown#deploy",
        "create-balanced:alice-countdown#",
        "create-balanced:alice-countdown#Build",
      ]) {
        const { response, url } = await complete({ messages: [], model });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: "invalid_request",
          reason: "create_project_required",
        });
        expect(url).toBeNull();
      }
      expect(metered().length).toBe(0);
    });
  });

  it("reads MODEL_CREATE_* and ignores the ordinary MODEL_* overrides", async () => {
    process.env["MODEL_BALANCED"] = "not-for-create";
    process.env["MODEL_CREATE_BALANCED"] = "gpt-5.6-sol";
    const { sent } = await complete({ messages: [], model: COUNTDOWN });
    expect(sent?.["model"]).toBe("gpt-5.6-sol");
  });

  it("leaves a plain model:fast delegation on the ordinary family", async () => {
    setEntitlement({ model_family: "openai"  });
    process.env["MODEL_CREATE_FAST"] = "gpt-5.6-sol";
    const { sent } = await complete({ messages: [], model: "fast" });
    expect(sent?.["model"]).toBe("gpt-5.6-luna");
  });

  it("attributes the completion to the project the request names", async () => {
    await complete({ messages: [], model: COUNTDOWN });
    expect(metered()[0]?.["label"]).toBe("create:alice-countdown");
    expect(metered()[0]?.["outcome"]).toBe("gateway_completion");
  });

  it("does not label non-Create completions", async () => {
    await complete({ messages: [], model: "balanced" });
    expect(metered()[0]?.["label"]).toBeUndefined();
  });

  it("returns exactly 429 insufficient_quota / create_budget when the budget is spent", async () => {
    setSpent("create:alice-countdown", [{ cost_usd: 3 }, { cost_usd: 2.5 }]);
    const { response, url } = await complete({ messages: [], model: COUNTDOWN });
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "insufficient_quota",
      reason: "create_budget",
    });
    expect(url).toBeNull();
    expect(metered().length).toBe(0);
  });

  it("serves while spend is under the budget", async () => {
    setSpent("create:alice-countdown", [{ cost_usd: 4.99 }]);
    const { response } = await complete({ messages: [], model: COUNTDOWN });
    expect(response.status).toBe(200);
  });

  it("refuses create-* with no open or recent Create run (403 create_run_required)", async () => {
    setRuns([]);
    const { response, url } = await complete({ messages: [], model: COUNTDOWN });
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: "forbidden", reason: "create_run_required" });
    expect(url).toBeNull();
    expect(metered().length).toBe(0);
  });

  it("still serves plain tiers with no Create run open", async () => {
    setRuns([]);
    const { response } = await complete({ messages: [], model: "fast" });
    expect(response.status).toBe(200);
    expect(metered()[0]?.["label"]).toBeUndefined();
  });

  describe("per-project attribution", () => {
    beforeEach(() => {
      setRuns([
        { user_id: "user-1", label: "create:alice-countdown" },
        { user_id: "user-1", label: "create:alice-recipes" },
      ]);
      setBudgets({ "alice-countdown": 5, "alice-recipes": 5  });
    });

    it("meters two concurrent projects under their own labels", async () => {
      await complete({ messages: [], model: COUNTDOWN });
      await complete({ messages: [], model: "create-balanced:alice-recipes" });
      await complete({ messages: [], model: COUNTDOWN });
      expect(metered().map((row) => row["label"])).toEqual([
        "create:alice-countdown",
        "create:alice-recipes",
        "create:alice-countdown",
      ]);
    });

    it("an exhausted project is refused while the other keeps serving", async () => {
      setSpent("create:alice-countdown", [{ cost_usd: 5 }]);
      const countdown = await complete({ messages: [], model: COUNTDOWN });
      expect(countdown.response.status).toBe(429);
      expect(countdown.url).toBeNull();
      const recipes = await complete({ messages: [], model: "create-balanced:alice-recipes" });
      expect(recipes.response.status).toBe(200);
      expect(metered().map((row) => row["label"])).toEqual(["create:alice-recipes"]);
    });

    it("refuses a project of the owner's that has no Create run (403)", async () => {
      setBudgets({ "alice-notes": 5 });
      const { response, url } = await complete({ messages: [], model: "create-balanced:alice-notes" });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "forbidden", reason: "create_run_required" });
      expect(url).toBeNull();
    });

    it("refuses another owner's project even while their run is open (403)", async () => {
      setRuns([...(db.tables["agent_runs"] ?? []), { user_id: "user-2", label: "create:bob-countdown" }]);
      setBudgets({ "bob-countdown": 5 }, "user-2");
      const { response, url } = await complete({ messages: [], model: "create-balanced:bob-countdown" });
      expect(response.status).toBe(403);
      expect(url).toBeNull();
      expect(metered().length).toBe(0);
    });

    it("a run row opened before its Hermes run is linked already attributes", async () => {
      setRuns([
        { user_id: "user-1", label: "create:alice-countdown", trigger: "web", hermes_run_id: null },
      ]);
      const { response } = await complete({ messages: [], model: COUNTDOWN });
      expect(response.status).toBe(200);
      expect(metered().map((row) => row["label"])).toEqual(["create:alice-countdown"]);
    });

    it("metered completion rows (no trigger) never make a project attributable", async () => {
      setRuns([
        { user_id: "user-1", label: "create:alice-countdown", trigger: null, hermes_run_id: null },
      ]);
      const { response, url } = await complete({ messages: [], model: COUNTDOWN });
      expect(response.status).toBe(403);
      expect(url).toBeNull();
      expect(metered().length).toBe(0);
    });

    it("transitional: a project-less create-<tier> from a run started before the format changed bills the owner's open run", async () => {
      setRuns([{ user_id: "user-1", label: "create:alice-recipes" }]);
      const { response, url } = await complete({ messages: [], model: "create-balanced" });
      expect(response.status).toBe(200);
      expect(url).toBe("https://gmi.test/v1/chat/completions");
      expect(metered().map((row) => row["label"])).toEqual(["create:alice-recipes"]);
      expect(metered()[0]?.["create_stage"]).toBeNull();
    });

    it("transitional: a project-less create-<tier> with no open run is refused (403), not guessed", async () => {
      setRuns([]);
      const { response, url } = await complete({ messages: [], model: "create-balanced" });
      expect(response.status).toBe(403);
      expect(await response.json()).toEqual({ error: "forbidden", reason: "create_run_required" });
      expect(url).toBeNull();
      expect(metered().length).toBe(0);
    });

    it("transitional: two candidate projects (two runs, or a trailing run beside a newer one) make a project-less call ambiguous → 403", async () => {
      setRuns([
        { user_id: "user-1", label: "create:alice-recipes" },
        { user_id: "user-1", label: "create:alice-countdown" },
      ]);
      const { response, url } = await complete({ messages: [], model: "create-balanced" });
      expect(response.status).toBe(403);
      expect(url).toBeNull();
      expect(metered().length).toBe(0);
    });

    it("transitional: two runs of the same project are not ambiguous; another owner's run does not count", async () => {
      setRuns([
        { user_id: "user-1", label: "create:alice-recipes" },
        { user_id: "user-1", label: "create:alice-recipes" },
        { user_id: "user-2", label: "create:bob-app" },
        { user_id: "user-1", label: "create:alice-ended", trigger: null },
      ]);
      const { response } = await complete({ messages: [], model: "create-balanced" });
      expect(response.status).toBe(200);
      expect(metered().map((row) => row["label"])).toEqual(["create:alice-recipes"]);
    });

    it("refuses malformed create-* rather than serving it unlabelled (400)", async () => {
      for (const model of ["create-balanced:", "create-balanced:Alice", "create-turbo:alice-countdown", "create-turbo"]) {
        const { response, url } = await complete({ messages: [], model });
        expect(response.status).toBe(400);
        expect(await response.json()).toEqual({
          error: "invalid_request",
          reason: "create_project_required",
        });
        expect(url).toBeNull();
      }
      expect(metered().length).toBe(0);
    });
  });
});
