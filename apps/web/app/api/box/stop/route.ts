/**
 * Graceful, user-initiated power off (M10, C20). Never force (C6): a refused
 * stop means the snapshot is failing, so surface it instead of losing data.
 * Refuses while an agent run is in flight so a stop can't cut a run mid-turn.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import { stop } from "@/lib/box/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id, state")
    .eq("user_id", session.userId)
    .maybeSingle();
  if (!box) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const row = box as { provider_box_id: string; state: string };
  if (row.state === "stopped" || row.state === "stopping") {
    return NextResponse.json({ state: row.state });
  }

  // Runs that started in the last 15 minutes and haven't ended are in
  // flight; stopping under them would cut the turn.
  const activeSince = new Date(Date.now() - 15 * 60_000).toISOString();
  const { data: activeRuns } = await supabase
    .from("agent_runs")
    .select("id")
    .eq("user_id", session.userId)
    .is("ended_at", null)
    .gt("started_at", activeSince)
    .limit(1);
  if (activeRuns && activeRuns.length > 0) {
    return NextResponse.json({ error: "run_active" }, { status: 409 });
  }

  await supabase
    .from("boxes")
    .update({ state: "stopping", last_active_at: new Date().toISOString() })
    .eq("user_id", session.userId);
  try {
    await stop(row.provider_box_id);
  } catch (error) {
    await supabase
      .from("boxes")
      .update({ state: "ready" })
      .eq("user_id", session.userId);
    console.error(
      JSON.stringify({
        msg: "user stop refused",
        user_id: session.userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return NextResponse.json({ error: "stop_refused" }, { status: 409 });
  }
  await supabase
    .from("boxes")
    .update({ state: "stopped", stop_after: null })
    .eq("user_id", session.userId);
  return NextResponse.json({ state: "stopped" });
}
