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

const app = makeApp({
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: "user-alice",
  status: "draft",
  bundle_version: null,
  draft_version: "v1700000000001",
});
const publish = vi.hoisted(() => ({ ownedApp: vi.fn(), resolveOwnedAppRef: vi.fn() }));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  ownedApp: publish.ownedApp,
  publisherUsername: async () => "alice",
  resolveOwnedAppRef: publish.resolveOwnedAppRef,
}));

const release = vi.hoisted(() => ({
  promoteToDev: vi.fn(),
  renewDev: vi.fn(),
  revokeDev: vi.fn(),
}));
vi.mock("@/lib/create/release", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/release")>()),
  ...release,
}));

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { ReleaseError } from "@/lib/create/release";
import { POST } from "./route";

const released = {
  channel: "dev",
  version: "v1700000000001",
  url: "https://link.wzrd.tech/alice/promo",
  expires_at: "2026-03-15T12:00:00.000Z",
};

function post(body: unknown, token?: string): NextRequest {
  return new NextRequest("https://air.test/api/create/release", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue(null);
  box.boxUserId.mockResolvedValue(undefined);
  publish.ownedApp.mockResolvedValue(app);
  publish.resolveOwnedAppRef.mockImplementation(
    async (supabase: unknown, userId: string, ref: string) =>
      ref === "promo" || ref === "alice-promo"
        ? publish.ownedApp(supabase as never, userId, "alice-promo").catch(() => null)
        : null,
  );
  release.promoteToDev.mockResolvedValue(released);
  release.renewDev.mockResolvedValue(released);
  release.revokeDev.mockResolvedValue({ version: "v1700000000001" });
});

describe("POST /api/create/release", () => {
  it("401 without a session or gateway token", async () => {
    const response = await POST(post({ app: "promo", channel: "dev", action: "promote" }));
    expect(response.status).toBe(401);
    expect(release.promoteToDev).not.toHaveBeenCalled();
  });

  it("promotes the draft version for the owner's Box and returns the dev release", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    const response = await POST(post({ app: "promo", channel: "dev", action: "promote" }, "gw-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(released);
    expect(publish.ownedApp).toHaveBeenCalledWith(expect.anything(), "user-alice", "alice-promo");
    expect(release.promoteToDev).toHaveBeenCalledWith(expect.anything(), app, "v1700000000001");
  });

  it("accepts an explicit version, a flat slug, or ?appname for the store session", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    const explicit = await POST(
      post({ slug: "alice-promo", channel: "dev", action: "promote", version: "v1700000000000" })
    );
    expect(explicit.status).toBe(200);
    expect(release.promoteToDev).toHaveBeenLastCalledWith(
      expect.anything(),
      app,
      "v1700000000000"
    );
    const flat = await POST(post({ app: "alice-promo", channel: "dev", action: "promote" }));
    expect(flat.status).toBe(200);
    expect(publish.ownedApp).toHaveBeenLastCalledWith(expect.anything(), "user-alice", "alice-promo");
    const byName = await POST(post({ appname: "promo", channel: "dev", action: "promote" }));
    expect(byName.status).toBe(200);
    expect(publish.ownedApp).toHaveBeenLastCalledWith(expect.anything(), "user-alice", "alice-promo");
  });

  it("409 not_ready with the CR22 reasons when the gate refuses", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    release.promoteToDev.mockRejectedValueOnce(
      new ReleaseError("not_ready", 409, ["hard_findings", "tests_failing"])
    );
    const response = await POST(post({ app: "promo", channel: "dev", action: "promote" }));
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "not_ready",
      reasons: ["hard_findings", "tests_failing"],
    });
  });

  it("renews and revokes", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    const renew = await POST(post({ app: "promo", channel: "dev", action: "renew" }));
    expect(renew.status).toBe(200);
    expect(release.renewDev).toHaveBeenCalledWith(expect.anything(), app);
    const revoke = await POST(post({ app: "promo", channel: "dev", action: "revoke" }));
    expect(revoke.status).toBe(200);
    expect(await revoke.json()).toEqual({
      channel: "dev",
      version: "v1700000000001",
      url: null,
      expires_at: null,
    });
    release.revokeDev.mockResolvedValueOnce(null);
    const again = await POST(post({ app: "promo", channel: "dev", action: "revoke" }));
    expect((await again.json()).version).toBeNull();
  });

  it("someone else's app is a 404, same as a missing one", async () => {
    session.storeSessionUserId.mockReturnValue("user-bob");
    publish.ownedApp.mockRejectedValueOnce(new PublishError("app not found", 404));
    const response = await POST(post({ app: "promo", channel: "dev", action: "revoke" }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "app not found" });
    expect(release.revokeDev).not.toHaveBeenCalled();
  });

  it("400 on a bad channel, action, version, slug, body or a promote with nothing staged", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    expect((await POST(post({ app: "promo", channel: "live", action: "promote" }))).status).toBe(400);
    expect((await POST(post({ app: "promo", channel: "dev", action: "ship" }))).status).toBe(400);
    expect(
      (await POST(post({ app: "promo", channel: "dev", action: "promote", version: "latest" }))).status
    ).toBe(400);
    expect((await POST(post({ slug: "Bad Slug", channel: "dev", action: "promote" }))).status).toBe(400);
    expect((await POST(post("{not json"))).status).toBe(400);
    publish.ownedApp.mockResolvedValueOnce({ ...app, draft_version: null, bundle_version: null });
    const nothing = await POST(post({ app: "promo", channel: "dev", action: "promote" }));
    expect(nothing.status).toBe(400);
    expect(await nothing.json()).toEqual({ error: "no version to promote" });
    expect(release.promoteToDev).not.toHaveBeenCalled();
  });

  it("passes ReleaseError statuses through (404 version, 503 lane off) without reasons", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    release.promoteToDev.mockRejectedValueOnce(new ReleaseError("version not found", 404));
    const missing = await POST(post({ app: "promo", channel: "dev", action: "promote" }));
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: "version not found" });
    release.renewDev.mockRejectedValueOnce(new ReleaseError("dev channel unavailable", 503));
    expect((await POST(post({ app: "promo", channel: "dev", action: "renew" }))).status).toBe(503);
  });
});
