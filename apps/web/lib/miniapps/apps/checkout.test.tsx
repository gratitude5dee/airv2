import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkout } from "./checkout";
import type { MiniAppContext } from "./types";

const getCheckoutHandoff = vi.hoisted(() => vi.fn());
const cancelCheckoutHandoff = vi.hoisted(() => vi.fn(async () => true));
const refreshCheckoutCard = vi.hoisted(() => vi.fn(async () => "updated"));
vi.mock("@/lib/checkout/handoffs", () => ({
  getCheckoutHandoff,
  cancelCheckoutHandoff,
}));
vi.mock("../cards", () => ({
  mintSignedLink: vi.fn(() => "https://mini.example/computer?t=token"),
  refreshCheckoutCard,
}));

const handoff = {
  id: "123e4567-e89b-12d3-a456-426614174000",
  user_id: "user-1",
  space_id: "space-1",
  phone: "+15550001111",
  task_id: "run-1",
  status: "needs_human",
  merchant_host: "tickets.example",
  merchant_url: "https://tickets.example/checkout/abc",
  item_summary: "Two festival tickets",
  quantity: 2,
  amount_cents: 48_000,
  currency: "usd",
  blocker: "Complete merchant verification",
  verified_at: "2026-09-14T15:00:00.000Z",
  expires_at: "2099-09-14T18:00:00.000Z",
  same_session: true,
  payment_request_id: null,
  version: 0,
  created_at: "2026-09-14T15:00:00.000Z",
  updated_at: "2026-09-14T15:00:00.000Z",
};

function ctx(role: "owner" | "guest" = "owner"): MiniAppContext {
  return {
    request: new NextRequest("https://mini.example/checkout"),
    supabase: {} as MiniAppContext["supabase"],
    app: { slug: "checkout" } as MiniAppContext["app"],
    session: { role, userId: "user-1", resourceId: handoff.id, via: "card" },
    basePath: "/checkout",
  };
}

describe("checkout mini-app", () => {
  it("renders verified quote, blocker, merchant link, and same-session control", async () => {
    getCheckoutHandoff.mockResolvedValueOnce(handoff);
    const response = await checkout.render(ctx());
    const html = await response.text();
    expect(html).toContain("Two festival tickets");
    expect(html).toContain("$480.00");
    expect(html).toContain("Complete merchant verification");
    expect(html).toContain("Continue on merchant site");
    expect(html).toContain("Control existing browser");
    expect(html).toContain("Verified:");
    expect(html).toContain("Hold expires:");
    expect(html).toContain("No automatic approval is enabled");
  });

  it("does not expose the owner page to guests and marks expired holds", async () => {
    expect((await checkout.render(ctx("guest"))).status).toBe(403);
    getCheckoutHandoff.mockResolvedValueOnce({
      ...handoff,
      status: "ready_for_review",
      expires_at: "2026-09-13T18:00:00.000Z",
    });
    const html = await (await checkout.render(ctx())).text();
    expect(html).toContain("This checkout hold expired");
    expect(html).toContain("No automatic approval is enabled");
  });

  it("cancels only through the owner action and redirects back to the app", async () => {
    const response = await checkout.action!(ctx(), new FormData());
    expect(response.status).toBe(403);
    const form = new FormData();
    form.set("action", "cancel");
    const cancelled = await checkout.action!(ctx(), form);
    expect(cancelCheckoutHandoff).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      handoff.id
    );
    expect(refreshCheckoutCard).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      { id: handoff.id, status: "cancelled" }
    );
    expect(cancelled.status).toBe(303);
  });
});
