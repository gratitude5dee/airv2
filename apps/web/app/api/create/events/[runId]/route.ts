/**
 * V11 §14.1 `GET /api/create/events/[runId]` — the Create surface's twin of
 * `/api/chat/[runId]/events` on the mini origin: streams the Box's run
 * events through the control plane with the store session, so the Box's
 * hosted token never reaches the browser (C3). Only the owner's own runs
 * resolve (`chatEventStream` scopes by `agent_runs.user_id`).
 */
import { NextRequest, NextResponse } from "next/server";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { serviceClient } from "@/lib/supabase";
import { chatEventStream, SSE_HEADERS } from "@/lib/chat/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { runId } = await context.params;
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(runId)) {
    return NextResponse.json({ error: "bad run id" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const stream = await chatEventStream(supabase, userId, runId);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "create events proxy failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "stream failed" }, { status: 500 });
  }
}
