/**
 * SSE proxy (M6): streams GET /v1/runs/{id}/events from the user's box
 * through Vercel so hosted_token never reaches the browser (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { chatEventStream, SSE_HEADERS } from "@/lib/chat/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const userId = await sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { runId } = await context.params;
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "bad run id" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const stream = await chatEventStream(supabase, userId, runId);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "web events proxy failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "stream failed" }, { status: 500 });
  }
}
