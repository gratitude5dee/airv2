/**
 * V11 §6.4 loader hand-off: once the mini-origin gate chain has admitted a
 * session, a published bundle either 303s to its isolated app origin (when
 * the live version has a Worker) or renders from R2 on the legacy lane
 * (pre-V11 versions, or the lane unconfigured). Suspended rows never reach
 * either — the loader's visibility gate 404s first (see loader.test.ts).
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

const versions = vi.hoisted(() => ({
  getVersion: vi.fn(async (): Promise<{ worker_sha256: string | null } | null> => null),
}));
vi.mock("@/lib/create/versions", () => versions);

const r2 = vi.hoisted(() => ({
  r2Configured: vi.fn(() => true),
  getObject: vi.fn(async () => ({
    body: Buffer.from("<!doctype html><h1>legacy</h1>"),
    contentType: "text/html",
  })),
}));
vi.mock("@/lib/storage/r2", () => r2);

import { publishedModule, publisherCsp } from "./published";
import { verifyAppToken } from "@/lib/functions/tokens";
import { verifyToken } from "@/lib/miniapps/tokens";
import { makeApp } from "@/app/mini/loader-test-utils";

const supabase = {} as SupabaseClient;

function ctx(overrides: Partial<Parameters<typeof makeApp>[0]> = {}) {
  const app = makeApp({
    id: "app-notes",
    slug: "alice-notes",
    owner_user_id: "user-alice",
    publisher_username: "alice",
    status: "published",
    bundle_version: "v1700000000001",
    ...overrides,
  });
  return {
    app,
    request: new NextRequest("https://mini.wzrd.tech/alice/notes", {
      headers: { host: "mini.wzrd.tech", "x-mini-host": "1", "x-mini-nested": "1" },
    }),
    supabase,
    session: { userId: "user-alice", resourceId: "default", role: "owner" as const },
    basePath: "/alice/notes",
  };
}

function laneOn() {
  process.env["APP_ORIGIN_SIGNING_KEY"] = "app-origin-signing-key";
  process.env["APPS_ORIGIN_SUFFIX"] = "apps.wzrd.tech";
  process.env["CLOUDFLARE_ACCOUNT_ID"] = "acct";
  process.env["CLOUDFLARE_API_TOKEN"] = "cf-token";
  process.env["CF_MANIFEST_KV_ID"] = "kv-id";
}

function laneOff() {
  delete process.env["APP_ORIGIN_SIGNING_KEY"];
  delete process.env["CLOUDFLARE_ACCOUNT_ID"];
  delete process.env["CLOUDFLARE_API_TOKEN"];
  delete process.env["CF_MANIFEST_KV_ID"];
}

beforeAll(() => {
  process.env["MINIAPP_SIGNING_KEY"] = "mini-signing-key";
});

beforeEach(() => {
  laneOn();
  versions.getVersion.mockReset();
  versions.getVersion.mockResolvedValue({ worker_sha256: "a".repeat(64) });
  r2.getObject.mockClear();
});

describe("publisherCsp", () => {
  it("locks the bundle down and pins frame ancestry", () => {
    const csp = publisherCsp();
    expect(csp).toContain("default-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(csp).toMatch(/frame-ancestors 'self' https:\/\//);
    // No wildcard sources anywhere.
    expect(csp).not.toContain("*");
    expect(csp).not.toContain("unsafe-eval");
  });
});

describe("publishedModule dispatch", () => {
  it("never matches first-party rows (owner_user_id null)", () => {
    expect(
      publishedModule(makeApp({ slug: "kanban", bundle_version: "v1700000000001" }))
    ).toBeNull();
  });
  it("never matches publisher rows without an uploaded bundle", () => {
    expect(publishedModule(ctx({ bundle_version: null }).app)).toBeNull();
  });
  it("matches only owner_user_id + bundle_version rows", () => {
    expect(publishedModule(ctx().app)).not.toBeNull();
  });
});

describe("app-origin hand-off", () => {
  it("303s to <slug>.apps.wzrd.tech/__air/enter with a bound app token", async () => {
    const c = ctx();
    const res = await publishedModule(c.app)!.render(c);
    expect(res.status).toBe(303);
    const target = new URL(res.headers.get("location") ?? "");
    expect(target.host).toBe("alice-notes.apps.wzrd.tech");
    expect(target.pathname).toBe("/__air/enter");
    const token = target.searchParams.get("t") ?? "";
    const claims = verifyAppToken(token, "alice-notes");
    expect(claims?.role).toBe("owner");
    expect(claims?.resource).toBe("default");
    expect(claims?.principal).toMatch(/^p_[0-9a-f]{32}$/);
    // Not a mini-origin token, and no mini/API cookie is set on hand-off:
    // the app origin gets exactly one 60 s token and nothing else.
    expect(verifyToken(token, "alice-notes")).toBeNull();
    expect(res.headers.get("set-cookie")).toBeNull();
    expect(r2.getObject).not.toHaveBeenCalled();
    expect(versions.getVersion).toHaveBeenCalledWith(
      supabase, "app-notes", "v1700000000001"
    );
  });

  it("maps a guest session to the guest role on the app origin", async () => {
    const c = ctx();
    const res = await publishedModule(c.app)!.render({
      ...c,
      session: { userId: "user-guest", resourceId: "default", role: "guest", grantId: "g1" },
    });
    const token = new URL(res.headers.get("location") ?? "").searchParams.get("t") ?? "";
    expect(verifyAppToken(token, "alice-notes")?.role).toBe("guest");
  });
});

describe("legacy R2 lane (frozen)", () => {
  it("renders pre-V11 versions (no Worker digest) from R2 with the strict CSP", async () => {
    versions.getVersion.mockResolvedValue({ worker_sha256: null });
    const c = ctx();
    const res = await publishedModule(c.app)!.render(c);
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("legacy");
    expect(r2.getObject).toHaveBeenCalledWith("apps/alice-notes/v1700000000001/index.html");
    expect(res.headers.get("content-security-policy")).toContain("default-src 'none'");
    expect(res.headers.get("set-cookie")).toContain("mini_api_alice-notes=");
  });

  it("stays on R2 when the live version row is missing", async () => {
    versions.getVersion.mockResolvedValue(null);
    const c = ctx();
    expect((await publishedModule(c.app)!.render(c)).status).toBe(200);
  });

  it("stays on R2 when the app-origin lane is unconfigured, even with a Worker", async () => {
    laneOff();
    const c = ctx();
    const res = await publishedModule(c.app)!.render(c);
    expect(res.status).toBe(200);
    expect(versions.getVersion).not.toHaveBeenCalled();
  });

  it("503s without R2 and 404s without a bundle", async () => {
    versions.getVersion.mockResolvedValue({ worker_sha256: null });
    r2.r2Configured.mockReturnValueOnce(false);
    const c = ctx();
    expect((await publishedModule(c.app)!.render(c)).status).toBe(503);
    r2.getObject.mockResolvedValueOnce(null as never);
    expect((await publishedModule(c.app)!.render(c)).status).toBe(404);
  });
});
