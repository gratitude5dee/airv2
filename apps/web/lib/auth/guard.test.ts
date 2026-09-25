import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  GuardError,
  guardResponse,
  requireAdmin,
  requireBox,
  requireBoxOrOwner,
  requireCron,
  requireOwner,
  requireStoreSession,
  requireWorker,
  tryBoxPrincipal,
} from "./guard";
import { createSessionToken } from "./session";
import { mintToken } from "../miniapps/tokens";

function request(headers: Record<string, string> = {}): NextRequest {
  return new NextRequest("https://air.test/api/x", { headers });
}

function bearer(token: string): NextRequest {
  return request({ authorization: `Bearer ${token}` });
}

function fakeBoxes(
  row: { user_id: string; provider_box_id: string } | null,
  error: { message: string } | null = null
): SupabaseClient {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: row, error }),
        }),
      }),
    }),
  } as unknown as SupabaseClient;
}

const BOX = { user_id: "user-alice", provider_box_id: "box-1" };

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GuardError", () => {
  it("renders a JSON error for 401/403 and an empty body for 404", async () => {
    const unauthorized = new GuardError(401).toResponse();
    expect(unauthorized.status).toBe(401);
    expect(await unauthorized.json()).toEqual({ error: "unauthorized" });

    const forbidden = new GuardError(403, "forbidden").toResponse();
    expect(forbidden.status).toBe(403);
    expect(await forbidden.json()).toEqual({ error: "forbidden" });

    const missing = new GuardError(404).toResponse();
    expect(missing.status).toBe(404);
    expect(await missing.text()).toBe("");
  });

  it("guardResponse maps GuardError and rethrows everything else", () => {
    expect(guardResponse(new GuardError(404)).status).toBe(404);
    expect(() => guardResponse(new Error("boom"))).toThrow("boom");
  });
});

describe("requireOwner", () => {
  it("throws 401 without a session cookie and returns the owner principal", async () => {
    vi.stubEnv("SESSION_SECRET", "session-secret");
    await expect(requireOwner(request())).rejects.toMatchObject({
      status: 401,
    });

    const cookie = `air_session=${createSessionToken("user-alice")}`;
    const principal = await requireOwner(request({ cookie }));
    expect(principal).toEqual({ kind: "owner", userId: "user-alice" });
  });
});

describe("requireAdmin", () => {
  it("throws 401 on missing or wrong bearer and accepts ADMIN_API_KEY", async () => {
    vi.stubEnv("ADMIN_API_KEY", "admin-key");
    await expect(requireAdmin(request())).rejects.toMatchObject({
      status: 401,
    });
    await expect(requireAdmin(bearer("nope"))).rejects.toMatchObject({
      status: 401,
    });
    await expect(requireAdmin(bearer("admin-key"))).resolves.toEqual({
      kind: "admin",
    });
  });
});

describe("requireCron", () => {
  it("fails closed when CRON_SECRET is unset and accepts the bearer", async () => {
    await expect(requireCron(bearer("anything"))).rejects.toMatchObject({
      status: 401,
    });
    vi.stubEnv("CRON_SECRET", "cron-key");
    await expect(requireCron(bearer("wrong"))).rejects.toMatchObject({
      status: 401,
    });
    await expect(requireCron(bearer("cron-key"))).resolves.toEqual({
      kind: "cron",
    });
  });
});

describe("requireWorker muse", () => {
  it("throws 404 when muse is disabled or the token is wrong, and returns the worker", async () => {
    await expect(
      requireWorker(bearer("tok"), "muse")
    ).rejects.toMatchObject({ status: 404 });

    vi.stubEnv("MUSE_ENABLED", "true");
    vi.stubEnv("MUSE_WORKER_TOKEN", "tok");
    await expect(
      requireWorker(request(), "muse")
    ).rejects.toMatchObject({ status: 404 });
    await expect(
      requireWorker(bearer("bad"), "muse")
    ).rejects.toMatchObject({ status: 404 });
    await expect(requireWorker(bearer("tok"), "muse")).resolves.toEqual({
      kind: "worker",
      worker: "muse",
    });
  });
});

describe("requireStoreSession", () => {
  it("throws 401 without the store cookie and returns the store principal", async () => {
    vi.stubEnv("MINIAPP_SIGNING_KEY", "store-key");
    await expect(requireStoreSession(request())).rejects.toMatchObject({
      status: 401,
    });
    const cookie = `mini_store=${mintToken("user-alice", "__store", "store")}`;
    await expect(requireStoreSession(request({ cookie }))).resolves.toEqual({
      kind: "store",
      userId: "user-alice",
    });
  });
});

describe("box guards", () => {
  it("tryBoxPrincipal resolves the boxes row by bearer token", async () => {
    await expect(
      tryBoxPrincipal(fakeBoxes(BOX), request())
    ).resolves.toBeNull();
    await expect(
      tryBoxPrincipal(fakeBoxes(null), bearer("unknown"))
    ).resolves.toBeNull();
    await expect(
      tryBoxPrincipal(fakeBoxes(BOX), bearer("gt"))
    ).resolves.toEqual({ kind: "box", userId: "user-alice", boxId: "box-1" });
  });

  it("requireBox throws 401 without a box and propagates lookup failures", async () => {
    await expect(
      requireBox(fakeBoxes(null), bearer("gt"))
    ).rejects.toMatchObject({ status: 401 });
    await expect(
      requireBox(fakeBoxes(null, { message: "db down" }), bearer("gt"))
    ).rejects.toThrow("box lookup failed");
  });

  it("requireBoxOrOwner prefers the box credential and falls back to the session", async () => {
    vi.stubEnv("SESSION_SECRET", "session-secret");
    const box = await requireBoxOrOwner(fakeBoxes(BOX), bearer("gt"));
    expect(box).toEqual({
      kind: "box",
      userId: "user-alice",
      boxId: "box-1",
    });

    const cookie = `air_session=${createSessionToken("user-alice")}`;
    const owner = await requireBoxOrOwner(
      fakeBoxes(null),
      request({ cookie })
    );
    expect(owner).toEqual({ kind: "owner", userId: "user-alice" });

    await expect(
      requireBoxOrOwner(fakeBoxes(null), request())
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe("the route idiom", () => {
  it("turns a rejected guard into the response", async () => {
    const denied = await requireCron(request()).catch(guardResponse);
    expect(denied).toBeInstanceOf(NextResponse);
    if (denied instanceof NextResponse) {
      expect(denied.status).toBe(401);
    }
  });
});
