/**
 * Identity asset references shared by the onboarding and settings mini-apps
 * (one code path per mutation — the lib/settings/account.ts convention).
 * identity_assets tags existing private creative_assets rows with a role;
 * the bytes stay in the private assets bucket and browsers only ever see
 * short-TTL signed URLs.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  ASSETS_BUCKET,
  DELIVERY_TTL_SECONDS,
} from "../assets/keys";
import {
  revokeDeliveries,
  type CreativeAsset,
} from "../assets/pipeline";
import { ingestUploadedMedia } from "../creative/store";
import { guardMediaUpload, MediaGuardError } from "../storage/guard";
import { heifToJpeg, isHeif } from "./heif";

export const IDENTITY_ROLES = [
  "selfie",
  "character_sheet",
  "character_sheet_draft",
  "avatar",
] as const;
export type IdentityRole = (typeof IDENTITY_ROLES)[number];

/** Confirmed vault references — what galleries, avatar choices, and twin
 * references draw from. Drafts and the avatar pointer are excluded. */
export const VAULT_ROLES: readonly IdentityRole[] = [
  "selfie",
  "character_sheet",
];

export function isVaultRole(role: IdentityRole): boolean {
  return VAULT_ROLES.includes(role);
}

export function isIdentityRole(value: string): value is IdentityRole {
  return (IDENTITY_ROLES as readonly string[]).includes(value);
}

/** Same allowlist and cap class as the icon upload lane. */
export const IDENTITY_IMAGE_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/webp",
]);
export const IDENTITY_IMAGE_MAX_BYTES = 8 * 1024 * 1024;

export interface IdentityAssetRow {
  id: string;
  asset_id: string;
  role: IdentityRole;
  created_at: string;
}

export interface IdentityAssetView extends IdentityAssetRow {
  asset: CreativeAsset;
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
  role: IdentityRole
): Promise<{ ok: true; asset: CreativeAsset } | { ok: false; error: string }> {
  let contentType = file.type.toLowerCase();
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
  let bytes: Buffer;
  try {
    bytes = guardMediaUpload(raw, contentType, {
      maxBytes: IDENTITY_IMAGE_MAX_BYTES,
    });
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
    await tagIdentityAsset(supabase, userId, asset.id, role);
    return { ok: true, asset };
  } catch {
    return { ok: false, error: "upload failed — try again in a minute." };
  }
}

/** Move an owned identity reference from one role to another (used to
 * confirm a character-sheet draft into the vault). */
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
    .select("id");
  if (error || (rows ?? []).length === 0) return false;
  return tagIdentityAsset(supabase, userId, assetId, to);
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
  role: IdentityRole
): Promise<boolean> {
  const { error } = await supabase
    .from("identity_assets")
    .upsert(
      { user_id: userId, asset_id: assetId, role },
      { onConflict: "user_id,asset_id,role", ignoreDuplicates: true }
    );
  return !error;
}

/** All identity references with their creative_assets rows, newest first. */
export async function listIdentityAssets(
  supabase: SupabaseClient,
  userId: string
): Promise<IdentityAssetView[]> {
  const { data: rows } = await supabase
    .from("identity_assets")
    .select("id, asset_id, role, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  const refs = (rows ?? []) as IdentityAssetRow[];
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

/** The current avatar's creative_assets id, if one is set. */
export async function getAvatarAssetId(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("identity_assets")
    .select("asset_id")
    .eq("user_id", userId)
    .eq("role", "avatar")
    .maybeSingle();
  return (data?.asset_id as string | undefined) ?? null;
}

/**
 * Point the user's avatar at an owned creative asset. The asset must already
 * be an identity reference (selfie or character sheet) or the current avatar.
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
    .in("role", ["selfie", "character_sheet", "avatar"])
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
 * the prefix.
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

export interface IdentityMediaView {
  assetId: string;
  role: IdentityRole;
  url: string | null;
}

/** Role-tagged identity images with fresh signed thumbnails (newest first,
 * capped so a big vault never slows a slide render). */
export async function listIdentityMediaViews(
  supabase: SupabaseClient,
  userId: string,
  limit = 12
): Promise<IdentityMediaView[]> {
  try {
    const entries = (await listIdentityAssets(supabase, userId)).slice(0, limit);
    return await Promise.all(
      entries.map(async (entry) => ({
        assetId: entry.asset_id,
        role: entry.role,
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
  limit = 12
): Promise<IdentityMediaView[]> {
  const { data } = await supabase
    .from("identity_assets")
    .select("asset_id, role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Array<{ asset_id: string; role: IdentityRole }>).map(
    (row) => ({ assetId: row.asset_id, role: row.role, url: null })
  );
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
