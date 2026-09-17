/**
 * V12 §9.2 icons — upload or generate, then one pipeline: MA8 guard (EXIF
 * strip, type + size caps) → 512×512 and 180×180 PNG → R2 under
 * `apps/<slug>/icon/<sha256>.png` (+ `-180`) → `mini_apps.icon_key`.
 *
 * Upload sources: a multipart file, or a path inside the owner's Box
 * workspace (`~/.hermes/create/<appname>/…`, ≤ 8 MiB). Generation runs one
 * image call on the creative lane (`createCreativeJob` + `executeCreativeJob`,
 * metered as `render_cents` like any `/imagine`) pinned to
 * `CREATE_ICON_MODEL`, with a fixed prompt built from the app's name and
 * description. Generations are counted in `ops_events` (kind `upload`, ref
 * `icon_generate:<slug>`); the third is refused so the owner uploads instead.
 * Resizing uses `sharp` when it resolves; otherwise the guarded original is
 * stored once and the result says `resized: false`.
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSETS_BUCKET, contentType as assetContentType } from "../assets/keys";
import { ensureComputeAwake } from "../compute/awake";
import { isBoxEnvironment } from "../compute/environments";
import { runCommand } from "../compute/runtime";
import { createCreativeJob } from "../creative/jobs";
import { executeCreativeJob } from "../creative/run";
import type { RouterPlan } from "../creative/schema";
import type { RegistryApp } from "../miniapps/registry";
import { armStopAfter } from "../orchestrator/boxes";
import { recordOpsEvent } from "../security/limits";
import type { SpectrumSender } from "../spectrum/sender";
import { guardMediaUpload } from "../storage/guard";
import { putObject } from "../storage/r2";
import { WORKSPACE_ROOT } from "./build";
import { createConfig } from "./config";
import type { ThemeName } from "./css";
import { safeArchivePath } from "./kit";
import { ownerThread } from "./plan";

export class IconError extends Error {
  readonly status: number;
  constructor(message: string, status = 400) {
    super(message);
    this.name = "IconError";
    this.status = status;
  }
}

/** §9.2: an icon source (upload or Box file) is at most this large. */
export const ICON_MAX_BYTES = 8 * 1024 * 1024;
export const ICON_SIZE = 512;
export const ICON_SMALL_SIZE = 180;
/** "One regeneration free; the third asks to upload instead." */
export const ICON_GENERATIONS_MAX = 2;
export const ICON_TYPES: ReadonlySet<string> = new Set(["image/png", "image/jpeg", "image/webp"]);
export const ICON_PROMPT_VERSION = "create.icon.v1";
export const ICON_PREVIEW_LINE = "use it, or send your own.";
/** `ops_events.ref` for one generation — `upload` is an admitted kind (0117). */
export const ICON_GENERATE_REF = "icon_generate";

/* ---------------------------------------------------------------- pure */

/** R2 keys for one icon: the 512 key is what `icon_key` stores. */
export function iconKeys(slug: string, sha256: string): { key: string; smallKey: string } {
  return {
    key: `apps/${slug}/icon/${sha256}.png`,
    smallKey: `apps/${slug}/icon/${sha256}-180.png`,
  };
}

export function sha256Hex(bytes: Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

/** Hue words per `air.json.theme`, when the caller has it cheaply; else omitted. */
export const THEME_HUES: Readonly<Record<ThemeName, string>> = {
  atmosphere: "soft atmospheric gradient hues",
  pixel: "bold saturated pixel-art hues",
};

/** §9.2 fixed prompt template. Name and description are the app's own metadata. */
export function iconPrompt(input: { name: string; description: string; theme?: ThemeName | null | undefined }): string {
  const name = input.name.trim().slice(0, 60);
  const description = input.description.trim().replace(/[.\s]+$/, "").slice(0, 160);
  const hue = input.theme ? THEME_HUES[input.theme] : null;
  return (
    `${name}${description ? `: ${description}` : ""}. ` +
    `Flat, single subject, no text, centered, 1:1${hue ? `, ${hue}` : ""}. App icon.`
  );
}

/** A caller-built plan: the routing decision is fixed, so no compile pass runs. */
export function iconPlan(prompt: string): RouterPlan {
  return {
    mode: "imagine",
    needs_input: false,
    chat_reply: "drawing your icon",
    delivery_line: "here is your icon",
    expanded_prompt: prompt,
    params: {
      aspect_ratio: "1:1",
      duration: null,
      generate_audio: false,
      quality: "medium",
      use_input_image_as: "none",
    },
  };
}

/** True while another generation is allowed (`count` already made). */
export function generationAllowed(count: number): boolean {
  return Number.isFinite(count) && count < ICON_GENERATIONS_MAX;
}

const APPNAME_RE = /^[a-z0-9](?:[a-z0-9-]{0,30}[a-z0-9])?$/;
const IMAGE_EXT_RE = /\.(?:png|jpe?g|webp)$/i;

/**
 * Resolve a Box path for an icon file the same way `plan.ts` resolves a
 * plan: workspace-relative or spelled from `~/.hermes/create/<appname>/`;
 * anything that leaves the workspace or is not png/jpeg/webp is refused.
 */
export function iconFilePath(appname: string, rawPath: string): string {
  if (!APPNAME_RE.test(appname)) throw new IconError("invalid appname");
  if (typeof rawPath !== "string" || rawPath.length === 0 || rawPath.length > 512) {
    throw new IconError("invalid path");
  }
  const workspace = `${WORKSPACE_ROOT}/${appname}/`;
  const slashed = rawPath.replace(/\\/g, "/");
  let relative: string;
  const at = slashed.indexOf(workspace);
  if (at >= 0) {
    const head = slashed.slice(0, at);
    if (!/^(?:~\/|\$HOME\/|\/(?:[^/\s]+\/)*|)$/.test(head)) throw new IconError("invalid path");
    relative = slashed.slice(at + workspace.length);
  } else if (slashed.startsWith("/") || slashed.startsWith("~") || slashed.startsWith("$")) {
    throw new IconError("path must be inside the app workspace");
  } else {
    relative = slashed;
  }
  const safe = relative.endsWith("/") ? null : safeArchivePath(relative);
  if (!safe || !IMAGE_EXT_RE.test(safe) || safe.split("/").some((segment) => segment.startsWith("."))) {
    throw new IconError("path must be a png, jpeg or webp file inside the app workspace");
  }
  return `${workspace}${safe}`;
}

/** Content type from magic bytes; null when not png/jpeg/webp. */
export function sniffImageType(bytes: Buffer): string | null {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return "image/png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 12 &&
    bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
    bytes.subarray(8, 12).toString("ascii") === "WEBP"
  ) {
    return "image/webp";
  }
  return null;
}

/* -------------------------------------------------------------- resize */

interface SharpLike {
  (input: Buffer): {
    resize(width: number, height: number, options: { fit: "cover" }): {
      png(): { toBuffer(): Promise<Buffer> };
    };
  };
}

async function loadSharp(): Promise<SharpLike | null> {
  try {
    const mod = (await import("sharp")) as unknown as { default?: SharpLike } | SharpLike;
    const fn = typeof mod === "function" ? mod : (mod as { default?: SharpLike }).default;
    return typeof fn === "function" ? fn : null;
  } catch {
    return null;
  }
}

export interface ResizedIcon {
  /** 512×512 PNG, or the guarded original when resizing is unavailable. */
  icon: Buffer;
  /** 180×180 PNG; null when resizing is unavailable. */
  small: Buffer | null;
  resized: boolean;
}

/** Cover-fit to 512 and 180 PNG through `sharp` when it resolves. */
export async function resizeIcon(bytes: Buffer, sharpLoader: () => Promise<SharpLike | null> = loadSharp): Promise<ResizedIcon> {
  const sharp = await sharpLoader();
  if (!sharp) return { icon: bytes, small: null, resized: false };
  try {
    const [icon, small] = await Promise.all([
      sharp(bytes).resize(ICON_SIZE, ICON_SIZE, { fit: "cover" }).png().toBuffer(),
      sharp(bytes).resize(ICON_SMALL_SIZE, ICON_SMALL_SIZE, { fit: "cover" }).png().toBuffer(),
    ]);
    return { icon, small, resized: true };
  } catch {
    throw new IconError("that image could not be decoded", 422);
  }
}

/* --------------------------------------------------------------- store */

export interface StoredIcon {
  icon_key: string;
  resized: boolean;
}

/**
 * Guard → resize → R2 → `icon_key`. The key is content-addressed, so a
 * re-upload of the same bytes overwrites the same object. The row's
 * `icon_key` is the 512 key; the 180 variant sits beside it.
 */
export async function storeIcon(
  supabase: SupabaseClient,
  app: Pick<RegistryApp, "id" | "slug" | "owner_user_id">,
  bytes: Buffer,
  contentType: string,
  options: { resize?: ((bytes: Buffer) => Promise<ResizedIcon>) | undefined } = {}
): Promise<StoredIcon> {
  const type = contentType.toLowerCase().trim();
  if (!ICON_TYPES.has(type)) throw new IconError("icon must be png, jpeg, or webp");
  const guarded = guardMediaUpload(bytes, type, { maxBytes: ICON_MAX_BYTES });
  const resized = await (options.resize ?? resizeIcon)(guarded);
  const digest = sha256Hex(resized.icon);
  const keys = iconKeys(app.slug, digest);
  await putObject(keys.key, resized.icon, resized.resized ? "image/png" : type);
  if (resized.small) await putObject(keys.smallKey, resized.small, "image/png");
  const { error } = await supabase
    .from("mini_apps")
    .update({ icon_key: keys.key, updated_at: new Date().toISOString() })
    .eq("id", app.id);
  if (error) throw new IconError("icon update failed", 502);
  await recordOpsEvent(supabase, "upload", app.owner_user_id, `icon:${app.slug}`, resized.icon.length);
  return { icon_key: keys.key, resized: resized.resized };
}

/* ---------------------------------------------------------------- box */

/**
 * Read an image out of the owner's Box (≤ 8 MiB) as bytes. `cat` through
 * the command lane is text-shaped, so the file travels base64 — the same
 * trick `pullWorkspace` uses for its tarball.
 */
export async function readBoxIcon(
  supabase: SupabaseClient,
  userId: string,
  appname: string,
  rawPath: string
): Promise<{ bytes: Buffer; contentType: string }> {
  const path = iconFilePath(appname, rawPath);
  const target = await ensureComputeAwake(supabase, userId);
  try {
    const cap = ICON_MAX_BYTES + 1;
    const result = await runCommand(
      target,
      `test -f "$HOME/${path}" || exit 3; head -c ${cap} "$HOME/${path}" | base64 -w0`,
      30
    );
    if (result.exitCode === 3) throw new IconError("icon file not found", 404);
    if (result.exitCode !== 0) throw new IconError("could not read the icon file", 502);
    const bytes = Buffer.from(result.stdout.trim(), "base64");
    if (bytes.length === 0) throw new IconError("the icon file is empty", 422);
    if (bytes.length >= cap) throw new IconError("icon is larger than 8 MiB", 413);
    const type = sniffImageType(bytes);
    if (!type) throw new IconError("icon must be png, jpeg, or webp", 415);
    return { bytes, contentType: type };
  } finally {
    if (isBoxEnvironment(target.environment)) {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }
}

/* ------------------------------------------------------------ generate */

/** Generations already made for this app (any time), from the ops ledger. */
export async function countIconGenerations(supabase: SupabaseClient, userId: string, slug: string): Promise<number> {
  const { count, error } = await supabase
    .from("ops_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", "upload")
    .eq("user_id", userId)
    .eq("ref", `${ICON_GENERATE_REF}:${slug}`);
  if (error) throw new IconError("could not count generations; try again", 503);
  return count ?? 0;
}

export interface GeneratedIcon {
  bytes: Buffer;
  contentType: string;
}

/**
 * One metered image render on the creative lane, pinned to
 * `CREATE_ICON_MODEL`. The prompt never lands on the job row (C4); the
 * generation is counted in `ops_events` before the render so a failed call
 * still spends one of the two free tries.
 */
export async function generateIcon(
  supabase: SupabaseClient,
  userId: string,
  app: Pick<RegistryApp, "slug" | "name" | "description">,
  options: { theme?: ThemeName | null | undefined; channel?: "web" | "imessage" | undefined } = {}
): Promise<GeneratedIcon> {
  await recordOpsEvent(supabase, "upload", userId, `${ICON_GENERATE_REF}:${app.slug}`);
  const prompt = iconPrompt({ name: app.name, description: app.description, theme: options.theme });
  const job = await createCreativeJob(supabase, userId, options.channel ?? "web", "imagine");
  const result = await executeCreativeJob(
    supabase,
    job.id,
    userId,
    { mode: "imagine", cleanedText: prompt, text: prompt, mediaInputs: [] },
    { plan: iconPlan(prompt), promptVersion: ICON_PROMPT_VERSION, model: createConfig.iconModel() }
  );
  if (result.status !== "delivered" || !result.asset) {
    throw new IconError(result.line || "icon generation failed", result.status === "refused" ? 422 : 502);
  }
  const download = await supabase.storage.from(ASSETS_BUCKET).download(result.asset.storage_key);
  if (download.error || !download.data) throw new IconError("generated icon could not be read", 502);
  const bytes = Buffer.from(await download.data.arrayBuffer());
  const type = sniffImageType(bytes) ?? assetContentType(result.asset.ext);
  if (!ICON_TYPES.has(type)) throw new IconError("generated icon is not png, jpeg or webp", 502);
  return { bytes, contentType: type };
}

/** §9.2: the preview goes back to the owner's thread with one line. Best-effort. */
export async function sendIconPreview(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  userId: string,
  appname: string,
  icon: Buffer
): Promise<boolean> {
  const thread = await ownerThread(supabase, userId);
  if (!thread) return false;
  await sender.sendAttachment(thread.spaceId, thread.phone, icon, {
    name: `${appname}-icon.png`,
    mimeType: "image/png",
  });
  await sender.sendText(thread.spaceId, thread.phone, ICON_PREVIEW_LINE);
  return true;
}
