import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const getPaymentRequest = vi.hoisted(() => vi.fn());
vi.mock("../commerce/paymentRequests", () => ({ getPaymentRequest }));

import {
  checkoutTransitionAllowed,
  createCheckoutHandoff,
  isCheckoutHandoffId,
  safeCheckoutUrl,
} from "./handoffs";

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

describe("checkout handoff payment request ownership", () => {
  it("rejects a cross-tenant payment request before creating a handoff", async () => {
    getPaymentRequest.mockResolvedValueOnce(null);
    const supabase = {} as SupabaseClient;

    await expect(
      createCheckoutHandoff(supabase, {
        userId: "owner-a",
        spaceId: "space-a",
        phone: "+14155550123",
        merchantUrl: "https://checkout.example.test/session/abc",
        itemSummary: "Two tickets",
        paymentRequestId: "123e4567-e89b-12d3-a456-426614174999",
      })
    ).rejects.toThrow("checkout payment request not found");

    expect(getPaymentRequest).toHaveBeenCalledWith(
      supabase,
      "owner-a",
      "123e4567-e89b-12d3-a456-426614174999"
    );
  });

  it("rejects a malformed payment request id without querying storage", async () => {
    getPaymentRequest.mockClear();

    await expect(
      createCheckoutHandoff({} as SupabaseClient, {
        userId: "owner-a",
        spaceId: "space-a",
        phone: "+14155550123",
        merchantUrl: "https://checkout.example.test/session/abc",
        itemSummary: "Two tickets",
        paymentRequestId: "payment-from-another-tenant",
      })
    ).rejects.toThrow("checkout payment request is invalid");

    expect(getPaymentRequest).not.toHaveBeenCalled();
  });
});
