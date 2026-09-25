// @vitest-environment jsdom
/**
 * freeze-studio smoke (R-TQ-09): the bundle mounts onto #freeze-studio and
 * renders the source stage; "sketch + generate" swaps to the sketch pad.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import "@/lib/testing/jsdom";

const fetchMock = vi.fn(async () => {
  throw new Error("no network in tests");
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

const payload = {
  sessionId: "freeze-session-1",
  expiresAt: new Date(Date.now() + 3600_000).toISOString(),
  lite: true,
  latest: 0,
  activeJob: null,
  latestJobId: null,
  sourceAssetId: null,
  sourceUrl: null,
  sketches: [],
  renders: [],
  presets: [],
};

beforeAll(async () => {
  document.body.innerHTML = `<div id="freeze-studio" data-payload='${JSON.stringify(
    payload
  )}'></div>`;
  await import("./freeze-studio");
});

describe("freeze-studio", () => {
  it("mounts and renders the source stage", async () => {
    expect(document.getElementById("freeze-studio")).toBeTruthy();
    await screen.findByText("freeze the scene");
    expect(screen.getByText("take a photo")).toBeTruthy();
    expect(screen.getByText("upload a photo")).toBeTruthy();
  });

  it("switches to the sketch pad when 'sketch + generate' is tapped", async () => {
    const sketchButton = await screen.findByText("sketch + generate");
    sketchButton.click();
    await waitFor(() => {
      expect(screen.getByText("← back")).toBeTruthy();
    });
  });
});
