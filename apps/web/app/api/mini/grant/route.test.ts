/**
 * MA4 grant mint: guest invites exist only for multiplayer apps, and the
 * grant options are validated before any date/database work happens.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/supabase", () => ({ serviceClient: () => ({}) }));
vi.mock("@/lib/auth/user", () => ({ sessionUserId: () => "owner-1" }));

const getRegistryApp = vi.fn();
vi.mock("@/lib/miniapps/registry", () => ({
  getRegistryApp: (...args: unknown[]) => getRegistryApp(...args),
}));

const createGuestGrant = vi.fn(async () => ({
  id: "11111111-2222-4333-8444-555555555555",
  app_id: "app-kanban",
  resource_id: "default",
  created_by: "owner-1",
  max_uses: 25,
  uses: 0,
  expires_at: new Date(Date.now() + 3600_000).toISOString(),
  revoked_at: null,
}));
const grantCalls: unknown[][] = [];
vi.mock("@/lib/miniapps/guests", () => ({
  createGuestGrant: (...args: unknown[]) => {
    grantCalls.push(args);
    return createGuestGrant();
  },
}));

import { POST } from "./route";

function post(body: unknown): NextRequest {
  return new NextRequest("https://air.example/api/mini/grant", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

function app(access: "single" | "multiplayer") {
  return { id: "app-kanban", slug: "kanban", status: "published", access };
}

beforeEach(() => {
  getRegistryApp.mockReset();
  grantCalls.length = 0;
});

describe("POST /api/mini/grant", () => {
  it("mints a grant for a multiplayer app", async () => {
    getRegistryApp.mockResolvedValue(app("multiplayer"));
    const res = await POST(post({ app: "kanban" }));
    expect(res.status).toBe(200);
    expect(grantCalls[0]?.slice(1)).toEqual([
      "owner-1",
      "app-kanban",
      "default",
      { maxUses: 25, ttlHours: 72 },
    ]);
  });

  it("400s an owner-only (access=single) app", async () => {
    getRegistryApp.mockResolvedValue(app("single"));
    const res = await POST(post({ app: "kanban" }));
    expect(res.status).toBe(400);
    expect(grantCalls).toHaveLength(0);
  });

  it("400s malformed max_uses / ttl_hours instead of crashing", async () => {
    getRegistryApp.mockResolvedValue(app("multiplayer"));
    for (const options of [
      { ttl_hours: "abc" },
      { ttl_hours: 0 },
      { ttl_hours: -1 },
      { ttl_hours: 24 * 31 },
      { max_uses: 0 },
      { max_uses: 2.5 },
      { max_uses: 501 },
      { max_uses: "many" },
    ]) {
      const res = await POST(post({ app: "kanban", ...options }));
      expect(res.status).toBe(400);
    }
    expect(grantCalls).toHaveLength(0);
  });

  it("passes validated bounds through", async () => {
    getRegistryApp.mockResolvedValue(app("multiplayer"));
    const res = await POST(
      post({ app: "kanban", max_uses: 5, ttl_hours: 1.5 })
    );
    expect(res.status).toBe(200);
    expect(grantCalls[0]?.slice(1)).toEqual([
      "owner-1",
      "app-kanban",
      "default",
      { maxUses: 5, ttlHours: 1.5 },
    ]);
  });
});
