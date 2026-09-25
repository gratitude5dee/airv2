// @vitest-environment jsdom
/**
 * Needs-panel behaviour (R-TQ-08): the web half of the purchase_review
 * closed-vocabulary check — a pending review renders with its label and
 * the "Fill card" CTA, and approving POSTs to the decisions API. Replaces
 * the source-grep assertions in lib/vault/tickets.test.ts.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import React from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@/lib/testing/jsdom";
import { NeedsPanel } from "./needs-panel";

const fetchMock = vi.fn();
globalThis.fetch = fetchMock as unknown as typeof fetch;

function jsonResponse(body: unknown, init?: { ok?: boolean; status?: number }) {
  return {
    ok: init?.ok ?? true,
    status: init?.status ?? 200,
    json: async () => body,
  } as Response;
}

const REVIEW = {
  id: "d-review-1",
  kind: "purchase_review",
  platform: null,
  sender: null,
  label: "Fill card on shop.example?",
  status: "pending",
  created_at: new Date().toISOString(),
  payload: {
    host: "shop.example",
    summary: "Order total $79.00",
    amount_band: "under $100",
    card_name: "Visa",
    card_masked: "•• 4242",
  },
};

afterEach(() => {
  cleanup();
  fetchMock.mockReset();
});

describe("NeedsPanel", () => {
  it("renders a purchase_review decision with its Fill card CTA", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ decisions: [REVIEW] }));
    render(<NeedsPanel active />);

    await screen.findByText("Card fill awaiting approval");
    expect(screen.getByText("Fill card")).toBeTruthy();
    expect(screen.getByText(/shop\.example/)).toBeTruthy();
  });

  it("posts an approve action when Fill card is clicked", async () => {
    fetchMock.mockImplementation((input: RequestInfo | URL) => {
      const url = typeof input === "string" ? input : input.toString();
      if (url === "/api/decisions" && input instanceof Request === false) {
        // both the list load and the resolve POST hit /api/decisions
        return Promise.resolve(jsonResponse({ decisions: [REVIEW] }));
      }
      return Promise.resolve(jsonResponse({ decisions: [REVIEW] }));
    });
    render(<NeedsPanel active />);
    const cta = await screen.findByText("Fill card");

    fireEvent.click(cta);

    await waitFor(() => {
      const posted = fetchMock.mock.calls.some(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST"
      );
      expect(posted).toBe(true);
    });
    const body = JSON.parse(
      (fetchMock.mock.calls.find(
        ([, init]) => (init as RequestInit | undefined)?.method === "POST"
      )![1] as RequestInit).body as string
    ) as Record<string, unknown>;
    expect(body["id"]).toBe("d-review-1");
    expect(body["action"]).toBe("approve");
  });
});
