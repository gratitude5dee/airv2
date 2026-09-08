/**
 * Owner-session resolution of legacy iMessage thread labels that match
 * several (or no) catalogue conversations. GET lists what the last migration
 * preflight left unresolved (label → candidate thread IDs) and the owner's
 * saved decisions; POST accepts `{resolutions: [{label, id}]}` and persists
 * them box-side under .hermes/context/imessage-archive-state/. Labels are
 * content: they travel box → this authenticated response only, never to
 * Postgres, logs, or the upload-ticket endpoint (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import {
  readResolutionView,
  ResolutionInputError,
  saveResolutions,
} from "@/lib/imessage/archiveResolutions";
import { StateBusyError } from "@/lib/miniapps/stateLease";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE = { "Cache-Control": "no-store" };

function busy(): NextResponse {
  return NextResponse.json(
    { error: "box busy starting — try again in a minute" },
    { status: 503, headers: { ...NO_STORE, "Retry-After": "60" } }
  );
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  try {
    return NextResponse.json(await readResolutionView(supabase, userId), { headers: NO_STORE });
  } catch (error) {
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json({ error: "resolution status read failed" }, { status: 502, headers: NO_STORE });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body: unknown = await request.json().catch(() => null);
  if (body === null) {
    return NextResponse.json({ error: "body must be JSON" }, { status: 400, headers: NO_STORE });
  }
  const supabase = serviceClient();
  try {
    const view = await saveResolutions(supabase, userId, body);
    return NextResponse.json({ ok: true, ...view }, { headers: NO_STORE });
  } catch (error) {
    if (error instanceof ResolutionInputError) {
      return NextResponse.json({ error: error.message }, { status: 400, headers: NO_STORE });
    }
    if (error instanceof StateBusyError) {
      return NextResponse.json({ error: "An archive upload is in progress — retry shortly." },
        { status: 503, headers: { ...NO_STORE, "Retry-After": "2" } });
    }
    if (error instanceof StartLimitError) return busy();
    return NextResponse.json({ error: "saving resolutions failed" }, { status: 502, headers: NO_STORE });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
