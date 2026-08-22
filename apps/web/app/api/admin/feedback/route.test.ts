/**
 * Admin feedback inbox contract: bearer auth against ADMIN_API_KEY, filter
 * validation, status counts, and a graceful empty read before the migration
 * is applied.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  rows: [] as Record<string, unknown>[],
  error: null as { message: string } | null,
  filters: [] as Array<[string, unknown]>,
}));

vi.mock("@/lib/supabase", () => {
  function builder() {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "order", "limit", "gte"]) {
      chain[method] = vi.fn(self);
    }
    chain.eq = vi.fn((column: string, value: unknown) => {
      db.filters.push([column, value]);
      return chain;
    });
    chain.then = (resolve: (value: unknown) => unknown) =>
      Promise.resolve({
        data: db.error ? null : db.rows,
        error: db.error,
      }).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

import { GET } from "./route";

const base = "https://air.test/api/admin/feedback";
const authed = (url = base) =>
  new NextRequest(url, { headers: { authorization: "Bearer admin-key" } });

beforeEach(() => {
  process.env.ADMIN_API_KEY = "admin-key";
  db.rows = [];
  db.error = null;
  db.filters = [];
});

describe("GET /api/admin/feedback", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("rejects unknown kinds, statuses, and limits", async () => {
    expect((await GET(authed(`${base}?kind=rant`))).status).toBe(400);
    expect((await GET(authed(`${base}?status=NOPE!`))).status).toBe(400);
    expect((await GET(authed(`${base}?limit=99999`))).status).toBe(400);
  });

  it("lists items with status counts", async () => {
    db.rows = [
      {
        id: "f1",
        user_id: "u1",
        kind: "bug",
        title: "cards never arrive",
        body: null,
        status: "open",
        created_at: "2026-08-21T00:00:00Z",
      },
      {
        id: "f2",
        user_id: "u2",
        kind: "feature",
        title: "let me rename my agent",
        body: "please",
        status: "closed",
        created_at: "2026-08-20T00:00:00Z",
      },
    ];
    const body = (await (await GET(authed())).json()) as {
      counts: Record<string, number>;
      items: Array<Record<string, unknown>>;
    };
    expect(body.counts).toEqual({ open: 1, closed: 1 });
    expect(body.items).toHaveLength(2);
  });

  it("applies kind and status filters", async () => {
    await GET(authed(`${base}?kind=bug&status=open`));
    expect(db.filters).toEqual([
      ["kind", "bug"],
      ["status", "open"],
    ]);
  });

  it("reads as unavailable rather than 500 before the migration lands", async () => {
    db.error = { message: 'relation "feedback_items" does not exist' };
    const response = await GET(authed());
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      items: [],
      counts: {},
      unavailable: true,
    });
  });
});
