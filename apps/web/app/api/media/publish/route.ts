/**
 * MA4 agent upload path (b): the box's Hermes calls media_publish with a
 * box-local file path; the control plane pulls the bytes FROM the box over
 * the command channel (capped — the box is the untrusted side, C16), runs
 * the MA8 guard (allowlist, text scrub, EXIF strip), charges the quota, and
 * writes to the user's public prefix. The box never sees an R2 credential —
 * only the resulting public URL comes back.
 */
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { command } from "@/lib/box/client";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";
import {
  ALLOWED_MEDIA_TYPES,
  guardMediaUpload,
  MEDIA_MAX_BYTES,
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
export const maxDuration = 300;

const BOX_PATH_RE = /^\/home\/user\/[A-Za-z0-9._/ -]{1,512}$/;

async function boxUserId(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  return box ? (box.user_id as string) : null;
}

function contentTypeFor(path: string, declared: string): string | null {
  const normalized = declared.toLowerCase().trim();
  if (normalized) {
    return Object.hasOwn(ALLOWED_MEDIA_TYPES, normalized) ? normalized : null;
  }
  const ext = path.slice(path.lastIndexOf(".") + 1).toLowerCase();
  for (const [type, typeExt] of Object.entries(ALLOWED_MEDIA_TYPES)) {
    if (typeExt === ext || (ext === "jpeg" && typeExt === "jpg")) return type;
  }
  return null;
}

/** Pull a box file over the command channel, base64-encoded, hard-capped. */
async function pullBoxFile(boxId: string, path: string): Promise<Buffer> {
  // head -c cap+1 makes an oversized file detectable without buffering it
  // all. pipefail so a missing/unreadable file fails the pipeline (base64
  // would otherwise exit 0 on empty input and hide the error).
  const result = await command(
    boxId,
    `set -o pipefail; head -c ${MEDIA_MAX_BYTES + 1} ${JSON.stringify(path)} | base64 -w0`,
    120
  );
  if (result.exitCode !== 0) {
    throw new MediaGuardError(`file not readable: ${path}`, 404);
  }
  const bytes = Buffer.from(result.stdout.trim(), "base64");
  if (bytes.length > MEDIA_MAX_BYTES) {
    throw new MediaGuardError(`file exceeds ${MEDIA_MAX_BYTES} bytes`, 413);
  }
  return bytes;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!r2Configured()) {
    return NextResponse.json(
      { error: "media storage unavailable" },
      { status: 503 }
    );
  }
  const body = (await request.json().catch(() => null)) as {
    path?: unknown;
    contentType?: unknown;
    filename?: unknown;
  } | null;
  const path = typeof body?.path === "string" ? body.path : "";
  const declared = typeof body?.contentType === "string" ? body.contentType : "";
  const filename =
    typeof body?.filename === "string" &&
    /^[A-Za-z0-9._-]{1,128}$/.test(body.filename)
      ? body.filename
      : path.slice(path.lastIndexOf("/") + 1).replace(/[^A-Za-z0-9._-]/g, "_");
  if (!BOX_PATH_RE.test(path) || path.includes("..")) {
    return NextResponse.json({ error: "invalid path" }, { status: 400 });
  }
  const contentType = contentTypeFor(path, declared);
  if (!contentType) {
    return NextResponse.json(
      { error: "content type not allowed" },
      { status: 400 }
    );
  }

  try {
    const bucket = await ensureUserBucket(supabase, userId);
    const box = await ensureBoxAwake(supabase, userId);
    const raw = await pullBoxFile(box.boxId, path);
    const bytes = guardMediaUpload(raw, contentType);
    assertWithinQuota(bucket, bytes.length);
    const key = `${bucket.prefix}media/${randomBytes(6).toString("hex")}-${filename}`;
    await putObject(key, bytes, contentType);
    await addUsage(supabase, userId, bytes.length);
    return NextResponse.json({
      ok: true,
      url: publicUrl(key),
      bytes: bytes.length,
      contentType,
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
