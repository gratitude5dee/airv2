/**
 * Desktop chat relay: identical to the web relay except for the credential it
 * accepts (a scoped device bearer token) and the channel it stamps on the run.
 * Same box, same `air-main` session, same tools — a desktop turn is
 * indistinguishable from a web or iMessage turn to the agent.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { desktopSession } from "@/lib/auth/desktop";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { startChatRun } from "@/lib/chat/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await desktopSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const input = (body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "empty input" }, { status: 400 });
  }
  try {
    const runId = await startChatRun(supabase, session.userId, input, "desktop");
    return NextResponse.json({ run_id: runId });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({
        msg: "desktop chat run failed",
        user_id: session.userId,
        device_id: session.deviceId,
        error: message,
      })
    );
    return NextResponse.json({ error: "run failed" }, { status: 500 });
  }
}
