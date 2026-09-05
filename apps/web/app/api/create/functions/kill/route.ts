/**
 * V11 §11.7 `POST /api/create/functions/kill {slug|app, killed}` — the
 * owner's kill switch. `killed: true` drops the user module from both
 * Workers (they fall back to the static stub) and marks the manifest; the
 * static app keeps serving. `killed: false` restores only what was already
 * approved — never a wider gate (CR4). Owner store session only.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { killBackend } from "@/lib/functions/approval";
import {
  appOf,
  callerOf,
  functionsErrorResponse,
  jsonBody,
} from "@/lib/functions/createRoute";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const caller = await callerOf(request, supabase, false);
  if (!caller) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await jsonBody(request);
  if (typeof body["killed"] !== "boolean") {
    return NextResponse.json({ error: "killed must be true or false" }, { status: 400 });
  }
  try {
    const app = await appOf(supabase, caller.userId, body);
    const row = await killBackend(supabase, app, body["killed"], "owner");
    if (!row) return NextResponse.json({ error: "this app has no backend" }, { status: 409 });
    return NextResponse.json({
      ok: true,
      status: row.status,
      killed: row.killed_at !== null,
    });
  } catch (error) {
    return functionsErrorResponse(error);
  }
}
