/**
 * Admin token metering contract: bearer auth against ADMIN_API_KEY, window
 * validation, per-user aggregation of the gateway's token receipts, and the
 * V12 §12 `?group=` regrouping (stage / lane / project / provider) with the
 * list-estimated cost flag.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "eq", "gte", "lt", "order", "range", "limit"]) {
      chain[method] = vi.fn(self);
    }
    chain["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: db.rows[table] ?? [], error: null }).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

import { GET } from "./route";

const base = "https://air.test/api/admin/tokens";
const authed = (url = base) =>
  new NextRequest(url, { headers: { authorization: "Bearer admin-key", "x-admin-operator": "carol" } });

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.rows = {};
});

describe("GET /api/admin/tokens", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
    expect(
      (
        await GET(
          new NextRequest(base, { headers: { authorization: "Bearer nope" } })
        )
      ).status
    ).toBe(401);
  });

  it("rejects a bad window", async () => {
    expect((await GET(authed(`${base}?days=0`))).status).toBe(400);
    expect((await GET(authed(`${base}?days=abc`))).status).toBe(400);
    expect((await GET(authed(`${base}?days=9999`))).status).toBe(400);
  });

  it("aggregates tokens and cost per user", async () => {
    db.rows = {
      agent_runs: [
        {
          user_id: "user-1",
          prompt_tokens: 100,
          completion_tokens: 20,
          cost_usd: 0.001,
        },
        {
          user_id: "user-1",
          prompt_tokens: 50,
          completion_tokens: 5,
          cost_usd: 0.0005,
        },
        {
          user_id: "user-2",
          prompt_tokens: 10,
          completion_tokens: null,
          cost_usd: null,
        },
      ],
    };
    const response = await GET(authed(`${base}?days=7`));
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      window_days: number;
      totals: { prompt_tokens: number; completion_tokens: number; cost_usd: number };
      users: Array<{
        user_id: string;
        runs: number;
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
        cost_usd: number;
      }>;
    };
    expect(body.window_days).toBe(7);
    expect(body.totals).toEqual({
      prompt_tokens: 160,
      completion_tokens: 25,
      cost_usd: 0.0015,
    });
    expect(body.users[0]).toEqual({
      user_id: "user-1",
      runs: 2,
      prompt_tokens: 150,
      completion_tokens: 25,
      total_tokens: 175,
      cost_usd: 0.0015,
    });
    expect(body.users[1]?.total_tokens).toBe(10);
  });

  it("rejects an unknown group", async () => {
    expect((await GET(authed(`${base}?group=owner`))).status).toBe(400);
  });

  it("defaults to the user group and mirrors the users rows", async () => {
    db.rows = {
      agent_runs: [
        { user_id: "user-1", prompt_tokens: 7, completion_tokens: 3, cost_usd: 0 },
      ],
    };
    const body = (await (await GET(authed())).json()) as {
      group: string;
      groups: Array<{ key: string; runs: number; total_tokens: number; cost_estimated: boolean }>;
    };
    expect(body.group).toBe("user");
    expect(body.groups).toEqual([
      {
        key: "user-1",
        runs: 1,
        prompt_tokens: 7,
        completion_tokens: 3,
        total_tokens: 10,
        cost_usd: 0,
        cost_estimated: false,
      },
    ]);
  });

  it("regroups the same receipts by stage, lane and project with the estimate flag", async () => {
    db.rows = {
      agent_runs: [
        {
          user_id: "user-1",
          prompt_tokens: 500,
          completion_tokens: 50,
          cost_usd: 0.0075,
          model: "openai/gpt-6-astra",
          model_family: "gmi",
          speed_tier: "deep",
          label: "create:alice-promo",
          create_stage: "plan",
        },
        {
          user_id: "user-1",
          prompt_tokens: 100,
          completion_tokens: 20,
          cost_usd: 0.001,
          model: "zai-org/GLM-5.3-Flash",
          model_family: "gmi",
          speed_tier: "balanced",
          label: "create:alice-promo",
          create_stage: "build",
        },
        {
          user_id: "user-2",
          prompt_tokens: 10,
          completion_tokens: 5,
          cost_usd: 0.0001,
          model: "gpt-5.6-luna",
          model_family: "openai",
          speed_tier: "balanced",
          label: null,
          create_stage: null,
        },
      ],
    };
    const stage = (await (await GET(authed(`${base}?group=stage`))).json()) as {
      group: string;
      users: unknown[];
      totals: { prompt_tokens: number };
      groups: Array<{ key: string; runs: number; cost_estimated: boolean; cost_usd: number }>;
    };
    expect(stage.group).toBe("stage");
    expect(stage.users).toHaveLength(2);
    expect(stage.totals.prompt_tokens).toBe(610);
    expect(stage.groups.map((row) => [row.key, row.runs, row.cost_estimated])).toEqual([
      ["plan", 1, true],
      ["build", 1, false],
      ["none", 1, false],
    ]);

    const lane = (await (await GET(authed(`${base}?group=lane`))).json()) as {
      groups: Array<{ key: string; runs: number; cost_usd: number }>;
    };
    expect(lane.groups).toEqual([
      expect.objectContaining({ key: "create", runs: 2, cost_usd: 0.0085 }),
      expect.objectContaining({ key: "chat", runs: 1, cost_usd: 0.0001 }),
    ]);

    const project = (await (await GET(authed(`${base}?group=project`))).json()) as {
      groups: Array<{ key: string }>;
    };
    expect(project.groups.map((row) => row.key)).toEqual(["create:alice-promo", "chat"]);

    const provider = (await (await GET(authed(`${base}?group=provider`))).json()) as {
      groups: Array<{ key: string; runs: number }>;
    };
    expect(provider.groups.map((row) => [row.key, row.runs])).toEqual([
      ["gmi", 2],
      ["openai", 1],
    ]);
  });

  it("is idempotent — repeated reads never mutate", async () => {
    db.rows = {
      agent_runs: [
        { user_id: "user-1", prompt_tokens: 7, completion_tokens: 3, cost_usd: 0 },
      ],
    };
    const first = await (await GET(authed())).json();
    const second = await (await GET(authed())).json();
    expect((second as { users: unknown[] }).users).toEqual(
      (first as { users: unknown[] }).users
    );
  });
});
