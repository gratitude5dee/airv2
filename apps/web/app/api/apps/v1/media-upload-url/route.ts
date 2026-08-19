/**
 * Apps API (MA3/MA4): GET a presigned PUT into the session user's public
 * prefix. Owner sessions only; the declared content type must pass the MA8
 * allowlist and the declared size is pre-charged against the user's quota
 * and recorded server-side (pending_uploads). POST confirms afterwards: the
 * reservation is consumed once, the full MA8 guard runs on the actual bytes,
 * and usage reconciles against the STORED charge — never a client value.
 * R2 credentials never appear here — only a time-boxed signed URL.
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
import { confirmUpload, reserveUpload } from "@/lib/storage/confirm";
import { presignPut, publicUrl, r2Configured } from "@/lib/storage/r2";
import { recordOpsEvent, uploadRateLimited } from "@/lib/security/limits";

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
  if (await uploadRateLimited(supabase, auth.session.userId)) {
    return NextResponse.json({ error: "too many uploads" }, { status: 429 });
  }
  try {
    const bucket = await ensureUserBucket(supabase, auth.session.userId);
    assertWithinQuota(bucket, sizeBytes);
    const key = `${bucket.prefix}apps/${auth.app.slug}/${randomBytes(8).toString("hex")}`;
    await addUsage(supabase, auth.session.userId, sizeBytes);
    await reserveUpload(supabase, auth.session.userId, key, sizeBytes);
    await recordOpsEvent(
      supabase,
      "upload",
      auth.session.userId,
      `apps-api:${auth.app.slug}`,
      sizeBytes
    );
    return NextResponse.json({
      uploadUrl: presignPut(key, contentType, 600),
      key,
      publicUrl: publicUrl(key),
    });
  } catch (error) {
    if (error instanceof MediaGuardError) {
      await recordOpsEvent(
        supabase,
        "upload_rejected",
        auth.session.userId,
        error.message
      );
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
  };
  const key = body.key ?? "";
  const bucket = await ensureUserBucket(supabase, auth.session.userId);
  // The key must live under this user's prefix and this app's folder.
  if (!key.startsWith(`${bucket.prefix}apps/${auth.app.slug}/`)) {
    return NextResponse.json({ error: "invalid key" }, { status: 400 });
  }
  const result = await confirmUpload(supabase, auth.session.userId, key);
  if (!result.ok) {
    if (result.status === 422) {
      await recordOpsEvent(
        supabase,
        "upload_rejected",
        auth.session.userId,
        result.error
      );
    }
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json({ ok: true, publicUrl: result.publicUrl });
}
