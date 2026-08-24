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
  normalizeImageDoc,
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

describe("image doc groups", () => {
  it("nests layers under a group and keeps the subtree contiguous", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-group", name: "Sky" });
    const group = at(doc.layers, 0);
    applyImageAction(doc, {
      kind: "add-asset",
      assetId: "cloud",
      parentGroupId: group.id,
    });
    applyImageAction(doc, { kind: "add-asset", assetId: "ground" });
    expect(doc.layers.map((l) => l.parentGroupId)).toEqual([
      null,
      group.id,
      null,
    ]);
    // Reparenting the root asset moves it next to its new parent.
    applyImageAction(doc, {
      kind: "set-parent",
      id: at(doc.layers, 2).id,
      parentGroupId: group.id,
    });
    expect(doc.layers.map((l) => l.parentGroupId)).toEqual([
      null,
      group.id,
      group.id,
    ]);
  });

  it("rejects cycles, non-group parents, and over-deep nesting", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-group", name: "outer" });
    const outer = at(doc.layers, 0);
    applyImageAction(doc, {
      kind: "add-group",
      name: "inner",
      parentGroupId: outer.id,
    });
    const inner = at(doc.layers, 1);
    applyImageAction(doc, { kind: "add-text", text: "leaf" });
    const leaf = at(doc.layers, 2);
    // A group cannot become a child of its own descendant.
    applyImageAction(doc, {
      kind: "set-parent",
      id: outer.id,
      parentGroupId: inner.id,
    });
    expect(outer.parentGroupId).toBeNull();
    // A leaf is not a valid parent.
    applyImageAction(doc, {
      kind: "set-parent",
      id: inner.id,
      parentGroupId: leaf.id,
    });
    expect(inner.parentGroupId).toBe(outer.id);
    // Depth cap: 6 nested groups is the limit, the 7th stays at the root.
    let parent = inner.id;
    for (let depth = 2; depth < 8; depth += 1) {
      applyImageAction(doc, {
        kind: "add-group",
        name: `g${depth}`,
        parentGroupId: parent,
      });
      const added = doc.layers.find((l) => l.name === `g${depth}`);
      if (added?.parentGroupId === parent) parent = added.id;
    }
    expect(doc.layers.some((l) => l.name === "g7")).toBe(false);
  });

  it("removes a group with its whole subtree", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-group", name: "g" });
    const group = at(doc.layers, 0);
    applyImageAction(doc, {
      kind: "add-asset",
      assetId: "a",
      parentGroupId: group.id,
    });
    applyImageAction(doc, {
      kind: "add-text",
      text: "t",
      parentGroupId: group.id,
    });
    applyImageAction(doc, { kind: "add-asset", assetId: "keep" });
    applyImageAction(doc, { kind: "remove", id: group.id });
    expect(doc.layers.map((l) => l.assetId)).toEqual(["keep"]);
  });

  it("toggles collapse only on groups and reorders siblings absolutely", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-group" });
    const group = at(doc.layers, 0);
    applyImageAction(doc, { kind: "toggle-collapsed", id: group.id });
    expect(group.collapsed).toBe(true);
    applyImageAction(doc, { kind: "add-asset", assetId: "a" });
    applyImageAction(doc, { kind: "add-asset", assetId: "b" });
    const last = at(doc.layers, 2);
    applyImageAction(doc, { kind: "reorder", id: last.id, index: 0 });
    expect(doc.layers.map((l) => l.id)[0]).toBe(last.id);
  });
});

describe("image doc history", () => {
  it("undoes and redoes a structural edit", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-asset", assetId: "a" });
    applyImageAction(doc, { kind: "add-asset", assetId: "b" });
    expect(doc.layers).toHaveLength(2);
    applyImageAction(doc, { kind: "undo" });
    expect(doc.layers.map((l) => l.assetId)).toEqual(["a"]);
    applyImageAction(doc, { kind: "redo" });
    expect(doc.layers.map((l) => l.assetId)).toEqual(["a", "b"]);
  });

  it("coalesces repeated edits to one target and skips no-ops", () => {
    const doc = imageDoc();
    applyImageAction(doc, { kind: "add-asset", assetId: "a" });
    const layer = at(doc.layers, 0);
    const steps = doc.history.undo.length;
    applyImageAction(doc, { kind: "set-opacity", id: layer.id, opacity: 80 });
    applyImageAction(doc, { kind: "set-opacity", id: layer.id, opacity: 60 });
    applyImageAction(doc, { kind: "set-opacity", id: layer.id, opacity: 40 });
    expect(doc.history.undo.length).toBe(steps + 1);
    // Selection, unknown ids, and rejected moves never burn an undo step.
    applyImageAction(doc, { kind: "select", id: layer.id });
    applyImageAction(doc, { kind: "remove", id: "nope" });
    applyImageAction(doc, { kind: "move", id: layer.id, direction: "up" });
    expect(doc.history.undo.length).toBe(steps + 1);
    applyImageAction(doc, { kind: "undo" });
    expect(at(doc.layers, 0).opacity).toBe(100);
  });

  it("caps the undo stack", () => {
    const doc = imageDoc();
    for (let index = 0; index < 40; index += 1) {
      applyImageAction(doc, { kind: "add-asset", assetId: `a${index}` });
    }
    expect(doc.history.undo.length).toBeLessThanOrEqual(20);
  });
});

describe("image doc normalization", () => {
  it("upgrades a v1 doc to v2 with root parents and identity transforms", () => {
    const doc = normalizeImageDoc({
      title: "Legacy",
      layers: [
        { id: "l1", kind: "asset", assetId: "a", opacity: 50, blend: "screen", visible: false },
        { id: "l2", kind: "text", text: "hi", opacity: 100, blend: "normal", visible: true },
      ],
      flatAssetId: "flat-1",
    });
    expect(doc.schemaVersion).toBe(2);
    expect(doc.layers.map((l) => l.parentGroupId)).toEqual([null, null]);
    expect(at(doc.layers, 0).transform).toEqual({
      x: 0,
      y: 0,
      scale: 100,
      rotation: 0,
    });
    expect(at(doc.layers, 0).blend).toBe("screen");
    expect(at(doc.layers, 0).visible).toBe(false);
    expect(doc.flatAssetId).toBe("flat-1");
    expect(doc.history).toEqual({ undo: [], redo: [] });
  });

  it("clamps hostile fields instead of dropping the document", () => {
    const doc = normalizeImageDoc({
      title: 42,
      layers: [
        null,
        { kind: "asset", assetId: "no-id" },
        { id: "g", kind: "group", parentGroupId: "g" },
        {
          id: "l1",
          kind: "asset",
          assetId: "a",
          parentGroupId: "missing",
          opacity: 900,
          blend: "javascript:alert(1)",
          transform: { x: "1e999", scale: 1e9, rotation: 4000 },
        },
      ],
      selectedLayerId: "gone",
      flatAssetId: 7,
      history: { undo: "nope", redo: [{ layers: [{ id: "x", kind: "text", text: "" }] }] },
    });
    expect(doc.layers.map((l) => l.id)).toEqual(["g", "l1"]);
    const layer = at(doc.layers, 1);
    expect(layer.parentGroupId).toBeNull();
    expect(layer.opacity).toBe(100);
    expect(layer.blend).toBe("normal");
    expect(layer.transform).toEqual({ x: 0, y: 0, scale: 1000, rotation: 360 });
    expect(at(doc.layers, 0).parentGroupId).toBeNull();
    expect(doc.selectedLayerId).toBeNull();
    expect(doc.flatAssetId).toBeNull();
    expect(doc.history.undo).toEqual([]);
    expect(doc.history.redo).toHaveLength(1);
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
