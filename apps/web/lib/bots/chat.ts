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
import { createTerminalScanner } from "../hermes/terminal";
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
  try {
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
    return run.run_id;
  } finally {
    // botBoxTarget cleared the box's idle shut-off deadline; re-arm it on
    // success and failure alike so a failed turn cannot leave the box
    // running forever.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

/** Re-stream a bot run's events, closing the agent_runs row at the end. */
export async function botEventStream(
  supabase: SupabaseClient,
  userId: string,
  bot: BotRow,
  runId: string
): Promise<ReadableStream<Uint8Array>> {
  const target = await botBoxTarget(supabase, userId, bot);
  let stream: ReadableStream<Uint8Array>;
  try {
    stream = await runEvents(target, runId);
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
