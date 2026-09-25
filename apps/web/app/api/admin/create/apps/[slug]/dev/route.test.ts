/**
 * Admin dev-release action contract (V12 §12): bearer auth, slug and action
 * validation, 404 for unknown or first-party apps, revoke / renew through
 * lib/create/release, the admin_audit row, the resulting registry row, and
 * ReleaseError / unexpected failures answering { error } JSON.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { makeApp } from "@/app/mini/loader-test-utils";

const db = vi.hoisted(() => ({ fake: null as unknown as { client(): unknown } }));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.fake.client() }));

const release = vi.hoisted(() => ({
  revokeDev: vi.fn(),
  renewDev: vi.fn(),
}));
vi.mock("@/lib/create/release", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/release")>()),
  ...release,
}));

import { ReleaseError } from "@/lib/create/release";
import { POST } from "./route";

const base = "https://air.test/api/admin/create/apps";
const post = (slug: string, body: unknown, key = "admin-key") =>
  POST(
    new NextRequest(`${base}/${slug}/dev`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
    { params: Promise.resolve({ slug }) }
  );

const app = makeApp({
  id: "app-1",
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: "user-alice",
  lane: "vibe",
  status: "draft",
  draft_version: "v1700000000001",
  dev_version: "v1700000000001",
  dev_released_at: "2026-09-01T00:00:00.000Z",
  dev_expires_at: "2026-09-15T00:00:00.000Z",
});

let fake: FakeSupabase;

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  vi.clearAllMocks();
  fake = new FakeSupabase();
  db.fake = fake;
  fake.tables["mini_apps"] = [{ ...app }, makeApp({ slug: "browser", owner_user_id: null }) as unknown as Record<string, unknown>];
  release.revokeDev.mockImplementation(async () => {
    const row = fake.rows("mini_apps")[0]!;
    Object.assign(row, { dev_version: null, dev_released_at: null, dev_expires_at: null });
    return { version: "v1700000000001" };
  });
  release.renewDev.mockImplementation(async () => {
    const row = fake.rows("mini_apps")[0]!;
    Object.assign(row, { dev_expires_at: "2026-09-29T00:00:00.000Z" });
    return {
      channel: "dev",
      version: "v1700000000001",
      url: "https://link.wzrd.tech/alice/promo",
      expires_at: "2026-09-29T00:00:00.000Z",
    };
  });
});

describe("POST /api/admin/create/apps/[slug]/dev", () => {
  it("401s without the admin key", async () => {
    expect((await post("alice-promo", { action: "revoke" }, "nope")).status).toBe(401);
    expect(release.revokeDev).not.toHaveBeenCalled();
  });

  it("400s on a bad slug or action", async () => {
    expect((await post("Bad Slug", { action: "revoke" })).status).toBe(400);
    expect((await post("alice-promo", { action: "promote" })).status).toBe(400);
    expect((await post("alice-promo", "not json")).status).toBe(400);
  });

  it("404s for an unknown or first-party app", async () => {
    expect((await post("nobody-app", { action: "revoke" })).status).toBe(404);
    expect((await post("browser", { action: "revoke" })).status).toBe(404);
  });

  it("revokes, audits and returns the resulting row", async () => {
    const response = await post("alice-promo", { action: "revoke" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      action: "revoke",
      dev: null,
      app: {
        slug: "alice-promo",
        status: "draft",
        dev_version: null,
        dev_released_at: null,
        dev_expires_at: null,
        updated_at: app.updated_at,
      },
    });
    expect(release.revokeDev).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ slug: "alice-promo" }));
    expect(fake.inserts).toEqual([
      expect.objectContaining({
        table: "admin_audit",
        row: expect.objectContaining({
          actor: "admin",
          action: "dev_revoke",
          app_id: "app-1",
          user_id: "user-alice",
          slug: "alice-promo",
          detail: { version: "v1700000000001" },
        }),
      }),
    ]);
  });

  it("renews and returns the release receipt", async () => {
    const body = await (await post("alice-promo", { action: "renew" })).json();
    expect(body.dev).toEqual({
      channel: "dev",
      version: "v1700000000001",
      url: "https://link.wzrd.tech/alice/promo",
      expires_at: "2026-09-29T00:00:00.000Z",
    });
    expect(body.app.dev_expires_at).toBe("2026-09-29T00:00:00.000Z");
    expect(fake.inserts[0]?.row).toMatchObject({
      action: "dev_renew",
      detail: { version: "v1700000000001", expires_at: "2026-09-29T00:00:00.000Z" },
    });
  });

  it("surfaces ReleaseError status and reasons without auditing", async () => {
    release.renewDev.mockRejectedValueOnce(new ReleaseError("no dev release", 409));
    const response = await post("alice-promo", { action: "renew" });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: "no dev release" });
    expect(fake.inserts).toEqual([]);
  });

  it("answers { error } JSON on an unexpected failure", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    release.revokeDev.mockRejectedValueOnce(new Error("cloudflare 500"));
    const response = await post("alice-promo", { action: "revoke" });
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "dev release action failed" });
  });
});
