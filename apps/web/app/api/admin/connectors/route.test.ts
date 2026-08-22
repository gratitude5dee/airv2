/**
 * Admin connector rollup contract: bearer auth against ADMIN_API_KEY, and
 * per-toolkit status counts (including unknown statuses) across all users.
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

const base = "https://air.test/api/admin/connectors";
const authed = () =>
  new NextRequest(base, { headers: { authorization: "Bearer admin-key" } });

beforeEach(() => {
  process.env.ADMIN_API_KEY = "admin-key";
  db.rows = {};
});

describe("GET /api/admin/connectors", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("counts connections by toolkit and status", async () => {
    db.rows = {
      connections: [
        { user_id: "u1", toolkit: "gmail", status: "active" },
        { user_id: "u2", toolkit: "gmail", status: "error" },
        { user_id: "u1", toolkit: "gmail", status: "active" },
        { user_id: "u1", toolkit: "telegram", status: "pending" },
        { user_id: "u1", toolkit: "telegram", status: "weird" },
      ],
    };
    const body = (await (await GET(authed())).json()) as {
      totals: Record<string, number>;
      toolkits: Array<Record<string, unknown>>;
    };
    expect(body.totals).toEqual({
      pending: 1,
      active: 2,
      revoked: 0,
      error: 1,
      unknown: 1,
    });
    expect(body.toolkits[0]).toEqual({
      toolkit: "gmail",
      pending: 0,
      active: 2,
      revoked: 0,
      error: 1,
      total: 3,
      users: 2,
    });
    expect(body.toolkits[1]).toMatchObject({
      toolkit: "telegram",
      pending: 1,
      total: 1,
      users: 1,
    });
  });

  it("is idempotent — repeated reads return the same rollup", async () => {
    db.rows = {
      connections: [{ user_id: "u1", toolkit: "gmail", status: "active" }],
    };
    const first = await (await GET(authed())).json();
    const second = await (await GET(authed())).json();
    expect(second).toEqual(first);
  });
});
