import { describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { checkout } from "./checkout";
import type { MiniAppContext } from "./types";

const getCheckoutHandoff = vi.hoisted(() => vi.fn());
const cancelCheckoutHandoff = vi.hoisted(() => vi.fn(async () => true));
const beginCheckoutHumanControl = vi.hoisted(() => vi.fn());
const returnCheckoutHumanControl = vi.hoisted(() => vi.fn());
const refreshCheckoutCard = vi.hoisted(() => vi.fn(async () => "updated"));
const armStopAfter = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("@/lib/checkout/handoffs", () => ({
  getCheckoutHandoff,
  cancelCheckoutHandoff,
  beginCheckoutHumanControl,
  returnCheckoutHumanControl,
  humanControlActive: (value: { human_control_expires_at: string | null }) =>
    value.human_control_expires_at !== null &&
    Date.parse(value.human_control_expires_at) > Date.now(),
}));
vi.mock("@/lib/orchestrator/boxes", () => ({ armStopAfter }));
vi.mock("../cards", () => ({
  mintSignedLink: vi.fn(() => "https://mini.example/computer?t=token"),
  mintCheckoutBrowserLink: vi.fn(
    () => "https://mini.example/api/mini/checkout-launch#t=browser-token"
  ),
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
  human_control_expires_at: null,
  human_control_returned_at: null,
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
    expect(html).toContain("Open checkout in browser");
    expect(html).toContain("/api/mini/checkout-launch#t=browser-token");
    expect(html).toContain("Open merchant site — you may need to rebuild the cart");
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

  it("starts a bounded human-control lease before opening the same browser", async () => {
    beginCheckoutHumanControl.mockResolvedValueOnce({
      ...handoff,
      human_control_expires_at: "2099-09-14T18:15:00.000Z",
      version: 1,
    });
    const form = new FormData();
    form.set("action", "take_control");

    const response = await checkout.action!(ctx(), form);

    expect(beginCheckoutHumanControl).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      handoff.id,
    );
    expect(armStopAfter).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      20,
    );
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://mini.example/computer?t=token",
    );
  });

  it("returns browser control explicitly and renders the active lease truthfully", async () => {
    getCheckoutHandoff.mockResolvedValueOnce({
      ...handoff,
      human_control_expires_at: "2099-09-14T18:15:00.000Z",
    });
    const html = await (await checkout.render(ctx())).text();
    expect(html).toContain("You control this browser");
    expect(html).toContain("Return control to agent");
    expect(html).not.toContain(">Control existing browser<");

    returnCheckoutHumanControl.mockResolvedValueOnce({
      ...handoff,
      human_control_expires_at: null,
      human_control_returned_at: "2026-09-14T18:10:00.000Z",
      version: 2,
    });
    const form = new FormData();
    form.set("action", "return_control");
    const response = await checkout.action!(ctx(), form);
    expect(returnCheckoutHumanControl).toHaveBeenCalledWith(
      expect.any(Object),
      "user-1",
      handoff.id,
    );
    expect(response.status).toBe(303);
  });
});
