/**
 * MA9.2 — owner-session Onairos surface.
 *   GET    → { configured, status, connected_at }   (metadata only)
 *   POST   → body { token, apiUrl }  = connect / re-import (SDK handoff)
 *            body { resync: true }   = re-sync from the box-stored grant
 *   DELETE → disconnect: deletes every Onairos-derived byte box-side.
 * Persona content flows Onairos → box only; responses and logs carry
 * status metadata, never payload bytes (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { OnairosError } from "@/lib/onairos/context";
import {
  disconnectOnairos,
  onairosStatus,
  resyncOnairos,
  syncOnairos,
} from "@/lib/onairos/sync";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

const NO_STORE = { "Cache-Control": "no-store" };

function fail(error: unknown): NextResponse {
  if (error instanceof StartLimitError) {
    return NextResponse.json(
      { error: "box busy starting — try again in a minute" },
      { status: 503, headers: NO_STORE }
    );
  }
  if (error instanceof OnairosError) {
    return NextResponse.json(
      { error: error.message },
      { status: error.status, headers: NO_STORE }
    );
  }
  return NextResponse.json(
    { error: "onairos request failed" },
    { status: 502, headers: NO_STORE }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const state = await onairosStatus(serviceClient(), userId);
  return NextResponse.json(
    {
      configured: state.configured,
      status: state.status,
      connected_at: state.connectedAt,
    },
    { headers: NO_STORE }
  );
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    resync?: unknown;
  } | null;
  if (!body) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const result =
      body.resync === true
        ? await resyncOnairos(supabase, userId)
        : await syncOnairos(supabase, userId, body);
    return NextResponse.json(
      { ok: true, synced_at: result.syncedAt },
      { headers: NO_STORE }
    );
  } catch (error) {
    return fail(error);
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    await disconnectOnairos(serviceClient(), userId);
    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return fail(error);
  }
}
