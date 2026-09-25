import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { makeApp } from "@/app/mini/loader-test-utils";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
const box = vi.hoisted(() => ({
  boxUserId: vi.fn(async (): Promise<string | undefined> => undefined),
}));
vi.mock("@/lib/auth/box", () => box);

/** Just enough PostgREST: `create_intakes` answers with the seeded row (or
 * nothing — a missing table/read error reads as `confirmed`), `create_builds`
 * with an empty p50 sample. */
const db = vi.hoisted(() => ({
  fake: null as unknown as FakeSupabase,
}));
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.fake.client(),
}));

const app = makeApp({
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: "user-alice",
  status: "draft",
  draft_version: "v1700000000001",
});
const publish = vi.hoisted(() => ({ ownedApp: vi.fn() }));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  ownedApp: publish.ownedApp,
  publisherUsername: async () => "alice",
}));

const T0 = Date.parse("2026-09-17T12:00:00.000Z");
const ledger = vi.hoisted(() => ({
  latestBuild: vi.fn(async (): Promise<unknown> => null),
}));
vi.mock("@/lib/create/build", () => ledger);
const versions = vi.hoisted(() => ({
  getVersion: vi.fn(async (): Promise<unknown> => null),
}));
vi.mock("@/lib/create/versions", () => versions);

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { GET } from "./route";

function progressRequest(query: string, token?: string): NextRequest {
  return new NextRequest(`https://air.test/api/create/progress?${query}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

const running = {
  id: "build-1",
  status: "running",
  log: [],
  findings: [],
  sizes: null,
  version: null,
  error: null,
  started_at: new Date(T0).toISOString(),
  finished_at: null,
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
  db.fake = new FakeSupabase();
  ledger.latestBuild.mockReset().mockResolvedValue(null);
  versions.getVersion.mockReset().mockResolvedValue(null);
  session.storeSessionUserId.mockReturnValue(null);
  box.boxUserId.mockResolvedValue(undefined);
  publish.ownedApp.mockImplementation(async (_s: unknown, userId: string, slug: string) => {
    if (userId === "user-alice" && slug === app.slug) return app;
    throw new PublishError("not found", 404);
  });
});

describe("GET /api/create/progress", () => {
  it("401 without a session or gateway token", async () => {
    expect((await GET(progressRequest("app=promo"))).status).toBe(401);
    expect(publish.ownedApp).not.toHaveBeenCalled();
  });

  it("400 on a malformed app name or slug", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    expect((await GET(progressRequest("app=Promo!", "gw-1"))).status).toBe(400);
    expect((await GET(progressRequest("slug=..", "gw-1"))).status).toBe(400);
    expect((await GET(progressRequest("", "gw-1"))).status).toBe(400);
  });

  it("returns the derived triple for the owner's Box; a missing intake reads as confirmed", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    vi.useFakeTimers({ now: T0 + 30_000 });
    ledger.latestBuild.mockResolvedValue(running);
    const response = await GET(progressRequest("app=promo", "gw-1"));
    expect(response.status).toBe(200);
    // Default p50 is 60 s with no history: 15 + 25 × 0.5 after 30 s.
    expect(await response.json()).toEqual({
      slug: "alice-promo",
      percent: 28,
      job: null,
      stage: "building",
      detail: "build running",
      updated_at: new Date(T0).toISOString(),
    });
    expect(publish.ownedApp).toHaveBeenCalledWith(expect.anything(), "user-alice", "alice-promo");
  });

  it("a missing create_intakes table is not an error: the build alone drives the percent", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    db.fake.errors["create_intakes"] = { message: "relation does not exist" };
    ledger.latestBuild.mockResolvedValue({ ...running, status: "queued" });
    const response = await GET(progressRequest("slug=alice-promo"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ percent: 15, stage: "building", detail: "build queued" });
  });

  it("reads the intake stage and the draft's QA / test counts", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    db.fake.tables["create_intakes"] = [
      { user_id: "user-alice", appname: "promo", stage: "testing", failed_builds: 0, opened_at: new Date(T0).toISOString(), updated_at: new Date(T0 + 1_000).toISOString() },
    ];
    ledger.latestBuild.mockResolvedValue({
      ...running,
      status: "succeeded",
      version: "v1700000000001",
      finished_at: new Date(T0).toISOString(),
    });
    versions.getVersion.mockResolvedValue({ qa_score: 92, tests_total: 3, tests_passed: 2, created_at: new Date(T0).toISOString() });
    const response = await GET(progressRequest("app=promo"));
    expect(await response.json()).toEqual({
      slug: "alice-promo",
      percent: 65,
      stage: "testing",
      detail: "tests 2/3",
      job: null,
      updated_at: new Date(T0 + 1_000).toISOString(),
    });
    expect(versions.getVersion).toHaveBeenCalledWith(expect.anything(), app.id, "v1700000000001");
  });

  it("5 % for a confirmed plan with no build yet", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    db.fake.tables["create_intakes"] = [
      { user_id: "user-alice", appname: "promo", stage: "confirmed", failed_builds: 0, opened_at: new Date(T0).toISOString(), updated_at: new Date(T0).toISOString() },
    ];
    const response = await GET(progressRequest("app=promo"));
    expect(await response.json()).toMatchObject({ percent: 5, stage: "confirmed", detail: null });
  });

  it("someone else's app is a 404, same as a missing one", async () => {
    session.storeSessionUserId.mockReturnValue("user-bob");
    expect((await GET(progressRequest("slug=alice-promo"))).status).toBe(404);
    expect((await GET(progressRequest("app=nothing"))).status).toBe(404);
    expect(ledger.latestBuild).not.toHaveBeenCalled();
  });
});
