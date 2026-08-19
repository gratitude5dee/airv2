/**
 * MA7 creative documents: the pure action grammar the image and video
 * editors apply to box-side docs. Layer/clip mutations must be bounded and
 * order-preserving — the doc that survives a box stop/resume is exactly
 * what these functions produced.
 */
import { describe, expect, it } from "vitest";
import {
  applyImageAction,
  applyVideoAction,
  DEFAULT_IMAGE_DOC,
  DEFAULT_VIDEO_DOC,
  isBlendMode,
  type ImageDoc,
  type VideoDoc,
} from "./creativeDocs";

function at<T>(items: T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`missing item ${index}`);
  return item;
}

function imageDoc(): ImageDoc {
  return structuredClone(DEFAULT_IMAGE_DOC);
}

function videoDoc(): VideoDoc {
  return structuredClone(DEFAULT_VIDEO_DOC);
}

describe("image doc actions", () => {
  it("builds a 3-layer doc that round-trips through JSON", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-asset", assetId: "asset-1" });
    applyImageAction(doc, { kind: "add-asset", assetId: "asset-2" });
    applyImageAction(doc, { kind: "add-text", text: "Hello" });
    expect(doc.layers).toHaveLength(3);
    const revived = JSON.parse(JSON.stringify(doc)) as ImageDoc;
    expect(revived.layers.map((l) => l.kind)).toEqual(["asset", "asset", "text"]);
    expect(at(revived.layers, 2).text).toBe("Hello");
  });

  it("reorders, clamps opacity, sets blend, toggles, removes", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-asset", assetId: "a" });
    applyImageAction(doc, { kind: "add-text", text: "t" });
    const bottom = at(doc.layers, 0);
    const top = at(doc.layers, 1);
    applyImageAction(doc, { kind: "move", id: top.id, direction: "up" });
    expect(at(doc.layers, 0).id).toBe(top.id);
    applyImageAction(doc, { kind: "move", id: top.id, direction: "up" });
    expect(at(doc.layers, 0).id).toBe(top.id); // no-op at the edge
    applyImageAction(doc, { kind: "set-opacity", id: bottom.id, opacity: 250 });
    expect(at(doc.layers, 1).opacity).toBe(100);
    applyImageAction(doc, { kind: "set-opacity", id: bottom.id, opacity: -5 });
    expect(at(doc.layers, 1).opacity).toBe(0);
    applyImageAction(doc, { kind: "set-blend", id: bottom.id, blend: "screen" });
    expect(at(doc.layers, 1).blend).toBe("screen");
    applyImageAction(doc, { kind: "toggle-visible", id: bottom.id });
    expect(at(doc.layers, 1).visible).toBe(false);
    applyImageAction(doc, { kind: "remove", id: bottom.id });
    expect(doc.layers).toHaveLength(1);
  });

  it("ignores unknown layer ids and rejects bad blend strings", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-text", text: "x" });
    applyImageAction(doc, { kind: "remove", id: "nope" });
    expect(doc.layers).toHaveLength(1);
    expect(isBlendMode("overlay")).toBe(true);
    expect(isBlendMode("subtract")).toBe(false);
  });
});

describe("video doc actions", () => {
  it("builds an ordered timeline with trims, captions, and audio", () => {
    const doc = videoDoc();
    applyVideoAction(doc, { kind: "add-clip", assetId: "clip-a" });
    applyVideoAction(doc, { kind: "add-clip", assetId: "clip-b" });
    const first = at(doc.clips, 0);
    const second = at(doc.clips, 1);
    applyVideoAction(doc, {
      kind: "set-trim",
      id: first.id,
      trimStart: 1.5,
      trimEnd: 4,
    });
    applyVideoAction(doc, { kind: "set-caption", id: second.id, caption: "cut 2" });
    applyVideoAction(doc, { kind: "set-audio", assetId: "audio-1" });
    applyVideoAction(doc, { kind: "move", id: second.id, direction: "up" });
    expect(doc.clips.map((c) => c.assetId)).toEqual(["clip-b", "clip-a"]);
    expect(at(doc.clips, 1).trimStart).toBe(1.5);
    expect(at(doc.clips, 1).trimEnd).toBe(4);
    expect(at(doc.clips, 0).caption).toBe("cut 2");
    expect(doc.audioAssetId).toBe("audio-1");
  });

  it("normalizes inverted or non-finite trims", () => {
    const doc = videoDoc();
    applyVideoAction(doc, { kind: "add-clip", assetId: "a" });
    const clip = at(doc.clips, 0);
    applyVideoAction(doc, {
      kind: "set-trim",
      id: clip.id,
      trimStart: 10,
      trimEnd: 5,
    });
    expect(clip.trimStart).toBe(10);
    expect(clip.trimEnd).toBe(0); // inverted window falls back to clip end
    applyVideoAction(doc, {
      kind: "set-trim",
      id: clip.id,
      trimStart: Number.NaN,
      trimEnd: -3,
    });
    expect(clip.trimStart).toBe(0);
    expect(clip.trimEnd).toBe(0);
  });

  it("clears the audio track with a blank asset id", () => {
    const doc = videoDoc();
    applyVideoAction(doc, { kind: "set-audio", assetId: "audio-1" });
    applyVideoAction(doc, { kind: "set-audio", assetId: "  " });
    expect(doc.audioAssetId).toBeNull();
  });
});
