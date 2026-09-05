/**
 * V11 §9.2 `POST /api/create/turn/[runId]/stop` — stop one of the owner's
 * Create runs (store session on the mini origin). The surface calls it when
 * a turn answers after the owner has already switched projects: nobody will
 * stream that run, so the relay would never close its row and the Box would
 * keep editing a project the owner has left.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { PublishError } from "@/lib/miniapps/publish";
import { stopCreateTurn } from "@/lib/create/turn";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
): Promise<NextResponse> {
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
    const stopped = await stopCreateTurn(supabase, userId, runId);
    if (!stopped) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error(
      JSON.stringify({
        msg: "create stop failed",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return NextResponse.json({ error: "stop failed" }, { status: 502 });
  }
  return NextResponse.json({ ok: true });
}
