/**
 * Surface-neutral chat relay. Web, desktop, and any future client create runs
 * in the one durable Hermes session (MAIN_SESSION), so memory, skills, files
 * and Composio tools are the same conversation everywhere — the surface is
 * recorded as run metadata, never as a separate session.
 *
 * Both halves keep the box target server-side: the client sees an opaque
 * run_id and an SSE stream re-emitted by Vercel (C3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { createRun, MAIN_SESSION, runEvents } from "../hermes/client";

export type ChatChannel = "web" | "desktop";

export async function startChatRun(
  supabase: SupabaseClient,
  userId: string,
  input: string,
  channel: ChatChannel
): Promise<string> {
  const box = await ensureBoxAwake(supabase, userId);
  const run = await createRun(box.target, {
    input,
    sessionId: MAIN_SESSION,
    metadata: { channel },
  });
  await supabase.from("agent_runs").insert({
    user_id: userId,
    hermes_run_id: run.run_id,
    trigger: channel,
  });
  await armStopAfter(supabase, userId);
  return run.run_id;
}

/**
 * Re-stream a run's events, closing out the agent_runs row as the terminal
 * event passes — the box owns the transcript; Postgres holds run metadata.
 */
export async function chatEventStream(
  supabase: SupabaseClient,
  userId: string,
  runId: string
): Promise<ReadableStream<Uint8Array>> {
  const box = await ensureBoxAwake(supabase, userId);
  const stream = await runEvents(box.target, runId);
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
  return stream.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        const text = decoder.decode(chunk, { stream: true });
        if (text.includes('"run.completed"')) finish("completed");
        else if (text.includes('"run.failed"')) finish("failed");
        controller.enqueue(chunk);
      },
    })
  );
}

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};
