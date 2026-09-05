/**
 * MC5 (goal-create-v11 §11.3, CR8): the `app` principal. A runtime token
 * (`art_…`) resolves to the app's owner, may only name a tier, is metered
 * as trigger='app' with the slug as label, and stops with `429 fn_capped`
 * (plus an ops_events row) before the owner's monthly cap is consulted.
 * Two apps of one owner meter and cap independently. The cap is a
 * reservation: admission and the hold are one RPC (miniapp_fn_reserve), so
 * two calls racing under the cap cannot both dispatch; the hold settles to
 * the metered cost or is released when nothing was metered.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { FunctionsRow } from "@/lib/functions/backend";
import type { RuntimePrincipal } from "@/lib/functions/runtime";

const today = new Date().toISOString().slice(0, 10);

function functionsRow(appId: string, over: Partial<FunctionsRow> = {}): FunctionsRow {
  return {
    app_id: appId,
    user_id: "user-1",
    script_name: appId,
    draft_script_name: `${appId}-draft`,
    d1_database_id: null,
    kv_namespace_id: null,
    egress: [],
    secret_names: [],
    ai_daily_cap_usd: 1,
    ai_spent_today_usd: 0,
    ai_spend_day: today,
    limits: { cpu_ms: 50, subrequests: 20 },
    status: "live",
    approved_manifest: { egress: [], db: false, kv: false, dailyCapUsd: 1, secretNames: [] },
    deployed_at: null,
    last_error: null,
    declared: null,
    declared_at: null,
    approved_at: null,
    runtime_token_id: "tok-a",
    secret_set_at: {},
    killed_at: null,
    killed_by: null,
    ...over,
  };
}

const state: {
  tokens: Record<string, RuntimePrincipal>;
  monthlySpend: number;
} = { tokens: {}, monthlySpend: 0 };

const meteredRows: Record<string, unknown>[] = [];
const opsRows: Record<string, unknown>[] = [];
/** Settlements (miniapp_fn_settle) in order; usd 0 is a release. */
const appSpend: { appId: string; usd: number }[] = [];
/** The miniapp_functions counters the RPCs update atomically. */
const ledger: Record<string, { spent: number; reserved: number }> = {};
let reserveFails = false;

function counters(appId: string): { spent: number; reserved: number } {
  return (ledger[appId] ??= { spent: 0, reserved: 0 });
}

/** miniapp_fn_reserve / miniapp_fn_settle with the migration's semantics. */
async function rpc(
  fn: string,
  args: Record<string, unknown>
): Promise<{ data?: unknown; error: { message: string } | null }> {
  if (fn === "miniapp_fn_reserve") {
    if (reserveFails) return { error: { message: "connection refused" } };
    const row = counters(String(args["p_app_id"]));
    if (row.spent + row.reserved < Number(args["p_cap"])) {
      row.reserved += Number(args["p_usd"]);
      return { data: true, error: null };
    }
    return { data: false, error: null };
  }
  if (fn === "miniapp_fn_settle") {
    const appId = String(args["p_app_id"]);
    const row = counters(appId);
    row.spent += Number(args["p_usd"]);
    row.reserved = Math.max(row.reserved - Number(args["p_reserved"]), 0);
    appSpend.push({ appId, usd: Number(args["p_usd"]) });
    return { data: row.spent, error: null };
  }
  return { error: null };
}

function table(name: string): Record<string, unknown> {
  const answer = (): { data: unknown } => {
    switch (name) {
      case "boxes":
        return { data: null };
      case "entitlements":
        return {
          data: {
            speed_tier: "balanced",
            model_family: "openai",
            monthly_cap_usd: 100,
            spend_mtd_usd: state.monthlySpend,
            spend_period_start: new Date().toISOString(),
            suspended_reason: null,
          },
        };
      default:
        return { data: null };
    }
  };
  const builder: Record<string, unknown> = {};
  for (const f of ["select", "eq", "like", "not", "is", "or", "gte", "order", "limit"]) {
    builder[f] = () => builder;
  }
  builder["maybeSingle"] = async () => answer();
  builder["then"] = (resolve: (v: unknown) => unknown) =>
    Promise.resolve(answer()).then(resolve);
  builder["insert"] = async (row: Record<string, unknown>) => {
    if (name === "agent_runs") meteredRows.push(row);
    if (name === "ops_events") opsRows.push(row);
    return { error: null };
  };
  return builder;
}

vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      from: (name: string) => table(name),
      rpc,
    }) as unknown as SupabaseClient,
}));
vi.mock("next/server", async (importOriginal) => {
  const actual = await importOriginal<typeof import("next/server")>();
  return { ...actual, after: (task: unknown) => void task };
});
vi.mock("@/lib/entitlements/spend", () => ({
  currentPeriodSpend: vi.fn(async () => state.monthlySpend),
}));
vi.mock("@/lib/functions/runtime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/functions/runtime")>();
  return {
    ...actual,
    authenticateRuntimeToken: vi.fn(async (_s: unknown, bearer: string) =>
      state.tokens[bearer] ?? null
    ),
  };
});
const providerKeys = vi.hoisted(() => ({ getProviderKey: vi.fn(async () => null as string | null) }));
vi.mock("@/lib/providers/keys", () => ({
  getProviderKey: providerKeys.getProviderKey,
  PROVIDER_LABELS: { openrouter: "OpenRouter", venice: "Venice", gmi: "GMI" },
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
import { appReserveUsd } from "@/lib/functions/runtime";
import { POST } from "./route";

function post(bearer: string, body: Record<string, unknown>): Promise<Response> {
  return POST(
    new NextRequest("https://air.test/api/gateway/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: ["chat", "completions"] }) }
  );
}

const tick = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function sse(events: unknown[]): Response {
  const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
  return new Response(body, { status: 200, headers: { "Content-Type": "text/event-stream" } });
}

function principal(appId: string, slug: string, over: Partial<FunctionsRow> = {}): RuntimePrincipal {
  return { tokenId: `tok-${appId}`, appId, userId: "user-1", slug, functions: functionsRow(appId, over) };
}

async function complete(
  bearer: string,
  body: Record<string, unknown>
): Promise<{ response: Response; sent: Record<string, unknown> | null }> {
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
  const response = await POST(
    new NextRequest("https://air.test/api/gateway/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${bearer}` },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ path: ["chat", "completions"] }) }
  );
  await new Promise((resolve) => setTimeout(resolve, 0));
  const call = fetchMock.mock.calls[0] as [RequestInfo | URL, RequestInit?] | undefined;
  return {
    response,
    sent: call ? (JSON.parse(String(call[1]?.body)) as Record<string, unknown>) : null,
  };
}

describe("gateway app principal (MC5 §11.3)", () => {
  beforeEach(() => {
    state.tokens = {
      art_a: principal("app-a", "alice-rsvp"),
      art_b: principal("app-b", "alice-poll"),
    };
    state.monthlySpend = 0;
    meteredRows.length = 0;
    opsRows.length = 0;
    appSpend.length = 0;
    for (const key of Object.keys(ledger)) delete ledger[key];
    reserveFails = false;
    providerKeys.getProviderKey.mockResolvedValue(null);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("never rides the owner's personal provider key, so the daily cap always meters", async () => {
    providerKeys.getProviderKey.mockResolvedValue("sk-owner-personal");
    const { response } = await complete("art_a", { model: "fast", messages: [] });
    expect(response.status).toBe(200);
    expect(providerKeys.getProviderKey).not.toHaveBeenCalled();
    expect(meteredRows[0]).toMatchObject({ trigger: "app" });
    expect(Number(meteredRows[0]?.["cost_usd"] ?? 0)).toBeGreaterThan(0);
    expect(appSpend).toEqual([expect.objectContaining({ appId: "app-a" })]);
  });

  it("rejects an unknown or revoked runtime token like any stranger", async () => {
    const { response } = await complete("art_nope", { model: "fast", messages: [] });
    expect(response.status).toBe(401);
  });

  it("meters trigger='app' with the slug as label and the app's counter", async () => {
    const { response, sent } = await complete("art_a", { model: "fast", messages: [] });
    expect(response.status).toBe(200);
    expect(sent?.["model"]).not.toBe("fast");
    expect(meteredRows).toHaveLength(1);
    expect(meteredRows[0]).toMatchObject({ trigger: "app", label: "alice-rsvp", speed_tier: "fast" });
    expect(appSpend).toEqual([expect.objectContaining({ appId: "app-a" })]);
  });

  it("clamps the requested tier to the owner's entitlement", async () => {
    const { response } = await complete("art_a", { model: "deep", messages: [] });
    expect(response.status).toBe(200);
    expect(meteredRows[0]).toMatchObject({ speed_tier: "balanced", requested_model: "deep" });
  });

  it("refuses anything but fast|balanced|deep, including Create tiers and model IDs", async () => {
    for (const model of ["gpt-4o", "create-fast", "openai/gpt-5", undefined]) {
      const { response } = await complete("art_a", { model, messages: [] });
      expect(response.status).toBe(400);
      expect(await response.json()).toMatchObject({ error: "unknown_model" });
    }
    expect(meteredRows).toHaveLength(0);
  });

  it("stops at the app's daily cap with fn_capped before the monthly cap, independently per app", async () => {
    state.tokens["art_a"] = principal("app-a", "alice-rsvp", { ai_spent_today_usd: 1 });
    const capped = await complete("art_a", { model: "fast", messages: [] });
    expect(capped.response.status).toBe(429);
    expect(await capped.response.json()).toEqual({
      error: "insufficient_quota",
      reason: "fn_capped",
    });
    expect(opsRows).toEqual([expect.objectContaining({ kind: "fn_capped", ref: "alice-rsvp" })]);
    expect(capped.sent).toBeNull();

    const other = await complete("art_b", { model: "fast", messages: [] });
    expect(other.response.status).toBe(200);
    expect(meteredRows).toEqual([expect.objectContaining({ label: "alice-poll" })]);
  });

  it("ignores yesterday's counter", async () => {
    state.tokens["art_a"] = principal("app-a", "alice-rsvp", {
      ai_spent_today_usd: 5,
      ai_spend_day: "2000-01-01",
    });
    const { response } = await complete("art_a", { model: "fast", messages: [] });
    expect(response.status).toBe(200);
  });

  it("the approved cap governs over the declared one", async () => {
    state.tokens["art_a"] = principal("app-a", "alice-rsvp", {
      ai_daily_cap_usd: 5,
      ai_spent_today_usd: 0.5,
      approved_manifest: { egress: [], db: false, kv: false, dailyCapUsd: 0.25, secretNames: [] },
    });
    const { response } = await complete("art_a", { model: "fast", messages: [] });
    expect(response.status).toBe(429);
  });

  it("still honors the owner's monthly cap after the app cap", async () => {
    state.monthlySpend = 100;
    const { response } = await complete("art_a", { model: "fast", messages: [] });
    expect(response.status).toBe(429);
    expect(opsRows).toHaveLength(0);
  });

  it("settles the hold to the metered cost, leaving nothing reserved", async () => {
    const { response } = await complete("art_a", { model: "fast", messages: [] });
    expect(response.status).toBe(200);
    const cost = Number(meteredRows[0]?.["cost_usd"]);
    expect(cost).toBeGreaterThan(0);
    expect(appSpend).toEqual([{ appId: "app-a", usd: cost }]);
    expect(ledger["app-a"]).toEqual({ spent: cost, reserved: 0 });
  });

  describe("reserve-then-dispatch (the cap race)", () => {
    // Cap $0.05 with $0.045 settled: one fast hold fits under the cap, a
    // second only does if it cannot see the first — the read-then-dispatch
    // gate let both through.
    const cap = 0.05;
    const spent = 0.045;
    const nearCap = (): void => {
      state.tokens["art_a"] = principal("app-a", "alice-rsvp", {
        ai_spent_today_usd: spent,
        approved_manifest: { egress: [], db: false, kv: false, dailyCapUsd: cap, secretNames: [] },
      });
      ledger["app-a"] = { spent, reserved: 0 };
    };

    it("two calls racing under the cap: one dispatches, the other is fn_capped before any usage lands", async () => {
      nearCap();
      expect(spent + appReserveUsd("fast")).toBeGreaterThanOrEqual(cap);
      let releaseUpstream: (() => void) | null = null;
      const gate = new Promise<void>((resolve) => {
        releaseUpstream = resolve;
      });
      const fetchMock = vi.fn(async () => {
        await gate;
        return new Response(
          JSON.stringify({
            choices: [{ message: { content: "ok" } }],
            usage: { prompt_tokens: 10, completion_tokens: 5 },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      });
      vi.stubGlobal("fetch", fetchMock);

      const first = post("art_a", { model: "fast", messages: [] });
      await tick();
      // First call is upstream with its hold taken; the second arrives now.
      expect(fetchMock).toHaveBeenCalledTimes(1);
      expect(ledger["app-a"]).toEqual({ spent, reserved: appReserveUsd("fast") });
      const second = await post("art_a", { model: "fast", messages: [] });
      expect(second.status).toBe(429);
      expect(await second.json()).toEqual({ error: "insufficient_quota", reason: "fn_capped" });
      expect(opsRows).toEqual([expect.objectContaining({ kind: "fn_capped", ref: "alice-rsvp" })]);
      expect(fetchMock).toHaveBeenCalledTimes(1);

      releaseUpstream!();
      const response = await first;
      await tick();
      expect(response.status).toBe(200);
      expect(meteredRows).toHaveLength(1);
      const cost = Number(meteredRows[0]?.["cost_usd"]);
      expect(ledger["app-a"].reserved).toBe(0);
      expect(ledger["app-a"].spent).toBeCloseTo(spent + cost, 10);
    });

    it("the other app of the same owner is not held back by the first app's hold", async () => {
      nearCap();
      await complete("art_a", { model: "fast", messages: [] });
      const other = await complete("art_b", { model: "fast", messages: [] });
      expect(other.response.status).toBe(200);
      expect(ledger["app-b"]?.reserved).toBe(0);
    });

    it("releases the hold when the upstream fails, so the next call is admitted", async () => {
      nearCap();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response("{\"error\":\"boom\"}", { status: 500 }))
      );
      const failed = await post("art_a", { model: "fast", messages: [] });
      await tick();
      expect(failed.status).toBe(500);
      expect(meteredRows).toHaveLength(0);
      expect(appSpend).toEqual([{ appId: "app-a", usd: 0 }]);
      expect(ledger["app-a"]).toEqual({ spent, reserved: 0 });

      const next = await complete("art_a", { model: "fast", messages: [] });
      expect(next.response.status).toBe(200);
    });

    it("releases the hold when the upstream throws", async () => {
      nearCap();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          throw new Error("socket hang up");
        })
      );
      await expect(post("art_a", { model: "fast", messages: [] })).rejects.toThrow("socket hang up");
      await tick();
      expect(ledger["app-a"]).toEqual({ spent, reserved: 0 });
    });

    it("a stream settles to its final usage chunk", async () => {
      nearCap();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () =>
          sse([
            { choices: [{ delta: { content: "hi" } }], usage: null },
            { choices: [], usage: { prompt_tokens: 10, completion_tokens: 5 } },
          ])
        )
      );
      const response = await post("art_a", { model: "fast", messages: [], stream: true });
      expect(response.status).toBe(200);
      expect(ledger["app-a"].reserved).toBe(appReserveUsd("fast"));
      await response.text();
      await tick();
      expect(meteredRows).toHaveLength(1);
      const cost = Number(meteredRows[0]?.["cost_usd"]);
      expect(cost).toBeGreaterThan(0);
      expect(ledger["app-a"].reserved).toBe(0);
      expect(ledger["app-a"].spent).toBeCloseTo(spent + cost, 10);
    });

    it("a stream that closes without usage releases the hold and meters nothing", async () => {
      nearCap();
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => sse([{ choices: [{ delta: { content: "hi" } }] }]))
      );
      const response = await post("art_a", { model: "fast", messages: [], stream: true });
      expect(response.status).toBe(200);
      await response.text();
      await tick();
      expect(meteredRows).toHaveLength(0);
      expect(ledger["app-a"]).toEqual({ spent, reserved: 0 });
    });

    it("refuses rather than dispatches unmetered when the ledger does not answer", async () => {
      reserveFails = true;
      const { response, sent } = await complete("art_a", { model: "fast", messages: [] });
      expect(response.status).toBe(503);
      expect(await response.json()).toEqual({ error: "cap_unavailable", reason: "fn_reserve" });
      expect(sent).toBeNull();
      expect(opsRows).toHaveLength(0);
    });

    it("a refused token never reaches the ledger", async () => {
      const { response } = await complete("art_nope", { model: "fast", messages: [] });
      expect(response.status).toBe(401);
      expect(ledger).toEqual({});
    });
  });
});
