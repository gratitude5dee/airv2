// @vitest-environment jsdom
/**
 * CreateStudio smoke (R-TQ-09): renders the chat shell for a new project
 * and accepts a typed app name.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@/lib/testing/jsdom";
import { CreateStudio } from "./CreateStudio";

const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
  const url = typeof input === "string" ? input : input.toString();
  if (url.startsWith("/api/create/projects")) {
    return { ok: true, json: async () => ({ projects: [] }) } as Response;
  }
  if (url.startsWith("/api/create/tier")) {
    return { ok: true, json: async () => ({ speed_tier: "balanced" }) } as Response;
  }
  return { ok: false, status: 404, json: async () => ({}) } as Response;
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

afterEach(cleanup);

describe("CreateStudio", () => {
  it("renders the new-project chat shell", async () => {
    render(<CreateStudio slug={null} />);
    await screen.findByLabelText("App name");
    expect(screen.getByLabelText("Prompt")).toBeTruthy();
  });

  it("accepts a typed app name", async () => {
    render(<CreateStudio slug={null} />);
    const input = await screen.findByLabelText("App name");
    fireEvent.change(input, { target: { value: "countdown" } });
    await waitFor(() => {
      expect((input as HTMLInputElement).value).toBe("countdown");
    });
  });
});
