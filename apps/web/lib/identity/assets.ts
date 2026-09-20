/**
 * Identity asset references shared by the onboarding and settings mini-apps
 * and the @username resolver (one code path per mutation — the
 * lib/settings/account.ts convention). identity_assets tags existing
 * private creative_assets rows with a role plus ordering, source, status and
 * the consent grant they were added under (0061, 0062, 0121); the bytes
 * stay in the private assets bucket and browsers only ever see short-TTL
 * signed URLs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSETS_BUCKET, DELIVERY_TTL_SECONDS } from "../assets/keys";
import { revokeDeliveries, type CreativeAsset } from "../assets/pipeline";
import { ingestUploadedMedia } from "../creative/store";
import { guardMediaUpload, MediaGuardError } from "../storage/guard";
import { heifToJpeg, isHeif } from "./heif";

export const IDENTITY_ROLES = [
  "selfie",
  "character_sheet",
  "character_sheet_draft",
  "avatar",
  "profile_image",
  "profile_image_draft",
  "alt_image",
  "reference_video",
  "voice_sample",
  "consent_recording",
] as const;
export type IdentityRole = (typeof IDENTITY_ROLES)[number];

/** Confirmed image references — what galleries, avatar choices, and twin
 * references draw from. Drafts and the avatar pointer are excluded. */
export const VAULT_ROLES: readonly IdentityRole[] = [
  "selfie",
  "character_sheet",
  "profile_image",
  "alt_image",
];

/** Roles that hold an image, a video clip, or an audio clip. */
export const IMAGE_ROLES: readonly IdentityRole[] = [
  "selfie",
  "character_sheet",
  "character_sheet_draft",
  "avatar",
  "profile_image",
  "profile_image_draft",
  "alt_image",
];
export const VIDEO_ROLES: readonly IdentityRole[] = [
  "reference_video",
  "consent_recording",
];
export const AUDIO_ROLES: readonly IdentityRole[] = ["voice_sample"];

export type IdentityMediaKind = "image" | "video" | "audio";

export function mediaKindForRole(role: IdentityRole): IdentityMediaKind {
  if (VIDEO_ROLES.includes(role)) return "video";
  if (AUDIO_ROLES.includes(role)) return "audio";
  return "image";
}

export function isVaultRole(role: IdentityRole): boolean {
  return VAULT_ROLES.includes(role);
}

export function isIdentityRole(value: string): value is IdentityRole {
  return (IDENTITY_ROLES as readonly string[]).includes(value);
}

export type IdentitySource = "upload" | "booth" | "generated";
export type IdentityAssetStatus = "ready" | "processing" | "failed";

/** Same allowlist and cap class as the icon upload lane. */
export const IDENTITY_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
export const IDENTITY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;
/** Reference clips and consent recordings (same caps as the twin consent). */
export const IDENTITY_VIDEO_TYPES = new Set(["video/mp4", "video/webm"]);
export const IDENTITY_VIDEO_MAX_BYTES = 50 * 1024 * 1024;
/** Voice samples: what iPhone/Safari and Chromium recorders and voice-memo
 * exports actually produce. `x-` variants normalise to their base type. */
export const IDENTITY_AUDIO_TYPES = new Set([
  "audio/mpeg",
  "audio/mp4",
  "audio/wav",
  "audio/ogg",
  "audio/webm",
]);
export const IDENTITY_AUDIO_MAX_BYTES = 25 * 1024 * 1024;
/** Newest-first cap on a single voice-clone request. */
export const MAX_VOICE_SAMPLES = 5;

export interface IdentityAssetRow {
  id: string;
  asset_id: string;
  role: IdentityRole;
  position: number;
  source: IdentitySource;
  status: IdentityAssetStatus;
  consent_id: string | null;
  label: string | null;
  provider_ref: string | null;
  created_at: string;
}

export interface IdentityAssetView extends IdentityAssetRow {
  asset: CreativeAsset;
}

export interface IdentityTagMeta {
  source?: IdentitySource | undefined;
  consentId?: string | null | undefined;
  status?: IdentityAssetStatus | undefined;
  label?: string | null | undefined;
  providerRef?: string | null | undefined;
  position?: number | undefined;
}

const ROW_COLUMNS =
  "id, asset_id, role, position, source, status, consent_id, label, provider_ref, created_at";

/** Codec parameters stripped, vendor prefixes folded onto the base type. */
export function normalizeMediaType(raw: string): string {
  const base = raw.split(";")[0]?.trim().toLowerCase() ?? "";
  if (base === "audio/x-m4a" || base === "audio/m4a") return "audio/mp4";
  if (base === "audio/x-wav" || base === "audio/wave") return "audio/wav";
  return base;
}

/**
 * Validate and store one owner-uploaded identity image: media guard
 * (type allowlist, size cap, EXIF strip) → content-addressed private
 * asset → role tag.
 */
export async function uploadIdentityImage(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  role: IdentityRole,
  meta: IdentityTagMeta = {}
): Promise<{ ok: true; asset: CreativeAsset } | { ok: false; error: string }> {
  let contentType = normalizeMediaType(file.type);
  let raw: Buffer = Buffer.from(await file.arrayBuffer());
  // iPhone photos arrive as HEIC — convert once at ingest so the vault and
  // the image-generation lane only ever see plain JPEGs.
  if (isHeif(contentType, raw)) {
    if (raw.length > IDENTITY_IMAGE_MAX_BYTES) {
      return { ok: false, error: "image is too large — 8 MB max." };
    }
    try {
      raw = await heifToJpeg(raw);
      contentType = "image/jpeg";
    } catch {
      return {
        ok: false,
        error: "couldn't read that HEIC image — export it as JPEG and retry.",
      };
    }
  }
  if (!IDENTITY_IMAGE_TYPES.has(contentType)) {
    return { ok: false, error: "image must be png, jpeg, webp, or heic." };
  }
  return storeGuarded(supabase, userId, raw, contentType, role, {
    maxBytes: IDENTITY_IMAGE_MAX_BYTES,
    meta,
  });
}

/**
 * Validate and store one owner-uploaded identity clip or voice sample
 * through the same guarded private path as images.
 */
export async function uploadIdentityMedia(
  supabase: SupabaseClient,
  userId: string,
  file: File,
  role: IdentityRole,
  meta: IdentityTagMeta = {}
): Promise<{ ok: true; asset: CreativeAsset } | { ok: false; error: string }> {
  const kind = mediaKindForRole(role);
  if (kind === "image") {
    return uploadIdentityImage(supabase, userId, file, role, meta);
  }
  const contentType = normalizeMediaType(file.type);
  if (kind === "video" && !IDENTITY_VIDEO_TYPES.has(contentType)) {
    return { ok: false, error: "video must be an mp4 or webm clip." };
  }
  if (kind === "audio" && !IDENTITY_AUDIO_TYPES.has(contentType)) {
    return {
      ok: false,
      error: "audio must be mp3, m4a, wav, ogg, or a browser recording.",
    };
  }
  const raw = Buffer.from(await file.arrayBuffer());
  return storeGuarded(supabase, userId, raw, contentType, role, {
    maxBytes: kind === "video" ? IDENTITY_VIDEO_MAX_BYTES : IDENTITY_AUDIO_MAX_BYTES,
    meta,
  });
}

async function storeGuarded(
  supabase: SupabaseClient,
  userId: string,
  raw: Buffer,
  contentType: string,
  role: IdentityRole,
  opts: { maxBytes: number; meta: IdentityTagMeta }
): Promise<{ ok: true; asset: CreativeAsset } | { ok: false; error: string }> {
  let bytes: Buffer;
  try {
    bytes = guardMediaUpload(raw, contentType, { maxBytes: opts.maxBytes });
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof MediaGuardError
          ? error.message
          : "that upload didn't pass validation.",
    };
  }
  try {
    const asset = await ingestUploadedMedia(supabase, userId, bytes, contentType);
    const position =
      opts.meta.position ?? (await nextPosition(supabase, userId, role));
    await tagIdentityAsset(supabase, userId, asset.id, role, {
      ...opts.meta,
      position,
    });
    return { ok: true, asset };
  } catch {
    return { ok: false, error: "upload failed — try again in a minute." };
  }
}

/** Appends after the current last item of the role's media kind. */
async function nextPosition(
  supabase: SupabaseClient,
  userId: string,
  role: IdentityRole
): Promise<number> {
  const { data } = await supabase
    .from("identity_assets")
    .select("position")
    .eq("user_id", userId)
    .eq("role", role)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  const last = (data as { position?: number } | null)?.position;
  return typeof last === "number" ? last + 1 : 0;
}

/** Move an owned identity reference from one role to another (used to
 * confirm a draft into the vault). Carries the row's metadata across. */
export async function retagIdentityAsset(
  supabase: SupabaseClient,
  userId: string,
  assetId: string,
  from: IdentityRole,
  to: IdentityRole
): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from("identity_assets")
    .delete()
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .eq("role", from)
    .select(ROW_COLUMNS);
  const removed = ((rows ?? []) as IdentityAssetRow[])[0];
  if (error || !removed) return false;
  return tagIdentityAsset(supabase, userId, assetId, to, {
    source: removed.source,
    consentId: removed.consent_id,
    status: removed.status,
    label: removed.label,
    providerRef: removed.provider_ref,
    position: removed.position,
  });
}

/** Drop one identity role from an asset, leaving other roles intact. */
export async function untagIdentityAsset(
  supabase: SupabaseClient,
  userId: string,
  assetId: string,
  role: IdentityRole
): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from("identity_assets")
    .delete()
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .eq("role", role)
    .select("id");
  return !error && (rows ?? []).length > 0;
}

/** Tag an owned creative asset with an identity role (idempotent). */
export async function tagIdentityAsset(
  supabase: SupabaseClient,
  userId: string,
  assetId: string,
  role: IdentityRole,
  meta: IdentityTagMeta = {}
): Promise<boolean> {
  const { error } = await supabase.from("identity_assets").upsert(
    {
      user_id: userId,
      asset_id: assetId,
      role,
      ...(meta.source !== undefined ? { source: meta.source } : {}),
      ...(meta.consentId !== undefined ? { consent_id: meta.consentId } : {}),
      ...(meta.status !== undefined ? { status: meta.status } : {}),
      ...(meta.label !== undefined ? { label: meta.label } : {}),
      ...(meta.providerRef !== undefined
        ? { provider_ref: meta.providerRef }
        : {}),
      ...(meta.position !== undefined ? { position: meta.position } : {}),
    },
    { onConflict: "user_id,asset_id,role", ignoreDuplicates: true }
  );
  return !error;
}

/** Update the processing status (and optional provider handle) of a tag. */
export async function setIdentityAssetStatus(
  supabase: SupabaseClient,
  userId: string,
  assetId: string,
  role: IdentityRole,
  status: IdentityAssetStatus,
  providerRef?: string | null
): Promise<boolean> {
  const { error } = await supabase
    .from("identity_assets")
    .update({
      status,
      ...(providerRef !== undefined ? { provider_ref: providerRef } : {}),
    })
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .eq("role", role);
  return !error;
}

/**
 * Move one reference up or down within its role's list. Positions are
 * rewritten sequentially so a list with gaps or ties settles into order.
 */
export async function reorderIdentityAsset(
  supabase: SupabaseClient,
  userId: string,
  assetId: string,
  role: IdentityRole,
  direction: "up" | "down"
): Promise<boolean> {
  const { data } = await supabase
    .from("identity_assets")
    .select("id, asset_id, position, created_at")
    .eq("user_id", userId)
    .eq("role", role)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  const rows = (data ?? []) as Array<{ id: string; asset_id: string }>;
  const index = rows.findIndex((row) => row.asset_id === assetId);
  if (index === -1) return false;
  const target = direction === "up" ? index - 1 : index + 1;
  if (target < 0 || target >= rows.length) return true;
  const current = rows[index];
  const other = rows[target];
  if (!current || !other) return false;
  rows[index] = other;
  rows[target] = current;
  for (const [position, row] of rows.entries()) {
    const { error } = await supabase
      .from("identity_assets")
      .update({ position })
      .eq("id", row.id)
      .eq("user_id", userId);
    if (error) return false;
  }
  return true;
}

/** All identity references with their creative_assets rows, in list order
 * (position, then newest first). */
export async function listIdentityAssets(
  supabase: SupabaseClient,
  userId: string
): Promise<IdentityAssetView[]> {
  const { data: rows } = await supabase
    .from("identity_assets")
    .select(ROW_COLUMNS)
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false });
  const refs = ((rows ?? []) as Partial<IdentityAssetRow>[]).map(normalizeRow);
  if (refs.length === 0) return [];
  const { data: assets } = await supabase
    .from("creative_assets")
    .select("*")
    .eq("user_id", userId)
    .in(
      "id",
      refs.map((row) => row.asset_id)
    );
  const byId = new Map(
    ((assets ?? []) as CreativeAsset[]).map((asset) => [asset.id, asset])
  );
  const views: IdentityAssetView[] = [];
  for (const row of refs) {
    const asset = byId.get(row.asset_id);
    if (asset) views.push({ ...row, asset });
  }
  return views;
}

/** Rows written before 0121 (or by older mocks) lack the new columns. */
function normalizeRow(row: Partial<IdentityAssetRow>): IdentityAssetRow {
  return {
    id: row.id ?? "",
    asset_id: row.asset_id ?? "",
    role: row.role ?? "selfie",
    position: typeof row.position === "number" ? row.position : 0,
    source: row.source ?? "upload",
    status: row.status ?? "ready",
    consent_id: row.consent_id ?? null,
    label: row.label ?? null,
    provider_ref: row.provider_ref ?? null,
    created_at: row.created_at ?? "",
  };
}

/** The current avatar's creative_assets id, if one is set. */
export async function getAvatarAssetId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  return roleAssetId(supabase, userId, "avatar");
}

/** The approved profile image's creative_assets id, if one exists. */
export async function getProfileImageAssetId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  return roleAssetId(supabase, userId, "profile_image");
}

async function roleAssetId(
  supabase: SupabaseClient,
  userId: string,
  role: IdentityRole
): Promise<string | null> {
  const { data } = await supabase
    .from("identity_assets")
    .select("asset_id")
    .eq("user_id", userId)
    .eq("role", role)
    .maybeSingle();
  return (data?.asset_id as string | undefined) ?? null;
}

/**
 * Point the user's avatar at an owned creative asset. The asset must already
 * be a confirmed identity image or the current avatar.
 */
export async function setAvatarAssetId(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  const { data: owned } = await supabase
    .from("identity_assets")
    .select("id")
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .in("role", [...VAULT_ROLES, "avatar"])
    .limit(1)
    .maybeSingle();
  if (!owned) return false;
  const { error: cleared } = await supabase
    .from("identity_assets")
    .delete()
    .eq("user_id", userId)
    .eq("role", "avatar");
  if (cleared) return false;
  const { error } = await supabase
    .from("identity_assets")
    .insert({ user_id: userId, asset_id: assetId, role: "avatar" });
  return !error;
}

/**
 * Remove all identity references to an owned asset and revoke its live
 * delivery URLs (the /api/assets/[id] pattern). The private master object
 * stays content-addressed under the user's prefix; account deletion removes
 * the prefix. deleteIdentityAsset goes one step further for uploads.
 */
export async function removeIdentityAsset(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  const { data: rows, error } = await supabase
    .from("identity_assets")
    .delete()
    .eq("user_id", userId)
    .eq("asset_id", assetId)
    .select("id");
  if (error || (rows ?? []).length === 0) return false;
  await revokeDeliveries(supabase, userId, assetId).catch(() => 0);
  return true;
}

/**
 * The owner's delete: drop every identity reference, revoke deliveries, and
 * — when the bytes were an owner upload (never a paid render, which other
 * ledgers reference) — remove the private master object and its
 * creative_assets row too, so "delete" means the original is gone.
 */
export async function deleteIdentityAsset(
  supabase: SupabaseClient,
  userId: string,
  assetId: string
): Promise<boolean> {
  const { data: asset } = await supabase
    .from("creative_assets")
    .select("id, box_asset_id, storage_key")
    .eq("user_id", userId)
    .eq("id", assetId)
    .maybeSingle();
  const removed = await removeIdentityAsset(supabase, userId, assetId);
  if (!removed || !asset) return removed;
  const origin = String((asset as { box_asset_id?: unknown }).box_asset_id ?? "");
  if (!origin.startsWith("upload:")) return true;
  const storageKey = String((asset as { storage_key?: unknown }).storage_key ?? "");
  if (storageKey) {
    await supabase.storage
      .from(ASSETS_BUCKET)
      .remove([storageKey])
      .catch(() => undefined);
  }
  // Best-effort: a row another ledger still points at stays (FK), and the
  // object is already gone — the reference is dead either way.
  await supabase
    .from("creative_assets")
    .delete()
    .eq("user_id", userId)
    .eq("id", assetId);
  return true;
}

export interface IdentityMediaView {
  assetId: string;
  role: IdentityRole;
  kind: IdentityMediaKind;
  url: string | null;
  position: number;
  source: IdentitySource;
  status: IdentityAssetStatus;
  label: string | null;
  createdAt: string;
}

/** Role-tagged identity media with fresh signed URLs (list order, capped so
 * a big vault never slows a slide render). */
export async function listIdentityMediaViews(
  supabase: SupabaseClient,
  userId: string,
  limit = 24
): Promise<IdentityMediaView[]> {
  try {
    const entries = (await listIdentityAssets(supabase, userId)).slice(0, limit);
    return await Promise.all(
      entries.map(async (entry) => ({
        ...viewOf(entry),
        url: await signedIdentityUrl(supabase, entry.asset).catch(() => null),
      }))
    );
  } catch {
    return [];
  }
}

/**
 * The same views without the creative_assets join or the signed URLs — one
 * indexed read. Enough for "does a selfie exist?" / "which asset is the
 * avatar?"; a caller that renders thumbnails wants listIdentityMediaViews.
 */
export async function listIdentityMediaRoles(
  supabase: SupabaseClient,
  userId: string,
  limit = 24
): Promise<IdentityMediaView[]> {
  const { data } = await supabase
    .from("identity_assets")
    .select(ROW_COLUMNS)
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Partial<IdentityAssetRow>[]).map((row) => ({
    ...viewOf(normalizeRow(row)),
    url: null,
  }));
}

function viewOf(row: IdentityAssetRow): IdentityMediaView {
  return {
    assetId: row.asset_id,
    role: row.role,
    kind: mediaKindForRole(row.role),
    url: null,
    position: row.position,
    source: row.source,
    status: row.status,
    label: row.label,
    createdAt: row.created_at,
  };
}

/** Short-TTL signed URL for one identity asset's private object. */
export async function signedIdentityUrl(
  supabase: SupabaseClient,
  asset: CreativeAsset
): Promise<string | null> {
  const signed = await supabase.storage
    .from(ASSETS_BUCKET)
    .createSignedUrl(asset.storage_key, DELIVERY_TTL_SECONDS);
  return signed.data?.signedUrl ?? null;
}

/** Download an owned identity asset's bytes (voice samples for cloning). */
export async function downloadIdentityAsset(
  supabase: SupabaseClient,
  asset: CreativeAsset
): Promise<Buffer | null> {
  const download = await supabase.storage
    .from(ASSETS_BUCKET)
    .download(asset.storage_key);
  if (download.error || !download.data) return null;
  return Buffer.from(await download.data.arrayBuffer());
}
