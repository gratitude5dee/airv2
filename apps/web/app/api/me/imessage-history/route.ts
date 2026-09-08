/**
 * iMessage history ingest endpoint. GET (owner session) reports box-side
 * ingest status and mints a short-TTL upload ticket plus the exact command
 * the owner runs on their Mac (the extractor reads the local chat.db — the
 * only place iMessage history exists; see the reference bridge projects).
 * POST (Bearer upload ticket) validates the extracted JSON and writes it to
 * the owner's box under .hermes/context/imessage-history/ — content never
 * touches Postgres (C4).
 *
 * POST failures share one envelope the uploader can act on:
 * `{error, code, retriable, retry_after_seconds?, resolve_at?}`. Bodies carry
 * fixed text or validation messages only — never labels or message text.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import {
  buildIngestCommand,
  IngestInputError,
  MAX_CHUNK_BYTES,
  mintIngestTicket,
  parseChunk,
  storeChunk,
  verifyIngestTicket,
} from "@/lib/imessage/ingest";
import {
  readIngestStatusOrMirror,
  writeStatusMirror,
} from "@/lib/miniapps/onboardingMirror";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { readUploadBody, UploadTooLargeError } from "@/lib/imessage/uploadBody";
import { StateBusyError } from "@/lib/miniapps/stateLease";
import { ArchiveMigrationError, ArchiveResolutionError } from "@/lib/imessage/archiveMigrateStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };
const RESOLUTIONS_PATH = "/api/me/imessage-history/resolutions";

export type UploadErrorCode =
  | "invalid_ticket" | "upload_too_large" | "unreadable_upload" | "invalid_json"
  | "invalid_chunk" | "archive_busy" | "box_starting" | "resolution_required"
  | "migration_failed" | "upload_failed";

export interface UploadErrorBody {
  error: string;
  code: UploadErrorCode;
  retriable: boolean;
  retry_after_seconds?: number;
  /** Owner-session URL where pending identities are listed and resolved. */
  resolve_at?: string;
}

function uploadError(
  status: number, code: UploadErrorCode, error: string,
  options: { retryAfter?: number; resolveAt?: string } = {}
): NextResponse {
  const body: UploadErrorBody = { error, code, retriable: options.retryAfter !== undefined };
  const headers: Record<string, string> = { ...NO_STORE };
  if (options.retryAfter !== undefined) {
    body.retry_after_seconds = options.retryAfter;
    headers["Retry-After"] = String(options.retryAfter);
  }
  if (options.resolveAt) body.resolve_at = options.resolveAt;
  return NextResponse.json(body, { status, headers });
}

function busy(): NextResponse {
  return uploadError(503, "box_starting", "Your agent's computer is still starting — retrying in a minute.", { retryAfter: 60 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  // A sleeping box answers from the Postgres mirror (refreshed on every
  // upload chunk) rather than spending a wake on a read-only status view.
  let read: Awaited<ReturnType<typeof readIngestStatusOrMirror>>;
  try {
    read = await readIngestStatusOrMirror(supabase, userId);
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "status read failed" },
      { status: 502, headers: NO_STORE }
    );
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
  const cursor = read.status?.cursor ?? null;
  const ticket = mintIngestTicket(userId);
  const command = buildIngestCommand(ticket, cursor);
  return NextResponse.json(
    {
      status: read.status,
      command,
      cursor,
      source: read.source,
      refreshed_at: read.refreshedAt,
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = verifyIngestTicket(token);
  if (!claims) {
    return uploadError(401, "invalid_ticket",
      "Invalid or expired upload ticket — open the iMessage step again to get a fresh command.");
  }
  let raw: string;
  try {
    raw = await readUploadBody(request, MAX_CHUNK_BYTES);
  } catch (error) {
    if (error instanceof UploadTooLargeError) {
      return uploadError(413, "upload_too_large",
        `Upload exceeds ${MAX_CHUNK_BYTES} bytes — send smaller chunks.`);
    }
    return uploadError(400, "unreadable_upload", "Could not read the upload body.");
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return uploadError(400, "invalid_json", "Upload body must be JSON.");
  }
  const supabase = serviceClient();
  try {
    const chunk = parseChunk(body);
    const status = await storeChunk(supabase, claims.userId, chunk);
    await writeStatusMirror(supabase, claims.userId, { ingest: status });
    return NextResponse.json({ ok: true, status, cursor: status.cursor }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof IngestInputError) {
      return uploadError(400, "invalid_chunk", `Upload rejected: ${error.message}.`);
    }
    if (error instanceof StateBusyError) {
      return uploadError(503, "archive_busy",
        "Another archive upload is in progress — retrying shortly.", { retryAfter: 2 });
    }
    if (error instanceof ArchiveResolutionError) {
      // Never echo error.unresolved here: labels stay box-side / owner-session only.
      return uploadError(409, "resolution_required",
        "Some earlier chat labels match more than one conversation. Sign in and resolve them, then rerun this command.",
        { resolveAt: `${env.appOrigin()}${RESOLUTIONS_PATH}` });
    }
    if (error instanceof ArchiveMigrationError) {
      return uploadError(409, "migration_failed", `Archive migration failed: ${error.message}.`,
        error.retriable ? { retryAfter: 5 } : {});
    }
    if (error instanceof StartLimitError) return busy();
    return uploadError(502, "upload_failed",
      "Upload failed on the agent's computer — retrying.", { retryAfter: 10 });
  } finally {
    await armStopAfter(supabase, claims.userId).catch(() => undefined);
  }
}
