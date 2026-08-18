/**
 * Bot Chat relay (V7): each bot has ONE persistent canonical session,
 * deterministic id + the exact title Hermes' bot-mode probe gates on. All
 * calls ride the per-profile client; the browser sees run ids and re-emitted
 * SSE only (C3). Postgres records run metadata, never transcript content.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createRun,
  ensureSession,
  runEvents,
  sessionMessages,
  type HermesBoxTarget,
  type HermesMessage,
} from "../hermes/client";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { botTarget, BOT_CHAT_SESSION, BOT_CHAT_TITLE } from "./client";
import type { BotRow } from "./store";

export async function botBoxTarget(
  supabase: SupabaseClient,
  userId: string,
  bot: BotRow
): Promise<HermesBoxTarget> {
  const box = await ensureBoxAwake(supabase, userId);
  return botTarget(box.target, bot.name, bot.api_server_key);
}

/**
 * Run one turn in the bot's canonical Bot Chat session. Creates the pinned
 * session on first use (exact title "Bot Chat" — the probe contract), then
 * reuses it forever; there is no /new for bot chats.
 */
export async function startBotChatRun(
  supabase: SupabaseClient,
  userId: string,
  bot: BotRow,
  input: string,
  channel: "web" | "imessage"
): Promise<string> {
  const target = await botBoxTarget(supabase, userId, bot);
  await ensureSession(target, BOT_CHAT_SESSION, BOT_CHAT_TITLE);
  const run = await createRun(target, {
    input,
    sessionId: BOT_CHAT_SESSION,
    metadata: { channel, bot: bot.name },
  });
  await supabase.from("agent_runs").insert({
    user_id: userId,
    hermes_run_id: run.run_id,
    trigger: channel === "imessage" ? "imessage" : "web",
  });
  await armStopAfter(supabase, userId);
  return run.run_id;
}

/** Re-stream a bot run's events, closing the agent_runs row at the end. */
export async function botEventStream(
  supabase: SupabaseClient,
  userId: string,
  bot: BotRow,
  runId: string
): Promise<ReadableStream<Uint8Array>> {
  const target = await botBoxTarget(supabase, userId, bot);
  const stream = await runEvents(target, runId);
  const decoder = new TextDecoder();
  let closed = false;
  let armed = false;
  // botBoxTarget cleared the box's idle shut-off deadline; re-arm it once
  // the stream terminates (finish, flush, or client cancel) so the sweeper
  // can stop the box again.
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
      .then(() => undefined);
  };
  // `cancel` (client abort) is a newer Transformer member missing from the
  // TS lib; declare it explicitly so runtimes that support it re-arm too.
  const transformer: Transformer<Uint8Array, Uint8Array> & {
    cancel?: () => void;
  } = {
    transform(chunk, controller) {
      const text = decoder.decode(chunk, { stream: true });
      if (text.includes('"run.completed"')) finish("completed");
      else if (text.includes('"run.failed"')) finish("failed");
      controller.enqueue(chunk);
    },
    flush() {
      rearm();
    },
    cancel() {
      rearm();
    },
  };
  return stream.pipeThrough(new TransformStream(transformer));
}

/** Canonical-session history for the per-bot screen. */
export async function botChatMessages(
  supabase: SupabaseClient,
  userId: string,
  bot: BotRow
): Promise<HermesMessage[]> {
  const target = await botBoxTarget(supabase, userId, bot);
  try {
    return await sessionMessages(target, BOT_CHAT_SESSION);
  } catch {
    return [];
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
