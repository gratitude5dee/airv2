/**
 * V11 CR16 guard on admin delete: a publisher whose apps were ever deployed to
 * the app origin cannot be deleted while the lane that tears origins down is
 * unconfigured — otherwise an orphaned Worker could outlive its owner. The
 * fact comes from mini_apps.app_origin_deployed_at, which survives the
 * discarded ledger rows of failed uploads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const db = vi.hoisted(() => ({
  rows: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, { message: string }>,
  deletes: [] as string[],
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    for (const method of ["select", "eq", "in", "not", "is", "limit", "update"]) {
      chain[method] = vi.fn(self);
    }
    chain["delete"] = vi.fn(() => {
      db.deletes.push(table);
      return chain;
    });
    const result = () => {
      const error = db.errors[table] ?? null;
      return { data: error ? null : (db.rows[table] ?? []), error };
    };
    chain["maybeSingle"] = () => {
      const r = result();
      return Promise.resolve({ data: (r.data ?? [])[0] ?? null, error: r.error });
    };
    chain["then"] = (resolve: (value: unknown) => unknown) =>
      Promise.resolve(result()).then(resolve);
    return chain;
  }
  return { serviceClient: () => ({ from: builder }) };
});

const deploy = vi.hoisted(() => ({
  appOriginLaneReady: vi.fn(() => false),
  teardownAppOrigin: vi.fn(async () => undefined),
}));
vi.mock("@/lib/functions/deploy", () => deploy);

import { POST } from "./route";

const authed = (body: unknown) =>
  new NextRequest("https://air.test/api/admin/delete", {
    method: "POST",
    headers: { authorization: "Bearer admin-key", "content-type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  db.rows = { users: [{ id: "u1", composio_session_id: null }] };
  db.errors = {};
  db.deletes = [];
  deploy.appOriginLaneReady.mockReset();
  deploy.appOriginLaneReady.mockReturnValue(false);
  deploy.teardownAppOrigin.mockClear();
});

describe("POST /api/admin/delete — app origin guard (CR16)", () => {
  it("refuses to delete a publisher that was ever deployed when the lane is unconfigured", async () => {
    // A failed upload discarded its version row, but the draft Worker it put
    // may still be serving: only the app row remembers.
    db.rows["mini_apps"] = [
      { slug: "alice-notes", app_origin_deployed_at: "2026-01-01T00:00:00.000Z" },
    ];
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { steps: Record<string, string>; retry: boolean };
    expect(body.retry).toBe(true);
    expect(body.steps["app_origin"]).toMatch(/nothing deleted/);
    expect(db.deletes).toEqual([]);
    expect(deploy.teardownAppOrigin).not.toHaveBeenCalled();
  });

  it("aborts, deleting nothing, when the owned-app lookup fails", async () => {
    db.errors["mini_apps"] = { message: "db down" };
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(db.deletes).toEqual([]);
  });

  it("tears down every owned app before touching rows once the lane is configured", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.rows["mini_apps"] = [
      { slug: "alice-notes", app_origin_deployed_at: "2026-01-01T00:00:00.000Z" },
      { slug: "alice-todo", app_origin_deployed_at: null },
    ];
    deploy.teardownAppOrigin.mockRejectedValueOnce(new Error("vendor 502"));
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(deploy.teardownAppOrigin).toHaveBeenCalledTimes(2);
    expect(db.deletes).toEqual([]);
  });
});
