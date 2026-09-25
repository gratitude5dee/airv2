import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";

const createCheckoutHandoff = vi.hoisted(() => vi.fn());
const findActiveCheckoutHumanControl = vi.hoisted(() => vi.fn());
const getCheckoutHandoff = vi.hoisted(() => vi.fn());
const updateCheckoutHandoff = vi.hoisted(() => vi.fn());
const refreshCheckoutCard = vi.hoisted(() => vi.fn(async () => "updated"));
vi.mock("@/lib/checkout/handoffs", () => ({
  createCheckoutHandoff,
  findActiveCheckoutHumanControl,
  getCheckoutHandoff,
  humanControlActive: (handoff: { human_control_expires_at: string | null }) =>
    handoff.human_control_expires_at !== null,
  isCheckoutHandoffId: (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value),
  updateCheckoutHandoff,
}));
vi.mock("@/lib/miniapps/cards", () => ({ refreshCheckoutCard }));

const db = new FakeSupabase();
vi.mock("@/lib/supabase", () => ({
  serviceClient: () => db.client(),
}));

import { GET, PATCH, POST } from "./route";

function request(method: "GET" | "POST" | "PATCH", body?: unknown, token = "good-token"): NextRequest {
  const query = method === "GET" && typeof body === "string" ? body : "";
  return new NextRequest(`https://air.example/api/checkout/handoff${query}`, {
    method,
    headers: {
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }),
    },
    ...(body === undefined || method === "GET" ? {} : { body: JSON.stringify(body) }),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.tables["boxes"] = [{ user_id: "owner-1", gateway_token: "good-token" }];
  db.tables["imessage_destinations"] = [
    { user_id: "owner-1", space_id: "space-1", phone: "+15550001111" },
  ];
  createCheckoutHandoff.mockResolvedValue({ id: "123e4567-e89b-12d3-a456-426614174000" });
  findActiveCheckoutHumanControl.mockResolvedValue(null);
  getCheckoutHandoff.mockResolvedValue({
    id: "123e4567-e89b-12d3-a456-426614174000",
    user_id: "owner-1",
    space_id: "space-secret",
    phone: "+15550001111",
    task_id: "run-1",
    status: "needs_human",
    merchant_host: "tickets.example",
    merchant_url: "https://tickets.example/checkout/cart-secret",
    item_summary: "Two tickets",
    quantity: 2,
    amount_cents: 48000,
    currency: "usd",
    blocker: "Complete verification",
    verified_at: null,
    expires_at: null,
    same_session: true,
    payment_request_id: null,
    human_control_expires_at: "2099-09-14T18:15:00.000Z",
    human_control_returned_at: null,
    version: 4,
    created_at: "2026-09-14T18:00:00.000Z",
    updated_at: "2026-09-14T18:00:00.000Z",
  });
  updateCheckoutHandoff.mockResolvedValue({
    id: "123e4567-e89b-12d3-a456-426614174000",
    status: "needs_human",
    version: 1,
  });
});

describe("/api/checkout/handoff", () => {
  it("requires the Box gateway token", async () => {
    expect((await GET(request("GET", "?handoff_id=x", ""))).status).toBe(401);
    expect((await POST(request("POST", undefined, ""))).status).toBe(401);
    expect((await PATCH(request("PATCH", {}, ""))).status).toBe(401);
  });

  it("returns owner-scoped lease state without leaking the cart URL", async () => {
    const response = await GET(request(
      "GET",
      "?handoff_id=123e4567-e89b-12d3-a456-426614174000",
    ));
    expect(response.status).toBe(200);
    expect(getCheckoutHandoff).toHaveBeenCalledWith(
      expect.anything(),
      "owner-1",
      "123e4567-e89b-12d3-a456-426614174000",
    );
    const payload = await response.json();
    expect(payload).toMatchObject({
      handoff_id: "123e4567-e89b-12d3-a456-426614174000",
      status: "needs_human",
      merchant_host: "tickets.example",
      human_control: {
        active: true,
        expires_at: "2099-09-14T18:15:00.000Z",
      },
      version: 4,
    });
    expect(payload).not.toHaveProperty("merchant_url");
    expect(payload).not.toHaveProperty("phone");
    expect(payload).not.toHaveProperty("space_id");
  });

  it("provides a value-free global lease guard for box browser tools", async () => {
    findActiveCheckoutHumanControl.mockResolvedValueOnce({
      expiresAt: "2099-09-14T18:15:00.000Z",
    });
    const response = await GET(request("GET", "?active_human_control=1"));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      active: true,
      expires_at: "2099-09-14T18:15:00.000Z",
    });
    expect(findActiveCheckoutHumanControl).toHaveBeenCalledWith(
      expect.anything(),
      "owner-1",
    );
  });

  it("returns 404 when the handoff is not owned by the gateway user", async () => {
    getCheckoutHandoff.mockResolvedValueOnce(null);
    const response = await GET(request(
      "GET",
      "?handoff_id=123e4567-e89b-12d3-a456-426614174999",
    ));
    expect(response.status).toBe(404);
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
