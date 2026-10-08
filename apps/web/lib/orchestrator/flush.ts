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
import { db } from "../db";
import { log } from "../log";
import { completeOperation } from "../migration/admission";
import { command, writeFile } from "../box/client";
import {
  createRun,
  ensureSession,
  type HermesBoxTarget,
  loadConversationTranscript,
  MAIN_SESSION,
  MAIN_SESSION_TITLE,
  runEvents,
  stopRun,
} from "../hermes/client";
import type { ConversationMessage } from "../hermes/history";
import { isStateDatabaseError, logStateDatabaseHealth } from "../hermes/stateHealth";
import { maybeRecoverStateDatabase } from "../hermes/stateRecovery";
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
import { maybeOpenIntake, recordAskingReply } from "../create/intake";
import { maybeRunDrawLane } from "../miniapps/drawCommand";
import { maybeRunFreezeLane } from "../miniapps/freezeCommand";
import { maybeRunTwinLane } from "../identity/twinCommand";
import { maybeRunLocationLane } from "../location/lane";
import { enqueueMuseHandoff } from "../muse/commands";
import { parseTradeCommand } from "../trade/parse";
import { runTradeCommand } from "../trade/imessage";
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
  progressUpdateReply,
  quickAckCarryMarker,
  sharedBridgeReply,
} from "./sharedBridge";
import { streamBubbles } from "./bubbles";
import {
  shouldStartProgressTimeline,
  startProgressTimeline,
  type ProgressTimeline,
} from "./ttfk";

const ATTACHMENT_MARKER = /^\[attachment:([^\]]+)\]$/;

export const DEBOUNCE_MS = 2_500;
/** Media and its explicit command are already paired in one webhook. */
export const CREATIVE_READY_DEBOUNCE_MS = 250;
/**
 * How long a media bubble or a creative command waits for its counterpart.
 * iMessage sends a photo and its typed caption as separate webhooks when the
 * user attaches, then types; either order lands inside this window.
 */
export const REFERENCE_WINDOW_MS = 3_000;
export const MAX_ATTEMPTS = 5;
const CANCEL_POLL_MS = 2_000;
/**
 * A Hermes turn may keep its SSE body open forever after the headers arrive.
 * A request must start promptly, but a started tool-using turn needs longer
 * than one model-response window to finish. We still buffer it so a retry can
 * never duplicate a partial iMessage.
 */
export const INITIAL_RESPONSE_DEADLINE_MS = 45_000;
export const FINAL_RESPONSE_DEADLINE_MS = 120_000;
const LIVE_DEADLINE_POLL_MS = 250;

export async function beforeDeadline<T>(
  pending: Promise<T>,
  deadlineAt: number,
  message: string
): Promise<T> {
  const remainingMs = deadlineAt - Date.now();
  // A zero-delay timer still loses to an already-resolved promise in the
  // microtask queue. Without this guard, a busy SSE stream can keep winning
  // after the absolute deadline and turn 45 seconds into an unbounded wait.
  if (remainingMs <= 0) throw new Error(message);
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      pending,
      new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new Error(message)), remainingMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * Initial-response deadline that re-arms on stream activity. The 45s
 * window exists to catch a dead stream, not to bound a working one:
 * reasoning deltas and tool calls never surface as text through
 * hermesDeltas, so a turn whose model thinks before speaking was killed
 * mid-work and retried with the identical input — a deterministic
 * livelock. Real events (anything with a `data:` frame; keepalive
 * comments don't count) push the window to `activity.at + 45s`; the
 * absolute cap stays `hardCapAt` (the 120s final deadline), so a turn
 * actively streaming gets at most the final deadline to emit first text.
 */
export async function untilLiveDeadline<T>(
  pending: Promise<T>,
  activity: { at: number },
  deadlineAt: number,
  hardCapAt: number,
  message: string
): Promise<T> {
  const settled = pending.then(
    (value) => ({ ok: true as const, value }),
    (error: unknown) => ({ ok: false as const, error })
  );
  for (;;) {
    const effectiveAt = Math.min(
      Math.max(deadlineAt, activity.at + INITIAL_RESPONSE_DEADLINE_MS),
      hardCapAt
    );
    const remainingMs = effectiveAt - Date.now();
    if (remainingMs <= 0) throw new Error(message);
    const winner = await Promise.race([
      settled,
      new Promise<"tick">((resolve) =>
        setTimeout(
          () => resolve("tick"),
          Math.min(remainingMs, LIVE_DEADLINE_POLL_MS)
        )
      ),
    ]);
    if (winner === "tick") continue;
    if (winner.ok) return winner.value;
    throw winner.error;
  }
}

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
  sender_id?: string | undefined;
  /** The sender's resolved trust tier at enqueue (migration 0130). */
  sender_tier?: number | null | undefined;
  received_at?: string | undefined;
}

/** A row whose tier was never recorded reads as least-trusted, never owner. */
const UNKNOWN_SENDER_TIER = 2;

/** Sender trust for a queued row: its own tier, else the job's scheduled one. */
function burstRowTier(
  row: QueuedMessage,
  jobTier: number | null | undefined
): number {
  return row.sender_tier ?? jobTier ?? UNKNOWN_SENDER_TIER;
}

/** Who a queued row speaks for inside the composed input. */
function senderLabel(row: QueuedMessage): string {
  if (row.sender_tier === 0) return "owner";
  return row.sender_id ?? "unknown";
}

const HAS_ATTACHMENT_MARKER = /\[attachment:[^\]]+\]/;

/** The debounce a message earns: media and creative commands wait for each other. */
const MINIAPP_COMMAND = /(^|[^A-Za-z0-9_/])\/(draw|freeze|twin)(?=$|[^A-Za-z0-9_-])/i;
export function debounceMsFor(body: string): number {
  const command = parseExplicitGenerationCommand(body);
  const readyCreative = command && !("ambiguous" in command);
  if (
    HAS_ATTACHMENT_MARKER.test(body) &&
    (readyCreative || MINIAPP_COMMAND.test(body))
  ) {
    return CREATIVE_READY_DEBOUNCE_MS;
  }
  if (HAS_ATTACHMENT_MARKER.test(body)) return REFERENCE_WINDOW_MS;
  // Mini-app commands earn the same window as creative commands — the
  // photo they act on often lands as a second message inside the burst.
  if (MINIAPP_COMMAND.test(body)) return REFERENCE_WINDOW_MS;
  if (command && !("ambiguous" in command)) return REFERENCE_WINDOW_MS;
  return DEBOUNCE_MS;
}

function referenceCandidate(body: string): boolean {
  const command = parseExplicitGenerationCommand(body);
  return (
    HAS_ATTACHMENT_MARKER.test(body) ||
    MINIAPP_COMMAND.test(body) ||
    Boolean(command && !("ambiguous" in command))
  );
}

/** True once the transient burst already contains both media and its command. */
export function hasCompleteReferencePair(bodies: readonly string[]): boolean {
  const hasMedia = bodies.some((body) => HAS_ATTACHMENT_MARKER.test(body));
  const hasCommand = bodies.some((body) => {
    if (MINIAPP_COMMAND.test(body)) return true;
    const command = parseExplicitGenerationCommand(body);
    return Boolean(command && !("ambiguous" in command));
  });
  return hasMedia && hasCommand;
}

/**
 * Move the chat's flush deadline for this message and return it. The choice
 * happens inside the upsert (schedule_flush, migration 0082) so overlapping
 * webhooks serialize on the row: every inbound owns a fresh, strictly later
 * run_at (claimFlush matches on it), but a short-debounce bubble must not
 * pull an open reference window in — a caption typed right after a photo
 * lands inside its 3s, so the later deadline wins (+1ms for ownership). Only
 * a deadline still within the window counts; a backoff reschedule (minutes
 * out) is pulled in by fresh input. cancelled_at is stamped here, on the same
 * clock that writes chain_started_at, so isCancelled compares like with like.
 */
export async function scheduleFlush(
  supabase: SupabaseClient,
  message: InboundMessage,
  completeReferencePair = false,
): Promise<string> {
  const now = Date.now();
  const debounceMs = completeReferencePair
    ? CREATIVE_READY_DEBOUNCE_MS
    : debounceMsFor(message.body);
  const { data, error } = await supabase.rpc("schedule_flush", {
    p_space_id: message.spaceId,
    p_user_id: message.userId,
    p_phone: message.phone,
    // V6 (C20): the purchase route reads this to keep offer-the-fill
    // owner-initiated. Fail closed: unknown tier is never owner.
    p_sender_tier: message.senderTier ?? null,
    p_run_at: new Date(now + debounceMs).toISOString(),
    // Closing the window once both halves exist lets migration 0082 replace
    // the earlier 3s deadline instead of preserving it.
    p_window_end: new Date(
      now + (completeReferencePair ? debounceMs : REFERENCE_WINDOW_MS)
    ).toISOString(),
    p_cancelled_at: new Date(now).toISOString(),
  });
  if (error) {
    throw new Error(`schedule_flush failed: ${error.message}`);
  }
  const runAt = new Date(String(data)).getTime();
  if (!Number.isFinite(runAt)) {
    throw new Error(`schedule_flush returned no deadline: ${String(data)}`);
  }
  return new Date(runAt).toISOString();
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
    sender_tier: message.senderTier ?? null,
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
      log.error("imessage_destinations upsert failed", {box_id: null,
        user_id: message.userId,
          error: destError.message,});
    }
  }

  let completeReferencePair = hasCompleteReferencePair([message.body]);
  if (!completeReferencePair && referenceCandidate(message.body)) {
    try {
      const { data, error } = await supabase
        .from("batch_queue")
        .select("body")
        .eq("space_id", message.spaceId)
        .order("received_at", { ascending: false })
        .limit(20);
      if (!error) {
        completeReferencePair = hasCompleteReferencePair(
          (data ?? []).map((row) => String(row.body ?? ""))
        );
      }
    } catch (error) {
      // Scheduling remains correct (only slower) if this optional look-ahead
      // is unavailable during a rolling deployment.
      log.warn("batch_queue lookahead failed", {
        user_id: message.userId,
        box_id: null,
        space_id: message.spaceId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    runAt: await scheduleFlush(supabase, message, completeReferencePair),
  };
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
): Promise<{ chainStartedAt: string; operationId?: string } | undefined> {
  const chainStartedAt = new Date().toISOString();
  // claim_flush CAS + admission check + operation lease in one statement: a
  // migration that closed admission between our read and this claim wins,
  // and the flush is deferred rather than racing the fence. While the
  // migration is dark-shipped the function may not exist yet — fall back to
  // the plain CAS so flushes keep working pre-deploy.
  let data: unknown = null;
  let error: { message: string } | null = null;
  try {
    ({ data, error } = await supabase.rpc("claim_flush", {
      p_space_id: spaceId,
      p_expected_run_at: expectedRunAt,
      p_chain_started_at: chainStartedAt,
      p_ttl_seconds: 300,
    }));
  } catch (rpcError) {
    error = { message: String(rpcError) };
  }
  if (error) {
    const { data: claimed } = await supabase
      .from("flush_jobs")
      .update({ chain_started_at: chainStartedAt })
      .eq("space_id", spaceId)
      .eq("run_at", expectedRunAt)
      .select("space_id");
    if (!claimed || claimed.length === 0) return undefined;
    return { chainStartedAt };
  }
  const result = data as {
    claimed?: boolean;
    chain_started_at?: string;
    operation_id?: string;
    reason?: string;
  } | null;
  if (!result?.claimed) return undefined;
  const out: { chainStartedAt: string; operationId?: string } = {
    chainStartedAt: result.chain_started_at ?? chainStartedAt,
  };
  if (result.operation_id) out.operationId = result.operation_id;
  return out;
}

/** Read in arrival order, then delete exactly the rows read. */
async function drainTable(
  supabase: SupabaseClient,
  table: "batch_queue" | "carried_messages",
  spaceId: string
): Promise<QueuedMessage[]> {
  const { data, error } = await supabase
    .from(table)
    .select("id, message_id, body, sender_id, sender_tier, received_at")
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

/**
 * Prior-chain remnants read as history, not fresh input. Every real body
 * carries its sender (R-SEC-02): a mixed burst must never read as one
 * undifferentiated voice — an owner bubble that lands after a contact's
 * text stays labelled as the owner's, and vice versa. Synthetic bridge
 * markers are the agent's own earlier output, not a sender, so they keep
 * their marker shape unlabelled.
 */
export function composeInput(
  carried: QueuedMessage[],
  fresh: QueuedMessage[]
): string {
  const parts: string[] = [];
  for (const message of carried) {
    parts.push(
      isBridgeMarkerId(message.message_id)
        ? `[Earlier message] ${message.body}`
        : `[Earlier message] [from ${senderLabel(message)}] ${message.body}`
    );
  }
  for (const message of fresh) {
    parts.push(`[from ${senderLabel(message)}] ${message.body}`);
  }
  return parts.join("\n");
}

/**
 * Deterministic response lanes receive the user's burst, not acknowledgments
 * previously sent by the bridge — and not sender labels either: the lanes'
 * command parsers are line-anchored on raw user text, so they keep seeing
 * the unlabelled bodies the webhook wrote. Real carried user rows keep their
 * original message ids, so they remain part of the command input.
 */
export function composeResponseLaneInput(
  carried: QueuedMessage[],
  fresh: QueuedMessage[]
): string {
  const parts: string[] = [];
  for (const message of carried) {
    if (isBridgeMarkerId(message.message_id)) continue;
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
      // Sender labels and the carried marker prefix the body (R-SEC-02);
      // the marker match and the rewrite must skip both.
      const prefix =
        /^(?:\[Earlier message\] )?(?:\[from [^\]]*\] )?/.exec(line)?.[0] ?? "";
      const match = ATTACHMENT_MARKER.exec(line.slice(prefix.length));
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
      return `${prefix}${parts.join(" ")}`;
    })
  );
  return lines.join("\n");
}

/** Parse Hermes SSE into text deltas; throws on run.failed. */
export async function* hermesDeltas(
  stream: ReadableStream<Uint8Array>,
  onDone?: (output: string) => void,
  onFirstDelta?: () => void,
  onActivity?: () => void
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
        // Reasoning/tool events never yield text but prove the run is alive
        // — the initial-response deadline re-arms on them (keepalive
        // comments carry no `data:` line and never reach this point).
        onActivity?.();
        if (event.event === "message.delta" && event.delta) {
          if (!sawDelta) onFirstDelta?.();
          sawDelta = true;
          yield event.delta;
        } else if (event.event === "run.completed") {
          // A completed event without either deltas or a final output would
          // otherwise look like a successful turn and silently consume the
          // human's queued message without sending a reply.
          if (!sawDelta && !event.output?.trim()) {
            throw new Error("run completed without a response");
          }
          if (!sawDelta && event.output) {
            onFirstDelta?.();
            yield event.output;
          }
          onDone?.(event.output ?? "");
          return;
        } else if (event.event === "run.failed") {
          throw new Error(event.error ?? "run failed");
        }
      }
    }
    // The upstream must terminate the SSE stream with run.completed or
    // run.failed. Treat a truncated stream as retryable rather than letting
    // it masquerade as an empty, successfully delivered answer.
    throw new Error("run event stream ended before completion");
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

/**
 * True when the box answers a stop with "run not found": the stale run
 * already ended (or the box lost its run table to a rebuild/restart), so
 * there is nothing left to kill and nothing alive to overlap. Anything
 * else — timeout, 5xx, unreachable — may still be a live run worth holding
 * the burst for.
 */
function runAlreadyGone(error: unknown): boolean {
  return (
    error instanceof Error &&
    (/run_not_found/i.test(error.message) ||
      /run not found/i.test(error.message))
  );
}

async function carryMessages(
  supabase: SupabaseClient,
  userId: string,
  spaceId: string,
  messages: QueuedMessage[]
): Promise<void> {
  if (messages.length === 0) return;
  // Unchecked this insert can drop a whole carried burst (R-ARCH-05).
  await db.write(
    supabase.from("carried_messages").insert(
      messages.map((message) => ({
        user_id: userId,
        space_id: spaceId,
        sender_id: message.sender_id ?? null,
        sender_tier: message.sender_tier ?? null,
        message_id: message.message_id,
        body: message.body,
      }))
    ),
    { what: "carried_messages insert", user_id: userId }
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
  // Unchecked this insert can drop a whole requeued burst (R-ARCH-05).
  await db.write(
    supabase.from("batch_queue").insert(
      messages.map((message) => ({
        user_id: userId,
        space_id: spaceId,
        phone,
        sender_id: message.sender_id ?? null,
        sender_tier: message.sender_tier ?? null,
        message_id: message.message_id,
        body: message.body,
      }))
    ),
    { what: "batch_queue requeue insert", user_id: userId }
  );
}

/**
 * The tapback probe runs before the first iMessage bubble is created. If the
 * model stream fails there, the drained burst has not produced any visible
 * reply and is therefore safe to carry forward and retry without duplicates.
 */
async function retryUndeliveredStream(
  supabase: SupabaseClient,
  job: {
    spaceId: string;
    userId: string;
    phone: string;
    attempts: number;
  },
  chainStartedAt: string,
  drained: QueuedMessage[],
  sender: SpectrumSender,
  error: unknown,
  statusAlreadyAttempted = false
): Promise<void> {
  if (await chainCancelled(supabase, job.spaceId, chainStartedAt)) {
    // A newer inbound already owns the job. Preserve this burst as history
    // for that successor, but never overwrite its deadline with a backoff.
    await carryMessages(supabase, job.userId, job.spaceId, drained);
    return;
  }

  if (job.attempts >= MAX_ATTEMPTS) {
    // The identical burst already failed this way MAX_ATTEMPTS times —
    // carrying it once more only guarantees the next claim dies the same
    // way (the dead-burst livelock). Drop it, close the job, and say so
    // honestly: resending beats an endless "still working on it" loop.
    log.error("imessage stream retries exhausted", {box_id: null,
        user_id: job.userId,
        space_id: job.spaceId,
        attempts: job.attempts,
        error: error instanceof Error ? error.message : String(error),});
    await supabase
      .from("flush_jobs")
      .delete()
      .eq("space_id", job.spaceId)
      .eq("chain_started_at", chainStartedAt);
    await sender
      .sendText(
        job.spaceId,
        job.phone,
        "i couldn't finish that one — send it again?"
      )
      .catch(() => undefined);
    return;
  }

  await carryMessages(supabase, job.userId, job.spaceId, drained);
  await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
  log.error("imessage stream retry scheduled", {box_id: null,
        user_id: job.userId,
      space_id: job.spaceId,
      attempt: job.attempts + 1,
      error: error instanceof Error ? error.message : String(error),});

  // A single visible status avoids another silent failure while the durable
  // retry runs. Later retries stay quiet so an extended provider outage does
  // not flood the conversation.
  if (job.attempts === 0 && !statusAlreadyAttempted) {
    await notifyFirstRetry(job, sender);
  }
}

async function notifyFirstRetry(
  job: { spaceId: string; phone: string; attempts: number },
  sender: SpectrumSender
): Promise<boolean> {
  if (job.attempts !== 0) return false;
  await sender
    .sendText(
      job.spaceId,
      job.phone,
      "I need a little more time. I’m continuing with the same request."
    )
    .catch(() => undefined);
  return true;
}

/**
 * Evaluate the anchored command lanes one queued message at a time.
 *
 * The card, create, and trade parsers all anchor on the WHOLE input —
 * but the burst composes bodies with "\n" and carried rows gain an
 * "[Earlier message]" prefix — so a single carry made every queued
 * command permanently unmatchable: "/calendar" inside a burst degraded
 * into a doomed model turn instead of an instant card. Each iMessage is
 * its own command unit, so the lanes run per body. A consumed message
 * leaves the model input: its card, intake, or order reply IS the
 * response (leaving it in would double-answer).
 *
 * Lane precedence per message mirrors the old whole-burst order:
 * /create intake → mini-app card → /trade command. Draw/freeze/twin/
 * creative/location stay whole-input after this pass — those parsers
 * already scan multi-line bursts, and attachments deliberately span
 * messages. Identical repeated commands deliver once.
 *
 * One command annotates instead of consuming: an owner `/create` opens
 * the intake and prepends its hook line, but the command text stays in
 * the burst — the Planner reads the prompt from the model input.
 *
 * Returns the consumed row ids plus any intake lines to prepend to the
 * model input, or "requeued" when a registry lookup failed and the
 * un-delivered remainder was requeued for backoff.
 */
async function deliverBurstCommands(
  supabase: SupabaseClient,
  sender: SpectrumSender,
  job: {
    spaceId: string;
    userId: string;
    phone: string;
    attempts: number;
    senderTier: number | null;
  },
  drained: QueuedMessage[]
): Promise<
  | { consumed: Set<string>; intakeLines: string[]; createSeen: boolean }
  | "requeued"
> {
  const laneJob = {
    spaceId: job.spaceId,
    userId: job.userId,
    phone: job.phone,
    senderTier: job.senderTier,
  };
  const consumed = new Set<string>();
  const intakeLines: string[] = [];
  const seen = new Set<string>();
  let createSeen = false;
  for (const message of drained) {
    if (isBridgeMarkerId(message.message_id)) continue;
    const body = (message.body ?? "").trim();
    if (!body) continue;
    const key = body.toLowerCase();
    // The repeat is still consumed — it was already answered once.
    if (seen.has(key)) {
      consumed.add(message.id);
      continue;
    }
    seen.add(key);

    const intake = await maybeOpenIntake(supabase, sender, laneJob, body);
    if (intake) {
      createSeen = true;
      if (intake.kind === "owner") {
        // An owner /create annotates the turn, it does not consume it: the
        // Planner runs in air-main and reads the prompt from the model
        // input, so the command text must stay in the burst.
        intakeLines.push(intake.line);
      } else {
        // Non-owner got the owner-only line inside maybeOpenIntake; the
        // command itself must not reach the model turn.
        consumed.add(message.id);
      }
      continue;
    }

    try {
      if (await maybeSendMiniAppLink(supabase, sender, laneJob, body)) {
        consumed.add(message.id);
        continue;
      }
    } catch (error) {
      if (error instanceof MiniAppRegistryLookupError) {
        if (job.attempts < MAX_ATTEMPTS) {
          // Only the un-delivered remainder retries — a card already sent
          // must not send again.
          await requeueMessages(
            supabase,
            job.userId,
            job.spaceId,
            job.phone,
            drained.filter((m) => !consumed.has(m.id))
          );
          await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
          return "requeued";
        }
        throw error;
      }
      log.error("mini-app command failed", {box_id: null,
          user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),});
      await sender
        .sendText(
          job.spaceId,
          job.phone,
          "couldn't open that mini-app. try again?"
        )
        .catch(() => undefined);
      consumed.add(message.id);
      continue;
    }

    const tradeCommand = parseTradeCommand(body);
    if (tradeCommand) {
      try {
        const { handled } = await runTradeCommand(
          supabase,
          (text) => sender.sendText(job.spaceId, job.phone, text),
          { ...laneJob, sender },
          tradeCommand
        );
        if (handled) {
          consumed.add(message.id);
          continue;
        }
      } catch (error) {
        log.error("trade command failed", {box_id: null,
            user_id: job.userId,
            error: error instanceof Error ? error.message : String(error),});
        await sender
          .sendText(job.spaceId, job.phone, "couldn't reach trading. try again?")
          .catch(() => undefined);
        consumed.add(message.id);
        continue;
      }
    }
  }
  return { consumed, intakeLines, createSeen };
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
 * Returns null when an existing session returns no transcript rows even
 * after a retry — running that turn would answer with total amnesia, so the
 * caller should hold the burst and try again rather than reply blank. A
 * transcript whose rows sanitise to nothing replayable (user inputs with no
 * assistant reply yet) is not amnesia: the store is hydrated, so the turn
 * proceeds with an empty history.
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
    log.error("session ensure failed before run", {box_id: null,
        user_id: context.userId,
        space_id: context.spaceId,
        session_id: sessionId,
        error: error instanceof Error ? error.message : String(error),});
  }
  let transcript = await loadConversationTranscript(target, sessionId);
  if (transcript.rows === 0 && !firstTurn) {
    // One immediate retry: the load is best-effort and a transient proxy
    // hiccup or a box mid-resume often clears within a moment.
    transcript = await loadConversationTranscript(target, sessionId);
  }
  if (transcript.rows === 0 && !firstTurn) {
    log.error("history replay empty on existing session", {box_id: null,
        user_id: context.userId,
        space_id: context.spaceId,
        session_id: sessionId,});
    return null;
  }
  log.info("history replayed", {box_id: null,
        user_id: context.userId,
      space_id: context.spaceId,
      session_id: sessionId,
      rows: transcript.rows,
      messages: transcript.history.length,
      first_turn: firstTurn,});
  return transcript.history;
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
  chainStartedAt: string,
  sender?: SpectrumSender
): Promise<void> {
  try {
    await runFlushInner(supabase, job, chainStartedAt, sender);
  } finally {
    // Release the claim_flush operation lease (held under the space id);
    // expiry is the backstop when this invocation died mid-run.
    await completeOperation(supabase, job.spaceId);
  }
}

async function runFlushInner(
  supabase: SupabaseClient,
  job: {
    spaceId: string;
    userId: string;
    phone: string;
    attempts: number;
    senderTier: number | null;
  },
  chainStartedAt: string,
  sharedSender?: SpectrumSender
): Promise<void> {
  // Connect to Spectrum BEFORE draining: draining deletes the queued rows,
  // so a sender that cannot be created (e.g. a Spectrum/Cloudflare 502)
  // must leave the burst in the queue and retry with backoff instead of
  // silently destroying it. A sharedSender is the turn's warm sender
  // (R-PERF-04): already connected, and owned by the caller — never closed
  // here, so the webhook's tapback/receipts and the flush share one init.
  const ownsSender = !sharedSender;
  let sender: SpectrumSender;
  if (sharedSender) {
    sender = sharedSender;
  } else {
    try {
      sender = await createSpectrumSender("flush");
    } catch (error) {
      if (job.attempts < MAX_ATTEMPTS) {
        await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
        return;
      }
      throw error;
    }
  }
  let progressTimeline: ProgressTimeline | undefined;
  
  try {
    const carried = await drainCarried(supabase, job.spaceId);
    const fresh = await drainQueue(supabase, job.spaceId);
    const drained = [...carried, ...fresh];
    if (drained.length === 0) {
      await supabase.from("flush_jobs").delete().eq("space_id", job.spaceId);
      return;
    }
    // R-SEC-02: the burst's trust is its least-trusted message — the highest
    // tier number across every queued row — never the last message's. An
    // owner bubble landing after a contact's text must not lift the burst
    // back into the owner's session. Rows without a recorded tier (legacy
    // rows, synthetic lane requeues) fall back to the job's scheduled tier,
    // then to unknown.
    const burstTier = drained.reduce(
      (tier, row) => Math.max(tier, burstRowTier(row, job.senderTier)),
      0
    );
    // The least-trusted sender still in the burst names the contact session.
    const burstSenderId =
      [...drained]
        .reverse()
        .find(
          (row) =>
            burstRowTier(row, job.senderTier) === burstTier && row.sender_id
        )?.sender_id ??
      [...drained].reverse().find((row) => row.sender_id)?.sender_id;
    // R-SEC-01: run metadata carries the burst's tier and a sender ref —
    // "owner" or contact:<sender_id>, the same ref that names the session.
    const senderRef =
      burstTier === 0 ? "owner" : `contact:${burstSenderId ?? "unknown"}`;
    // Anchored command lanes run per message before anything composes the
    // burst — see deliverBurstCommands. A consumed command's deterministic
    // reply is its whole turn; it must also stay out of every later
    // carry/requeue so the retry never re-delivers it.
    const burstCommands = await deliverBurstCommands(
      supabase,
      sender,
      {
        spaceId: job.spaceId,
        userId: job.userId,
        phone: job.phone,
        attempts: job.attempts,
        senderTier: burstTier,
      },
      drained
    );
    if (burstCommands === "requeued") return;
    const consumedIds = burstCommands.consumed;
    const carriedLeft = carried.filter((m) => !consumedIds.has(m.id));
    const freshLeft = fresh.filter((m) => !consumedIds.has(m.id));
    const remaining = [...carriedLeft, ...freshLeft];
    if (!remaining.some((m) => !isBridgeMarkerId(m.message_id))) {
      if (!(await chainCancelled(supabase, job.spaceId, chainStartedAt))) {
        await supabase
          .from("flush_jobs")
          .delete()
          .eq("space_id", job.spaceId)
          .eq("chain_started_at", chainStartedAt);
      }
      return;
    }
    let rawInput = composeInput(carriedLeft, freshLeft);
    const responseLaneInput = composeResponseLaneInput(
      carriedLeft,
      freshLeft
    );
    // Timed progress starts from the first fresh iMessage, not from when a
    // warm box happened to finish booting. Retried carried work has already
    // received a visible update, so it never restarts this clock.
    const firstFreshAt = freshLeft[0]?.received_at;
    const receivedAtMs = firstFreshAt ? Date.parse(firstFreshAt) : Number.NaN;
    if (
      fresh.length > 0 &&
      Number.isFinite(receivedAtMs) &&
      shouldStartProgressTimeline(responseLaneInput)
    ) {
      progressTimeline = startProgressTimeline({
        receivedAtMs,
        send: (body) => sender.sendText(job.spaceId, job.phone, body),
        generate: (stage) =>
          progressUpdateReply(supabase, job.userId, responseLaneInput, stage),
        onSent: (stage, elapsedMs, generated) => {
          log.info("imessage ttfk progress", {box_id: null,
        user_id: job.userId,
              space_id: job.spaceId,
              stage,
              elapsed_ms: elapsedMs,
              generated,});
        },
      });
    }
    // /draw runs before the generic card path: a bare command must mint a
    // session-bound studio card, and "/draw <prompt> [image]" also consumes
    // the burst for the auto-start job.
    try {
      const handled = await maybeRunDrawLane(
        supabase,
        sender,
        {
          spaceId: job.spaceId,
          userId: job.userId,
          phone: job.phone,
          senderTier: burstTier,
        },
        responseLaneInput
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
            remaining
          );
          await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
          return;
        }
        throw error;
      }
      log.error("draw command failed", {box_id: null,
        user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),});
      await sender
        .sendText(job.spaceId, job.phone, "couldn't open draw. try again?")
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
    // /freeze runs next, same shape as /draw: a bare command mints a
    // session-bound studio card; "/freeze <prompt>" consumes the burst for
    // a sketch-lane source render.
    try {
      const handled = await maybeRunFreezeLane(
        supabase,
        sender,
        {
          spaceId: job.spaceId,
          userId: job.userId,
          phone: job.phone,
          senderTier: burstTier,
        },
        responseLaneInput
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
            remaining
          );
          await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
          return;
        }
        throw error;
      }
      log.error("freeze command failed", {box_id: null,
        user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),});
      await sender
        .sendText(job.spaceId, job.phone, "couldn't open freeze. try again?")
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
    // V12 §8.1: "/create <text>" intakes opened per message in
    // deliverBurstCommands mark the turn here — the Planner itself runs in
    // air-main (V11 §9.2), so the turn is never short-circuited. Each intake
    // line rides the model input in message order.
    for (const line of burstCommands.intakeLines) {
      rawInput = `${line}\n${rawInput}`;
    }
    // V13 §9.2 (F1): a non-`/create` reply while the owner's newest intake is
    // at `asking` counts as the owner's answer — record it before the turn
    // runs so `plan_written` can never hit an intake that never left asking.
    if (!burstCommands.createSeen) {
      await recordAskingReply(supabase, job.userId).catch(() => undefined);
    }
    // /twin lane: the digital twin speaks or poses as the owner — voice
    // clone + lip-sync, or an identity-anchored image. Owner-only, consent
    // checked server-side, delivered like a creative job; ordinary prose
    // and the other commands fall through unchanged.
    try {
      const handled = await maybeRunTwinLane(
        supabase,
        sender,
        {
          spaceId: job.spaceId,
          userId: job.userId,
          phone: job.phone,
          senderTier: burstTier,
          ...(Number.isFinite(receivedAtMs) ? { receivedAtMs } : {}),
        },
        responseLaneInput
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
      log.error("twin lane failed", {box_id: null,
        user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),});
      await sender
        .sendText(job.spaceId, job.phone, "that one didn't come out. try again?")
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
        {
          spaceId: job.spaceId,
          userId: job.userId,
          phone: job.phone,
          ...(Number.isFinite(receivedAtMs) ? { receivedAtMs } : {}),
        },
        responseLaneInput
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
      log.error("creative lane failed", {box_id: null,
        user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),});
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
    // Find My lane (§5.1): a "near me" burst is held behind a Find My
    // request card and resolved by the sweep — it must not wake the box.
    // A share/ack also short-circuits here (it just expedites the pending
    // request). A fresh-enough prior share rides in as a context line.
    let locationContext: string | undefined;
    let locationInput: string | undefined;
    try {
      const located = await maybeRunLocationLane(
        supabase,
        sender,
        {
          spaceId: job.spaceId,
          userId: job.userId,
          phone: job.phone,
          senderTier: burstTier,
          senderId: remaining.find((row) => row.sender_id)?.sender_id,
        },
        // Lane input is unlabelled: the share marker and intent regexes
        // anchor on raw user lines.
        responseLaneInput,
        remaining[0]?.message_id ?? String(Date.now())
      );
      if (located.handled) {
        if (!(await chainCancelled(supabase, job.spaceId, chainStartedAt))) {
          await supabase
            .from("flush_jobs")
            .delete()
            .eq("space_id", job.spaceId)
            .eq("chain_started_at", chainStartedAt);
        }
        return;
      }
      locationContext = located.contextLine;
      // A captioned share with nothing pending: the caption is the turn.
      locationInput = located.inputOverride;
    } catch (error) {
      log.error("location lane failed", {box_id: null,
        user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),});
      // Location is best-effort: a lane failure must never eat the burst —
      // fall through so Hermes answers the "near me" text itself.
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
        await carryMessages(supabase, job.userId, job.spaceId, remaining);
        if (job.attempts === 0) {
          // Shared bridge (optibox rule 1: always answer something): a
          // restricted no-tools completion through the gateway answers the
          // burst right now, and the reply rides into the retried turn as
          // history so the agent continues instead of repeating. Any bridge
          // failure falls back to the static holding line.
          const bridged = await sharedBridgeReply(
            supabase,
            job.userId,
            locationInput ?? rawInput
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
            } catch (error) {
              // burst already carried above; retry owns the reply
              log.warn("imessage bridged reply send failed", {
                user_id: job.userId,
                box_id: null,
                space_id: job.spaceId,
                error: error instanceof Error ? error.message : String(error),
              });
            }
          } else {
            await sender
              .sendText(
                job.spaceId,
                job.phone,
                "Give me a few minutes — my computer is busy starting up. I'll reply as soon as it's ready."
              )
              .catch((error) =>
                log.warn("imessage holding line send failed", {
                  user_id: job.userId,
                  box_id: null,
                  space_id: job.spaceId,
                  error:
                    error instanceof Error ? error.message : String(error),
                })
              );
          }
        }
        await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
        return;
      }
      throw error;
    }

    const turnInput = locationInput ?? rawInput;
    const input = await materializeAttachments(
      sender,
      box.boxId,
      job.phone,
      locationContext ? `${locationContext}\n${turnInput}` : turnInput
    );

    // V7: an @mention validated against the roster delegates the burst to
    // that bot's canonical chat; the reply streams back attributed
    // ('\u{1F916} <name>: \u2026'). Unknown @words stay ordinary text for the
    // default agent. Roster read failures degrade to the default agent.
    // R-SEC-01: delegation is owner-only — a contact's text never enters a
    // bot's persistent chat either.
    let runTarget = box.target;
    // R-SEC-01: a non-owner burst never mounts the owner's air-main — it
    // runs in the contact's own session, so no owner history is replayed
    // and no owner memory is attached to the turn. Its own transcript is
    // replayed instead, keeping contact threads coherent across bursts.
    let runSession = burstTier === 0 ? MAIN_SESSION : senderRef;
    let runInput = input;
    let botPrefix = "";
    let botSessionCreated: boolean | undefined;
    try {
      const roster =
        burstTier === 0 ? await listBots(supabase, job.userId) : [];
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
      log.error("bot delegation skipped", {box_id: null,
        user_id: job.userId,
          error: error instanceof Error ? error.message : String(error),});
    }

    // No control-plane transcript replay: the run goes into a session
    // Hermes itself hydrates, so fetching and replaying the transcript here
    // only cost a round-trip per turn while truncating the box's own view.
    // The session is still ensured so a first turn has somewhere to
    // persist; the bot branch ensured its own session above.
    if (botSessionCreated === undefined) {
      try {
        await ensureSession(
          runTarget,
          runSession,
          runSession === MAIN_SESSION ? MAIN_SESSION_TITLE : senderRef
        );
      } catch (error) {
        log.error("session ensure failed before run", {box_id: null,
          user_id: job.userId,
          space_id: job.spaceId,
          session_id: runSession,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const initialResponseDeadlineAt = Date.now() + INITIAL_RESPONSE_DEADLINE_MS;
    const finalResponseDeadlineAt = Date.now() + FINAL_RESPONSE_DEADLINE_MS;
    // A retried attempt of this same burst may find the previous attempt's
    // run still alive — a crash after createRun wrote its id to flush_jobs
    // leaves it there (the row survives until a flush completes). Stop the
    // stale run before starting a second so two side-effectful runs never
    // overlap; a failed stop holds the burst for another retry instead
    // (R-ARCH-06).
    const { data: priorJob } = await supabase
      .from("flush_jobs")
      .select("hermes_run_id")
      .eq("space_id", job.spaceId)
      .maybeSingle();
    const priorRunId = (priorJob?.hermes_run_id as string | null) ?? null;
    if (priorRunId) {
      const stopped = await stopRun(runTarget, priorRunId)
        .then(() => true)
        .catch((error: unknown) => {
          // The box no longer knows this run — the stop is already satisfied,
          // so the stale id must not hold the burst forever (the dead-stop
          // livelock: the id stays set, every claim fails the same stop, and
          // the user's question is never run again).
          if (runAlreadyGone(error)) return true;
          log.error("imessage prior run stop failed", {
            user_id: job.userId,
            box_id: box.boxId,
            space_id: job.spaceId,
            hermes_run_id: priorRunId,
            error: error instanceof Error ? error.message : String(error),
          });
          return false;
        });
      if (!stopped) {
        // Mark the still-live run so a sweeper can finish it, and hold the
        // burst — never start a second run over it.
        await db
          .write(
            supabase
              .from("agent_runs")
              .update({
                ended_at: new Date().toISOString(),
                outcome: "stop_failed",
              })
              .eq("user_id", job.userId)
              .eq("hermes_run_id", priorRunId),
            {
              what: "mark unstopped prior run",
              user_id: job.userId,
              box_id: box.boxId,
            }
          )
          .catch((error: unknown) =>
            log.error("imessage stop_failed receipt write failed", {
              user_id: job.userId,
              box_id: box.boxId,
              space_id: job.spaceId,
              hermes_run_id: priorRunId,
              error: error instanceof Error ? error.message : String(error),
            })
          );
        if (await chainCancelled(supabase, job.spaceId, chainStartedAt)) {
          // A newer inbound already owns the job: carry this burst for it
          // and leave its deadline alone.
          await carryMessages(supabase, job.userId, job.spaceId, remaining);
          return;
        }
        if (job.attempts >= MAX_ATTEMPTS) {
          // Same dead-burst end as the stream path: holding again only
          // guarantees the next claim dies on the same stop. Drop the job
          // and say so honestly.
          log.error("imessage prior run stop retries exhausted", {
            box_id: box.boxId,
            user_id: job.userId,
            space_id: job.spaceId,
            hermes_run_id: priorRunId,
            attempts: job.attempts,
          });
          await supabase
            .from("flush_jobs")
            .delete()
            .eq("space_id", job.spaceId)
            .eq("chain_started_at", chainStartedAt);
          await sender
            .sendText(
              job.spaceId,
              job.phone,
              "i couldn't finish that one — send it again?"
            )
            .catch(() => undefined);
          return;
        }
        await carryMessages(supabase, job.userId, job.spaceId, remaining);
        await rescheduleWithBackoff(supabase, job.spaceId, job.attempts);
        return;
      }
      // Clear the stale id: a later retry must not hold the burst trying to
      // stop a run that is already dead.
      await db
        .write(
          supabase
            .from("flush_jobs")
            .update({ hermes_run_id: null })
            .eq("space_id", job.spaceId),
          {
            what: "clear stopped hermes_run_id",
            user_id: job.userId,
            box_id: box.boxId,
          }
        )
        .catch((error: unknown) =>
          log.error("imessage hermes_run_id clear failed", {
            user_id: job.userId,
            box_id: box.boxId,
            space_id: job.spaceId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
    }
    let run: Awaited<ReturnType<typeof createRun>>;
    try {
      run = await beforeDeadline(
        createRun(runTarget, {
          input: runInput,
          sessionId: runSession,
          // R-SEC-01: the run declares who wrote it — the burst's minimum
          // trust and the sender ref — so Hermes can attribute the turn.
          metadata: {
            channel: "imessage",
            sender_tier: String(burstTier),
            sender_ref: senderRef,
          },
          ...(burstTier > 0
            ? {
                author: {
                  id: senderRef,
                  name: burstSenderId ?? "unknown",
                  is_bot: false,
                },
              }
            : {}),
          idempotencyKey: `imessage-flush:${job.spaceId}:${remaining[0]?.message_id ?? chainStartedAt}`,
        }),
        initialResponseDeadlineAt,
        "Hermes did not create the run before the initial-response deadline"
      );
    } catch (error) {
      await retryUndeliveredStream(
        supabase,
        job,
        chainStartedAt,
        remaining,
        sender,
        error
      );
      return;
    }
    await supabase
      .from("flush_jobs")
      .update({ hermes_run_id: run.run_id })
      .eq("space_id", job.spaceId);

    const startedAt = new Date().toISOString();
    const { error: openReceiptError } = await supabase
      .from("agent_runs")
      .insert({
        user_id: job.userId,
        hermes_run_id: run.run_id,
        trigger: "imessage",
        sender_tier: job.senderTier ?? null,
        started_at: startedAt,
      });
    if (openReceiptError) {
      log.error("imessage agent run receipt open failed", {box_id: box.boxId,
        user_id: job.userId,
          hermes_run_id: run.run_id,
          error: openReceiptError.message,});
    }
    let cancelled = false;
    let lastCancelCheck = Date.now();
    let prepared: {
      stripped: ReturnType<typeof stripSendFileMarkers>;
      probe: Awaited<ReturnType<typeof probeForTapback>>;
    };
    try {
      const events = await beforeDeadline(
        runEvents(runTarget, run.run_id),
        initialResponseDeadlineAt,
        "Hermes did not open the event stream before the initial-response deadline"
      );
      // Outbound marker lanes: `[send-file: …]` and `[card: …]` markers are
      // stripped from the streamed text and delivered (native attachments,
      // mini-app cards) after the stream.
      const streamActivity = { at: Date.now() };
      const stripped = stripSendFileMarkers(
        hermesDeltas(events, undefined, () => progressTimeline?.stop(), () => {
          streamActivity.at = Date.now();
        })
      );
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
              const stopped = await stopRun(runTarget, run.run_id)
                .then(() => true)
                .catch((error: unknown) => {
                  log.error("imessage stop run after cancel failed", {
                    user_id: job.userId,
                    box_id: box.boxId,
                    space_id: job.spaceId,
                    hermes_run_id: run.run_id,
                    error:
                      error instanceof Error ? error.message : String(error),
                  });
                  return false;
                });
              if (!stopped) {
                // The run may still be alive and side-effecting — mark it so
                // a sweeper can finish the kill (R-ARCH-06).
                await db
                  .write(
                    supabase
                      .from("agent_runs")
                      .update({ outcome: "stop_failed" })
                      .eq("user_id", job.userId)
                      .eq("hermes_run_id", run.run_id),
                    {
                      what: "mark unstopped cancelled run",
                      user_id: job.userId,
                      box_id: box.boxId,
                    }
                  )
                  .catch((error: unknown) =>
                    log.error("imessage stop_failed receipt write failed", {
                      user_id: job.userId,
                      box_id: box.boxId,
                      space_id: job.spaceId,
                      hermes_run_id: run.run_id,
                      error:
                        error instanceof Error ? error.message : String(error),
                    })
                  );
              }
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
      const initialProbe = await untilLiveDeadline(
        probeForTapback(iterator),
        streamActivity,
        initialResponseDeadlineAt,
        finalResponseDeadlineAt,
        "Hermes did not begin a response within the initial-response window"
      );
      // Finish consuming the reply before Spectrum sees any of it. If Hermes
      // stalls after its first few tokens, the same durable burst can still be
      // retried without leaving a duplicate or half-answer in Messages.
      const replyChunks = initialProbe.buffered
        ? [initialProbe.buffered]
        : [];
      if (!initialProbe.ended) {
        for (;;) {
          const next = await beforeDeadline(
            iterator.next(),
            finalResponseDeadlineAt,
            "Hermes did not complete a response within 120 seconds"
          );
          if (next.done) break;
          replyChunks.push(next.value);
        }
      }
      prepared = {
        stripped,
        probe: {
          ...initialProbe,
          buffered: replyChunks.join(""),
          ended: true,
        },
      };
    } catch (error) {
      progressTimeline?.stop();
      // The user-facing deadline must not wait behind a slow or unavailable
      // stop endpoint. The durable retry is still scheduled only after the
      // stop attempt settles, which prevents overlapping side-effectful runs.
      const statusAttempted = await notifyFirstRetry(job, sender);
      let stopFailed = false;
      await stopRun(runTarget, run.run_id).catch((error: unknown) => {
        stopFailed = true;
        log.error("imessage stop run before retry failed", {
          user_id: job.userId,
          box_id: box.boxId,
          space_id: job.spaceId,
          hermes_run_id: run.run_id,
          error: error instanceof Error ? error.message : String(error),
        });
      });
      const { error: failReceiptError } = await supabase
        .from("agent_runs")
        .update({
          ended_at: new Date().toISOString(),
          // The retry creates a second run; when the stop itself failed the
          // first may still be alive — mark it so a sweeper can finish the
          // kill rather than leaving two overlapping side-effectful runs
          // (R-ARCH-06).
          outcome: stopFailed ? "stop_failed" : "first_response_failed",
        })
        .eq("user_id", job.userId)
        .eq("hermes_run_id", run.run_id);
      if (failReceiptError) {
        log.error("imessage agent run receipt failure close failed", {box_id: box.boxId,
        user_id: job.userId,
            hermes_run_id: run.run_id,
            error: failReceiptError.message,});
      }
      await retryUndeliveredStream(
        supabase,
        job,
        chainStartedAt,
        remaining,
        sender,
        error,
        statusAttempted
      );
      if (runSession === MAIN_SESSION && isStateDatabaseError(error)) {
        await logStateDatabaseHealth(box.boxId);
        await maybeRecoverStateDatabase(supabase, box.boxId);
      }
      return;
    }
    const { stripped, probe } = prepared;
    // Synthetic carried rows (bridge markers) are not real iMessages, so a
    // reaction can never pin to them; target the last real inbound instead.
    const tapbackTarget = [...remaining]
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
      }
      await streamBubbles(sender, job.spaceId, job.phone, remainder());
    }

    // Files are owner-scoped like cards: a tier-1 burst must never pull
    // bytes off the box, even an outbox file. There is no per-sender
    // deliverable lane yet — until one exists the whole lane stays closed.
    if (!cancelled && stripped.files.length > 0 && job.senderTier === 0) {
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
      if (burstTier === 0) {
        await sendMarkedCards(
          supabase,
          { userId: job.userId, spaceId: job.spaceId, phone: job.phone },
          stripped.cards,
          sender
        ).catch(() => 0);
      } else {
        await sender
          .sendText(job.spaceId, job.phone, OWNER_ONLY_CARD_LINE)
          .catch(() => undefined);
      }
    }

    // A box may hand an owner-requested subtask to Muse with one explicit
    // marker. The marker is removed before delivery; its content crosses
    // straight into the owner's per-user Worker queue and never reaches
    // Postgres or another sender's thread.
    if (!cancelled && stripped.muse) {
      await enqueueMuseHandoff(supabase, {
        userId: job.userId,
        text: stripped.muse,
        messageId: `${run.run_id}:muse`,
        agentHint: "air",
      }).catch(() => false);
    }

    if (cancelled) {
      // Losing nothing: the drained messages ride into the next batch as
      // history. The successor chain owns the flush job now.
      await carryMessages(supabase, job.userId, job.spaceId, remaining);
      return;
    }

    // V6: a purchase outcome recorded mid-run already inserted this run's
    // row (keyed by hermes_run_id) — close it instead of duplicating, and
    // never overwrite a purchase_* outcome with the generic "completed".
    const { data: existingRun, error: existingRunError } = await supabase
      .from("agent_runs")
      .select("id, outcome")
      .eq("user_id", job.userId)
      .eq("hermes_run_id", run.run_id)
      .limit(1)
      .maybeSingle();
    if (existingRunError) {
      log.error("imessage agent run receipt lookup failed", {box_id: box.boxId,
        user_id: job.userId,
          hermes_run_id: run.run_id,
          error: existingRunError.message,});
    } else if (existingRun) {
      const { error: updateReceiptError } = await supabase
        .from("agent_runs")
        .update({
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          // A purchase/approval handler may have already recorded a more
          // specific terminal outcome while Hermes was running. Preserve it.
          ...(!existingRun.outcome ? { outcome: "completed" } : {}),
        })
        .eq("id", existingRun.id);
      if (updateReceiptError) {
        log.error("imessage agent run receipt close failed", {box_id: box.boxId,
        user_id: job.userId,
            hermes_run_id: run.run_id,
            error: updateReceiptError.message,});
      }
    } else {
      const { error: insertReceiptError } = await supabase
        .from("agent_runs")
        .insert({
          user_id: job.userId,
          hermes_run_id: run.run_id,
          trigger: "imessage",
          started_at: startedAt,
          ended_at: new Date().toISOString(),
          outcome: "completed",
        });
      if (insertReceiptError) {
        log.error("imessage agent run receipt insert failed", {box_id: box.boxId,
        user_id: job.userId,
            hermes_run_id: run.run_id,
            error: insertReceiptError.message,});
      }
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
    progressTimeline?.stop();

    // Re-arm the idle deadline no matter how the turn ended: ensureBoxAwake
    // cleared it, and a throw mid-turn must not leave the box awake with no
    // deadline. Monotonic, so a no-op for boxes that never woke.
    await armStopAfter(supabase, job.userId).catch(() => undefined);
    if (ownsSender) await sender.close().catch(() => undefined);
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

/**
 * Debounce wait + claim + run; the webhook route calls this via after().
 * `sender` is the turn's warm Spectrum sender (R-PERF-04): the flush reuses
 * it for every send/lane/card instead of a second SDK init, and the route
 * retains ownership (it closes it after this resolves).
 */
export async function flushAfterDebounce(
  supabase: SupabaseClient,
  message: InboundMessage,
  runAt: string,
  sender?: SpectrumSender
): Promise<void> {
  const waitMs = new Date(runAt).getTime() - Date.now();
  if (waitMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, waitMs));
  }
  const claim = await claimFlush(supabase, message.spaceId, runAt);
  if (!claim) return; // a later message owns the flush now
  const { data } = await supabase
    .from("flush_jobs")
    .select("attempts, sender_tier")
    .eq("space_id", message.spaceId)
    .maybeSingle();
  await runFlush(
    supabase,
    {
      spaceId: message.spaceId,
      userId: message.userId,
      phone: message.phone,
      attempts: (data?.attempts as number | undefined) ?? 0,
      // The job row's folded minimum trust (schedule_flush, migration 0130),
      // not this caller's own tier — that was the last-message bug.
      senderTier:
        (data?.sender_tier as number | null | undefined) ??
        message.senderTier ??
        null,
    },
    claim.chainStartedAt,
    sender
  );
}
