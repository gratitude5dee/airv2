/**
 * iMessage-path eval helpers: Spectrum webhook signing, the inbound envelope
 * the control plane accepts, and the timing math over recorded outbound
 * bubbles. Pure functions — the runner (imessage.ts) wires them to HTTP.
 *
 * The signature scheme mirrors apps/web/lib/routing/spectrum.ts
 * (verifySpectrumSignature): HMAC-SHA256 over `v0:{timestamp}:{rawBody}`
 * emitted as `v0=<hex>`; imessage-lib.test.ts proves the parity against the
 * real verifier so the two cannot drift apart silently.
 */
import { createHmac, randomUUID } from "node:crypto";

export interface WebhookTarget {
  /** Per-webhook signing secret (SPECTRUM_WEBHOOK_SECRET on the plane). */
  signingSecret: string;
  /** The space the line owns; must match a lines/handles row for the user. */
  spaceId: string;
  /** The line's phone (E.164) the turn is delivered on. */
  phone: string;
  /** Sender handle id that resolves to a trust tier (tier 0 = owner). */
  senderId: string;
}

export function signSpectrumWebhook(
  signingSecret: string,
  timestampSeconds: number,
  rawBody: Uint8Array
): string {
  const digest = createHmac("sha256", signingSecret)
    .update(
      Buffer.concat([
        Buffer.from(`v0:${timestampSeconds}:`, "utf8"),
        Buffer.from(rawBody),
      ])
    )
    .digest("hex");
  return `v0=${digest}`;
}

export interface SignedWebhook {
  rawBody: string;
  headers: Record<string, string>;
  messageId: string;
  webhookId: string;
}

/** One inbound iMessage text event, signed for POST /api/inbound/imessage. */
export function buildSignedInboundWebhook(
  target: WebhookTarget,
  text: string,
  timestampSeconds: number = Math.floor(Date.now() / 1000)
): SignedWebhook {
  const messageId = randomUUID();
  const webhookId = randomUUID();
  const rawBody = JSON.stringify({
    event: "messages",
    message: {
      id: messageId,
      direction: "inbound",
      sender: { id: target.senderId },
      platform: "iMessage",
      content: { type: "text", text },
      space: { id: target.spaceId, phone: target.phone, platform: "imessage" },
    },
    space: { id: target.spaceId, phone: target.phone, platform: "imessage" },
  });
  return {
    rawBody,
    messageId,
    webhookId,
    headers: {
      "content-type": "application/json",
      "x-spectrum-event": "messages",
      "x-spectrum-signature": signSpectrumWebhook(
        target.signingSecret,
        timestampSeconds,
        Buffer.from(rawBody, "utf8")
      ),
      "x-spectrum-timestamp": String(timestampSeconds),
      "x-spectrum-webhook-id": webhookId,
    },
  };
}

/**
 * One event the recording Spectrum sender POSTed to the harness listener.
 * `at` is the sender-side ISO stamp; `received_ms` is stamped by the
 * listener on arrival — all latency math uses `received_ms` so a clock skew
 * between planes cannot move a measurement.
 */
export interface RecordedSenderEvent {
  kind: string;
  at?: string;
  received_ms: number;
  [key: string]: unknown;
}

/** Sender kinds that produce a visible bubble in the chat. */
export const BUBBLE_KINDS = new Set([
  "sendText",
  "sendReply",
  "streamText",
  "sendApp",
  "editApp",
  "sendAttachment",
  "sendRichLink",
]);

/** Kinds that are visible but not bubbles — tracked for the reaction SLA. */
export const REACTION_KINDS = new Set(["react"]);

export interface IMessageCaseTiming {
  /** ms from webhook POST to the first outbound bubble; null when none. */
  firstBubbleMs: number | null;
  /** ms from webhook POST to the last outbound bubble; null when none. */
  finalBubbleMs: number | null;
  /** ms from webhook POST to the first tapback reaction; null when none. */
  firstReactionMs: number | null;
  bubbles: number;
  reactions: number;
}

export function timingFromEvents(
  events: RecordedSenderEvent[],
  postedAtMs: number
): IMessageCaseTiming {
  const bubbles = events
    .filter((event) => BUBBLE_KINDS.has(event.kind))
    .map((event) => event.received_ms);
  const reactions = events
    .filter((event) => REACTION_KINDS.has(event.kind))
    .map((event) => event.received_ms);
  return {
    firstBubbleMs: bubbles.length ? Math.min(...bubbles) - postedAtMs : null,
    finalBubbleMs: bubbles.length ? Math.max(...bubbles) - postedAtMs : null,
    firstReactionMs: reactions.length
      ? Math.min(...reactions) - postedAtMs
      : null,
    bubbles: bubbles.length,
    reactions: reactions.length,
  };
}

/** Nearest-rank percentile over unsorted values; null for an empty input. */
export function percentile(values: number[], p: number): number | null {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * sorted.length));
  return sorted[Math.min(rank, sorted.length) - 1]!;
}

export interface TimingSummary {
  cases: number;
  /** Cases that produced at least one outbound bubble. */
  answered: number;
  firstBubbleP50Ms: number | null;
  firstBubbleP95Ms: number | null;
  finalBubbleP50Ms: number | null;
  finalBubbleP95Ms: number | null;
  firstReactionP50Ms: number | null;
  firstReactionP95Ms: number | null;
}

export function summarizeTimings(timings: IMessageCaseTiming[]): TimingSummary {
  const first = timings
    .map((t) => t.firstBubbleMs)
    .filter((v): v is number => v !== null);
  const final = timings
    .map((t) => t.finalBubbleMs)
    .filter((v): v is number => v !== null);
  const reaction = timings
    .map((t) => t.firstReactionMs)
    .filter((v): v is number => v !== null);
  return {
    cases: timings.length,
    answered: first.length,
    firstBubbleP50Ms: percentile(first, 50),
    firstBubbleP95Ms: percentile(first, 95),
    finalBubbleP50Ms: percentile(final, 50),
    finalBubbleP95Ms: percentile(final, 95),
    firstReactionP50Ms: percentile(reaction, 50),
    firstReactionP95Ms: percentile(reaction, 95),
  };
}
