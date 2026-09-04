import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
const box = vi.hoisted(() => ({
  boxUserId: vi.fn(async (): Promise<string | undefined> => undefined),
}));
vi.mock("@/lib/auth/box", () => box);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
const publish = vi.hoisted(() => ({ ownedApp: vi.fn() }));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  ownedApp: publish.ownedApp,
  publisherUsername: async () => "alice",
}));
const preview = vi.hoisted(() => ({
  draftPreviewUrl: vi.fn((): string | null => "https://alice-countdown.apps.test/__air/enter?t=tok"),
}));
vi.mock("@/lib/create/preview", () => preview);

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { POST } from "./route";

const app = makeApp({
  slug: "alice-countdown",
  appname: "countdown",
  owner_user_id: "user-alice",
  status: "draft",
  bundle_version: null,
  draft_version: "v1700000000001",
});

function post(body: unknown): NextRequest {
  return new NextRequest("https://mini.test/api/create/preview-link", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue("user-alice");
  box.boxUserId.mockResolvedValue(undefined);
  preview.draftPreviewUrl.mockReturnValue("https://alice-countdown.apps.test/__air/enter?t=tok");
  publish.ownedApp.mockImplementation(async (_s: unknown, userId: string, slug: string) => {
    if (userId === "user-alice" && slug === app.slug) return app;
    throw new PublishError("not found", 404);
  });
});

describe("POST /api/create/preview-link", () => {
  it("401 without a store session or gateway bearer (CR13: owner/agent only)", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    expect((await POST(post({ slug: "alice-countdown" }))).status).toBe(401);
    expect(publish.ownedApp).not.toHaveBeenCalled();
  });

  it("mints a fresh owner-only draft link for the slug", async () => {
    const response = await POST(post({ slug: "alice-countdown" }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      ok: true,
      slug: "alice-countdown",
      version: "v1700000000001",
      preview_url: "https://alice-countdown.apps.test/__air/enter?t=tok",
    });
    expect(preview.draftPreviewUrl).toHaveBeenCalledWith(app);
  });

  it("accepts the Box's gateway bearer with an appname (air-create qa)", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    box.boxUserId.mockResolvedValue("user-alice");
    const response = await POST(post({ appname: "countdown" }));
    expect(response.status).toBe(200);
    expect(publish.ownedApp).toHaveBeenCalledWith(expect.anything(), "user-alice", "alice-countdown");
  });

  it("400 on a malformed slug or appname", async () => {
    expect((await POST(post({ slug: "../x" }))).status).toBe(400);
    expect((await POST(post({ appname: "../x" }))).status).toBe(400);
    expect((await POST(post({}))).status).toBe(400);
    expect(publish.ownedApp).not.toHaveBeenCalled();
  });

  it("404 for another owner's app", async () => {
    expect((await POST(post({ slug: "bob-promo" }))).status).toBe(404);
    expect(preview.draftPreviewUrl).not.toHaveBeenCalled();
  });

  it("409 when there is nothing staged to preview", async () => {
    publish.ownedApp.mockResolvedValueOnce(makeApp({ ...app, draft_version: null, bundle_version: null }));
    expect((await POST(post({ slug: "alice-countdown" }))).status).toBe(409);
  });

  it("503 when the app origin is not configured", async () => {
    preview.draftPreviewUrl.mockReturnValueOnce(null);
    expect((await POST(post({ slug: "alice-countdown" }))).status).toBe(503);
  });
});
