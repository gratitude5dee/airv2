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
  name: "Promo",
  description: "A tour page",
  status: "draft",
});
const publish = vi.hoisted(() => ({ ownedApp: vi.fn(), resolveOwnedAppRef: vi.fn() }));
vi.mock("@/lib/miniapps/publish", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/miniapps/publish")>()),
  ownedApp: publish.ownedApp,
  publisherUsername: async () => "alice",
  resolveOwnedAppRef: publish.resolveOwnedAppRef,
}));

const r2 = vi.hoisted(() => ({ configured: true }));
vi.mock("@/lib/storage/r2", () => ({ r2Configured: () => r2.configured }));

const limits = vi.hoisted(() => ({
  uploadRateLimited: vi.fn(async () => false),
  recordOpsEvent: vi.fn(async () => undefined),
}));
vi.mock("@/lib/security/limits", () => limits);

const icon = vi.hoisted(() => ({
  storeIcon: vi.fn(),
  readBoxIcon: vi.fn(),
  generateIcon: vi.fn(),
  countIconGenerations: vi.fn(async () => 0),
  sendIconPreview: vi.fn(async () => true),
}));
vi.mock("@/lib/create/icon", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/icon")>()),
  ...icon,
}));

const spectrum = vi.hoisted(() => ({
  createSpectrumSender: vi.fn(async () => ({ close: async () => undefined })),
}));
vi.mock("@/lib/spectrum/sender", () => spectrum);

import { NextRequest } from "next/server";
import { PublishError } from "@/lib/miniapps/publish";
import { MediaGuardError } from "@/lib/storage/guard";
import { IconError } from "@/lib/create/icon";
import { POST } from "./route";

const KEY = `apps/alice-promo/icon/${"a".repeat(64)}.png`;
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(16, 1)]);

function json(body: unknown, token?: string): NextRequest {
  return new NextRequest("https://air.test/api/create/icon", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

function multipart(fields: Record<string, string | File>): NextRequest {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) form.set(key, value);
  return new NextRequest("https://air.test/api/create/icon", { method: "POST", body: form });
}

beforeEach(() => {
  vi.clearAllMocks();
  r2.configured = true;
  session.storeSessionUserId.mockReturnValue(null);
  box.boxUserId.mockResolvedValue(undefined);
  publish.ownedApp.mockResolvedValue(app);
  publish.resolveOwnedAppRef.mockImplementation(
    async (_supabase: unknown, _userId: string, ref: string) =>
      ref === "promo" || ref === "alice-promo" ? { slug: "alice-promo" } : null,
  );
  limits.uploadRateLimited.mockResolvedValue(false);
  icon.storeIcon.mockResolvedValue({ icon_key: KEY, resized: true });
  icon.readBoxIcon.mockResolvedValue({ bytes: PNG, contentType: "image/png" });
  icon.generateIcon.mockResolvedValue({ bytes: PNG, contentType: "image/png" });
  icon.countIconGenerations.mockResolvedValue(0);
});

describe("POST /api/create/icon", () => {
  it("401 without a session or gateway token; 503 without media storage", async () => {
    expect((await POST(json({ appname: "promo", generate: true }))).status).toBe(401);
    session.storeSessionUserId.mockReturnValue("user-alice");
    r2.configured = false;
    expect((await POST(json({ appname: "promo", generate: true }))).status).toBe(503);
    expect(icon.storeIcon).not.toHaveBeenCalled();
  });

  it("multipart upload for the store session → guard/resize/R2 through storeIcon", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    const file = new File([PNG], "icon.png", { type: "image/png" });
    const response = await POST(multipart({ app: "promo", icon: file }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ icon_key: KEY, resized: true, generated: false });
    expect(publish.ownedApp).toHaveBeenCalledWith(expect.anything(), "user-alice", "alice-promo");
    const [, storedApp, bytes, type] = icon.storeIcon.mock.calls[0] as unknown as [unknown, typeof app, Buffer, string];
    expect(storedApp.slug).toBe("alice-promo");
    expect(bytes.equals(PNG)).toBe(true);
    expect(type).toBe("image/png");
  });

  it("multipart: a non-image type is 400 and never stored", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    const svg = new File(["<svg/>"], "icon.svg", { type: "image/svg+xml" });
    const response = await POST(multipart({ slug: "alice-promo", icon: svg }));
    expect(response.status).toBe(400);
    expect(icon.storeIcon).not.toHaveBeenCalled();
    expect((await POST(multipart({ app: "promo" }))).status).toBe(400);
  });

  it("{ appname, path } from the Box reads the file through readBoxIcon", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    const response = await POST(json({ appname: "promo", path: "public/icon.png" }, "gw-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ icon_key: KEY, resized: true, generated: false });
    expect(icon.readBoxIcon).toHaveBeenCalledWith(expect.anything(), "user-alice", "promo", "public/icon.png");
    expect(icon.generateIcon).not.toHaveBeenCalled();
  });

  it("{ generate: true } from the Box renders, stores and sends the preview back", async () => {
    box.boxUserId.mockResolvedValue("user-alice");
    const response = await POST(json({ appname: "promo", generate: true, theme: "pixel" }, "gw-1"));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ icon_key: KEY, resized: true, generated: true, previewed: true });
    expect(icon.generateIcon).toHaveBeenCalledWith(expect.anything(), "user-alice", app, {
      theme: "pixel",
      channel: "imessage",
    });
    expect(spectrum.createSpectrumSender).toHaveBeenCalled();
    expect(icon.sendIconPreview).toHaveBeenCalledWith(expect.anything(), expect.anything(), "user-alice", "promo", PNG);
  });

  it("{ generate: true } from the store session skips the Messages preview", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    const response = await POST(json({ app: "alice-promo", generate: true }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ generated: true, previewed: false });
    expect(icon.generateIcon).toHaveBeenCalledWith(expect.anything(), "user-alice", app, { theme: null, channel: "web" });
    expect(spectrum.createSpectrumSender).not.toHaveBeenCalled();
  });

  it("the third generation is 429 upload_instead and nothing renders", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    icon.countIconGenerations.mockResolvedValue(2);
    const response = await POST(json({ appname: "promo", generate: true }));
    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({ error: "upload_instead" });
    expect(icon.generateIcon).not.toHaveBeenCalled();
    expect(icon.storeIcon).not.toHaveBeenCalled();
  });

  it("400 on a body with neither file, path nor generate, a bad theme, a missing app, or bad json", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    expect((await POST(json({ appname: "promo" }))).status).toBe(400);
    expect((await POST(json({ appname: "promo", generate: true, theme: "neon" }))).status).toBe(400);
    expect((await POST(json({ generate: true }))).status).toBe(400);
    expect((await POST(json("{not json"))).status).toBe(400);
    expect(icon.storeIcon).not.toHaveBeenCalled();
  });

  it("429 too many uploads; 404 for someone else's app", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    limits.uploadRateLimited.mockResolvedValueOnce(true);
    expect((await POST(json({ appname: "promo", generate: true }))).status).toBe(429);
    publish.ownedApp.mockRejectedValueOnce(new PublishError("app not found", 404));
    const response = await POST(json({ appname: "promo", generate: true }));
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: "app not found" });
  });

  it("guard and icon errors keep their status; a guard rejection is recorded", async () => {
    session.storeSessionUserId.mockReturnValue("user-alice");
    icon.storeIcon.mockRejectedValueOnce(new MediaGuardError("upload exceeds 8388608 bytes", 413));
    const guarded = await POST(json({ appname: "promo", path: "public/huge.png" }));
    expect(guarded.status).toBe(413);
    expect(limits.recordOpsEvent).toHaveBeenCalledWith(expect.anything(), "upload_rejected", "user-alice", expect.any(String));
    icon.readBoxIcon.mockRejectedValueOnce(new IconError("icon file not found", 404));
    expect((await POST(json({ appname: "promo", path: "public/missing.png" }))).status).toBe(404);
    icon.generateIcon.mockRejectedValueOnce(new IconError("can't draw that", 422));
    const refused = await POST(json({ appname: "promo", generate: true }));
    expect(refused.status).toBe(422);
    expect(await refused.json()).toEqual({ error: "can't draw that" });
  });
});
