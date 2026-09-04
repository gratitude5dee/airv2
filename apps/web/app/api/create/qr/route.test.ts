import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { makeApp } from "@/app/mini/loader-test-utils";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({}) as unknown as SupabaseClient,
}));
const publish = vi.hoisted(() => ({ ownedApp: vi.fn() }));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  ownedApp: publish.ownedApp,
}));
const qr = vi.hoisted(() => ({
  addressQrDataUrl: vi.fn(async (address: string): Promise<string | null> => `data:image/svg+xml,${address.length}`),
}));
vi.mock("@/lib/wallet/qr", () => qr);

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { GET } from "./route";

const app = makeApp({ slug: "alice-countdown", appname: "countdown", owner_user_id: "user-alice" });

function get(query: string): NextRequest {
  return new NextRequest(`https://mini.test/api/create/qr${query}`);
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue("user-alice");
  publish.ownedApp.mockImplementation(async (_s: unknown, userId: string, slug: string) => {
    if (userId === "user-alice" && slug === app.slug) return app;
    throw new PublishError("not found", 404);
  });
});

describe("GET /api/create/qr", () => {
  it("401 without the store session", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    expect((await GET(get("?slug=alice-countdown"))).status).toBe(401);
  });

  it("400 on a malformed slug", async () => {
    expect((await GET(get(""))).status).toBe(400);
    expect((await GET(get("?slug=../x"))).status).toBe(400);
    expect(publish.ownedApp).not.toHaveBeenCalled();
  });

  it("404 for an app the owner does not own", async () => {
    expect((await GET(get("?slug=bob-promo"))).status).toBe(404);
    expect(qr.addressQrDataUrl).not.toHaveBeenCalled();
  });

  it("encodes the app's nested public URL on the mini origin", async () => {
    const response = await GET(get("?slug=alice-countdown"));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { slug: string; url: string; qr: string };
    expect(body.slug).toBe("alice-countdown");
    expect(body.url).toBe("https://mini.wzrd.tech/alice/countdown");
    expect(qr.addressQrDataUrl).toHaveBeenCalledWith("https://mini.wzrd.tech/alice/countdown");
    expect(body.qr.startsWith("data:image/svg+xml,")).toBe(true);
  });

  it("503 when the QR could not be rendered", async () => {
    qr.addressQrDataUrl.mockResolvedValueOnce(null);
    expect((await GET(get("?slug=alice-countdown"))).status).toBe(503);
  });
});
