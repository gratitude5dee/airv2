/**
 * Desktop SSE relay. The run's events are re-emitted from Vercel, so the
 * desktop app never learns the box origin or its `_port_auth` token (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { desktopSession } from "@/lib/auth/desktop";
import { chatEventStream, SSE_HEADERS } from "@/lib/chat/relay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const supabase = serviceClient();
  const session = await desktopSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { runId } = await context.params;
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "bad run id" }, { status: 400 });
  }
  try {
    const stream = await chatEventStream(supabase, session.userId, runId);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({
        msg: "desktop events relay failed",
        user_id: session.userId,
        error: message,
      })
    );
    return NextResponse.json({ error: "stream failed" }, { status: 500 });
  }
}
