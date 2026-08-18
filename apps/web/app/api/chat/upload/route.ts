/**
 * Web chat file/photo upload (V8): drop the bytes into the box's
 * ~/.hermes/inbox/ — the same landing zone as iMessage attachments — and
 * return the box path for the composer to reference in the run input.
 * Bytes go browser → this route → box; nothing lands in Postgres (C4).
 *
 * Large files arrive as sequential chunks (each request stays under the
 * platform's ~4.5 MB body ceiling). Every non-final chunk is exactly
 * UPLOAD_CHUNK_BYTES — a multiple of 3 — so its base64 is padless and the
 * pieces concatenate into one valid stream that the final chunk decodes.
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
import { shellQuote } from "@/lib/box/shell";
import {
  attachmentMarker,
  inboxPath,
  INBOX_PATH_RE,
  MAX_UPLOAD_BYTES,
  MAX_UPLOAD_CHUNKS,
  UPLOAD_CHUNK_B64_LEN,
  UPLOAD_CHUNK_BYTES,
} from "@/lib/chat/attachments";

/** Abandoned upload partials older than this are swept on the next upload. */
const STALE_PARTIAL_SWEEP =
  "find /home/user/.hermes/inbox -maxdepth 1 " +
  "\\( -name '*.b64' -o -name '*.part' -o -name '*.bin' \\) " +
  "-mmin +60 -delete";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function intField(form: FormData, name: string, fallback: number): number {
  const raw = form.get(name);
  if (typeof raw !== "string" || raw === "") return fallback;
  const value = Number(raw);
  return Number.isInteger(value) ? value : NaN;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!form || !(file instanceof File)) {
    return NextResponse.json({ error: "file required" }, { status: 400 });
  }
  const index = intField(form, "index", 0);
  const total = intField(form, "total", 1);
  if (
    !Number.isInteger(index) ||
    !Number.isInteger(total) ||
    total < 1 ||
    total > MAX_UPLOAD_CHUNKS ||
    index < 0 ||
    index >= total
  ) {
    return NextResponse.json({ error: "bad chunking" }, { status: 400 });
  }
  const last = index === total - 1;
  // Non-final chunks must be exactly the chunk size (padless base64 pieces
  // only concatenate then); the final chunk bounds the overall file size.
  if (
    file.size === 0 ||
    (!last && file.size !== UPLOAD_CHUNK_BYTES) ||
    (last && file.size > UPLOAD_CHUNK_BYTES) ||
    (last && (total - 1) * UPLOAD_CHUNK_BYTES + file.size > MAX_UPLOAD_BYTES)
  ) {
    return NextResponse.json({ error: "file too large" }, { status: 413 });
  }
  let path: string;
  if (index === 0) {
    path = inboxPath(file.name, Date.now());
  } else {
    const key = form.get("key");
    if (typeof key !== "string" || !INBOX_PATH_RE.test(key)) {
      return NextResponse.json({ error: "bad key" }, { status: 400 });
    }
    path = key;
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const base64 = Buffer.from(await file.arrayBuffer()).toString("base64");
    // Single-quote paths at the call site — safety must not depend solely
    // on the sanitizer in lib/chat/attachments.ts keeping its character set.
    const quoted = shellQuote(`/home/user/${path}`);
    const quotedB64 = shellQuote(`/home/user/${path}.b64`);
    const quotedPart = shellQuote(`/home/user/${path}.part`);
    const quotedTmp = shellQuote(`/home/user/${path}.bin`);
    if (index === 0) {
      await command(
        box.boxId,
        `mkdir -p /home/user/.hermes/inbox && { ${STALE_PARTIAL_SWEEP} || true; }`
      );
      await writeFile(box.boxId, `${path}.b64`, base64);
    } else {
      await writeFile(box.boxId, `${path}.part`, base64);
      // The accumulator must be exactly index full-chunk base64 pieces long,
      // otherwise this is a replayed/out-of-order chunk — refuse and clean up
      // (the declared-total size bound is only sound if every index lands once).
      const expected = index * UPLOAD_CHUNK_B64_LEN;
      const appended = await command(
        box.boxId,
        `sz=$(stat -c %s ${quotedB64} 2>/dev/null || echo -1); ` +
          `if [ "$sz" -ne ${expected} ]; then rm -f ${quotedPart}; exit 42; fi; ` +
          `cat ${quotedPart} >> ${quotedB64} && rm ${quotedPart}`
      );
      if (appended.exitCode === 42) {
        return NextResponse.json({ error: "chunk out of order" }, { status: 409 });
      }
      if (appended.exitCode !== 0) {
        return NextResponse.json({ error: "upload failed" }, { status: 502 });
      }
    }
    if (!last) {
      return NextResponse.json({ key: path });
    }
    const finalized = await command(
      box.boxId,
      `base64 -d ${quotedB64} > ${quotedTmp} && rm ${quotedB64} && mv ${quotedTmp} ${quoted}`
    );
    if (finalized.exitCode !== 0) {
      return NextResponse.json({ error: "upload failed" }, { status: 502 });
    }
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
