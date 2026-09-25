/**
 * Admin suspend contract (V12 §12, CR16): bearer auth, slug validation, 404
 * for unknown or first-party apps, the fail-closed order (dev Worker →
 * app-origin manifest → registry row), idempotency on an already-suspended
 * app, the admin_audit row, and failures answering { error } JSON without
 * flipping the registry.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { makeApp } from "@/app/mini/loader-test-utils";

const db = vi.hoisted(() => ({ fake: null as unknown as { client(): unknown } }));
vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.fake.client() }));

const calls = vi.hoisted(() => ({ order: [] as string[] }));
const release = vi.hoisted(() => ({ revokeDev: vi.fn() }));
vi.mock("@/lib/create/release", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/create/release")>()),
  revokeDev: release.revokeDev,
}));
const mirror = vi.hoisted(() => ({ removeMirror: vi.fn(async () => ({ commit: "c1", folder: "apps/alice/promo" })) }));
vi.mock("@/lib/create/mirror", () => mirror);
const deploy = vi.hoisted(() => ({ suspendOnAppOrigin: vi.fn() }));
vi.mock("@/lib/functions/deploy", () => ({ suspendOnAppOrigin: deploy.suspendOnAppOrigin }));

import { POST } from "./route";

import { expectLog } from "@/lib/testing/expectLog";
const base = "https://air.test/api/admin/create/apps";
const post = (slug: string, key = "admin-key") =>
  POST(
    new NextRequest(`${base}/${slug}/suspend`, {
      method: "POST",
      headers: { authorization: `Bearer ${key}` },
    }),
    { params: Promise.resolve({ slug }) }
  );

const app = makeApp({
  id: "app-1",
  slug: "alice-promo",
  appname: "promo",
  owner_user_id: "user-alice",
  lane: "vibe",
  status: "published",
  bundle_version: "v1700000000001",
  draft_version: "v1700000000002",
  dev_version: "v1700000000002",
  dev_released_at: "2026-09-01T00:00:00.000Z",
  dev_expires_at: "2026-09-15T00:00:00.000Z",
});

let fake: FakeSupabase;

beforeEach(() => {
  process.env["ADMIN_API_KEY"] = "admin-key";
  vi.clearAllMocks();
  calls.order = [];
  fake = new FakeSupabase();
  db.fake = fake;
  fake.tables["mini_apps"] = [
    { ...app },
    makeApp({ slug: "browser", owner_user_id: null }) as unknown as Record<string, unknown>,
    makeApp({ id: "app-2", slug: "bob-old", owner_user_id: "user-bob", lane: "vibe", status: "suspended" }) as unknown as Record<string, unknown>,
  ];
  release.revokeDev.mockImplementation(async () => {
    calls.order.push("revokeDev");
    Object.assign(fake.rows("mini_apps")[0]!, {
      dev_version: null,
      dev_released_at: null,
      dev_expires_at: null,
    });
    return { version: "v1700000000002" };
  });
  deploy.suspendOnAppOrigin.mockImplementation(async () => {
    calls.order.push("suspendOnAppOrigin");
  });
});

describe("POST /api/admin/create/apps/[slug]/suspend", () => {
  it("401s without the admin key", async () => {
    expect((await post("alice-promo", "nope")).status).toBe(401);
    expect(deploy.suspendOnAppOrigin).not.toHaveBeenCalled();
  });

  it("400s on a bad slug and 404s for unknown or first-party apps", async () => {
    expect((await post("Bad Slug")).status).toBe(400);
    expect((await post("nobody-app")).status).toBe(404);
    expect((await post("browser")).status).toBe(404);
  });

  it("suspends fail-closed: dev Worker, app origin, then the registry row", async () => {
    const response = await post("alice-promo");
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({
      suspended: true,
      already: false,
      app: {
        slug: "alice-promo",
        status: "suspended",
        dev_version: null,
        dev_expires_at: null,
        live_version: null,
        draft_version: "v1700000000002",
        updated_at: expect.any(String),
      },
    });
    expect(calls.order).toEqual(["revokeDev", "suspendOnAppOrigin"]);
    expect(deploy.suspendOnAppOrigin).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ slug: "alice-promo", dev_version: null })
    );
    expect(fake.updates).toEqual([
      { table: "mini_apps", patch: expect.objectContaining({ status: "suspended" }) },
    ]);
    expect(fake.rows("mini_apps")[0]).toMatchObject({ status: "suspended" });
    expect(fake.inserts[0]).toMatchObject({
      table: "admin_audit",
      row: {
        action: "suspend",
        app_id: "app-1",
        user_id: "user-alice",
        detail: {
          previous_status: "published",
          live_version: "v1700000000001",
          dev_version: "v1700000000002",
        },
      },
    });
  });

  it("skips the dev leg when there is no dev release", async () => {
    Object.assign(fake.rows("mini_apps")[0]!, {
      dev_version: null,
      dev_released_at: null,
      dev_expires_at: null,
    });
    expect((await post("alice-promo")).status).toBe(200);
    expect(release.revokeDev).not.toHaveBeenCalled();
    expect(calls.order).toEqual(["suspendOnAppOrigin"]);
  });

  it("is idempotent on an already-suspended app", async () => {
    const body = await (await post("bob-old")).json();
    expect(body).toMatchObject({ suspended: true, already: true, app: { status: "suspended" } });
    expect(deploy.suspendOnAppOrigin).not.toHaveBeenCalled();
    expect(fake.inserts).toEqual([]);
    expect(fake.updates).toEqual([]);
  });

  it("leaves the registry untouched when the origin refuses", async () => {
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    deploy.suspendOnAppOrigin.mockRejectedValueOnce(new Error("cloudflare 500"));
    const response = await post("alice-promo");
    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({ error: "suspend failed" });
    expect(fake.updates).toEqual([]);
    expect(fake.rows("mini_apps")[0]).toMatchObject({ status: "published" });

    const refused = new Error("deleting");
    refused.name = "AppOriginRefusedError";
    deploy.suspendOnAppOrigin.mockRejectedValueOnce(refused);
    expect((await post("alice-promo")).status).toBe(409);
  });
});

describe("mirror removal (§10.2)", () => {
  it("replaces the mirror folder when a version was mirrored and the lane is on", async () => {
    process.env["CREATE_MIRROR_ENABLED"] = "true";
    process.env["WZRD_CREATE_INSTALLATION_ID"] = "12345";
    fake.tables["miniapp_versions"] = [
      { id: "ver-1", app_id: "app-1", mirrored_at: "2026-09-10T00:00:00.000Z" },
    ];
    expect((await post("alice-promo")).status).toBe(200);
    expect(mirror.removeMirror).toHaveBeenCalled();
    delete process.env["CREATE_MIRROR_ENABLED"];
    delete process.env["WZRD_CREATE_INSTALLATION_ID"];
  });

  it("leaves the mirror alone when nothing was ever mirrored", async () => {
    process.env["CREATE_MIRROR_ENABLED"] = "true";
    process.env["WZRD_CREATE_INSTALLATION_ID"] = "12345";
    fake.tables["miniapp_versions"] = [{ id: "ver-1", app_id: "app-1", mirrored_at: null }];
    expect((await post("alice-promo")).status).toBe(200);
    expect(mirror.removeMirror).not.toHaveBeenCalled();
    delete process.env["CREATE_MIRROR_ENABLED"];
    delete process.env["WZRD_CREATE_INSTALLATION_ID"];
  });

  it("a failed removal still suspends the app", async () => {
    process.env["CREATE_MIRROR_ENABLED"] = "true";
    process.env["WZRD_CREATE_INSTALLATION_ID"] = "12345";
    fake.tables["miniapp_versions"] = [
      { id: "ver-1", app_id: "app-1", mirrored_at: "2026-09-10T00:00:00.000Z" },
    ];
    mirror.removeMirror.mockRejectedValueOnce(new Error("github 502"));
    const response = await post("alice-promo");
    expect(response.status).toBe(200);
    expect(fake.rows("mini_apps")[0]).toMatchObject({ status: "suspended" });
    delete process.env["CREATE_MIRROR_ENABLED"];
    delete process.env["WZRD_CREATE_INSTALLATION_ID"];
    expectLog(/mirror\ removal\ failed/, { level: "warn" });
  });
});
