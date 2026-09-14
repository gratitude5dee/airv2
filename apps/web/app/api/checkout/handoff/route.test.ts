import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const createCheckoutHandoff = vi.hoisted(() => vi.fn());
const updateCheckoutHandoff = vi.hoisted(() => vi.fn());
const refreshCheckoutCard = vi.hoisted(() => vi.fn(async () => "updated"));
vi.mock("@/lib/checkout/handoffs", () => ({
  createCheckoutHandoff,
  updateCheckoutHandoff,
}));
vi.mock("@/lib/miniapps/cards", () => ({ refreshCheckoutCard }));

const box = { user_id: "owner-1" };
const destination = { space_id: "space-1", phone: "+15550001111" };
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from(table: string) {
      const row = table === "boxes" ? box : table === "imessage_destinations" ? destination : null;
      const chain = {
        select: () => chain,
        eq: () => chain,
        maybeSingle: async () => ({ data: row, error: null }),
      };
      return chain;
    },
  }),
}));

import { PATCH, POST } from "./route";

function request(method: "POST" | "PATCH", body?: unknown, token = "good-token"): NextRequest {
  return new NextRequest("https://air.example/api/checkout/handoff", {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  createCheckoutHandoff.mockResolvedValue({ id: "123e4567-e89b-12d3-a456-426614174000" });
  updateCheckoutHandoff.mockResolvedValue({
    id: "123e4567-e89b-12d3-a456-426614174000",
    status: "needs_human",
    version: 1,
  });
});

describe("/api/checkout/handoff", () => {
  it("requires the Box gateway token", async () => {
    expect((await POST(request("POST", undefined, ""))).status).toBe(401);
    expect((await PATCH(request("PATCH", {}, ""))).status).toBe(401);
  });

  it("creates an owner-scoped handoff from the durable iMessage destination", async () => {
    const response = await POST(request("POST", {
      task_id: "run-1",
      merchant_url: "https://tickets.example/checkout/1",
      item_summary: "Two tickets",
      quantity: 2,
      amount_cents: 48000,
      currency: "usd",
    }));
    expect(response.status).toBe(200);
    expect(createCheckoutHandoff).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      userId: "owner-1",
      spaceId: "space-1",
      phone: "+15550001111",
      merchantUrl: "https://tickets.example/checkout/1",
      itemSummary: "Two tickets",
    }));
    await expect(response.json()).resolves.toEqual({
      ok: true,
      handoff_id: "123e4567-e89b-12d3-a456-426614174000",
    });
  });

  it("advances a handoff through the versioned updater", async () => {
    const response = await PATCH(request("PATCH", {
      handoff_id: "123e4567-e89b-12d3-a456-426614174000",
      status: "needs_human",
      blocker: "Complete verification",
      version: 0,
    }));
    expect(response.status).toBe(200);
    expect(updateCheckoutHandoff).toHaveBeenCalledWith(
      expect.anything(),
      "owner-1",
      "123e4567-e89b-12d3-a456-426614174000",
      expect.objectContaining({ status: "needs_human", expectedVersion: 0 })
    );
    expect(refreshCheckoutCard).toHaveBeenCalledWith(
      expect.anything(),
      "owner-1",
      expect.objectContaining({
        id: "123e4567-e89b-12d3-a456-426614174000",
        status: "needs_human",
      })
    );
    await expect(response.json()).resolves.toEqual({
      ok: true,
      handoff_id: "123e4567-e89b-12d3-a456-426614174000",
      status: "needs_human",
      version: 1,
    });
  });
});
