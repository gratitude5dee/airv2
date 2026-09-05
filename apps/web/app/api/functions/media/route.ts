/**
 * Runtime API (goal-create-v11 §11.3): put a file at the owner's public
 * prefix (`u/<username>/apps/<slug>/…`). Owner role only. The full MA8 guard
 * runs on the bytes in hand (type allowlist, size, text scrub, EXIF strip)
 * and the owner's quota is reserved before the bytes reach R2 — released if
 * the put fails — the same accounting as the Apps API presign path, minus
 * the presign: the Worker never holds an R2 URL.
 */
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { ALLOWED_MEDIA_TYPES, guardMediaUpload, MediaGuardError } from "@/lib/storage/guard";
import { ensureUserBucket, releaseQuota, reserveQuota } from "@/lib/storage/buckets";
import { publicUrl, putObject, r2Configured } from "@/lib/storage/r2";
import { recordOpsEvent, uploadRateLimited } from "@/lib/security/limits";
import {
  handleRuntime,
  MEDIA_MAX_BYTES,
  RuntimeApiError,
  runtimeJson,
  type RuntimeCall,
} from "@/lib/functions/runtimeApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EXT_RE = /\.([a-z0-9]{1,8})$/;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  return handleRuntime(request, supabase, async (call: RuntimeCall) => {
    if (call.role !== "owner") throw new RuntimeApiError(403, "owner_only");
    if (!r2Configured()) throw new RuntimeApiError(503, "media_unavailable");
    const { userId, slug } = call.principal;
    if (await uploadRateLimited(supabase, userId)) {
      throw new RuntimeApiError(429, "too_many_uploads");
    }
    const declared = Number(request.headers.get("content-length") ?? "0");
    if (declared > MEDIA_MAX_BYTES) throw new RuntimeApiError(413, "payload_too_large");
    const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
    const bytes = Buffer.from(await request.arrayBuffer());
    try {
      const sanitized = guardMediaUpload(bytes, contentType, { maxBytes: MEDIA_MAX_BYTES });
      const bucket = await ensureUserBucket(supabase, userId);
      const filename = request.nextUrl.searchParams.get("filename") ?? "";
      const ext =
        EXT_RE.exec(filename.toLowerCase())?.[1] ?? ALLOWED_MEDIA_TYPES[contentType];
      const key = `${bucket.prefix}apps/${slug}/${randomBytes(8).toString("hex")}${ext ? `.${ext}` : ""}`;
      const hold = await reserveQuota(supabase, userId, sanitized.length);
      try {
        await putObject(key, sanitized, contentType);
      } catch (error) {
        await releaseQuota(supabase, hold);
        throw error;
      }
      await recordOpsEvent(supabase, "upload", userId, `functions:${slug}`, sanitized.length);
      return runtimeJson({
        url: publicUrl(key),
        bytes: sanitized.length,
        contentType,
      });
    } catch (error) {
      if (error instanceof MediaGuardError) {
        await recordOpsEvent(supabase, "upload_rejected", userId, error.message);
        throw new RuntimeApiError(error.status, "media_rejected");
      }
      throw error;
    }
  });
}
