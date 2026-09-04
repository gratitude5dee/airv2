import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const session = vi.hoisted(() => ({
  storeSessionUserId: vi.fn((): string | null => null),
}));
vi.mock("@/lib/miniapps/storeSession", () => session);
const db = vi.hoisted(() => ({ row: { speed_tier: "balanced", monthly_cap_usd: 40 } as Record<string, unknown> | null }));
vi.mock("@/lib/supabase", () => ({
  serviceClient: () =>
    ({
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle: async () => ({ data: db.row, error: null }) }),
        }),
      }),
    }) as unknown as SupabaseClient,
}));
const account = vi.hoisted(() => ({
  setSpeedTier: vi.fn(async () => true),
}));
vi.mock("@/lib/settings/account", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/settings/account")>()),
  setSpeedTier: account.setSpeedTier,
}));

import { NextRequest } from "next/server";
import { GET, PUT } from "./route";

function put(body: unknown): NextRequest {
  return new NextRequest("https://mini.test/api/create/tier", {
    method: "PUT",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  session.storeSessionUserId.mockReturnValue("user-alice");
  db.row = { speed_tier: "balanced", monthly_cap_usd: 40 };
  account.setSpeedTier.mockResolvedValue(true);
});

describe("/api/create/tier", () => {
  it("401 without the store session", async () => {
    session.storeSessionUserId.mockReturnValue(null);
    expect((await GET(new NextRequest("https://mini.test/api/create/tier"))).status).toBe(401);
    expect((await PUT(put({ speed_tier: "fast" }))).status).toBe(401);
    expect(account.setSpeedTier).not.toHaveBeenCalled();
  });

  it("reads the owner's speed_tier and monthly cap, defaulting to balanced", async () => {
    let body = await (await GET(new NextRequest("https://mini.test/api/create/tier"))).json();
    expect(body).toEqual({ speed_tier: "balanced", monthly_cap_usd: 40 });
    db.row = null;
    body = await (await GET(new NextRequest("https://mini.test/api/create/tier"))).json();
    expect(body).toEqual({ speed_tier: "balanced", monthly_cap_usd: 0 });
  });

  it("writes only a tier name through setSpeedTier — never a model id", async () => {
    const response = await PUT(put({ speed_tier: "deep" }));
    expect(response.status).toBe(200);
    expect(account.setSpeedTier).toHaveBeenCalledWith(expect.anything(), "user-alice", "deep");
    expect((await PUT(put({ speed_tier: "gpt-5.6-terra" }))).status).toBe(400);
    expect((await PUT(put({ speed_tier: "create-deep" }))).status).toBe(400);
    expect((await PUT(put({}))).status).toBe(400);
    expect(account.setSpeedTier).toHaveBeenCalledTimes(1);
  });

  it("500 when the entitlement update fails", async () => {
    account.setSpeedTier.mockResolvedValueOnce(false);
    expect((await PUT(put({ speed_tier: "fast" }))).status).toBe(500);
  });
});
