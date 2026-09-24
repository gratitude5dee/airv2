/**
 * Admin deliveries contract: bearer auth against ADMIN_API_KEY, window and
 * limit validation, per-user filtering, and the schedule-name join flattening
 * to a metadata-only row.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; filters: Record<string, unknown> }[],
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const filters: Record<string, unknown> = {};
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "gte", "order", "limit", "range"]) {
      chain[method] = vi.fn(self);
    }
    chain["eq"] = vi.fn((col: string, value: unknown) => {
      filters[col] = value;
      return chain;
    });
    chain["then"] = (resolve: (value: unknown) => unknown) => {
      db.calls.push({ table, filters });
      return Promise.resolve({
        data: db.rows[table] ?? [],
        error: null,
      }).then(resolve);
    };
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

import { GET } from "./route";

const base = "https://air.test/api/admin/deliveries";
const USER = "11111111-1111-4111-8111-111111111111";
const SCHED = "22222222-2222-4222-8222-222222222222";
const authed = (url = base) =>
  new NextRequest(url, { headers: { authorization: "Bearer admin-key" } });

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.rows = {};
  db.calls = [];
});

describe("GET /api/admin/deliveries", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("400s on a non-uuid user_id and a bad window", async () => {
    expect(
      (await GET(authed(`${base}?user_id=not-a-uuid`))).status
    ).toBe(400);
    expect((await GET(authed(`${base}?days=0`))).status).toBe(400);
    expect((await GET(authed(`${base}?days=91`))).status).toBe(400);
    expect((await GET(authed(`${base}?limit=0`))).status).toBe(400);
    expect((await GET(authed(`${base}?limit=501`))).status).toBe(400);
  });

  it("returns flattened rows and scopes by user_id", async () => {
    db.rows["schedule_deliveries"] = [
      {
        id: "d1",
        user_id: USER,
        schedule_id: SCHED,
        channel: "imessage",
        disposition: "delivered",
        content_hash: "abc",
        excerpt: "checkout page is 500ing",
        created_at: "2026-09-24T00:00:00Z",
        agent_schedules: { name: "site watch" },
      },
    ];
    const res = await GET(authed(`${base}?user_id=${USER}&days=3`));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.days).toBe(3);
    expect(body.deliveries).toHaveLength(1);
    expect(body.deliveries[0].schedule_name).toBe("site watch");
    expect(body.deliveries[0].disposition).toBe("delivered");
    expect(db.calls[0]?.filters["user_id"]).toBe(USER);
  });

  it("survives a null schedule join (deleted schedule)", async () => {
    db.rows["schedule_deliveries"] = [
      {
        id: "d2",
        user_id: USER,
        schedule_id: null,
        channel: "none",
        disposition: "suppressed_silent",
        content_hash: null,
        excerpt: null,
        created_at: "2026-09-24T00:00:00Z",
        agent_schedules: null,
      },
    ];
    const res = await GET(authed(`${base}?user_id=${USER}`));
    const body = await res.json();
    expect(body.deliveries[0].schedule_name).toBeNull();
    expect(body.deliveries[0].disposition).toBe("suppressed_silent");
  });
});
