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
  addUsage,
  assertWithinQuota,
  ensureUserBucket,
} from "@/lib/storage/buckets";
import { publicUrl, putObject, r2Configured } from "@/lib/storage/r2";

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
  try {
    const app = await ownedApp(supabase, userId, slug);
    const bytes = guardMediaUpload(Buffer.from(await file.arrayBuffer()), contentType, {
      maxBytes: ICON_MAX_BYTES,
    });
    const bucket = await ensureUserBucket(supabase, userId);
    assertWithinQuota(bucket, bytes.length);
    const key = `${bucket.prefix}icons/${app.slug}.${ALLOWED_MEDIA_TYPES[contentType]}`;
    await putObject(key, bytes, contentType);
    await addUsage(supabase, userId, bytes.length);
    const { error } = await supabase
      .from("mini_apps")
      .update({ icon_key: key, updated_at: new Date().toISOString() })
      .eq("id", app.id);
    if (error) throw new Error(`icon update failed: ${error.message}`);
    return NextResponse.json({ ok: true, icon_url: publicUrl(key) });
  } catch (error) {
    if (error instanceof PublishError || error instanceof MediaGuardError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
