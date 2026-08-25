/**
 * MA4 owner upload path (a): any owner surface (web session or desktop
 * bearer) mints a presigned PUT into the user's public prefix. The declared
 * size is pre-charged against the quota and recorded server-side
 * (pending_uploads); POST confirms afterwards — the confirm leg consumes the
 * reservation once, runs the full MA8 guard on the actual bytes, and
 * reconciles usage against the STORED charge. R2 credentials stay
 * server-side — the browser only ever sees the time-boxed signed URL.
 */
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requestSession } from "@/lib/auth/surface";
import { serviceClient } from "@/lib/supabase";
import { parseBody } from "@/lib/http/body";
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
  confirmUpload,
  PRESIGN_TTL_SECONDS,
  reserveUpload,
} from "@/lib/storage/confirm";
import { presignPut, publicUrl, r2Configured } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const FILENAME_RE = /^[a-zA-Z0-9._-]{1,128}$/;

const UploadBodySchema = z.object({
  filename: z.string().optional(),
  contentType: z.string().optional(),
  sizeBytes: z.number().optional(),
  confirmKey: z.string().optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, UploadBodySchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  // Confirm/reconcile leg after an upload completed. The reservation is
  // consumed exactly once and the release amount comes from the stored
  // pre-charge, never the request body.
  if (body.confirmKey) {
    const bucket = await ensureUserBucket(supabase, session.userId);
    const key = body.confirmKey;
    if (!key.startsWith(bucket.prefix)) {
      return NextResponse.json({ error: "invalid key" }, { status: 400 });
    }
    const result = await confirmUpload(supabase, session.userId, key);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: result.status });
    }
    return NextResponse.json({ ok: true, publicUrl: result.publicUrl });
  }

  if (!r2Configured()) {
    return NextResponse.json(
      { error: "media storage unavailable" },
      { status: 503 }
    );
  }
  const contentType = (body.contentType ?? "").toLowerCase().trim();
  const sizeBytes = body.sizeBytes ?? 0;
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
    await reserveUpload(supabase, session.userId, key, sizeBytes);
    return NextResponse.json({
      uploadUrl: presignPut(key, contentType, PRESIGN_TTL_SECONDS),
      key,
      publicUrl: publicUrl(key),
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
