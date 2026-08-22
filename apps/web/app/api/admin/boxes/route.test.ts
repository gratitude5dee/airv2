/**
 * Admin box usage contract: bearer auth against ADMIN_API_KEY, window
 * validation, and per-user box state joined with start/stop and box_seconds.
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
    for (const method of ["select", "eq", "gte", "order", "range", "limit"]) {
      chain[method] = vi.fn(self);
    }
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({ data: db.rows[table] ?? [], error: null }).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

import { GET } from "./route";

const base = "https://air.test/api/admin/boxes";
const authed = (url = base) =>
  new NextRequest(url, { headers: { authorization: "Bearer admin-key" } });

beforeEach(() => {
  process.env.ADMIN_API_KEY = "admin-key";
  db.rows = {};
});

describe("GET /api/admin/boxes", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("rejects a bad window", async () => {
    expect((await GET(authed(`${base}?days=0`))).status).toBe(400);
    expect((await GET(authed(`${base}?days=1.5`))).status).toBe(400);
  });

  it("reports box state, wake/stop counts, and box_seconds per user", async () => {
    db.rows = {
      boxes: [
        {
          user_id: "u1",
          provider: "ascii",
          state: "ready",
          template_version: "v9",
          last_active_at: "2026-08-20T00:00:00Z",
          stop_after: null,
          created_at: "2026-08-01T00:00:00Z",
        },
        { user_id: "u2", provider: "ascii", state: "stopped" },
      ],
      box_state_events: [
        { user_id: "u1", state: "ready" },
        { user_id: "u1", state: "keepawake" },
        { user_id: "u1", state: "stopped" },
        { user_id: "u2", state: "ready" },
      ],
      agent_runs: [
        { user_id: "u1", box_seconds: 120 },
        { user_id: "u1", box_seconds: null },
        { user_id: "u2", box_seconds: 30 },
      ],
    };
    const body = (await (await GET(authed(`${base}?days=7`))).json()) as {
      window_days: number;
      totals: {
        boxes: number;
        by_state: Record<string, number>;
        starts: number;
        stops: number;
        box_seconds: number;
      };
      users: Array<Record<string, unknown>>;
    };
    expect(body.window_days).toBe(7);
    expect(body.totals.boxes).toBe(2);
    expect(body.totals.by_state).toEqual({ ready: 1, stopped: 1 });
    expect(body.totals).toMatchObject({ starts: 3, stops: 1, box_seconds: 150 });
    expect(body.users[0]).toMatchObject({
      user_id: "u1",
      state: "ready",
      template_version: "v9",
      starts: 2,
      stops: 1,
      runs: 2,
      box_seconds: 120,
    });
  });

  it("is idempotent — repeated reads return the same snapshot shape", async () => {
    db.rows = { boxes: [{ user_id: "u1", state: "idle" }] };
    const first = (await (await GET(authed())).json()) as { users: unknown[] };
    const second = (await (await GET(authed())).json()) as { users: unknown[] };
    expect(second.users).toEqual(first.users);
  });
});
