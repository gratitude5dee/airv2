/**
 * MA7 creative documents. Image and video editors keep their documents in
 * the user's box at `.hermes/miniapps/<app>/<resource>.json` (C4) — the
 * agent's own tools and the mini-app views read and write the same file.
 * Mutations are pure functions over the parsed doc so the action grammar is
 * testable without a box.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { readFile, writeFile } from "../box/client";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";

/* ------------------------------------------------------------- image docs */

export type BlendMode = "normal" | "multiply" | "screen" | "overlay";

export interface ImageLayer {
  id: string;
  kind: "asset" | "text";
  /** Box creative-plugin asset id for kind 'asset'. */
  assetId?: string;
  /** Text content for kind 'text'. */
  text?: string;
  opacity: number; // 0–100
  blend: BlendMode;
  visible: boolean;
}

export interface ImageDoc {
  title: string;
  layers: ImageLayer[];
  /**
   * Control-plane creative_assets id of the last rendered flat. Generation
   * and flattening go through the existing creative lane (the agent writes
   * this back after a render) — the view only previews and exports it.
   */
  flatAssetId: string | null;
}

export const DEFAULT_IMAGE_DOC: ImageDoc = {
  title: "Untitled image",
  layers: [],
  flatAssetId: null,
};

export type ImageAction =
  | { kind: "rename"; title: string }
  | { kind: "add-text"; text: string }
  | { kind: "add-asset"; assetId: string }
  | { kind: "set-text"; id: string; text: string }
  | { kind: "set-opacity"; id: string; opacity: number }
  | { kind: "set-blend"; id: string; blend: BlendMode }
  | { kind: "toggle-visible"; id: string }
  | { kind: "move"; id: string; direction: "up" | "down" }
  | { kind: "remove"; id: string };

const BLEND_MODES: readonly BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
];

export function isBlendMode(value: string): value is BlendMode {
  return (BLEND_MODES as readonly string[]).includes(value);
}

const MAX_LAYERS = 50;

function newId(prefix: string): string {
  return `${prefix}${Date.now().toString(36)}${Math.floor(Math.random() * 1296)
    .toString(36)
    .padStart(2, "0")}`;
}

const clampOpacity = (value: number): number =>
  Math.max(0, Math.min(100, Math.round(value)));

/** Apply one direct-input action. Returns the same doc object, mutated. */
export function applyImageAction(doc: ImageDoc, action: ImageAction): ImageDoc {
  if (action.kind === "rename") {
    const title = action.title.trim().slice(0, 120);
    if (title) doc.title = title;
    return doc;
  }
  if (action.kind === "add-text") {
    const text = action.text.trim().slice(0, 500);
    if (text && doc.layers.length < MAX_LAYERS) {
      doc.layers.push({
        id: newId("l"),
        kind: "text",
        text,
        opacity: 100,
        blend: "normal",
        visible: true,
      });
    }
    return doc;
  }
  if (action.kind === "add-asset") {
    const assetId = action.assetId.trim().slice(0, 128);
    if (assetId && doc.layers.length < MAX_LAYERS) {
      doc.layers.push({
        id: newId("l"),
        kind: "asset",
        assetId,
        opacity: 100,
        blend: "normal",
        visible: true,
      });
    }
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
  } else if (action.kind === "move") {
    const index = doc.layers.indexOf(layer);
    const target = action.direction === "up" ? index - 1 : index + 1;
    if (target >= 0 && target < doc.layers.length) {
      doc.layers.splice(index, 1);
      doc.layers.splice(target, 0, layer);
    }
  } else if (action.kind === "remove") {
    doc.layers.splice(doc.layers.indexOf(layer), 1);
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

function normalizeImageDoc(raw: unknown): ImageDoc {
  const doc = raw as Partial<ImageDoc> | null;
  if (!doc || !Array.isArray(doc.layers)) {
    return structuredClone(DEFAULT_IMAGE_DOC);
  }
  return {
    title: typeof doc.title === "string" ? doc.title : DEFAULT_IMAGE_DOC.title,
    layers: doc.layers.filter(
      (l): l is ImageLayer =>
        typeof l === "object" && l !== null && typeof l.id === "string"
    ),
    flatAssetId: typeof doc.flatAssetId === "string" ? doc.flatAssetId : null,
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
    // A wake failure must propagate — treating it as "no document yet" would
    // let a later write replace the real doc with an empty one. Only a
    // missing/unparseable file means the document doesn't exist.
    const box = await ensureBoxAwake(supabase, userId);
    try {
      return JSON.parse(await readFile(box.boxId, docPath(app, resourceId)));
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
