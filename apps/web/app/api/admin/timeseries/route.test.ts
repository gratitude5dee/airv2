/**
 * Admin time-series contract: bearer auth, window validation, hour vs day
 * bucketing, zero-filled buckets, per-bucket aggregation from agent_runs and
 * box_state_events, the optional user_id filter, and paged reads past the
 * 1000-row default.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  runs: [] as Record<string, unknown>[],
  events: [] as Record<string, unknown>[],
  runsError: null as { message: string } | null,
  filters: [] as { table: string; column: string; value: unknown }[],
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    let from = 0;
    let to = Infinity;
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "gte", "order"]) {
      chain[method] = vi.fn(self);
    }
    chain["eq"] = vi.fn((column: string, value: unknown) => {
      db.filters.push({ table, column, value });
      return chain;
    });
    chain["range"] = vi.fn((start: number, end: number) => {
      from = start;
      to = end;
      return chain;
    });
    chain["then"] = (resolve: (value: unknown) => unknown) => {
      const error = table === "agent_runs" ? db.runsError : null;
      const rows = table === "agent_runs" ? db.runs : db.events;
      return Promise.resolve({
        data: error ? null : rows.slice(from, to + 1),
        error,
      }).then(resolve);
    };
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

import { GET } from "./route";

const base = "https://air.test/api/admin/timeseries";
const authed = (qs = "") =>
  new NextRequest(`${base}${qs}`, {
    headers: { authorization: "Bearer admin-key" },
  });

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.runs = [];
  db.events = [];
  db.runsError = null;
  db.filters = [];
});

describe("GET /api/admin/timeseries", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("400s on invalid windows", async () => {
    expect((await GET(authed("?days=0"))).status).toBe(400);
    expect((await GET(authed("?days=9999"))).status).toBe(400);
    expect((await GET(authed("?days=1.5"))).status).toBe(400);
  });

  it("buckets by hour for short windows and by day otherwise", async () => {
    const short = await (await GET(authed("?days=1"))).json();
    expect(short.bucket).toBe("hour");
    expect(short.points).toHaveLength(25);
    const long = await (await GET(authed("?days=7"))).json();
    expect(long.bucket).toBe("day");
    expect(long.points).toHaveLength(8);
  });

  it("aggregates runs and box events into their buckets", async () => {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    db.runs = [
      {
        user_id: "u1",
        started_at: hourAgo,
        prompt_tokens: 100,
        completion_tokens: 40,
        cost_usd: 0.5,
        box_seconds: 60,
      },
      {
        user_id: "u2",
        started_at: hourAgo,
        prompt_tokens: 10,
        completion_tokens: 5,
        cost_usd: 0.25,
        box_seconds: 30,
      },
    ];
    db.events = [
      { user_id: "u1", state: "ready", created_at: hourAgo },
      { user_id: "u1", state: "stopped", created_at: hourAgo },
    ];
    const body = await (await GET(authed("?days=1"))).json();
    const hot = body.points.find((p: { runs: number }) => p.runs > 0);
    expect(hot).toMatchObject({
      runs: 2,
      prompt_tokens: 110,
      completion_tokens: 45,
      cost_usd: 0.75,
      box_seconds: 90,
      starts: 1,
      stops: 1,
    });
    const totalRuns = body.points.reduce(
      (sum: number, p: { runs: number }) => sum + p.runs,
      0
    );
    expect(totalRuns).toBe(2);
  });

  it("applies the user_id filter to both reads", async () => {
    await GET(authed("?days=1&user_id=u1"));
    expect(db.filters).toEqual([
      { table: "agent_runs", column: "user_id", value: "u1" },
      { table: "box_state_events", column: "user_id", value: "u1" },
    ]);
  });

  it("pages past the 1000-row read limit", async () => {
    const hourAgo = new Date(Date.now() - 3_600_000).toISOString();
    db.runs = Array.from({ length: 1500 }, () => ({
      user_id: "u1",
      started_at: hourAgo,
      prompt_tokens: 1,
      completion_tokens: 1,
      cost_usd: 0,
      box_seconds: 0,
    }));
    const body = await (await GET(authed("?days=1"))).json();
    const totalRuns = body.points.reduce(
      (sum: number, p: { runs: number }) => sum + p.runs,
      0
    );
    expect(totalRuns).toBe(1500);
  });

  it("returns zero-filled buckets when the runs read fails", async () => {
    db.runsError = { message: "boom" };
    const response = await GET(authed("?days=1"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(
      body.points.every((p: { runs: number }) => p.runs === 0)
    ).toBe(true);
  });
});
