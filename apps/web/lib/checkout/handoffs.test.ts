import { describe, expect, it } from "vitest";
import { checkoutTransitionAllowed, isCheckoutHandoffId, safeCheckoutUrl } from "./handoffs";

describe("checkout handoff URL validation", () => {
  it("accepts public HTTPS checkout URLs", () => {
    expect(safeCheckoutUrl("https://checkout.example.test/session/abc")?.hostname).toBe("checkout.example.test");
  });
  it.each([
    "http://checkout.example.test/session",
    "https://user:pass@checkout.example.test/session",
    "https://localhost/session",
    "https://127.0.0.1/session",
    "https://172.16.0.1/session",
    "https://[::1]/session",
    "https://checkout..example/session",
    "javascript:alert(1)",
  ])("rejects unsafe checkout URL %s", (url) => {
    expect(safeCheckoutUrl(url)).toBeNull();
  });
});

describe("checkout handoff lifecycle", () => {
  it("accepts forward progress and recovery states", () => {
    expect(checkoutTransitionAllowed("preparing", "needs_human")).toBe(true);
    expect(checkoutTransitionAllowed("payment_pending", "requires_action")).toBe(true);
    expect(checkoutTransitionAllowed("requires_action", "payment_pending")).toBe(true);
    expect(checkoutTransitionAllowed("payment_pending", "completed")).toBe(true);
  });

  it("rejects reopening a terminal handoff or skipping its payment state", () => {
    expect(checkoutTransitionAllowed("completed", "payment_pending")).toBe(false);
    expect(checkoutTransitionAllowed("cancelled", "ready_for_review")).toBe(false);
    expect(checkoutTransitionAllowed("ready_for_review", "completed")).toBe(false);
  });

  it("only accepts UUID-shaped handoff ids", () => {
    expect(isCheckoutHandoffId("123e4567-e89b-12d3-a456-426614174000")).toBe(true);
    expect(isCheckoutHandoffId("------------------------------------")).toBe(false);
    expect(isCheckoutHandoffId("handoff-1")).toBe(false);
  });
});
