// @vitest-environment jsdom
/**
 * image-editor smoke (R-TQ-09): the bundle mounts onto #image-editor and
 * renders its empty stage; the options drawer opens on tap.
 */
import { beforeAll, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import "@/lib/testing/jsdom";
import { DEFAULT_IMAGE_DOC } from "@/lib/miniapps/creativeDocs";

const fetchMock = vi.fn(async () => {
  throw new Error("no network in tests");
});
globalThis.fetch = fetchMock as unknown as typeof fetch;

const payload = {
  doc: { ...DEFAULT_IMAGE_DOC, title: "Test image" },
  flatUrl: null,
  assetUrls: {},
};

beforeAll(async () => {
  document.body.innerHTML = `<div id="image-editor" data-payload='${JSON.stringify(
    payload
  )}'></div>`;
  await import("./image-editor");
});

describe("image-editor", () => {
  it("mounts and renders the empty stage", async () => {
    expect(document.getElementById("image-editor")).toBeTruthy();
    await screen.findByText(/No image yet/);
    expect(screen.getByLabelText("drawing surface")).toBeTruthy();
  });

  it("opens the layers & options drawer on tap", async () => {
    const toggle = await screen.findByLabelText("expand editor panel");
    toggle.click();
    await waitFor(() => {
      expect(screen.getByLabelText("document title")).toBeTruthy();
    });
  });
});
