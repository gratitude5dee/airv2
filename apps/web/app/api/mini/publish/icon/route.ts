/**
 * MA3/MA4 icon lane: mini-app icons (and storefront images) are public R2
 * media under the publisher's prefix — never the private creative pipeline.
 * Owner uploads an image for an owned app; the MA8 guard (allowlist, size,
 * EXIF strip) runs server-side, the object lands at u/<username>/icons/,
 * and the registry row's icon_key points at it. Sessions D–F/G/I consume
 * icon_key via publicUrl() on media.wzrd.tech.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { ownedApp, PublishError } from "@/lib/miniapps/publish";
import {
  ALLOWED_MEDIA_TYPES,
  guardMediaUpload,
  MediaGuardError,
} from "@/lib/storage/guard";
import {
  ensureUserBucket,
  releaseQuota,
  reserveQuota,
} from "@/lib/storage/buckets";
import {
  deleteObject,
  headObject,
  publicUrl,
  putObject,
  r2Configured,
} from "@/lib/storage/r2";
import { recordOpsEvent, uploadRateLimited } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ICON_MAX_BYTES = 1024 * 1024;
const ICON_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json(
      { error: "media storage unavailable" },
      { status: 503 }
    );
  }
  const form = await request.formData().catch(() => null);
  const slug = form?.get("slug");
  const file = form?.get("icon");
  if (typeof slug !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const contentType = file.type.toLowerCase();
  if (!ICON_TYPES.has(contentType)) {
    return NextResponse.json(
      { error: "icon must be png, jpeg, or webp" },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  if (await uploadRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many uploads" }, { status: 429 });
  }
  try {
    const app = await ownedApp(supabase, userId, slug);
    const bytes = guardMediaUpload(Buffer.from(await file.arrayBuffer()), contentType, {
      maxBytes: ICON_MAX_BYTES,
    });
    const bucket = await ensureUserBucket(supabase, userId);
    const key = `${bucket.prefix}icons/${app.slug}.${ALLOWED_MEDIA_TYPES[contentType]}`;
    // The key is deterministic per app, so an upload overwrites. The new
    // icon is reserved in full before the put (same atomic check as every
    // other upload); the bytes it replaces — the object at this key and a
    // stale one under a previous extension — are released only once they
    // are gone, so the row never under-counts what is in R2.
    const hold = await reserveQuota(supabase, userId, bytes.length);
    let reclaimed = 0;
    try {
      const previous = await headObject(key);
      reclaimed = previous?.sizeBytes ?? 0;
      await putObject(key, bytes, contentType);
    } catch (error) {
      await releaseQuota(supabase, hold);
      throw error;
    }
    // From here the new icon is in R2 and its charge stays; only the bytes
    // it demonstrably displaced go back.
    if (app.icon_key && app.icon_key !== key) {
      try {
        const stale = await headObject(app.icon_key);
        if (stale) {
          await deleteObject(app.icon_key);
          reclaimed += stale.sizeBytes;
        }
      } catch (error) {
        if (reclaimed > 0) await releaseQuota(supabase, { userId, bytes: reclaimed });
        throw error;
      }
    }
    if (reclaimed > 0) {
      await releaseQuota(supabase, { userId, bytes: reclaimed });
    }
    const { error } = await supabase
      .from("mini_apps")
      .update({ icon_key: key, updated_at: new Date().toISOString() })
      .eq("id", app.id);
    if (error) throw new Error(`icon update failed: ${error.message}`);
    await recordOpsEvent(supabase, "upload", userId, `icon:${app.slug}`, bytes.length);
    return NextResponse.json({ ok: true, icon_url: publicUrl(key) });
  } catch (error) {
    if (error instanceof MediaGuardError) {
      await recordOpsEvent(supabase, "upload_rejected", userId, error.message);
    }
    if (error instanceof PublishError || error instanceof MediaGuardError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
