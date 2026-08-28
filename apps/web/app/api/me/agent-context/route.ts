/**
 * Agent-context import endpoint. GET (owner session) reports box-side import
 * status and mints a short-TTL upload ticket plus the exact one-command
 * packager the owner runs on their machine (it reads the local Hermes
 * profile, Codex CLI, and Claude Code stores — the only places that context
 * exists). POST (Bearer upload ticket) validates the packaged JSON and
 * writes it to the owner's box under .hermes/context/agent-import/ — content
 * never touches Postgres (C4). The packager's final chunk auto-starts the
 * ingestion subagent that distills Dictionary.MD.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import {
  ImportInputError,
  importedFileCount,
  MAX_CHUNK_BYTES,
  mintImportTicket,
  parseImportChunk,
  readImportStatus,
  startDictionaryRun,
  storeImportChunk,
  verifyImportTicket,
} from "@/lib/context/importer";
import { writeStatusMirror } from "@/lib/miniapps/onboardingMirror";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function busy(): NextResponse {
  return NextResponse.json(
    { error: "box busy starting — try again in a minute" },
    { status: 503, headers: NO_STORE }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  try {
    const status = await readImportStatus(supabase, userId);
    const ticket = mintImportTicket(userId);
    const command = `curl -fsSL ${env.appOrigin()}/agent-context-import.sh -o /tmp/air-import.sh && AIR_IMPORT_ENDPOINT=${env.appOrigin()}/api/me/agent-context bash /tmp/air-import.sh ${ticket}`;
    return NextResponse.json({ status, command }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "status read failed" },
      { status: 502, headers: NO_STORE }
    );
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const claims = verifyImportTicket(token);
  if (!claims) {
    return NextResponse.json(
      { error: "invalid or expired upload ticket" },
      { status: 401, headers: NO_STORE }
    );
  }
  const raw = await request.text();
  if (raw.length > MAX_CHUNK_BYTES) {
    return NextResponse.json(
      { error: "upload too large — chunk it" },
      { status: 413, headers: NO_STORE }
    );
  }
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { error: "body must be JSON" },
      { status: 400, headers: NO_STORE }
    );
  }
  const supabase = serviceClient();
  try {
    const chunk = parseImportChunk(body);
    let status = await storeImportChunk(supabase, claims.userId, chunk);
    let dictionary_started = false;
    if (chunk.final && importedFileCount(status) > 0) {
      // The last chunk is the one-click trigger: the ingestion subagent
      // starts automatically and distills Dictionary.MD box-side.
      status = await startDictionaryRun(supabase, claims.userId);
      dictionary_started = true;
    }
    await writeStatusMirror(supabase, claims.userId, { imports: status });
    return NextResponse.json(
      { ok: true, status, dictionary_started },
      { headers: NO_STORE }
    );
  } catch (error) {
    if (error instanceof ImportInputError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400, headers: NO_STORE }
      );
    }
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json(
      { error: "upload failed" },
      { status: 502, headers: NO_STORE }
    );
  } finally {
    await armStopAfter(supabase, claims.userId).catch(() => undefined);
  }
}
