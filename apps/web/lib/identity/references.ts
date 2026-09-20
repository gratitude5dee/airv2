/**
 * Owner-selected photo references for identity generation. The selected
 * source photos remain private; the only derived artifact is a private
 * contact sheet that lets the current one-image edit backend see every
 * chosen viewpoint at once.
 */
import sharp from "sharp";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CreativeAsset } from "../assets/pipeline";
import { ingestUploadedMedia } from "../creative/store";
import {
  deleteIdentityAsset,
  downloadIdentityAsset,
  listIdentityAssets,
  tagIdentityAsset,
  type IdentityAssetView,
} from "./assets";

export const MIN_IDENTITY_REFERENCES = 1;
export const MAX_IDENTITY_REFERENCES = 6;

interface ReferenceRow {
  asset_id: string;
  position: number;
  created_at: string;
}

export type ReplaceIdentityReferencesResult =
  | { ok: true; assetIds: string[]; referenceSheet: CreativeAsset }
  | { ok: false; error: string };

/** Ordered selected asset ids, without leaking a URL or asset metadata. */
export async function listIdentityReferenceAssetIds(
  supabase: SupabaseClient,
  userId: string
): Promise<string[]> {
  const { data, error } = await supabase
    .from("identity_reference_assets")
    .select("asset_id, position, created_at")
    .eq("user_id", userId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) return [];
  return ((data ?? []) as ReferenceRow[])
    .map((row) => row.asset_id)
    .filter((assetId) => assetId.length > 0);
}

/** Selected, ready selfie records in saved order. Invalid legacy rows are
 * ignored defensively; replacement never writes them. */
export async function listIdentityReferenceAssets(
  supabase: SupabaseClient,
  userId: string
): Promise<IdentityAssetView[]> {
  const [assetIds, entries] = await Promise.all([
    listIdentityReferenceAssetIds(supabase, userId),
    listIdentityAssets(supabase, userId),
  ]);
  const byId = new Map(
    entries
      .filter((entry) => entry.role === "selfie" && entry.status === "ready")
      .map((entry) => [entry.asset_id, entry])
  );
  return assetIds
    .map((assetId) => byId.get(assetId))
    .filter((entry): entry is IdentityAssetView => entry !== undefined);
}

/** The materialized private contact sheet for the owner's selected photos. */
export async function selectedReferenceSheet(
  supabase: SupabaseClient,
  userId: string
): Promise<IdentityAssetView | null> {
  const entries = await listIdentityAssets(supabase, userId);
  return (
    entries.find(
      (entry) => entry.role === "reference_sheet" && entry.status === "ready"
    ) ?? null
  );
}

/**
 * Validate and replace the owner's 1–6 selected selfies. A new contact sheet
 * is created before replacing the old selection, so a failed composition
 * leaves the user's last working reference set intact.
 */
export async function replaceIdentityReferences(
  supabase: SupabaseClient,
  userId: string,
  rawAssetIds: readonly string[]
): Promise<ReplaceIdentityReferencesResult> {
  const assetIds = [...new Set(rawAssetIds.map((id) => id.trim()).filter(Boolean))];
  if (
    assetIds.length < MIN_IDENTITY_REFERENCES ||
    assetIds.length > MAX_IDENTITY_REFERENCES
  ) {
    return {
      ok: false,
      error: `Choose ${MIN_IDENTITY_REFERENCES}–${MAX_IDENTITY_REFERENCES} photos.`,
    };
  }

  const entries = await listIdentityAssets(supabase, userId);
  const byId = new Map(entries.map((entry) => [entry.asset_id, entry]));
  const selected = assetIds.map((assetId) => byId.get(assetId));
  if (
    selected.some(
      (entry) => !entry || entry.role !== "selfie" || entry.status !== "ready"
    )
  ) {
    return {
      ok: false,
      error: "Choose only ready photos from your private gallery.",
    };
  }
  const selfies = selected as IdentityAssetView[];
  const oldSheets = entries.filter((entry) => entry.role === "reference_sheet");

  let referenceSheet: CreativeAsset;
  try {
    referenceSheet = await createReferenceSheet(supabase, userId, selfies);
  } catch {
    return {
      ok: false,
      error: "Couldn't prepare those photos as a reference set — try again.",
    };
  }

  const { error: persisted } = await supabase.rpc(
    "replace_identity_reference_assets",
    { p_user_id: userId, p_asset_ids: assetIds }
  );
  if (persisted) {
    // Content-addressed storage can give an unchanged selection the exact
    // same sheet asset id. It belongs to the previous valid selection, so a
    // failed replacement must not delete it.
    if (!oldSheets.some((sheet) => sheet.asset_id === referenceSheet.id)) {
      await deleteIdentityAsset(supabase, userId, referenceSheet.id).catch(
        () => false
      );
    }
    return { ok: false, error: "Couldn't save your reference selection — try again." };
  }

  // The newly tagged sheet is live before old sheets are removed. These
  // masters are derived from private uploads and are safe to delete fully.
  await Promise.all(
    oldSheets
      .filter((sheet) => sheet.asset_id !== referenceSheet.id)
      .map((sheet) => deleteIdentityAsset(supabase, userId, sheet.asset_id))
  );
  return { ok: true, assetIds, referenceSheet };
}

/** Clear a reference set before deleting its final selected source photo. */
export async function clearIdentityReferences(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const entries = await listIdentityAssets(supabase, userId);
  const sheets = entries.filter((entry) => entry.role === "reference_sheet");
  const { error } = await supabase
    .from("identity_reference_assets")
    .delete()
    .eq("user_id", userId);
  if (error) return false;
  await Promise.all(
    sheets.map((sheet) => deleteIdentityAsset(supabase, userId, sheet.asset_id))
  );
  return true;
}

async function createReferenceSheet(
  supabase: SupabaseClient,
  userId: string,
  selfies: readonly IdentityAssetView[]
): Promise<CreativeAsset> {
  const bytes = await Promise.all(
    selfies.map(async (entry) => {
      const downloaded = await downloadIdentityAsset(supabase, entry.asset);
      if (!downloaded) throw new Error("reference unavailable");
      return downloaded;
    })
  );
  const image = await composeReferenceSheet(bytes);
  const asset = await ingestUploadedMedia(supabase, userId, image, "image/jpeg");
  const tagged = await tagIdentityAsset(supabase, userId, asset.id, "reference_sheet", {
    source: "generated",
    label: "private selected-photo reference sheet",
    position: 0,
  });
  if (!tagged) throw new Error("reference sheet tag failed");
  return asset;
}

/** Exported for deterministic image tests. No source image is written to a
 * browser or public location; Sharp composites the already-private bytes. */
export async function composeReferenceSheet(
  photos: readonly Buffer[]
): Promise<Buffer> {
  if (
    photos.length < MIN_IDENTITY_REFERENCES ||
    photos.length > MAX_IDENTITY_REFERENCES
  ) {
    throw new Error("invalid reference count");
  }
  const cell = 512;
  const columns = photos.length === 1 ? 1 : photos.length <= 4 ? 2 : 3;
  const rows = Math.ceil(photos.length / columns);
  const tiles = await Promise.all(
    photos.map((photo) =>
      sharp(photo)
        .rotate()
        .resize(cell - 8, cell - 8, { fit: "cover", position: "attention" })
        .jpeg({ quality: 88 })
        .toBuffer()
    )
  );
  return sharp({
    create: {
      width: columns * cell,
      height: rows * cell,
      channels: 3,
      background: { r: 18, g: 22, b: 34 },
    },
  })
    .composite(
      tiles.map((input, index) => ({
        input,
        left: (index % columns) * cell + 4,
        top: Math.floor(index / columns) * cell + 4,
      }))
    )
    .jpeg({ quality: 90, chromaSubsampling: "4:4:4" })
    .toBuffer();
}
