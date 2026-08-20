/**
 * MA3 state for paying x402 visitors: their sessions carry the synthetic
 * "x402:<payer>" principal, which maps to no box — state must resolve
 * against the app owner's box (a real uuid) and never leak the synthetic id
 * into a box lookup, where it would throw and 500 the bundle's first fetch.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import type { RegistryApp } from "@/lib/miniapps/registry";
import type { MiniSession } from "@/lib/miniapps/gates";
import { makeApp } from "../../../../mini/loader-test-utils";

vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));

let fakeAuth: { app: RegistryApp; session: MiniSession } | null = null;
vi.mock("@/lib/miniapps/appsApi", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/lib/miniapps/appsApi")>();
  return {
    ...actual,
    appsApiSession: async () => fakeAuth,
    bundleManifest: async () => ({
      actions: ["add"],
      guestActions: ["add"],
    }),
  };
});

// The real ensureBoxAwake resolves boxes by uuid user_id and throws for a
// synthetic principal — the fake records every id it is asked to look up.
const boxLookups: string[] = [];
vi.mock("@/lib/orchestrator/boxes", () => ({
  ensureBoxAwake: async (_supabase: unknown, userId: string) => {
    boxLookups.push(userId);
    if (userId.startsWith("x402:")) {
      throw new Error(`no box for synthetic user ${userId}`);
    }
    return { boxId: "box-1" };
  },
}));

const files: Record<string, string> = {};
vi.mock("@/lib/box/client", () => ({
  readFile: async (_boxId: string, path: string) => {
    if (!(path in files)) throw new Error("not found");
    return files[path];
  },
  writeFile: async (_boxId: string, path: string, body: string) => {
    files[path] = body;
  },
}));

import { GET } from "./route";
import { POST as ACTION } from "../action/route";

const OWNER = "22222222-3333-4444-8555-666666666666";
const PAYER_SESSION: MiniSession = {
  userId: "x402:0x2222222222222222222222222222222222222222",
  resourceId: "default",
  role: "guest",
};

function paidApp(overrides?: Partial<RegistryApp>): RegistryApp {
  return makeApp({
    slug: "paidapp",
    owner_user_id: OWNER,
    x402_enabled: true,
    x402_price_usdc: 1.5,
    ...overrides,
  });
}

function get(): NextRequest {
  return new NextRequest("https://mini.wzrd.tech/api/apps/v1/state");
}

function action(body: unknown): NextRequest {
  return new NextRequest("https://mini.wzrd.tech/api/apps/v1/action", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  fakeAuth = null;
  boxLookups.length = 0;
  for (const key of Object.keys(files)) delete files[key];
});

describe("x402 sessions and the state box lookup", () => {
  it("GET resolves state against the owner's box, never the synthetic id", async () => {
    fakeAuth = { app: paidApp(), session: PAYER_SESSION };
    files[".hermes/miniapps/paidapp/default.json"] = JSON.stringify({
      score: 7,
    });
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: { score: 7 } });
    expect(boxLookups).toEqual([OWNER]);
  });

  it("GET returns empty state without any box lookup when the app has no owner", async () => {
    fakeAuth = { app: paidApp({ owner_user_id: null }), session: PAYER_SESSION };
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ state: {} });
    expect(boxLookups).toEqual([]);
  });

  it("action POST logs against the owner's box for an x402 guest", async () => {
    fakeAuth = { app: paidApp(), session: PAYER_SESSION };
    const res = await ACTION(action({ action: "add", payload: { n: 1 } }));
    expect(res.status).toBe(200);
    expect(boxLookups.every((id) => id === OWNER)).toBe(true);
    expect(boxLookups.length).toBeGreaterThan(0);
    const log = JSON.parse(
      files[".hermes/miniapps/paidapp/actions.json"] ?? "[]"
    ) as { action: string; role: string }[];
    expect(log).toHaveLength(1);
    expect(log[0]?.action).toBe("add");
    expect(log[0]?.role).toBe("guest");
  });

  it("regular uuid sessions still use their own box", async () => {
    fakeAuth = {
      app: paidApp(),
      session: { userId: OWNER, resourceId: "default", role: "owner" },
    };
    const res = await GET(get());
    expect(res.status).toBe(200);
    expect(boxLookups).toEqual([OWNER]);
  });
});
