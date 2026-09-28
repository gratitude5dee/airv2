/**
 * iMessage outbound helpers for the Spectrum inbound webhook: the warm
 * sender lifecycle, the immediate tapback, the first-bubble reply, and the
 * durable body composition. Extracted from the route (R-ARCH-07) so each
 * piece unit-tests without NextRequest. The webhook keeps only its ordered
 * pipeline; every send path lives here.
 */
import { after } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  carryQuickAckMarker,
  dropQuickAckMarker,
  isBurstStart,
  updateQuickAckMarker,
  type InboundMessage,
} from "../orchestrator/flush";
import { type InitialResponse } from "../orchestrator/sharedBridge";
import {
  ACK_REACTION,
  hasExplicitResponseLane,
  INITIAL_REPLY_SLA_MS,
  REACTION_SLA_MS,
} from "../orchestrator/ttfk";
import { createSpectrumSender } from "../spectrum/sender";
import { type FastReactionSender } from "../spectrum/fast-reaction";
import type { InboundSpectrumMessage } from "./spectrum";

/**
 * Compose the durable body for an inbound message: attachment marker and
 * location-share marker, never content coordinates (§2.6, C4).
 */
export function composeInboundBody(
  inbound: Pick<
    InboundSpectrumMessage,
    "attachmentIds" | "locationSignal" | "text"
  >,
): string {
  const marker =
    inbound.attachmentIds.length > 0
      ? `[attachment:${inbound.attachmentIds.join(",")}]`
      : "";
  // A private Find My share is persisted as a marker only — the
  // coordinates never reach Postgres (§2.6, C4).
  return inbound.locationSignal
    ? ["[location shared]", inbound.text ?? ""].filter(Boolean).join("\n")
    : [marker, inbound.text ?? ""].filter(Boolean).join("\n");
}

/**
 * Reply on the line: thread under the source message when the target
 * resolves, plain send otherwise.
 */
export async function sendLineReply(
  spaceId: string,
  phone: string,
  messageId: string,
  text: string,
  senderPromise?: ReturnType<typeof warmSpectrumSender>,
): Promise<void> {
  const sender = await (senderPromise ?? warmSpectrumSender());
  if (!sender) return;
  try {
    const threaded = await sender
      .sendReply(spaceId, phone, messageId, text)
      .catch(() => false);
    if (!threaded) await sender.sendText(spaceId, phone, text);
  } finally {
    await sender.close().catch(() => undefined);
  }
}

/**
 * Token minting and gRPC client construction are read-only, but account for a
 * material part of first-kindness latency. Start them as soon as a known user
 * route exists, while dedupe/onboarding/trust checks continue. No send occurs
 * until those gates pass, so tier-2 contacts still cause zero outbound work.
 */
export function warmSpectrumSender() {
  return createSpectrumSender().catch(() => undefined);
}

export async function closeWarmSpectrumSender(
  senderPromise: ReturnType<typeof warmSpectrumSender> | undefined,
): Promise<void> {
  const sender = await senderPromise;
  await sender?.close().catch(() => undefined);
}

export function closeWarmSpectrumSenderAfter(
  senderPromise: ReturnType<typeof warmSpectrumSender> | undefined,
): void {
  if (!senderPromise) return;
  after(() => closeWarmSpectrumSender(senderPromise));
}

export async function withWarmSenderCleanup<T>(
  operation: Promise<T>,
  senderPromise: ReturnType<typeof warmSpectrumSender> | undefined,
): Promise<T> {
  try {
    return await operation;
  } catch (error) {
    closeWarmSpectrumSenderAfter(senderPromise);
    throw error;
  }
}

/**
 * Starts before the HTTP response is returned. The promise is awaited from
 * `after()` so serverless teardown cannot interrupt it, but establishing the
 * Spectrum connection and sending the tapback do not wait for debounce,
 * box wake, or a model request.
 */
export async function sendImmediateReaction(
  fastSenderPromise: Promise<FastReactionSender | undefined> | undefined,
  senderPromise: ReturnType<typeof warmSpectrumSender>,
  message: InboundMessage,
  receivedAtMs: number
): Promise<void> {
  let transport: "grpc-direct" | "spectrum-fallback" = "grpc-direct";
  let fastSender: FastReactionSender | undefined;
  let reacted = false;
  try {
    fastSender = await fastSenderPromise?.catch(() => undefined);
    reacted = fastSender
      ? await fastSender
          .react(message.spaceId, message.messageId, ACK_REACTION)
          .catch(() => false)
      : false;
  } finally {
    await fastSender?.close().catch(() => undefined);
  }
  if (!reacted) {
    transport = "spectrum-fallback";
    const sender = await senderPromise;
    reacted = sender
      ? await sender
          .react(
            message.spaceId,
            message.phone,
            message.messageId,
            ACK_REACTION,
          )
          .catch(() => false)
      : false;
  }
  const elapsedMs = Date.now() - receivedAtMs;
  console.info(
    JSON.stringify({
      msg: "imessage ttfk reaction",
      user_id: message.userId,
      space_id: message.spaceId,
      delivered: reacted,
      transport,
      elapsed_ms: elapsedMs,
      within_sla: elapsedMs <= REACTION_SLA_MS,
    })
  );
}

/**
 * A single first bubble per settled burst. The marker is present for normal
 * agent turns so the final model reply never repeats the acknowledgement.
 * Explicit commands own their deterministic response lane, so they receive
 * the visible line without introducing a marker into their command input.
 */
export async function sendInitialReply(
  supabase: SupabaseClient,
  sender: Awaited<ReturnType<typeof createSpectrumSender>> | undefined,
  message: InboundMessage,
  body: string,
  response: InitialResponse,
  receivedAtMs: number
): Promise<boolean> {
  if (!sender || !(await isBurstStart(supabase, message.spaceId))) return false;
  const isCommand =
    body.trimStart().startsWith("/") || hasExplicitResponseLane(body);
  const markerId = isCommand || response.disposition === "final"
    ? undefined
    : await carryQuickAckMarker(supabase, message.userId, message.spaceId);
  let sent = false;
  try {
    await sender.sendText(message.spaceId, message.phone, response.body);
    sent = true;
    if (markerId) {
      await updateQuickAckMarker(
        supabase,
        message.spaceId,
        markerId,
        response.body
      );
    }
    console.info(
      JSON.stringify({
        msg: "imessage ttfk initial reply",
        user_id: message.userId,
        space_id: message.spaceId,
        elapsed_ms: Date.now() - receivedAtMs,
        within_sla: Date.now() - receivedAtMs <= INITIAL_REPLY_SLA_MS,
        kind: isCommand ? "command" : "agent",
        disposition: response.disposition,
        source: response.source,
      })
    );
    return response.disposition === "final";
  } finally {
    if (markerId && !sent) {
      await dropQuickAckMarker(supabase, message.spaceId, markerId);
    }
  }
}
