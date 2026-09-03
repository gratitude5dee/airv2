/**
 * Burst debouncing and the debounced turn (goal.md M2 task 3, C14).
 *
 * One flush job per chat. Every inbound resets run_at to now()+DEBOUNCE_MS; the
 * invocation that still owns the deadline when it fires claims the drain
 * atomically. A message that is media or an explicit creative command holds
 * the burst open for REFERENCE_WINDOW_MS instead, so a photo/clip and its
 * /zap sent as separate bubbles within that window drain as one burst and
 * render as one job; a shorter bubble arriving inside an open window never
 * shortens it. Messages stay in batch_queue until the handler reads them —
 * the enqueuer never carries them in a payload. A chain cancelled
 * mid-generation moves its drained messages to carried_messages, and the
 * next batch prepends them as "[Earlier message] …". Cancellation compares
 * cancelled_at against the chain's own chainStartedAt, never "is the flag
 * set", so a stale flag cannot orphan a new chain.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, writeFile } from "../box/client";
import {
  createRun,
  ensureSession,
  loadConversationHistory,
  MAIN_SESSION,
  MAIN_SESSION_TITLE,
  runEvents,
  stopRun,
  type HermesBoxTarget,
} from "../hermes/client";
import type { ConversationMessage } from "../hermes/history";
import { botTarget, BOT_CHAT_SESSION, BOT_CHAT_TITLE } from "../bots/client";
import { parseMention } from "../bots/mentions";
import { listBots } from "../bots/store";
import { createSpectrumSender, type SpectrumSender } from "../spectrum/sender";
import { probeForTapback } from "../spectrum/tapbacks";
import { maybeRunCreativeLane } from "../creative/imessage";
import { parseExplicitGenerationCommand } from "../creative/parse";
import {
  maybeSendMiniAppLink,
  MiniAppRegistryLookupError,
  OWNER_ONLY_CARD_LINE,
} from "../miniapps/imessageCommand";
import { sendMarkedCards } from "../miniapps/cards";
import {
  armStopAfter,
  ensureBoxAwake,
} from "./boxes";
import { deliverSendFiles, stripSendFileMarkers } from "./outbound";
import {
  BRIDGE_MESSAGE_ID_PREFIX,
  bridgeCarryMarker,
  isBridgeMarkerId,
  QUICK_ACK_CARRY_MARKER,
  quickAckCarryMarker,
  sharedBridgeReply,
} from "./sharedBridge";
import { streamBubbles } from "./bubbles";

const ATTACHMENT_MARKER = /^\[attachment:([^\]]+)\]$/;

export const DEBOUNCE_MS = 2_500;
/**
 * How long a media bubble or a creative command waits for its counterpart.
 * iMessage sends a photo and its typed caption as separate webhooks when the
 * user attaches, then types; either order lands inside this window.
 */
export const REFERENCE_WINDOW_MS = 3_000;
const MAX_ATTEMPTS = 5;
const CANCEL_POLL_MS = 2_000;

export interface InboundMessage {
  userId: string;
  spaceId: string;
  phone: string;
  senderId?: string | undefined;
  messageId: string;
  body: string;
  /** Resolved sender trust tier; 0 = the owner's own verified handle. */
  senderTier?: number | undefined;
}

interface QueuedMessage {
  id: string;
  message_id: string;
  body: string;
}

const HAS_ATTACHMENT_MARKER = /\[attachment:[^\]]+\]/;

/** The debounce a message earns: media and creative commands wait for each other. */
export function debounceMsFor(body: string): number {
  if (HAS_ATTACHMENT_MARKER.test(body)) return REFERENCE_WINDOW_MS;
  const command = parseExplicitGenerationCommand(body);
  if (command && !("ambiguous" in command)) return REFERENCE_WINDOW_MS;
  return DEBOUNCE_MS;
}

/**
 * The deadline this message moves the flush to. Every inbound owns a fresh,
 * strictly later run_at (claimFlush matches on it), but a short-debounce
 * bubble must not pull an open reference window in: a caption typed right
 * after a photo lands inside its 3s, so the later of the two deadlines wins.
 * Only a deadline still within the window counts — a backoff reschedule
 * (minutes out) must still be pulled in by fresh input.
 */
async function nextRunAt(
  supabase: SupabaseClient,
  message: InboundMessage
): Promise<string> {
  const now = Date.now();
  const own = now + debounceMsFor(message.body);
  const { data } = await supabase
    .from("flush_jobs")
    .select("run_at")
    .eq("space_id", message.spaceId)
    .maybeSingle();
  const current = data?.run_at ? Date.parse(String(data.run_at)) : NaN;
  const holdsWindow =
    Number.isFinite(current) &&
    current >= own &&
    current <= now + REFERENCE_WINDOW_MS;
  return new Date(holdsWindow ? current + 1 : own).toISOString();
}

/** Enqueue + (re)schedule the chat's flush job. Returns the new deadline. */
export async function enqueueInbound(
  supabase: SupabaseClient,
  message: InboundMessage
): Promise<{ runAt: string }> {
  const { error: queueError } = await supabase.from("batch_queue").insert({
    user_id: message.userId,
    space_id: message.spaceId,
    phone: message.phone,
    sender_id: message.senderId ?? null,
    message_id: message.messageId,
    body: message.body,
  });
  if (queueError) {
    throw new Error(`batch_queue insert failed: ${queueError.message}`);
  }

  // Durable destination for agent-initiated cards (flush_jobs is transient).
  // Owner-only (tier 0): on a shared line, tier-1 contacts also reach this
  // path, and their conversation must never become the screen-card target.
  // Best-effort: a failure here must not drop the user's message.
  if (message.senderTier === 0) {
    const { error: destError } = await supabase
      .from("imessage_destinations")
      .upsert(
        {
          user_id: message.userId,
          space_id: message.spaceId,
          phone: message.phone,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "user_id" }
      );
    if (destError) {
      console.error(
        JSON.stringify({
          msg: "imessage_destinations upsert failed",
          user_id: message.userId,
          error: destError.message,
        })
      );
    }
  }

  const runAt = await nextRunAt(supabase, message);
  const { error: jobError } = await supabase.from("flush_jobs").upsert(
    {
      space_id: message.spaceId,
      user_id: message.userId,
      phone: message.phone,
      run_at: runAt,
      cancelled_at: new Date().toISOString(),
      // V6 (C20): the purchase route reads this to keep offer-the-fill
      // owner-initiated. Fail closed: unknown tier is never owner.
      sender_tier: message.senderTier ?? null,
    },
    { onConflict: "space_id" }
  );
  if (jobError) {
    throw new Error(`flush_jobs upsert failed: ${jobError.message}`);
  }
  return { runAt };
}

/**
 * Claim the flush if this invocation still owns the deadline: the update
 * only matches while run_at is unchanged, so a later inbound (which moved
 * run_at) silently wins.
 */
export async function claimFlush(
  supabase: SupabaseClient,
  spaceId: string,
  expectedRunAt: string
): Promise<{ chainStartedAt: string } | undefined> {
  const chainStartedAt = new Date().toISOString();
  const { data } = await supabase
    .from("flush_jobs")
    .update({ chain_started_at: chainStartedAt })
    .eq("space_id", spaceId)
    .eq("run_at", expectedRunAt)
    .select("space_id");
  if (!data || data.length === 0) return undefined;
  return { chainStartedAt };
}

/** Read in arrival order, then delete exactly the rows read. */
async function drainTable(
  supabase: SupabaseClient,
  table: "batch_queue" | "carried_messages",
  spaceId: string
): Promise<QueuedMessage[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, message_id, body")
    .eq("space_id", spaceId)
    .order("received_at", { ascending: true });
  if (error) {
    throw new Error(`${table} read failed: ${error.message}`);
  }
  const rows = (data ?? []) as QueuedMessage[];
  if (rows.length > 0) {
    const { error: deleteError } = await supabase
      .from(table)
      .delete()
      .in(
        "id",
        rows.map((row) => row.id)
      );
    if (deleteError) {
      throw new Error(`${table} drain failed: ${deleteError.message}`);
    }
  }
  return rows;
}

const drainQueue = (
  supabase: SupabaseClient,
  spaceId: string
): Promise<QueuedMessage[]> => drainTable(supabase, "batch_queue", spaceId);

const drainCarried = (
  supabase: SupabaseClient,
  spaceId: string
): Promise<QueuedMessage[]> =>
  drainTable(supabase, "carried_messages", spaceId);

/** Prior-chain remnants read as history, not fresh input. */
export function composeInput(
  carried: QueuedMessage[],
  fresh: QueuedMessage[]
): string {
  const parts: string[] = [];
  for (const message of carried) {
    parts.push(`[Earlier message] ${message.body}`);
  }
  for (const message of fresh) {
    parts.push(message.body);
  }
  return parts.join("\n");
}

/** True when a cancellation stamped after this chain began. */
export function isCancelled(
  cancelledAt: string | null,
  chainStartedAt: string
): boolean {
  return cancelledAt !== null && cancelledAt > chainStartedAt;
}

async function chainCancelled(
  supabase: SupabaseClient,
  spaceId: string,
  chainStartedAt: string
): Promise<boolean> {
  const { data } = await supabase
    .from("flush_jobs")
    .select("cancelled_at")
    .eq("space_id", spaceId)
    .maybeSingle();
  return isCancelled((data?.cancelled_at as string | null) ?? null, chainStartedAt);
}

/**
 * Webhooks carry attachment metadata only. Fetch the bytes through the live
 * SDK (`getAttachment(id, phone)`), drop them into the box filesystem, and
 * rewrite the marker so the agent can read the file itself.
 */
async function materializeAttachments(
  sender: SpectrumSender,
  boxId: string,
  phone: string,
  input: string
): Promise<string> {
  const lines = await Promise.all(
    input.split("\n").map(async (line) => {
      const match = ATTACHMENT_MARKER.exec(
        line.replace(/^\[Earlier message\] /, "")
      );
      if (!match?.[1]) return line;
      const parts: string[] = [];
      for (const id of match[1].split(",")) {
        const attachment = await sender
          .getAttachment(id, phone)
          .catch(() => undefined);
        if (!attachment) {
          parts.push("[The user sent an attachment that could not be retrieved]");
          continue;
        }
        const safeName = attachment.name.replace(/[^A-Za-z0-9._-]/g, "_");
        const path = `.hermes/inbox/${Date.now()}-${safeName}`;
        await command(boxId, "mkdir -p /home/user/.hermes/inbox");
        await writeFile(boxId, path, attachment.data.toString("base64"));
        await command(
          boxId,
          `base64 -d /home/user/${path} > /home/user/${path}.bin && mv /home/user/${path}.bin /home/user/${path}`
        );
        parts.push(
          `[The user sent an attachment (${attachment.mimeType}); it is saved at /home/user/${path}]`
        );
      }
      return line.startsWith("[Earlier message] ")
        ? `[Earlier message] ${parts.join(" ")}`
        : parts.join(" ");
    })
  );
  return lines.join("\n");
}

/** Parse Hermes SSE into text deltas; throws on run.failed. */
export async function* hermesDeltas(
  stream: ReadableStream<Uint8Array>,
  onDone?: (output: string) => void
): AsyncGenerator<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let sawDelta = false;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let index: number;
      while ((index = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, index);
        buffer = buffer.slice(index + 2);
        const line = frame
          .split("\n")
          .find((entry) => entry.startsWith("data: "));
        if (!line) continue;
        let event: {
          event?: string;
          delta?: string;
          output?: string;
          error?: string;
        };
        try {
          event = JSON.parse(line.slice(6)) as typeof event;
        } catch {
          continue;
        }
        if (event.event === "message.delta" && event.delta) {
          sawDelta = true;
          yield event.delta;
        } else if (event.event === "run.completed") {
          if (!sawDelta && event.output) {
            yield event.output;
          }
          onDone?.(event.output ?? "");
          return;
        } else if (event.event === "run.failed") {
          throw new Error(event.error ?? "run failed");
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}

async function rescheduleWithBackoff(
  supabase: SupabaseClient,
  spaceId: string,
  attempts: number
): Promise<void> {
  const delayMs = Math.min(2 ** attempts * 15_000, 10 * 60_000);
  await supabase
    .from("flush_jobs")
    .update({
      run_at: new Date(Date.now() + delayMs).toISOString(),
      chain_started_at: null,
      attempts: attempts + 1,
    })
    .eq("space_id", spaceId);
}

async function carryMessages(
  supabase: SupabaseClient,
  userId: string,
  spaceId: string,
  messages: QueuedMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  await supabase.from("carried_messages").insert(
    messages.map((message) => ({
      user_id: userId,
      space_id: spaceId,
      message_id: message.message_id,
      body: message.body,
    }))
  );
}

async function requeueMessages(
  supabase: SupabaseClient,
  userId: string,
  spaceId: string,
  phone: string,
  messages: QueuedMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  await supabase.from("batch_queue").insert(
    messages.map((message) => ({
      user_id: userId,
      space_id: spaceId,
      phone,
      message_id: message.message_id,
      body: message.body,
    }))
  );
}

/**
 * Explicit, observable history replay for an iMessage turn.
 *
 * createRun replays the transcript itself when `conversationHistory` is
 * omitted, but that load degrades to an empty history on any error — an
 * unreachable box or an odd payload silently starts the turn blank and the
 * agent re-asks for what the human already sent. Doing it here makes the
 * degradation visible: the session is ensured first (so a first turn
 * persists its transcript) and an empty replay against a session the box
 * already had is logged as a dropped replay. Counts only — transcript
 * content never enters control-plane logs (C4).
 *
 * Returns null when an existing session replays empty even after a retry —
 * running that turn would answer with total amnesia, so the caller should
 * hold the burst and try again rather than reply blank.
 */
export async function replayHistory(
  target: HermesBoxTarget,
  sessionId: string,
  context: {
    userId: string;
    spaceId: string;
    title: string;
    /** Set when the caller already ensured the session this turn. */
    firstTurn?: boolean;
  }
): Promise<ConversationMessage[] | null> {
  let firstTurn = context.firstTurn ?? false;
  try {
    if (context.firstTurn === undefined) {
      firstTurn = (await ensureSession(target, sessionId, context.title))
        .created;
    }
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "session ensure failed before run",
        user_id: context.userId,
        space_id: context.spaceId,
        session_id: sessionId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
  let history = await loadConversationHistory(target, sessionId);
  if (history.length === 0 && !firstTurn) {
    // One immediate retry: the load is best-effort and a transient proxy
    // hiccup or a box mid-resume often clears within a moment.
    history = await loadConversationHistory(target, sessionId);
  }
  if (history.length === 0 && !firstTurn) {
    console.error(
      JSON.stringify({
        msg: "history replay empty on existing session",
        user_id: context.userId,
        space_id: context.spaceId,
        session_id: sessionId,
      })
    );
    return null;
  } else {
    console.log(
      JSON.stringify({
        msg: "history replayed",
        user_id: context.userId,
        space_id: context.spaceId,
        session_id: sessionId,
        messages: history.length,
        first_turn: firstTurn,
      })
    );
  }
  return history;
}

/**
 * Run one debounced turn for a chat. Called after the claim succeeds; owns
 * drain → resume → run → stream → stop_after re-arm.
 */
export async function runFlush(
  supabase: SupabaseClient,
  job: {
    spaceId: string;
    userId: string;
    phone: string;
    attempts: number;
    senderTier: number | null;
  },
  chainStartedAt: string
): Promise<void> {
  // Connect to Spectrum BEFORE draining: draining deletes the queued rows,
  // so a sender that cannot be created (e.g. a Spectrum/Cloudflare 502)
  // must leave the burst in the queue and retry with backoff instead of
  // silently destroying it.
  let sender: SpectrumSender;
  try {
    sender = await createSpectrumSender();
  } catch (error) {
    if (job.attempts < MAX_ATTEMPTS) {
      await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
      return;
    }
    throw error;
  }
  try {
    const carried = await drainCarried(supabase, job.spaceId);
    const fresh = await drainQueue(supabase, job.spaceId);
    const drained = [...carried, ...fresh];
    if (drained.length === 0) {
      await supabase.from("flush_jobs").delete().eq("space_id", job.spaceId);
      return;
    }
    const rawInput = composeInput(carried, fresh);
    try {
      const handled = await maybeSendMiniAppLink(
        supabase,
        sender,
        {
          spaceId: job.spaceId,
          userId: job.userId,
          phone: job.phone,
          senderTier: job.senderTier,
        },
        rawInput
      );
      if (handled) {
        if (!(await chainCancelled(supabase, job.spaceId, chainStartedAt))) {
          await supabase
            .from("flush_jobs")
            .delete()
            .eq("space_id", job.spaceId)
            .eq("chain_started_at", chainStartedAt);
        }
        return;
      }
    } catch (error) {
      if (error instanceof MiniAppRegistryLookupError) {
        if (job.attempts < MAX_ATTEMPTS) {
          await requeueMessages(
            supabase,
            job.userId,
            job.spaceId,
            job.phone,
            drained
          );
          await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
          return;
        }
        throw error;
      }
      console.error(
        JSON.stringify({
          msg: "mini-app command failed",
          user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      await sender
        .sendText(job.spaceId, job.phone, "couldn't open that mini-app. try again?")
        .catch(() => undefined);
      if (!(await chainCancelled(supabase, job.spaceId, chainStartedAt))) {
        await supabase
          .from("flush_jobs")
          .delete()
          .eq("space_id", job.spaceId)
          .eq("chain_started_at", chainStartedAt);
      }
      return;
    }
    // M16 creative lane: an explicit /imagine, /animate, or /zap in the
    // settled burst is handled here, before any box wake or Hermes run.
    // Only tier-0/1 senders ever reach the flush — tier-2 inbound returns
    // from the webhook before enqueue — so no provider call can happen for
    // an unknown number. Ordinary prose falls through to Hermes unchanged.
    try {
      const handled = await maybeRunCreativeLane(
        supabase,
        sender,
        { spaceId: job.spaceId, userId: job.userId, phone: job.phone },
        rawInput
      );
      if (handled) {
        if (!(await chainCancelled(supabase, job.spaceId, chainStartedAt))) {
          await supabase
            .from("flush_jobs")
            .delete()
            .eq("space_id", job.spaceId)
            .eq("chain_started_at", chainStartedAt);
        }
        return;
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "creative lane failed",
          user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      await sender
        .sendText(job.spaceId, job.phone, "that one didn't come out. try again?")
        .catch(() => undefined);
      // The burst was answered (with the failure line); do not carry it, or
      // the next inbound would re-trigger the same paid command.
      if (!(await chainCancelled(supabase, job.spaceId, chainStartedAt))) {
        await supabase
          .from("flush_jobs")
          .delete()
          .eq("space_id", job.spaceId)
          .eq("chain_started_at", chainStartedAt);
      }
      return;
    }

    let box: Awaited<ReturnType<typeof ensureBoxAwake>>;
    try {
      box = await ensureBoxAwake(supabase, job.userId);
    } catch (error) {
      // Any wake failure (start limit, slow boot, hermes not healthy after
      // an unclean VM death) is transient: hold the burst and retry rather
      // than dropping the drained messages on the floor.
      if (job.attempts < MAX_ATTEMPTS) {
        // First-class queued state: hold the user honestly, retry later.
        // Carry the full drained burst: previously carried rows were already
        // deleted by drainCarried, so re-carrying only `fresh` would lose them.
        await carryMessages(supabase, job.userId, job.spaceId, drained);
        if (job.attempts === 0) {
          // Shared bridge (optibox rule 1: always answer something): a
          // restricted no-tools completion through the gateway answers the
          // burst right now, and the reply rides into the retried turn as
          // history so the agent continues instead of repeating. Any bridge
          // failure falls back to the static holding line.
          const bridged = await sharedBridgeReply(
            supabase,
            job.userId,
            rawInput
          ).catch(() => null);
          // Holding lines are best-effort: a Spectrum send failure here
          // must not throw past the reschedule below, or the carried burst
          // would wait on the sweeper instead of the backoff retry.
          if (bridged) {
            try {
              await sender.sendText(job.spaceId, job.phone, bridged);
              await carryMessages(supabase, job.userId, job.spaceId, [
                {
                  id: "bridge",
                  message_id: `${BRIDGE_MESSAGE_ID_PREFIX}${Date.now()}`,
                  body: bridgeCarryMarker(bridged),
                },
              ]);
            } catch {
              // burst already carried above; retry owns the reply
            }
          } else {
            await sender
              .sendText(
                job.spaceId,
                job.phone,
                "Give me a few minutes — my computer is busy starting up. I'll reply as soon as it's ready."
              )
              .catch(() => undefined);
          }
        }
        await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
        return;
      }
      throw error;
    }

    const input = await materializeAttachments(
      sender,
      box.boxId,
      job.phone,
      rawInput
    );

    // V7: an @mention validated against the roster delegates the burst to
    // that bot's canonical chat; the reply streams back attributed
    // ('\u{1F916} <name>: \u2026'). Unknown @words stay ordinary text for the
    // default agent. Roster read failures degrade to the default agent.
    let runTarget = box.target;
    let runSession = MAIN_SESSION;
    let runInput = input;
    let botPrefix = "";
    let botSessionCreated: boolean | undefined;
    try {
      const roster = await listBots(supabase, job.userId);
      const hit = parseMention(
        input,
        roster.filter((b) => b.status === "ready").map((b) => b.name)
      );
      if (hit) {
        const bot = roster.find((b) => b.name === hit.bot);
        if (bot) {
          runTarget = botTarget(box.target, bot.name, bot.api_server_key);
          botSessionCreated = (
            await ensureSession(runTarget, BOT_CHAT_SESSION, BOT_CHAT_TITLE)
          ).created;
          runSession = BOT_CHAT_SESSION;
          runInput = hit.input;
          botPrefix = `\u{1F916} ${bot.name}: `;
        }
      }
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "bot delegation skipped",
          user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }

    const replayed = await replayHistory(runTarget, runSession, {
      userId: job.userId,
      spaceId: job.spaceId,
      title: runSession === MAIN_SESSION ? MAIN_SESSION_TITLE : BOT_CHAT_TITLE,
      // The delegation branch above already ensured the bot chat session.
      ...(botSessionCreated === undefined
        ? {}
        : { firstTurn: botSessionCreated }),
    });
    if (replayed === null && job.attempts < MAX_ATTEMPTS) {
      // An existing session replayed empty: running now would answer with
      // total amnesia. Hold the burst and retry, same as a wake failure.
      await carryMessages(supabase, job.userId, job.spaceId, drained);
      await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
      return;
    }
    // At max attempts a degraded (blank-context) answer beats dropping the
    // burst on the floor.
    const conversationHistory = replayed ?? [];

    const run = await createRun(runTarget, {
      input: runInput,
      sessionId: runSession,
      conversationHistory,
      metadata: { channel: "imessage" },
    });
    await supabase
      .from("flush_jobs")
      .update({ hermes_run_id: run.run_id })
      .eq("space_id", job.spaceId);

    const startedAt = new Date().toISOString();
    let cancelled = false;
    let lastCancelCheck = Date.now();
    const events = await runEvents(runTarget, run.run_id);
    // Outbound marker lanes: `[send-file: …]` and `[card: …]` markers are
    // stripped from the streamed text and delivered (native attachments,
    // mini-app cards) after the stream.
    const stripped = stripSendFileMarkers(hermesDeltas(events));
    const deltas = stripped.deltas;

    // Stream straight into iMessage: first chunk is a real message, edited
    // in place as more arrives. Delegated replies carry the bot attribution
    // on the first chunk.
    async function* guarded(): AsyncGenerator<string> {
      let first = true;
      for await (const delta of deltas) {
        if (Date.now() - lastCancelCheck > CANCEL_POLL_MS) {
          lastCancelCheck = Date.now();
          if (await chainCancelled(supabase, job.spaceId, chainStartedAt)) {
            cancelled = true;
            await stopRun(runTarget, run.run_id).catch(() => undefined);
            return;
          }
        }
        yield first ? `${botPrefix}${delta}` : delta;
        first = false;
      }
    }
    // Tapback lane: when the whole reply is one tapback emoji, pin it to the
    // human's last message as a native reaction instead of a new bubble
    // (SOUL.md tells the agent this convention). Anything longer streams
    // exactly as before, prefixed by what the probe consumed.
    const iterator = guarded()[Symbol.asyncIterator]();
    const probe = await probeForTapback(iterator);
    // Synthetic carried rows (bridge markers) are not real iMessages, so a
    // reaction can never pin to them; target the last real inbound instead.
    const tapbackTarget = [...drained]
      .reverse()
      .find((message) => !isBridgeMarkerId(message.message_id))?.message_id;
    if (probe.tapback && tapbackTarget && !cancelled) {
      const reacted = await sender
        .react(job.spaceId, job.phone, tapbackTarget, probe.tapback)
        .catch(() => false);
      if (!reacted) {
        // Thread the short acknowledgment under the human's message so it
        // reads like a native reply rather than a floating bubble.
        const threaded = await sender
          .sendReply(
            job.spaceId,
            job.phone,
            tapbackTarget,
            probe.buffered.trim()
          )
          .catch(() => false);
        if (!threaded) {
          await sender.sendText(job.spaceId, job.phone, probe.buffered.trim());
        }
      }
    } else if (!(probe.ended && probe.buffered.length === 0)) {
      async function* remainder(): AsyncGenerator<string> {
        if (probe.buffered) yield probe.buffered;
        if (probe.ended) return;
        for (;;) {
          const next = await iterator.next();
          if (next.done) return;
          yield next.value;
        }
      }
      await streamBubbles(sender, job.spaceId, job.phone, remainder());
    }

    if (!cancelled && stripped.files.length > 0) {
      await deliverSendFiles(
        sender,
        box.boxId,
        job.spaceId,
        job.phone,
        stripped.files
      ).catch(() => 0);
    }

    // Cards are owner-scoped (C15): only a tier-0 thread is the owner's own
    // conversation, so a marker in a reply to a shared-line contact is never
    // minted into their thread. The reply text may still promise a card, so
    // the contact gets the same owner-only line as the explicit /<app> path.
    if (!cancelled && stripped.cards.length > 0) {
      if (job.senderTier === 0) {
        await sendMarkedCards(
          supabase,
          { userId: job.userId, spaceId: job.spaceId, phone: job.phone },
          stripped.cards
        ).catch(() => 0);
      } else {
        await sender
          .sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE)
          .catch(() => undefined);
      }
    }

    if (cancelled) {
      // Losing nothing: the drained messages ride into the next batch as
      // history. The successor chain owns the flush job now.
      await carryMessages(supabase, job.userId, job.spaceId, drained);
      return;
    }

    // V6: a purchase outcome recorded mid-run already inserted this run's
    // row (keyed by hermes_run_id) — close it instead of duplicating, and
    // never overwrite a purchase_* outcome with the generic "completed".
    const { data: existingRun } = await supabase
      .from("agent_runs")
      .select("id")
      .eq("user_id", job.userId)
      .eq("hermes_run_id", run.run_id)
      .limit(1)
      .maybeSingle();
    if (existingRun) {
      await supabase
        .from("agent_runs")
        .update({ started_at: startedAt, ended_at: new Date().toISOString() })
        .eq("id", existingRun.id);
    } else {
      await supabase
        .from("agent_runs")
        .insert({
          user_id: job.userId,
          hermes_run_id: run.run_id,
          trigger: "imessage",
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          outcome: "completed",
        });
    }
    // If a new inbound arrived while we streamed, its flush owns the job now.
    if (!(await chainCancelled(supabase, job.spaceId, chainStartedAt))) {
      await supabase
        .from("flush_jobs")
        .delete()
        .eq("space_id", job.spaceId)
        .eq("chain_started_at", chainStartedAt);
    }
  } finally {
    // Re-arm the idle deadline no matter how the turn ended: ensureBoxAwake
    // cleared it, and a throw mid-turn must not leave the box awake with no
    // deadline. Monotonic, so a no-op for boxes that never woke.
    await armStopAfter(supabase, job.userId).catch(() => undefined);
    await sender.close().catch(() => undefined);
  }
}

/**
 * True when this message opened a fresh burst: nothing else queued or
 * carried for the chat, so the quick-ack lane may speak once. Mid-burst
 * messages and retry turns (which already sent a holding line) stay quiet.
 */
export async function isBurstStart(
  supabase: SupabaseClient,
  spaceId: string
): Promise<boolean> {
  const [queued, carried] = await Promise.all([
    supabase
      .from("batch_queue")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId),
    supabase
      .from("carried_messages")
      .select("id", { count: "exact", head: true })
      .eq("space_id", spaceId),
  ]);
  return (queued.count ?? 0) <= 1 && (carried.count ?? 0) === 0;
}

/**
 * Record that a quick ack went out (or is about to): inserted BEFORE the
 * ack is generated so the real turn can never drain the queue first and
 * answer unaware, double-greeting the user.
 */
export async function carryQuickAckMarker(
  supabase: SupabaseClient,
  userId: string,
  spaceId: string
): Promise<string> {
  const messageId = `${BRIDGE_MESSAGE_ID_PREFIX}ack-${Date.now()}`;
  await supabase.from("carried_messages").insert({
    user_id: userId,
    space_id: spaceId,
    message_id: messageId,
    body: QUICK_ACK_CARRY_MARKER,
  });
  return messageId;
}

/**
 * Swap the generic marker for one that embeds the ack text the moment it's
 * known, so the agent sees exactly what went out and never re-answers a
 * question the ack fully covered. Best-effort: if the turn already drained
 * the generic marker, the update matches nothing and the generic contract
 * still holds.
 */
export async function updateQuickAckMarker(
  supabase: SupabaseClient,
  spaceId: string,
  messageId: string,
  ack: string
): Promise<void> {
  await supabase
    .from("carried_messages")
    .update({ body: quickAckCarryMarker(ack) })
    .eq("space_id", spaceId)
    .eq("message_id", messageId);
}

/**
 * Remove the marker when no ack actually reached the user (completion
 * returned null or the send failed), so the real turn is never told an
 * acknowledgment went out when none did. Best-effort like the update:
 * if the turn already drained the row, the delete matches nothing.
 */
export async function dropQuickAckMarker(
  supabase: SupabaseClient,
  spaceId: string,
  messageId: string
): Promise<void> {
  await supabase
    .from("carried_messages")
    .delete()
    .eq("space_id", spaceId)
    .eq("message_id", messageId);
}

/** Debounce wait + claim + run; the webhook route calls this via after(). */
export async function flushAfterDebounce(
  supabase: SupabaseClient,
  message: InboundMessage,
  runAt: string
): Promise<void> {
  const waitMs = new Date(runAt).getTime() - Date.now();
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  const claim = await claimFlush(supabase, message.spaceId, runAt);
  if (!claim) return; // a later message owns the flush now
  const { data } = await supabase
    .from("flush_jobs")
    .select("attempts")
    .eq("space_id", message.spaceId)
    .maybeSingle();
  await runFlush(
    supabase,
    {
      spaceId: message.spaceId,
      userId: message.userId,
      phone: message.phone,
      attempts: (data?.attempts as number | undefined) ?? 0,
      senderTier: message.senderTier ?? null,
    },
    claim.chainStartedAt
  );
}
