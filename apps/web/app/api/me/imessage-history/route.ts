/**
 * iMessage history ingest endpoint. GET (owner session) reports box-side
 * ingest status and mints a short-TTL upload ticket plus the exact command
 * the owner runs on their Mac (the extractor reads the local chat.db — the
 * only place iMessage history exists; see the reference bridge projects).
 * POST (Bearer upload ticket) validates the extracted JSON and writes it to
 * the owner's box under .hermes/context/imessage-history/ — content never
 * touches Postgres (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import {
  IngestInputError,
  MAX_CHUNK_BYTES,
  mintIngestTicket,
  parseChunk,
  readIngestStatus,
  storeChunk,
  verifyIngestTicket,
} from "@/lib/imessage/ingest";
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
    const status = await readIngestStatus(supabase, userId);
    const ticket = mintIngestTicket(userId);
    const command = `curl -fsSL ${env.appOrigin()}/imessage-ingest.sh -o /tmp/air-ingest.sh && AIR_INGEST_ENDPOINT=${env.appOrigin()}/api/me/imessage-history bash /tmp/air-ingest.sh ${ticket}`;
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
  const claims = verifyIngestTicket(token);
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
    const chunk = parseChunk(body);
    const status = await storeChunk(supabase, claims.userId, chunk);
    return NextResponse.json({ ok: true, status }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof IngestInputError) {
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
