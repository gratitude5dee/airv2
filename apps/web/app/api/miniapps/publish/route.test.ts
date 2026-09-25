import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeApp } from "@/app/mini/loader-test-utils";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const db = new FakeSupabase();
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.client(),
}));

const app = makeApp({
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: "user-alice",
  name: "Promo",
  description: "A tour page",
  status: "draft",
  draft_version: "v1700000000001",
  dev_version: "v1700000000001",
  dev_expires_at: "2099-01-01T00:00:00.000Z",
});
const publish = vi.hoisted(() => ({
  createDraft: vi.fn(),
  ownedApp: vi.fn(),
}));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  createDraft: publish.createDraft,
  ownedApp: publish.ownedApp,
}));

vi.mock("@/lib/functions/backend", () => ({
  loadFunctions: async () => null,
  fileBackendDecision: async () => null,
}));

const versions = vi.hoisted(() => ({ getVersion: vi.fn() }));
vi.mock("@/lib/create/versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/versions")>()),
  getVersion: versions.getVersion,
}));

const finalize = vi.hoisted(() => ({
  filePublishDecision: vi.fn<(supabase: unknown, userId: string, app: unknown, payload: unknown) => Promise<string>>(),
}));
vi.mock("@/lib/create/finalize", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/finalize")>()),
  filePublishDecision: finalize.filePublishDecision,
}));

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { POST } from "./route";

const version = {
  id: "row-1",
  app_id: app.id,
  user_id: "user-alice",
  version: "v1700000000001",
  lane: "vibe" as const,
  bundle_sha256: "ab".repeat(32),
  bundle_bytes: 2048,
  file_count: 4,
  worker_sha256: null,
  kit_version: "1.4.0",
  functions: null,
  findings: [],
  qa_score: 90,
  tests_total: 3,
  tests_passed: 3,
  created_at: "2026-01-01T00:00:00.000Z",
  published_at: null,
  retired_at: null,
  purged_at: null,
};

function post(body: unknown, token = "gw-1"): NextRequest {
  return new NextRequest("https://air.test/api/miniapps/publish", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function payloadOf(): Record<string, unknown> {
  return finalize.filePublishDecision.mock.calls[0]?.[3] as Record<string, unknown>;
}

beforeEach(() => {
  db.reset();
  vi.clearAllMocks();
  db.tables["boxes"] = [{ user_id: "user-alice", gateway_token: "gw-1" }];
  publish.createDraft.mockResolvedValue({ id: app.id, slug: app.slug, name: "Promo", created: false });
  publish.ownedApp.mockResolvedValue(app);
  versions.getVersion.mockResolvedValue(version);
  finalize.filePublishDecision.mockResolvedValue("dec-1");
});

describe("POST /api/miniapps/publish", () => {
  it("401 without a gateway token", async () => {
    db.tables["boxes"] = [];
    expect((await POST(post({ appname: "promo", name: "Promo" }))).status).toBe(401);
    expect(publish.createDraft).not.toHaveBeenCalled();
  });

  it("V11 body: stages the draft and files the decision with the production defaults", async () => {
    const response = await POST(post({ appname: "promo", name: "Promo", description: "A tour page" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ ok: true, slug: "alice-promo", status: "draft", decision_id: "dec-1" });
    expect(publish.createDraft).toHaveBeenCalledWith(expect.anything(), "user-alice", {
      appname: "promo",
      name: "Promo",
      description: "A tour page",
    });
    expect(payloadOf()).toMatchObject({
      channel: "production",
      store: "listed",
      mirror: true,
      tests: { passed: 3, total: 3 },
      qa_score: 90,
      version: "v1700000000001",
    });
  });

  it("V12 body: store, mirror, tests, qa_score and dev_url land on the decision payload (counts only)", async () => {
    const response = await POST(
      post({
        appname: "promo",
        name: "Promo",
        channel: "production",
        store: "unlisted",
        mirror: false,
        tests: { total: 3, passed: 2, failed_ids: ["checkout-opens"] },
        qa_score: 74,
        dev_url: "https://link.wzrd.tech/alice/promo",
      })
    );
    expect(response.status).toBe(200);
    const payload = payloadOf();
    expect(payload).toMatchObject({
      channel: "production",
      store: "unlisted",
      mirror: false,
      tests: { passed: 2, total: 3 },
      qa_score: 74,
      dev_url: "https://link.wzrd.tech/alice/promo",
    });
    expect(JSON.stringify(payload)).not.toContain("checkout-opens");
    expect(payload["mirror_line"]).toBe("source stays private (no mirror).");
  });

  it("400 on an invalid V12 field: bad tests, channel, store, qa_score or an off-host dev_url", async () => {
    const cases = [
      { tests: { total: 2, passed: 3, failed_ids: [] } },
      { tests: { total: 2, passed: 1, failed_ids: [] } },
      { tests: { total: 2, passed: 1 , failed_ids: ["a"], extra: 1 } },
      { channel: "dev" },
      { store: "featured" },
      { qa_score: 101 },
      { mirror: "no" },
      { dev_url: "https://evil.example/alice/promo" },
    ];
    for (const extra of cases) {
      const response = await POST(post({ appname: "promo", name: "Promo", ...extra }));
      expect(response.status, JSON.stringify(extra)).toBe(400);
      expect(await response.json()).toMatchObject({ error: "invalid request" });
    }
    expect(publish.createDraft).not.toHaveBeenCalled();
    expect(finalize.filePublishDecision).not.toHaveBeenCalled();
  });

  it("PublishError statuses pass through; a decision failure is 502", async () => {
    publish.createDraft.mockRejectedValueOnce(new PublishError("set a username before publishing", 409));
    expect((await POST(post({ appname: "promo", name: "Promo" }))).status).toBe(409);
    finalize.filePublishDecision.mockRejectedValueOnce(new Error("insert failed"));
    const failed = await POST(post({ appname: "promo", name: "Promo" }));
    expect(failed.status).toBe(502);
    expect(await failed.json()).toEqual({ error: "decision failed" });
  });
});
