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
  status: "published",
  bundle_version: "v1700000000000",
  draft_version: "v1700000000001",
});
const publish = vi.hoisted(() => ({ ownedApp: vi.fn() }));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  ownedApp: publish.ownedApp,
}));

const row = (version: string, findings: unknown[] = []) => ({
  id: `row-${version}`,
  app_id: app.id,
  user_id: "user-alice",
  version,
  lane: "drop",
  bundle_sha256: "a".repeat(64),
  bundle_bytes: 10,
  file_count: 1,
  worker_sha256: "b".repeat(64),
  kit_version: null,
  findings,
  qa_score: null,
  created_at: "2026-01-01T00:00:00.000Z",
  published_at: null,
  retired_at: null,
  purged_at: null,
});
vi.mock("@/lib/create/versions", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/versions")>()),
  listVersions: vi.fn(async () => [
    row("v1700000000001", [
      { file: "index.html", line: 3, rule: "inline-handler", severity: "soft", hint: "move it" },
    ]),
    row("v1700000000000"),
  ]),
}));
vi.mock("@/lib/create/preview", () => ({
  draftPreviewUrl: () => "https://alice-promo.apps.wzrd.tech/__air/enter?t=x",
}));

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { GET } from "./route";

function statusRequest(slug: string, token?: string): NextRequest {
  return new NextRequest(`https://air.test/api/create/status?slug=${slug}`, {
    headers: token ? { authorization: `Bearer ${token}` } : {},
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue(null);
  box.boxUserId.mockResolvedValue(undefined);
  publish.ownedApp.mockResolvedValue(app);
});

describe("GET /api/create/status", () => {
  it("401 without a session or gateway token", async () => {
    expect((await GET(statusRequest("alice-promo"))).status).toBe(401);
  });

  it("returns live + draft versions with findings for the owner's Box", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    const response = await GET(statusRequest("alice-promo", "gw-1"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({
      slug: "alice-promo",
      status: "published",
      url: "https://mini.wzrd.tech/alice/promo",
      preview_url: expect.stringContaining("/__air/enter?t="),
      live: { version: "v1700000000000", findings: [] },
      draft: {
        version: "v1700000000001",
        findings: [expect.objectContaining({ rule: "inline-handler", severity: "soft" })],
      },
    });
    expect(body.versions).toHaveLength(2);
    expect(publish.ownedApp).toHaveBeenCalledWith(expect.anything(), "user-alice", "alice-promo");
  });

  it("someone else's app is a 404, same as a missing one", async () => {
    session.storeSessionUserId.mockReturnValue("user-bob");
    publish.ownedApp.mockRejectedValueOnce(new PublishError("app not found", 404));
    const response = await GET(statusRequest("alice-promo"));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "app not found" });
  });

  it("400 on a malformed slug", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    expect((await GET(statusRequest("Bad%20Slug"))).status).toBe(400);
  });
});
