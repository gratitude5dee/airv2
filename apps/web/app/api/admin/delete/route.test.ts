/**
 * V11 CR16 guard on admin delete: a publisher whose apps were ever deployed to
 * the app origin cannot be deleted while the lane that tears origins down is
 * unconfigured — otherwise an orphaned Worker could outlive its owner. The
 * fact comes from mini_apps.app_origin_deployed_at, which survives the
 * discarded ledger rows of failed uploads.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const db = vi.hoisted(() => ({
  fake: null as unknown as FakeSupabase,
}));

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.fake.client(),
}));

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
  db.fake = new FakeSupabase();
  db.fake.tables["users"] = [{ id: "u1", composio_session_id: null }];
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
    db.fake.tables["boxes"] = [{ user_id: "u1", provider_box_id: "tk_abc" }];
    db.fake.tables["mini_apps"] = [];
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
    expect(db.fake.deletes).toEqual([]);
    // The account stays closed so a retry finds the same inventory.
    expect(
      db.fake.updates.some((u) => u.table === "users" && typeof u.patch["deleting_at"] === "string")
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
    expect(db.fake.deletes.map((d) => d.table)).toContain("users");
  });

  it("deletes the user once the provider confirms the box is gone", async () => {
    withBox();
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { steps: Record<string, string> };
    expect(body.steps["box"]).toBe("deleted");
    expect(box.stop).toHaveBeenCalledWith("tk_abc");
    expect(db.fake.deletes.map((d) => d.table)).toContain("users");
  });
});

describe("POST /api/admin/delete — app origin guard (CR16)", () => {
  it("refuses to delete a publisher that was ever deployed when the lane is unconfigured", async () => {
    // A failed upload discarded its version row, but the draft Worker it put
    // may still be serving: only the app row remembers.
    db.fake.tables["mini_apps"] = [
      { slug: "alice-notes", owner_user_id: "u1", app_origin_deployed_at: "2026-01-01T00:00:00.000Z" },
    ];
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(503);
    const body = (await res.json()) as { steps: Record<string, string>; retry: boolean };
    expect(body.retry).toBe(true);
    expect(body.steps["app_origin"]).toMatch(/nothing deleted/);
    expect(db.fake.deletes).toEqual([]);
    expect(deploy.teardownAppOrigin).not.toHaveBeenCalled();
  });

  it("aborts, deleting nothing, when the owned-app lookup fails", async () => {
    db.fake.errors["mini_apps"] = { message: "db down" };
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(db.fake.deletes).toEqual([]);
  });

  it("tears down every owned app before touching rows once the lane is configured", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.fake.tables["mini_apps"] = [
      { slug: "alice-notes", owner_user_id: "u1", app_origin_deployed_at: "2026-01-01T00:00:00.000Z" },
      { slug: "alice-todo", owner_user_id: "u1", app_origin_deployed_at: null },
    ];
    deploy.teardownAppOrigin.mockRejectedValueOnce(new Error("vendor 502"));
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(deploy.teardownAppOrigin).toHaveBeenCalledTimes(2);
    expect(db.fake.deletes).toEqual([]);
  });

  it("closes every owned app to new deploys before the first teardown", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.fake.tables["mini_apps"] = [{ slug: "alice-notes", owner_user_id: "u1", app_origin_deployed_at: null }];
    let closedBeforeTeardown = false;
    deploy.teardownAppOrigin.mockImplementationOnce(async () => {
      closedBeforeTeardown = db.fake.updates.some(
        (u) => u.table === "mini_apps" && typeof u.patch["deleting_at"] === "string"
      );
      throw new Error("stop here");
    });
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(closedBeforeTeardown).toBe(true);
  });

  it("closes the account (users.deleting_at) before reading the owned-app inventory", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.fake.tables["mini_apps"] = [{ slug: "alice-notes", owner_user_id: "u1", app_origin_deployed_at: null }];
    deploy.teardownAppOrigin.mockRejectedValueOnce(new Error("stop here"));
    await POST(authed({ user_id: "u1" }));
    const accountClosed = db.fake.updates.findIndex(
      (u) => u.table === "users" && typeof u.patch["deleting_at"] === "string"
    );
    expect(accountClosed).toBe(0);
    expect(db.fake.queries.findIndex((q) => q.table === "users" && q.mode === "update")).toBeLessThan(db.fake.queries.findIndex((q) => q.table === "mini_apps" && q.mode === "select"));
  });

  it("aborts, deleting nothing, when the account cannot be closed to new apps", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.fake.tables["mini_apps"] = [{ slug: "alice-notes", owner_user_id: "u1", app_origin_deployed_at: null }];
    db.fake.opErrors["users:update"] = { message: "db down" };
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(db.fake.queries.some((q) => q.table === "mini_apps" && q.mode === "select")).toBe(false);
    expect(deploy.teardownAppOrigin).not.toHaveBeenCalled();
    expect(db.fake.deletes).toEqual([]);
  });

  it("aborts, deleting nothing, when the apps cannot be closed to deploys", async () => {
    deploy.appOriginLaneReady.mockReturnValue(true);
    db.fake.tables["mini_apps"] = [{ slug: "alice-notes", owner_user_id: "u1", app_origin_deployed_at: null }];
    db.fake.opErrors["mini_apps:update"] = { message: "db down" };
    const res = await POST(authed({ user_id: "u1" }));
    expect(res.status).toBe(502);
    expect(deploy.teardownAppOrigin).not.toHaveBeenCalled();
    expect(db.fake.deletes).toEqual([]);
  });
});
