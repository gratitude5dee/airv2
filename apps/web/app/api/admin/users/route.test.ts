/**
 * Admin user directory contract: bearer auth against ADMIN_API_KEY, id →
 * username/handle mapping, paged reads past the 1000-row default, and a
 * handles read failure degrading to an empty handle list rather than a 500.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  users: [] as Record<string, unknown>[],
  handles: [] as Record<string, unknown>[],
  usersError: null as { message: string } | null,
  handlesError: null as { message: string } | null,
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    let from = 0;
    let to = Infinity;
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "order", "not"]) {
      chain[method] = vi.fn(self);
    }
    chain.range = vi.fn((start: number, end: number) => {
      from = start;
      to = end;
      return chain;
    });
    chain.then = (resolve: (value: unknown) => unknown) => {
      const error = table === "users" ? db.usersError : db.handlesError;
      const rows = table === "users" ? db.users : db.handles;
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

const base = "https://air.test/api/admin/users";
const authed = () =>
  new NextRequest(base, { headers: { authorization: "Bearer admin-key" } });

beforeEach(() => {
  process.env.ADMIN_API_KEY = "admin-key";
  db.users = [];
  db.handles = [];
  db.usersError = null;
  db.handlesError = null;
});

describe("GET /api/admin/users", () => {
  it("401s without the admin key", async () => {
    expect((await GET(new NextRequest(base))).status).toBe(401);
  });

  it("lists users with their handles", async () => {
    db.users = [
      { id: "u1", username: "gratitude", status: "active", created_at: "t1" },
      { id: "u2", username: null, status: "pending", created_at: "t2" },
    ];
    db.handles = [
      { user_id: "u1", platform: "imessage", address: "+15551234567" },
      { user_id: "u2", platform: "email", address: "gopal@example.com" },
      { user_id: "ghost", platform: "email", address: "orphan@example.com" },
    ];
    const response = await GET(authed());
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.users).toEqual([
      {
        user_id: "u1",
        username: "gratitude",
        status: "active",
        created_at: "t1",
        handles: [{ platform: "imessage", address: "+15551234567" }],
      },
      {
        user_id: "u2",
        username: null,
        status: "pending",
        created_at: "t2",
        handles: [{ platform: "email", address: "gopal@example.com" }],
      },
    ]);
  });

  it("pages past the 1000-row read limit", async () => {
    db.users = Array.from({ length: 1500 }, (_, i) => ({
      id: `u${i}`,
      username: null,
      status: "active",
      created_at: `t${i}`,
    }));
    const body = await (await GET(authed())).json();
    expect(body.users).toHaveLength(1500);
  });

  it("500s when the users read fails", async () => {
    db.usersError = { message: "boom" };
    expect((await GET(authed())).status).toBe(500);
  });

  it("degrades to empty handles when the handles read fails", async () => {
    db.users = [
      { id: "u1", username: "gratitude", status: "active", created_at: "t1" },
    ];
    db.handlesError = { message: "boom" };
    const body = await (await GET(authed())).json();
    expect(body.users[0].handles).toEqual([]);
  });
});
