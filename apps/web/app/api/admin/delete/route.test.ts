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
  updates: [] as { table: string; values: Record<string, unknown> }[],
  updateErrors: {} as Record<string, { message: string }>,
  /** `select:<table>` / `update:<table>` in call order. */
  log: [] as string[],
}));

vi.mock("@/lib/supabase", () => {
  function builder(table: string) {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    let updating = false;
    for (const method of ["eq", "in", "not", "is", "limit"]) {
      chain[method] = vi.fn(self);
    }
    chain["select"] = vi.fn(() => {
      db.log.push(`select:${table}`);
      return chain;
    });
    chain["update"] = vi.fn((values: Record<string, unknown>) => {
      updating = true;
      db.log.push(`update:${table}`);
      db.updates.push({ table, values });
      return chain;
    });
    chain["delete"] = vi.fn(() => {
      db.deletes.push(table);
      return chain;
    });
    const result = () => {
      const error =
        (updating ? db.updateErrors[table] : db.errors[table]) ?? null;
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
  const storage = {
    from: () => ({
      list: async () => ({ data: [], error: null }),
      remove: async () => ({ data: [], error: null }),
    }),
  };
  return { serviceClient: () => ({ from: builder, storage }) };
});

const deploy = vi.hoisted(() => ({
  appOriginLaneReady: vi.fn(() => false),
  teardownAppOrigin: vi.fn(async () => undefined),
}));
vi.mock("@/lib/functions/deploy", () => deploy);

const box = vi.hoisted(() => ({
  stop: vi.fn(async () => undefined),
  deleteBox: vi.fn(async () => undefined),
}));
vi.mock("@/lib/box/client", async () => {
  const types = await import("@/lib/box/types");
  return { BoxApiError: types.BoxApiError, stop: box.stop, deleteBox: box.deleteBox };
});
vi.mock("@/lib/mail/client", () => ({ deletePod: vi.fn(async () => undefined) }));
vi.mock("@/lib/daytona/client", () => ({
  daytonaConfigured: () => false,
  deleteTenantKey: vi.fn(),
}));
vi.mock("@/lib/composio/client", () => ({
  listConnectedAccounts: vi.fn(async () => []),
  deleteConnectedAccount: vi.fn(),
  deleteSession: vi.fn(),
}));
vi.mock("@/lib/functions/teardown", () => ({
  teardownBackends: vi.fn(async () => ({ deleted: 0, failed: [] })),
}));
vi.mock("@/lib/create/import", () => ({ forgetInstallations: vi.fn() }));
vi.mock("@/lib/github/app", () => ({ githubAppConfigured: () => false }));
vi.mock("@/lib/ads/openai", () => ({ openAdsKey: () => "", updateCampaign: vi.fn() }));
vi.mock("@/lib/storage/r2", () => ({ r2Configured: () => false, deletePrefix: vi.fn() }));

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
  db.updates = [];
  db.updateErrors = {};
  db.log = [];
  deploy.appOriginLaneReady.mockReset();
  deploy.appOriginLaneReady.mockReturnValue(false);
  deploy.teardownAppOrigin.mockClear();
  box.stop.mockReset();
  box.stop.mockResolvedValue(undefined);
  box.deleteBox.mockReset();
  box.deleteBox.mockResolvedValue(undefined);
});

describe("POST /api/admin/delete — provider box cleanup", () => {
  const withBox = () => {
    db.rows["boxes"] = [{ provider_box_id: "tk_abc" }];
    db.rows["mini_apps"] = [];
  };

  it("keeps the user and box rows when the provider still holds resources", async () => {
    withBox();
    box.deleteBox.mockRejectedValue(new Error("tenki: box tk_abc still has provider resources"));
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    const body = (await res.json()) as { steps: Record<string, string>; retry: boolean };
    expect(body.retry).toBe(true);
    expect(body.steps["box"]).toMatch(/still has provider resources/);
    expect(body.steps["box"]).toMatch(/kept for retry/);
    expect(body.steps["user"]).toBeUndefined();
    expect(db.deletes).toEqual([]);
    // The account stays closed so a retry finds the same inventory.
    expect(
      db.updates.some((u) => u.table === "users" && typeof u.values["deleting_at"] === "string")
    ).toBe(true);
  });

  it("treats a box the provider no longer knows as already cleaned up", async () => {
    withBox();
    const { BoxApiError } = await import("@/lib/box/types");
    box.deleteBox.mockRejectedValue(new BoxApiError(404, "not found"));
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { steps: Record<string, string> };
    expect(body.steps["box"]).toBe("already gone at the provider");
    expect(db.deletes).toContain("users");
  });

  it("deletes the user once the provider confirms the box is gone", async () => {
    withBox();
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { steps: Record<string, string> };
    expect(body.steps["box"]).toBe("deleted");
    expect(box.stop).toHaveBeenCalledWith("tk_abc");
    expect(db.deletes).toContain("users");
  });
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

  it("closes every owned app to new deploys before the first teardown", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.rows["mini_apps"] = [{ slug: "alice-notes", app_origin_deployed_at: null }];
    let closedBeforeTeardown = false;
    deploy.teardownAppOrigin.mockImplementationOnce(async () => {
      closedBeforeTeardown = db.updates.some(
        (u) => u.table === "mini_apps" && typeof u.values["deleting_at"] === "string"
      );
      throw new Error("stop here");
    });
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(closedBeforeTeardown).toBe(true);
  });

  it("closes the account (users.deleting_at) before reading the owned-app inventory", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.rows["mini_apps"] = [{ slug: "alice-notes", app_origin_deployed_at: null }];
    deploy.teardownAppOrigin.mockRejectedValueOnce(new Error("stop here"));
    await POST(authed({ user_id: "u1" }));
    const accountClosed = db.updates.findIndex(
      (u) => u.table === "users" && typeof u.values["deleting_at"] === "string"
    );
    expect(accountClosed).toBe(0);
    expect(db.log.indexOf("update:users")).toBeLessThan(db.log.indexOf("select:mini_apps"));
  });

  it("aborts, deleting nothing, when the account cannot be closed to new apps", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.rows["mini_apps"] = [{ slug: "alice-notes", app_origin_deployed_at: null }];
    db.updateErrors["users"] = { message: "db down" };
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(db.log).not.toContain("select:mini_apps");
    expect(deploy.teardownAppOrigin).not.toHaveBeenCalled();
    expect(db.deletes).toEqual([]);
  });

  it("aborts, deleting nothing, when the apps cannot be closed to deploys", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.rows["mini_apps"] = [{ slug: "alice-notes", app_origin_deployed_at: null }];
    db.updateErrors["mini_apps"] = { message: "db down" };
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(deploy.teardownAppOrigin).not.toHaveBeenCalled();
    expect(db.deletes).toEqual([]);
  });
});
