/**
 * Chat stop (V8): relays the composer's stop button to Hermes's existing
 * POST /v1/runs/{id}/stop. The box target stays server-side (C3); the row
 * closes as interrupted so History reflects the cut.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { stopRun } from "@/lib/hermes/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { runId } = await context.params;
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "bad run id" }, { status: 400 });
  }
  const supabase = serviceClient();
  // Only runs this user owns can be stopped.
  const { data: run } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("user_id", userId)
    .eq("hermes_run_id", runId)
    .maybeSingle();
  if (!run) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const box = await ensureBoxAwake(supabase, userId);
    await stopRun(box.target, runId);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "chat stop failed",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return NextResponse.json({ error: "stop failed" }, { status: 502 });
  }
  await supabase
    .from("agent_runs")
    .update({ outcome: "interrupted", ended_at: new Date().toISOString() })
    .eq("user_id", userId)
    .eq("hermes_run_id", runId)
    .is("outcome", null);
  return NextResponse.json({ ok: true });
}
