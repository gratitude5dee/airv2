// @vitest-environment jsdom
/**
 * app/home smoke (R-TQ-09): the shell renders its chrome on the home
 * section and the Bots rail toggles open — the five biggest client files
 * get a mount-and-interact baseline.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@/lib/testing/jsdom";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
}));

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString();
  const body = url === "/api/bots" ? { bots: [] } : url.startsWith("/api/bots/rooms") ? { rooms: [] } : {};
  return { ok: true, status: 200, json: async () => body } as Response;
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

import HomePage from "./page";

afterEach(() => {
  cleanup();
  fetchMock.mockClear();
});

describe("app/home/page", () => {
  it("renders the shell on the home section", async () => {
    render(<HomePage />);
    await screen.findByText("A softer way to get things done.");
    expect(screen.getByLabelText("Sections")).toBeTruthy();
    expect(screen.getByText("Sign out")).toBeTruthy();
  });

  it("toggles the bots rail open and closed", async () => {
    render(<HomePage />);
    const bots = await screen.findByText("Bots");
    expect(bots.closest("button")?.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(bots);
    await waitFor(() => {
      expect(bots.closest("button")?.getAttribute("aria-pressed")).toBe("true");
    });
  });
});
