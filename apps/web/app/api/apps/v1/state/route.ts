/**
 * Apps API (MA3): GET/PUT the app's own state document —
 * .hermes/miniapps/<slug>/<resource>.json in the session user's box (C4).
 * Owner sessions have full access; guest sessions read only (writes go
 * through declared guest actions on /action). The app can never name another
 * app's slug or another user's resource: both come from the verified cookie
 * claims, never the request.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { appsApiSession, stateUserId } from "@/lib/miniapps/appsApi";
import { readAppState, writeAppState } from "@/lib/miniapps/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const STATE_MAX_BYTES = 256 * 1024;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await appsApiSession(request, supabase);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = stateUserId(auth);
  if (!userId) {
    return NextResponse.json({ state: {} });
  }
  const state = await readAppState(
    supabase,
    userId,
    auth.app.slug,
    auth.session.resourceId
  );
  return NextResponse.json({ state });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await appsApiSession(request, supabase);
  if (!auth) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (auth.session.role !== "owner") {
    return NextResponse.json(
      { error: "guests cannot write state" },
      { status: 403 }
    );
  }
  const raw = await request.text();
  if (raw.length > STATE_MAX_BYTES) {
    return NextResponse.json({ error: "state too large" }, { status: 413 });
  }
  let state: unknown;
  try {
    state = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  await writeAppState(
    supabase,
    auth.session.userId,
    auth.app.slug,
    auth.session.resourceId,
    state
  );
  return NextResponse.json({ ok: true });
}
