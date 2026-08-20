/**
 * MA4/MA8 public export: publishing a creative flat or render to a durable
 * public URL goes through the shared media lane — the MA8 guard (allowlist,
 * size cap, EXIF strip), the per-user bucket quota, and the user's public
 * R2 prefix — never a second storage path. Bytes come from the asset's
 * existing creative-assets storage copy; the caller owns the asset row
 * (scoped by user_id).
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ASSETS_BUCKET } from "@/lib/assets/keys";
import type { CreativeAsset } from "@/lib/assets/pipeline";
import {
  ALLOWED_MEDIA_TYPES,
  guardMediaUpload,
  MediaGuardError,
} from "@/lib/storage/guard";
import {
  addUsage,
  assertWithinQuota,
  ensureUserBucket,
} from "@/lib/storage/buckets";
import { publicUrl, putObject, r2Configured } from "@/lib/storage/r2";

export interface PublicExportResult {
  ok: boolean;
  /** Durable public URL when ok. */
  url: string | null;
  /** Honest user-facing line when not ok. */
  line: string;
}

export interface PublicExporter {
  publishAsset(
    supabase: SupabaseClient,
    userId: string,
    assetId: string
  ): Promise<PublicExportResult>;
}

function contentTypeForExt(ext: string): string | null {
  const normalized = ext.toLowerCase().trim();
  for (const [type, typeExt] of Object.entries(ALLOWED_MEDIA_TYPES)) {
    if (typeExt === normalized || (normalized === "jpeg" && typeExt === "jpg")) {
      return type;
    }
  }
  return null;
}

function unavailable(line: string): PublicExportResult {
  return { ok: false, url: null, line };
}

export const publicExporter: PublicExporter = {
  async publishAsset(
    supabase: SupabaseClient,
    userId: string,
    assetId: string
  ): Promise<PublicExportResult> {
    if (!r2Configured()) {
      return unavailable(
        "public media storage isn't configured — use a private link for now."
      );
    }
    const { data } = await supabase
      .from("creative_assets")
      .select("*")
      .eq("id", assetId)
      .eq("user_id", userId)
      .maybeSingle();
    const asset = (data as CreativeAsset | null) ?? null;
    if (!asset) {
      return unavailable("asset not found — render a flat before exporting.");
    }
    const contentType = contentTypeForExt(asset.ext);
    if (!contentType) {
      return unavailable(
        `.${asset.ext} files can't be published to the public lane.`
      );
    }
    const download = await supabase.storage
      .from(ASSETS_BUCKET)
      .download(asset.storage_key);
    if (download.error || !download.data) {
      return unavailable("couldn't read the rendered file — try re-rendering.");
    }
    const raw = Buffer.from(await download.data.arrayBuffer());
    try {
      const bucket = await ensureUserBucket(supabase, userId);
      const bytes = guardMediaUpload(raw, contentType);
      assertWithinQuota(bucket, bytes.length);
      const key = `${bucket.prefix}media/${randomBytes(6).toString("hex")}-${asset.id}.${asset.ext}`;
      await putObject(key, bytes, contentType);
      await addUsage(supabase, userId, bytes.length);
      const url = publicUrl(key);
      return { ok: true, url, line: `public link: ${url}` };
    } catch (error) {
      if (error instanceof MediaGuardError) {
        return unavailable(error.message);
      }
      throw error;
    }
  },
};
