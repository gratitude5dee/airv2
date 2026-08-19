/**
 * MA4 owner upload path (a): any owner surface (web session or desktop
 * bearer) mints a presigned PUT into the user's public prefix. The declared
 * size is pre-charged against the quota; POST confirms/reconciles after the
 * upload (HEAD → actual size; delete on violation). R2 credentials stay
 * server-side — the browser only ever sees the time-boxed signed URL.
 */
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requestSession } from "@/lib/auth/surface";
import { serviceClient } from "@/lib/supabase";
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

const FILENAME_RE = /^[a-zA-Z0-9._-]{1,128}$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    filename?: string;
    contentType?: string;
    sizeBytes?: number;
    confirmKey?: string;
    declaredBytes?: number;
  };

  // Confirm/reconcile leg after an upload completed.
  if (body.confirmKey) {
    const bucket = await ensureUserBucket(supabase, session.userId);
    const key = body.confirmKey;
    const declared = Number(body.declaredBytes ?? 0);
    if (!key.startsWith(bucket.prefix)) {
      return NextResponse.json({ error: "invalid key" }, { status: 400 });
    }
    const head = await headObject(key);
    if (!head) {
      await addUsage(supabase, session.userId, -declared);
      return NextResponse.json({ error: "object not found" }, { status: 404 });
    }
    if (head.sizeBytes > MEDIA_MAX_BYTES || !allowedMediaType(head.contentType)) {
      await deleteObject(key);
      await addUsage(supabase, session.userId, -declared);
      return NextResponse.json({ error: "upload rejected" }, { status: 422 });
    }
    await addUsage(supabase, session.userId, head.sizeBytes - declared);
    return NextResponse.json({ ok: true, publicUrl: publicUrl(key) });
  }

  if (!r2Configured()) {
    return NextResponse.json(
      { error: "media storage unavailable" },
      { status: 503 }
    );
  }
  const contentType = (body.contentType ?? "").toLowerCase().trim();
  const sizeBytes = Number(body.sizeBytes ?? 0);
  const filename = body.filename ?? "";
  if (!allowedMediaType(contentType)) {
    return NextResponse.json(
      { error: "content type not allowed" },
      { status: 400 }
    );
  }
  if (!FILENAME_RE.test(filename)) {
    return NextResponse.json({ error: "invalid filename" }, { status: 400 });
  }
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0 || sizeBytes > MEDIA_MAX_BYTES) {
    return NextResponse.json({ error: "invalid size" }, { status: 400 });
  }
  try {
    const bucket = await ensureUserBucket(supabase, session.userId);
    assertWithinQuota(bucket, sizeBytes);
    const key = `${bucket.prefix}media/${randomBytes(6).toString("hex")}-${filename}`;
    await addUsage(supabase, session.userId, sizeBytes);
    return NextResponse.json({
      uploadUrl: presignPut(key, contentType, 600),
      key,
      publicUrl: publicUrl(key),
      declaredBytes: sizeBytes,
    });
  } catch (error) {
    if (error instanceof MediaGuardError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
