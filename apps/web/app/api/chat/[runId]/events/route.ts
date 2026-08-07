/**
 * SSE proxy (M6): streams GET /v1/runs/{id}/events from the user's box
 * through Vercel so hosted_token never reaches the browser (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { runEvents } from "@/lib/hermes/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ runId: string }> }
): Promise<Response> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { runId } = await context.params;
  if (!/^[A-Za-z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "bad run id" }, { status: 400 });
  }
  const supabase = serviceClient();
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const stream = await runEvents(box.target, runId);

    // Close out the agent_runs row as the terminal event streams past —
    // the box owns the transcript; Supabase records only run metadata.
    const decoder = new TextDecoder();
    let closed = false;
    const finish = (outcome: string): void => {
      if (closed) return;
      closed = true;
      void supabase
        .from("agent_runs")
        .update({ outcome, ended_at: new Date().toISOString() })
        .eq("user_id", userId)
        .eq("hermes_run_id", runId)
        .is("outcome", null)
        .then(() => undefined);
    };
    const watched = stream.pipeThrough(
      new TransformStream<Uint8Array, Uint8Array>({
        transform(chunk, controller) {
          const text = decoder.decode(chunk, { stream: true });
          if (text.includes('"run.completed"')) finish("completed");
          else if (text.includes('"run.failed"')) finish("failed");
          controller.enqueue(chunk);
        },
      })
    );
    return new Response(watched, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "web events proxy failed", user_id: userId, error: message })
    );
    return NextResponse.json({ error: "stream failed" }, { status: 500 });
  }
}
