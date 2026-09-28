// @vitest-environment jsdom
/**
 * draw-studio smoke (R-TQ-09): the bundle mounts onto #draw-studio and
 * renders the canvas controls; the eraser toggles its pressed state.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import "@/lib/testing/jsdom";

const fetchMock = vi.fn(async () => {
  throw new Error("no network in tests");
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

const payload = {
  sessionId: "draw-session-1",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  latest: 0,
  activeJob: null,
  latestJobId: null,
  initialAssetUrl: null,
  revisions: [],
};

beforeAll(async () => {
  document.body.innerHTML = `<div id="draw-studio" data-payload='${JSON.stringify(
    payload
  )}'></div>`;
  await import("./draw-studio");
});

describe("draw-studio", () => {
  it("mounts and renders the canvas controls", async () => {
    expect(document.getElementById("draw-studio")).toBeTruthy();
    await screen.findByLabelText("Drawing canvas");
    expect(screen.getByLabelText("Prompt")).toBeTruthy();
    expect(screen.getByLabelText("Undo")).toBeTruthy();
  });

  it("toggles the eraser on tap", async () => {
    const eraser = await screen.findByText("Eraser");
    expect(eraser.getAttribute("aria-pressed")).toBe("false");
    eraser.click();
    await waitFor(() => {
      expect(eraser.getAttribute("aria-pressed")).toBe("true");
    });
  });
});
