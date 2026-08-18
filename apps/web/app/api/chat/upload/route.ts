/**
 * Web chat file/photo upload (V8): drop the bytes into the box's
 * ~/.hermes/inbox/ — the same landing zone as iMessage attachments — and
 * return the box path for the composer to reference in the run input.
 * Bytes go browser → this route → box; nothing lands in Postgres (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import { command, writeFile } from "@/lib/box/client";
import {
  attachmentMarker,
  inboxPath,
  MAX_UPLOAD_BYTES,
} from "@/lib/chat/attachments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const path = inboxPath(file.name, Date.now());
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    // Quote the path at the call site — safety must not depend solely on the
    // sanitizer in lib/chat/attachments.ts keeping its character set.
    const quoted = JSON.stringify(`/home/user/${path}`);
    const quotedTmp = JSON.stringify(`/home/user/${path}.bin`);
    await command(box.boxId, "mkdir -p /home/user/.hermes/inbox");
    await writeFile(box.boxId, path, base64);
    await command(
      box.boxId,
      `base64 -d ${quoted} > ${quotedTmp} && mv ${quotedTmp} ${quoted}`
    );
    const mimeType = file.type || "application/octet-stream";
    return NextResponse.json({
      path,
      name: file.name,
      marker: attachmentMarker(mimeType, path),
    });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    console.error(
      JSON.stringify({
        msg: "chat upload failed",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return NextResponse.json({ error: "upload failed" }, { status: 502 });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
