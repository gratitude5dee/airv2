/**
 * Pre-warm the user's box. Fired in the background on sign-in / home load so
 * the agent's computer is usually up before the first message or panel load.
 * Waking clears stop_after, so the idle deadline is re-armed afterwards.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import {
  ensureBoxAwake,
  armStopAfter,
  StartLimitError,
} from "@/lib/orchestrator/boxes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    await ensureBoxAwake(supabase, session.userId);
    await armStopAfter(supabase, session.userId);
    return NextResponse.json({ status: "awake" });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json(
        { error: "start_limit_reached" },
        { status: 429 }
      );
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({
        msg: "box wake failed",
        user_id: session.userId,
        error: message,
      })
    );
    return NextResponse.json({ error: "wake failed" }, { status: 502 });
  }
}
