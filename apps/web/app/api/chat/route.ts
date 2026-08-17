/**
 * Web chat (M6): create a Hermes run on the user's own box. The box target
 * (hosted_url/_token/API_SERVER_KEY) stays server-side; the browser only
 * ever sees the run id (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { startChatRun } from "@/lib/chat/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    input?: string;
    via?: string;
  };
  const input = (body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "empty input" }, { status: 400 });
  }
  const trigger = body.via === "voice" ? "voice" : "web";
  const supabase = serviceClient();
  try {
    const runId = await startChatRun(supabase, userId, input, "web", trigger);
    return NextResponse.json({ run_id: runId });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "web chat run failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "run failed" }, { status: 500 });
  }
}
