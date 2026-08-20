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
import { createTerminalScanner } from "../hermes/terminal";

export type ChatChannel = "web" | "desktop";
/** agent_runs.trigger: the channel, or 'voice' when the composer content came from a transcription (M13). */
export type ChatTrigger = ChatChannel | "voice";

export async function startChatRun(
  supabase: SupabaseClient,
  userId: string,
  input: string,
  channel: ChatChannel,
  trigger: ChatTrigger = channel
): Promise<string> {
  const box = await ensureBoxAwake(supabase, userId);
  try {
    const run = await createRun(box.target, {
      input,
      sessionId: MAIN_SESSION,
      metadata: { channel },
    });
    await supabase.from("agent_runs").insert({
      user_id: userId,
      hermes_run_id: run.run_id,
      trigger,
    });
    return run.run_id;
  } finally {
    // ensureBoxAwake cleared the idle deadline; re-arm on success and
    // failure alike so a failed turn cannot leave the box running forever.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
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
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await runEvents(box.target, runId);
  } catch (error) {
    // The box was woken but no stream (and so no transformer re-arm) will
    // ever run — restore the idle deadline before surfacing the failure.
    await armStopAfter(supabase, userId).catch(() => undefined);
    throw error;
  }
  const decoder = new TextDecoder();
  const scanner = createTerminalScanner();
  let closed = false;
  let armed = false;
  // ensureBoxAwake cleared the idle deadline; re-arm it once the stream
  // terminates (finish, flush, or client cancel) so the sweeper can stop
  // the box again.
  const rearm = (): void => {
    if (armed) return;
    armed = true;
    void armStopAfter(supabase, userId).catch(() => undefined);
  };
  const finish = (outcome: string): void => {
    rearm();
    if (closed) return;
    closed = true;
    void supabase
      .from("agent_runs")
      .update({ outcome, ended_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("hermes_run_id", runId)
      .is("outcome", null)
      .then(() =>
        // A purchase outcome recorded mid-run keeps precedence over the
        // generic terminal outcome, but the run still closes.
        supabase
          .from("agent_runs")
          .update({ ended_at: new Date().toISOString() })
          .eq("user_id", userId)
          .eq("hermes_run_id", runId)
          .is("ended_at", null)
      )
      .then(() => undefined);
  };
  // `cancel` (client abort) is a newer Transformer member missing from the
  // TS lib; declare it explicitly so runtimes that support it re-arm too.
  const transformer: Transformer<Uint8Array, Uint8Array> & {
    cancel?: () => void;
  } = {
    transform(chunk, controller) {
      const outcome = scanner.push(decoder.decode(chunk, { stream: true }));
      if (outcome) finish(outcome);
      controller.enqueue(chunk);
    },
    flush() {
      const outcome = scanner.flush();
      if (outcome) finish(outcome);
      rearm();
    },
    cancel() {
      rearm();
    },
  };
  return stream.pipeThrough(new TransformStream(transformer));
}

export const SSE_HEADERS: Record<string, string> = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
};
