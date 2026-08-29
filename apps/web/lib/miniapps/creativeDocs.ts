/**
 * MA7 creative documents. Image and video editors keep their documents in
 * the user's box at `.hermes/miniapps/<app>/<resource>.json` (C4) — the
 * agent's own tools and the mini-app views read and write the same file.
 * Mutations are pure functions over the parsed doc so the action grammar is
 * testable without a box.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { BoxApiError, readFile, writeFile } from "../box/client";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";

/* ------------------------------------------------------------- image docs */

/** The CSS `mix-blend-mode` set — image.goal.md §5.1. The bundle composites
 * previews with these names directly, so the enum and the CSS keyword match. */
export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "darken"
  | "lighten"
  | "color-dodge"
  | "color-burn"
  | "hard-light"
  | "soft-light"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export interface LayerTransform {
  /** Canvas-relative offset in px. */
  x: number;
  y: number;
  /** Percent, 1–1000. */
  scale: number;
  /** Degrees, -360–360. */
  rotation: number;
}

export interface ImageLayer {
  id: string;
  kind: "asset" | "text" | "group";
  /** User-authored label; empty falls back to a derived one at render. */
  name?: string;
  /** Group this layer sits in; null = document root. */
  parentGroupId: string | null;
  /** Groups only: panel collapse state (UI, not content — a collapsed
   * group still composites). */
  collapsed?: boolean;
  /** Box creative-plugin asset id for kind 'asset'. */
  assetId?: string;
  /** Text content for kind 'text'. */
  text?: string;
  opacity: number; // 0–100
  blend: BlendMode;
  visible: boolean;
  transform: LayerTransform;
}

/** One undoable step: the layer tree as it was *before* the action. */
export interface ImageHistoryEntry {
  label: string;
  at: string;
  layers: ImageLayer[];
  selectedLayerId: string | null;
}

export interface ImageDoc {
  schemaVersion: 2;
  title: string;
  /**
   * Bottom-of-stack first, and always in canonical tree order: a group is
   * immediately followed by its own subtree (the Toolcraft layout, so a
   * subtree is a contiguous run).
   */
  layers: ImageLayer[];
  selectedLayerId: string | null;
  /**
   * Control-plane creative_assets id of the last rendered flat. Generation
   * and flattening go through the existing creative lane (the agent writes
   * this back after a render) — the view only previews and exports it.
   * Deliberately outside history: a render is metered and cannot be undone
   * by rewriting a document.
   */
  flatAssetId: string | null;
  history: { undo: ImageHistoryEntry[]; redo: ImageHistoryEntry[] };
}

export const IMAGE_DOC_VERSION = 2;

export const DEFAULT_IMAGE_DOC: ImageDoc = {
  schemaVersion: IMAGE_DOC_VERSION,
  title: "Untitled image",
  layers: [],
  selectedLayerId: null,
  flatAssetId: null,
  history: { undo: [], redo: [] },
};

export const IDENTITY_TRANSFORM: LayerTransform = {
  x: 0,
  y: 0,
  scale: 100,
  rotation: 0,
};

export type ImageAction =
  | { kind: "rename"; title: string }
  | { kind: "add-text"; text: string; parentGroupId?: string | null }
  | { kind: "add-asset"; assetId: string; parentGroupId?: string | null }
  | { kind: "add-group"; name?: string; parentGroupId?: string | null }
  | { kind: "set-text"; id: string; text: string }
  | { kind: "set-opacity"; id: string; opacity: number }
  | { kind: "set-blend"; id: string; blend: BlendMode }
  | { kind: "toggle-visible"; id: string }
  | { kind: "toggle-collapsed"; id: string }
  | { kind: "rename-layer"; id: string; name: string }
  | { kind: "select"; id: string | null }
  | { kind: "set-parent"; id: string; parentGroupId: string | null }
  | { kind: "set-transform"; id: string; transform: Partial<LayerTransform> }
  /** Coarse sibling nudge (the classic renderer's arrows). */
  | { kind: "move"; id: string; direction: "up" | "down" }
  /** Absolute placement among siblings (what drag-and-drop produces). */
  | { kind: "reorder"; id: string; index: number }
  | { kind: "remove"; id: string }
  | { kind: "set-flat"; assetId: string | null }
  | { kind: "undo" }
  | { kind: "redo" };

export const BLEND_MODES: readonly BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "darken",
  "lighten",
  "color-dodge",
  "color-burn",
  "hard-light",
  "soft-light",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

export function isBlendMode(value: string): value is BlendMode {
  return (BLEND_MODES as readonly string[]).includes(value);
}

/** Layers and groups share the budget: the whole doc must stay under the
 * Apps API's 256 KB state cap (image.goal.md §5.1). */
const MAX_LAYERS = 50;
const MAX_GROUP_DEPTH = 6;
const MAX_HISTORY = 20;
const HISTORY_MERGE_MS = 1500;

let idCounter = 0;

function newId(prefix: string): string {
  idCounter += 1;
  return `${prefix}${Date.now().toString(36)}${idCounter.toString(36)}${Math.floor(
    Math.random() * 1296
  )
    .toString(36)
    .padStart(2, "0")}`;
}

const clampOpacity = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

const clampTransform = (
  base: LayerTransform,
  patch: Partial<LayerTransform>
): LayerTransform => {
  const num = (value: unknown, fallback: number): number =>
    typeof value === "number" && Number.isFinite(value) ? value : fallback;
  const clamp = (value: number, min: number, max: number): number =>
    Math.max(min, Math.min(max, value));
  return {
    x: clamp(Math.round(num(patch.x, base.x)), -100000, 100000),
    y: clamp(Math.round(num(patch.y, base.y)), -100000, 100000),
    scale: clamp(Math.round(num(patch.scale, base.scale)), 1, 1000),
    rotation: clamp(Math.round(num(patch.rotation, base.rotation)), -360, 360),
  };
};

/* -------- tree helpers: a flat array with parent pointers, kept in canonical
   order (each group immediately followed by its own subtree), so a subtree is
   always a contiguous run — the Toolcraft layout (image.goal.md §4.1). */

/** Descendants of `layers[index]` occupy `[index + 1, end)`. */
function subtreeEnd(layers: ImageLayer[], index: number): number {
  const layer = layers[index];
  if (!layer) return index;
  const inside = new Set([layer.id]);
  let end = index + 1;
  while (end < layers.length) {
    const next = layers[end];
    if (!next || next.parentGroupId === null || !inside.has(next.parentGroupId)) {
      break;
    }
    inside.add(next.id);
    end += 1;
  }
  return end;
}

function depthOf(byId: Map<string, ImageLayer>, layer: ImageLayer): number {
  let depth = 0;
  let parentId = layer.parentGroupId;
  const seen = new Set<string>([layer.id]);
  while (parentId && !seen.has(parentId)) {
    seen.add(parentId);
    const parent = byId.get(parentId);
    if (!parent) break;
    depth += 1;
    parentId = parent.parentGroupId;
  }
  return depth;
}

/** True when `ancestorId` is `layer` itself or one of its ancestors. */
function isSelfOrAncestor(
  byId: Map<string, ImageLayer>,
  layerId: string,
  candidateId: string
): boolean {
  if (layerId === candidateId) return true;
  let cursor = byId.get(candidateId)?.parentGroupId ?? null;
  const seen = new Set<string>();
  while (cursor && !seen.has(cursor)) {
    if (cursor === layerId) return true;
    seen.add(cursor);
    cursor = byId.get(cursor)?.parentGroupId ?? null;
  }
  return false;
}

/**
 * Rewrite the array into canonical order, dropping parent pointers that name
 * a missing layer, a non-group, or a cycle (they fall back to the root) and
 * anything past MAX_GROUP_DEPTH. Layer object identity is preserved.
 */
function canonicalizeLayers(layers: ImageLayer[]): ImageLayer[] {
  const byId = new Map(layers.map((layer) => [layer.id, layer]));
  for (const layer of layers) {
    const parentId = layer.parentGroupId;
    if (!parentId) {
      layer.parentGroupId = null;
      continue;
    }
    const parent = byId.get(parentId);
    if (
      !parent ||
      parent.kind !== "group" ||
      isSelfOrAncestor(byId, layer.id, parentId)
    ) {
      layer.parentGroupId = null;
    }
  }
  for (const layer of layers) {
    if (depthOf(byId, layer) > MAX_GROUP_DEPTH) layer.parentGroupId = null;
  }
  const ordered: ImageLayer[] = [];
  const emit = (parentId: string | null): void => {
    for (const layer of layers) {
      if (layer.parentGroupId !== parentId) continue;
      ordered.push(layer);
      if (layer.kind === "group") emit(layer.id);
    }
  };
  emit(null);
  return ordered;
}

function siblings(layers: ImageLayer[], parentId: string | null): ImageLayer[] {
  return layers.filter((layer) => layer.parentGroupId === parentId);
}

/** Move `layer`'s subtree so it sits at `index` among its siblings. */
function placeAt(doc: ImageDoc, layer: ImageLayer, index: number): void {
  const run = siblings(doc.layers, layer.parentGroupId);
  const from = run.indexOf(layer);
  if (from < 0) return;
  const to = Math.max(0, Math.min(run.length - 1, index));
  if (to === from) return;
  const start = doc.layers.indexOf(layer);
  const block = doc.layers.splice(start, subtreeEnd(doc.layers, start) - start);
  const reordered = run.filter((sibling) => sibling !== layer);
  reordered.splice(to, 0, layer);
  const after = reordered[to + 1];
  const anchor = after
    ? doc.layers.indexOf(after)
    : (() => {
        const previous = reordered[to - 1];
        if (!previous) return doc.layers.length;
        const at = doc.layers.indexOf(previous);
        return at < 0 ? doc.layers.length : subtreeEnd(doc.layers, at);
      })();
  doc.layers.splice(anchor < 0 ? doc.layers.length : anchor, 0, ...block);
}

function insertLayer(
  doc: ImageDoc,
  layer: ImageLayer,
  parentGroupId: string | null
): void {
  const parent = parentGroupId
    ? doc.layers.find((l) => l.id === parentGroupId && l.kind === "group")
    : undefined;
  if (parentGroupId && !parent) return;
  if (parent) {
    const byId = new Map(doc.layers.map((l) => [l.id, l]));
    if (depthOf(byId, parent) + 1 > MAX_GROUP_DEPTH) return;
  }
  layer.parentGroupId = parent ? parent.id : null;
  if (!parent) {
    doc.layers.push(layer);
  } else {
    const at = doc.layers.indexOf(parent);
    doc.layers.splice(subtreeEnd(doc.layers, at), 0, layer);
  }
  doc.selectedLayerId = layer.id;
}

/* ------------------------------------------------------------ image history */

/** Actions that push an undo step, and the label they push (§5.3). */
const HISTORY_LABELS: Partial<Record<ImageAction["kind"], string>> = {
  "add-text": "Add text layer",
  "add-asset": "Add layer",
  "add-group": "Add group",
  "set-text": "Edit text",
  "set-opacity": "Opacity",
  "set-blend": "Blend mode",
  "toggle-visible": "Visibility",
  "rename-layer": "Rename layer",
  "set-parent": "Group layer",
  "set-transform": "Transform",
  move: "Reorder layer",
  reorder: "Reorder layer",
  remove: "Delete layer",
};

/** Continuous edits coalesce; discrete ones each get their own step. */
const MERGEABLE = new Set<ImageAction["kind"]>([
  "set-opacity",
  "set-transform",
  "set-text",
]);

/**
 * Record `before` (the pre-action layer state) as one undo step. Repeated
 * edits to the same target within HISTORY_MERGE_MS coalesce into the step
 * they started, so dragging a slider is one undo, not forty (Toolcraft
 * `history: "merge"`).
 */
function pushHistory(
  doc: ImageDoc,
  action: ImageAction,
  before: ImageHistoryEntry
): void {
  const label = HISTORY_LABELS[action.kind];
  if (!label) return;
  const target = "id" in action ? action.id : null;
  const mergeKey = `${label}:${target ?? ""}`;
  const last = doc.history.undo[doc.history.undo.length - 1];
  const now = Date.now();
  doc.history.redo = [];
  if (
    MERGEABLE.has(action.kind) &&
    last &&
    last.label === mergeKey &&
    now - Date.parse(last.at) < HISTORY_MERGE_MS
  ) {
    last.at = new Date(now).toISOString();
    return;
  }
  doc.history.undo.push({ ...before, label: mergeKey });
  if (doc.history.undo.length > MAX_HISTORY) doc.history.undo.shift();
}

function swapHistory(doc: ImageDoc, from: "undo" | "redo"): void {
  const stack = doc.history[from];
  const entry = stack.pop();
  if (!entry) return;
  const other = from === "undo" ? "redo" : "undo";
  doc.history[other].push({
    label: entry.label,
    at: new Date().toISOString(),
    layers: structuredClone(doc.layers),
    selectedLayerId: doc.selectedLayerId,
  });
  if (doc.history[other].length > MAX_HISTORY) doc.history[other].shift();
  doc.layers = canonicalizeLayers(entry.layers);
  doc.selectedLayerId = entry.selectedLayerId;
}

/**
 * Apply one direct-input action. Returns the same doc object, mutated.
 * History is recorded around the mutation so a no-op — an unknown layer id,
 * a rejected group move, a blank text — never burns an undo step.
 */
export function applyImageAction(doc: ImageDoc, action: ImageAction): ImageDoc {
  if (action.kind === "undo" || action.kind === "redo") {
    swapHistory(doc, action.kind);
    return doc;
  }
  const before: ImageHistoryEntry = {
    label: "",
    at: new Date().toISOString(),
    layers: structuredClone(doc.layers),
    selectedLayerId: doc.selectedLayerId,
  };
  applyLayerAction(doc, action);
  if (JSON.stringify(before.layers) !== JSON.stringify(doc.layers)) {
    pushHistory(doc, action, before);
  }
  return doc;
}

function applyLayerAction(doc: ImageDoc, action: ImageAction): ImageDoc {
  if (action.kind === "undo" || action.kind === "redo") return doc;
  if (action.kind === "rename") {
    const title = action.title.trim().slice(0, 120);
    if (title) doc.title = title;
    return doc;
  }
  if (action.kind === "select") {
    doc.selectedLayerId =
      action.id && doc.layers.some((l) => l.id === action.id) ? action.id : null;
    return doc;
  }
  if (action.kind === "set-flat") {
    doc.flatAssetId = action.assetId ? action.assetId.slice(0, 128) : null;
    return doc;
  }
  if (
    action.kind === "add-text" ||
    action.kind === "add-asset" ||
    action.kind === "add-group"
  ) {
    if (doc.layers.length >= MAX_LAYERS) return doc;
    const base = {
      id: newId("l"),
      parentGroupId: null,
      opacity: 100,
      blend: "normal" as BlendMode,
      visible: true,
      transform: { ...IDENTITY_TRANSFORM },
    };
    if (action.kind === "add-text") {
      const text = action.text.trim().slice(0, 500);
      if (!text) return doc;
      insertLayer(
        doc,
        { ...base, kind: "text", text },
        action.parentGroupId ?? null
      );
      return doc;
    }
    if (action.kind === "add-asset") {
      const assetId = action.assetId.trim().slice(0, 128);
      if (!assetId) return doc;
      insertLayer(
        doc,
        { ...base, kind: "asset", assetId },
        action.parentGroupId ?? null
      );
      return doc;
    }
    const name = (action.name ?? "").trim().slice(0, 120);
    insertLayer(
      doc,
      { ...base, kind: "group", collapsed: false, ...(name ? { name } : {}) },
      action.parentGroupId ?? null
    );
    return doc;
  }

  const layer = doc.layers.find((l) => l.id === action.id);
  if (!layer) return doc;
  if (action.kind === "set-text") {
    if (layer.kind === "text") layer.text = action.text.trim().slice(0, 500);
  } else if (action.kind === "set-opacity") {
    if (Number.isFinite(action.opacity)) {
      layer.opacity = clampOpacity(action.opacity);
    }
  } else if (action.kind === "set-blend") {
    layer.blend = action.blend;
  } else if (action.kind === "toggle-visible") {
    layer.visible = !layer.visible;
  } else if (action.kind === "toggle-collapsed") {
    if (layer.kind === "group") layer.collapsed = !layer.collapsed;
  } else if (action.kind === "rename-layer") {
    const name = action.name.trim().slice(0, 120);
    if (name) layer.name = name;
    else delete layer.name;
  } else if (action.kind === "set-transform") {
    layer.transform = clampTransform(layer.transform, action.transform);
  } else if (action.kind === "set-parent") {
    const byId = new Map(doc.layers.map((l) => [l.id, l]));
    const parentId = action.parentGroupId;
    if (parentId === null) {
      layer.parentGroupId = null;
    } else {
      const parent = byId.get(parentId);
      // No cycles, no non-group parents, no depth blowouts (§5.4).
      if (
        parent &&
        parent.kind === "group" &&
        !isSelfOrAncestor(byId, layer.id, parentId) &&
        depthOf(byId, parent) + 1 <= MAX_GROUP_DEPTH
      ) {
        layer.parentGroupId = parentId;
      }
    }
    doc.layers = canonicalizeLayers(doc.layers);
  } else if (action.kind === "move") {
    const run = siblings(doc.layers, layer.parentGroupId);
    const at = run.indexOf(layer);
    placeAt(doc, layer, action.direction === "up" ? at - 1 : at + 1);
  } else if (action.kind === "reorder") {
    if (Number.isFinite(action.index)) {
      placeAt(doc, layer, Math.round(action.index));
    }
  } else if (action.kind === "remove") {
    const at = doc.layers.indexOf(layer);
    doc.layers.splice(at, subtreeEnd(doc.layers, at) - at);
    if (doc.selectedLayerId === layer.id) doc.selectedLayerId = null;
  }
  return doc;
}

/* ------------------------------------------------------------- video docs */

export interface VideoClip {
  id: string;
  /** Box creative-plugin asset id of the source media. */
  assetId: string;
  /** Trim window in seconds; end 0 = to the clip's end. */
  trimStart: number;
  trimEnd: number;
  caption: string;
}

export interface VideoDoc {
  title: string;
  clips: VideoClip[];
  /** Optional box creative-plugin asset id of an audio track. */
  audioAssetId: string | null;
  /** creative_jobs id of the last video_render submission. */
  lastRenderJobId: string | null;
}

export const DEFAULT_VIDEO_DOC: VideoDoc = {
  title: "Untitled video",
  clips: [],
  audioAssetId: null,
  lastRenderJobId: null,
};

export type VideoAction =
  | { kind: "rename"; title: string }
  | { kind: "add-clip"; assetId: string }
  | { kind: "set-trim"; id: string; trimStart: number; trimEnd: number }
  | { kind: "set-caption"; id: string; caption: string }
  | { kind: "set-audio"; assetId: string }
  | { kind: "move"; id: string; direction: "up" | "down" }
  | { kind: "remove"; id: string };

const MAX_CLIPS = 50;

const clampSeconds = (value: number): number =>
  Number.isFinite(value) ? Math.max(0, Math.min(36_000, value)) : 0;

/** Apply one direct-input action. Returns the same doc object, mutated. */
export function applyVideoAction(doc: VideoDoc, action: VideoAction): VideoDoc {
  if (action.kind === "rename") {
    const title = action.title.trim().slice(0, 120);
    if (title) doc.title = title;
    return doc;
  }
  if (action.kind === "add-clip") {
    const assetId = action.assetId.trim().slice(0, 128);
    if (assetId && doc.clips.length < MAX_CLIPS) {
      doc.clips.push({
        id: newId("c"),
        assetId,
        trimStart: 0,
        trimEnd: 0,
        caption: "",
      });
    }
    return doc;
  }
  if (action.kind === "set-audio") {
    const assetId = action.assetId.trim().slice(0, 128);
    doc.audioAssetId = assetId || null;
    return doc;
  }
  const clip = doc.clips.find((c) => c.id === action.id);
  if (!clip) return doc;
  if (action.kind === "set-trim") {
    clip.trimStart = clampSeconds(action.trimStart);
    clip.trimEnd = clampSeconds(action.trimEnd);
    if (clip.trimEnd !== 0 && clip.trimEnd <= clip.trimStart) {
      clip.trimEnd = 0;
    }
  } else if (action.kind === "set-caption") {
    clip.caption = action.caption.trim().slice(0, 200);
  } else if (action.kind === "move") {
    const index = doc.clips.indexOf(clip);
    const target = action.direction === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < doc.clips.length) {
      doc.clips.splice(index, 1);
      doc.clips.splice(target, 0, clip);
    }
  } else if (action.kind === "remove") {
    doc.clips.splice(doc.clips.indexOf(clip), 1);
  }
  return doc;
}

/* ----------------------------------------------------------- box doc I/O */

function docPath(app: "image" | "video", resourceId: string): string {
  return `.hermes/miniapps/${app}/${resourceId}.json`;
}

/** Loose layer shape: hostile doc fields stay unknown and are clamped below. */
const LayerRow = z.object({
  id: z.unknown(),
  kind: z.unknown(),
  name: z.unknown(),
  parentGroupId: z.unknown(),
  collapsed: z.unknown(),
  assetId: z.unknown(),
  text: z.unknown(),
  opacity: z.unknown(),
  blend: z.unknown(),
  visible: z.unknown(),
  transform: z.unknown(),
});

function normalizeLayer(raw: unknown): ImageLayer | null {
  const parsed = LayerRow.safeParse(raw);
  if (!parsed.success) return null;
  const input = parsed.data;
  if (typeof input.id !== "string" || !input.id) return null;
  const kind =
    input.kind === "group" || input.kind === "text" || input.kind === "asset"
      ? input.kind
      : typeof input.text === "string"
        ? "text"
        : "asset";
  const assetId = typeof input.assetId === "string" ? input.assetId : undefined;
  const text = typeof input.text === "string" ? input.text : undefined;
  // A leaf with no payload carries nothing renderable; a group never carries one.
  if (kind === "asset" && !assetId) return null;
  if (kind === "text" && text === undefined) return null;
  const transform =
    typeof input.transform === "object" && input.transform !== null
      ? clampTransform(
          IDENTITY_TRANSFORM,
          input.transform as Partial<LayerTransform>
        )
      : { ...IDENTITY_TRANSFORM };
  const name = typeof input.name === "string" ? input.name.slice(0, 120) : "";
  return {
    id: input.id.slice(0, 64),
    kind,
    ...(name ? { name } : {}),
    parentGroupId:
      typeof input.parentGroupId === "string" && input.parentGroupId
        ? input.parentGroupId
        : null,
    ...(kind === "group" ? { collapsed: input.collapsed === true } : {}),
    ...(kind === "asset" && assetId ? { assetId } : {}),
    ...(kind === "text" && text !== undefined ? { text } : {}),
    opacity:
      typeof input.opacity === "number" && Number.isFinite(input.opacity)
        ? clampOpacity(input.opacity)
        : 100,
    blend:
      typeof input.blend === "string" && isBlendMode(input.blend)
        ? input.blend
        : "normal",
    visible: input.visible !== false,
    transform,
  };
}

const HistoryRow = z.object({
  label: z.unknown(),
  at: z.unknown(),
  layers: z.unknown(),
  selectedLayerId: z.unknown(),
});

function normalizeHistory(raw: unknown): ImageHistoryEntry[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .flatMap((value) => {
      const parsed = HistoryRow.safeParse(value);
      return parsed.success ? [parsed.data] : [];
    })
    .map((entry) => ({
      label: typeof entry.label === "string" ? entry.label.slice(0, 80) : "Edit",
      at:
        typeof entry.at === "string" && !Number.isNaN(Date.parse(entry.at))
          ? entry.at
          : new Date(0).toISOString(),
      layers: canonicalizeLayers(
        (Array.isArray(entry.layers) ? entry.layers : [])
          .map(normalizeLayer)
          .filter((layer): layer is ImageLayer => layer !== null)
          .slice(0, MAX_LAYERS)
      ),
      selectedLayerId:
        typeof entry.selectedLayerId === "string" ? entry.selectedLayerId : null,
    }))
    .slice(-MAX_HISTORY);
}

/**
 * Read-time upgrade to v2 (image.goal.md §5.2). A v1 doc (no schemaVersion)
 * gains root-level parent pointers, identity transforms, and empty history;
 * a hostile doc — one the agent wrote from an injected prompt (C9) — is
 * clamped rather than rejected, so an owner never loses their layer stack to
 * a bad field.
 */
export function normalizeImageDoc(raw: unknown): ImageDoc {
  const doc = raw as Partial<ImageDoc> | null;
  if (!doc || !Array.isArray(doc.layers)) {
    return structuredClone(DEFAULT_IMAGE_DOC);
  }
  const layers = canonicalizeLayers(
    doc.layers
      .map(normalizeLayer)
      .filter((layer): layer is ImageLayer => layer !== null)
      .slice(0, MAX_LAYERS)
  );
  const historyParsed = z
    .object({ undo: z.unknown(), redo: z.unknown() })
    .safeParse(doc.history);
  const history = historyParsed.success ? historyParsed.data : {};
  return {
    schemaVersion: IMAGE_DOC_VERSION,
    title: typeof doc.title === "string" ? doc.title : DEFAULT_IMAGE_DOC.title,
    layers,
    selectedLayerId:
      typeof doc.selectedLayerId === "string" &&
      layers.some((layer) => layer.id === doc.selectedLayerId)
        ? doc.selectedLayerId
        : null,
    flatAssetId: typeof doc.flatAssetId === "string" ? doc.flatAssetId : null,
    history: {
      undo: normalizeHistory(history.undo),
      redo: normalizeHistory(history.redo),
    },
  };
}

function normalizeVideoDoc(raw: unknown): VideoDoc {
  const doc = raw as Partial<VideoDoc> | null;
  if (!doc || !Array.isArray(doc.clips)) {
    return structuredClone(DEFAULT_VIDEO_DOC);
  }
  return {
    title: typeof doc.title === "string" ? doc.title : DEFAULT_VIDEO_DOC.title,
    clips: doc.clips.filter(
      (c): c is VideoClip =>
        typeof c === "object" &&
        c !== null &&
        typeof c.id === "string" &&
        typeof c.assetId === "string"
    ),
    audioAssetId:
      typeof doc.audioAssetId === "string" ? doc.audioAssetId : null,
    lastRenderJobId:
      typeof doc.lastRenderJobId === "string" ? doc.lastRenderJobId : null,
  };
}

async function readDoc(
  supabase: SupabaseClient,
  userId: string,
  app: "image" | "video",
  resourceId: string
): Promise<unknown> {
  try {
    // Failures must propagate — treating them as "no document yet" would let
    // a later write replace the real doc with an empty one. Only a genuinely
    // missing (cat exits non-zero → 404) or unparseable file means no doc.
    const box = await ensureBoxAwake(supabase, userId);
    let raw: string;
    try {
      raw = await readFile(box.boxId, docPath(app, resourceId));
    } catch (error) {
      if (error instanceof BoxApiError && error.status === 404) return null;
      throw error;
    }
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  } finally {
    // ensureBoxAwake nulls stop_after before it can fail; re-arm on every exit.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

async function writeDoc(
  supabase: SupabaseClient,
  userId: string,
  app: "image" | "video",
  resourceId: string,
  doc: ImageDoc | VideoDoc
): Promise<void> {
  try {
    const box = await ensureBoxAwake(supabase, userId);
    await writeFile(
      box.boxId,
      docPath(app, resourceId),
      JSON.stringify(doc, null, 2)
    );
  } finally {
    // ensureBoxAwake nulls stop_after before it can fail; re-arm on every exit.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export async function getImageDoc(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string
): Promise<ImageDoc> {
  return normalizeImageDoc(await readDoc(supabase, userId, "image", resourceId));
}

export async function updateImageDoc(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  action: ImageAction
): Promise<ImageDoc> {
  const doc = await getImageDoc(supabase, userId, resourceId);
  applyImageAction(doc, action);
  await writeDoc(supabase, userId, "image", resourceId, doc);
  return doc;
}

export async function getVideoDoc(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string
): Promise<VideoDoc> {
  return normalizeVideoDoc(await readDoc(supabase, userId, "video", resourceId));
}

export async function updateVideoDoc(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  action: VideoAction
): Promise<VideoDoc> {
  const doc = await getVideoDoc(supabase, userId, resourceId);
  applyVideoAction(doc, action);
  await writeDoc(supabase, userId, "video", resourceId, doc);
  return doc;
}

export async function setVideoRenderJob(
  supabase: SupabaseClient,
  userId: string,
  resourceId: string,
  jobId: string
): Promise<void> {
  const doc = await getVideoDoc(supabase, userId, resourceId);
  doc.lastRenderJobId = jobId;
  await writeDoc(supabase, userId, "video", resourceId, doc);
}
