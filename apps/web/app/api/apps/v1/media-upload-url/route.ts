/**
 * Apps API (MA3/MA4): GET a presigned PUT into the session user's public
 * prefix. Owner sessions only; the declared content type must pass the MA8
 * allowlist and the declared size is pre-charged against the user's quota
 * (POST confirms the upload afterwards: HEAD the object, reconcile usage to
 * the actual size, delete on violation). R2 credentials never appear here —
 * only a time-boxed signed URL.
 */
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { appsApiSession } from "@/lib/miniapps/appsApi";
import {
  allowedMediaType,
  MEDIA_MAX_BYTES,
  MediaGuardError,
} from "@/lib/storage/guard";
import {
  addUsage,
  assertWithinQuota,
  ensureUserBucket,
} from "@/lib/storage/buckets";
import {
  deleteObject,
  headObject,
  presignPut,
  publicUrl,
  r2Configured,
} from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await appsApiSession(request, supabase);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (auth.session.role !== "owner") {
    return NextResponse.json(
      { error: "guests cannot upload media" },
      { status: 403 }
    );
  }
  if (!r2Configured()) {
    return NextResponse.json(
      { error: "media storage unavailable" },
      { status: 503 }
    );
  }
  const contentType = (
    request.nextUrl.searchParams.get("contentType") ?? ""
  ).toLowerCase();
  const sizeBytes = Number(request.nextUrl.searchParams.get("sizeBytes") ?? "0");
  if (!allowedMediaType(contentType)) {
    return NextResponse.json({ error: "content type not allowed" }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MEDIA_MAX_BYTES) {
    return NextResponse.json({ error: "invalid size" }, { status: 400 });
  }
  try {
    const bucket = await ensureUserBucket(supabase, auth.session.userId);
    assertWithinQuota(bucket, sizeBytes);
    const key = `${bucket.prefix}apps/${auth.app.slug}/${randomBytes(8).toString("hex")}`;
    await addUsage(supabase, auth.session.userId, sizeBytes);
    return NextResponse.json({
      uploadUrl: presignPut(key, contentType, 600),
      key,
      publicUrl: publicUrl(key),
      declaredBytes: sizeBytes,
    });
  } catch (error) {
    if (error instanceof MediaGuardError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await appsApiSession(request, supabase);
  if (!auth || auth.session.role !== "owner") {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    key?: string;
    declaredBytes?: number;
  };
  const key = body.key ?? "";
  const declared = Number(body.declaredBytes ?? 0);
  const bucket = await ensureUserBucket(supabase, auth.session.userId);
  // The key must live under this user's prefix and this app's folder.
  if (!key.startsWith(`${bucket.prefix}apps/${auth.app.slug}/`)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }
  const head = await headObject(key);
  if (!head) {
    // Never uploaded: release the pre-charge.
    await addUsage(supabase, auth.session.userId, -declared);
    return NextResponse.json({ error: "object not found" }, { status: 404 });
  }
  if (head.sizeBytes > MEDIA_MAX_BYTES || !allowedMediaType(head.contentType)) {
    await deleteObject(key);
    await addUsage(supabase, auth.session.userId, -declared);
    return NextResponse.json({ error: "upload rejected" }, { status: 422 });
  }
  // Reconcile pre-charged usage to the actual object size.
  await addUsage(supabase, auth.session.userId, head.sizeBytes - declared);
  return NextResponse.json({ ok: true, publicUrl: publicUrl(key) });
}
