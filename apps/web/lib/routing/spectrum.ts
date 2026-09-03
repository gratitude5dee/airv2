/**
 * Spectrum inbound webhook verification and reduction.
 *
 * Mirrors the hardened reference implementation: HMAC-SHA256 over
 * `v0:{timestamp}:{rawBody}` with the per-webhook signing secret, 5-minute
 * staleness rejection, timingSafeEqual, secret-safe errors, and reduction of
 * the payload to routing-only identifiers — no content or media is persisted
 * (C4/I2).
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export class SpectrumWebhookError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SpectrumWebhookError";
    this.status = status;
  }
}

export interface SpectrumWebhookHeaders {
  event?: string | undefined;
  signature?: string | undefined;
  timestamp?: string | undefined;
  webhookId?: string | undefined;
}

/**
 * Routing identifiers plus the in-flight text/attachment metadata the
 * debounced turn needs. Only the identifiers are persisted to
 * inbound_events; text lives transiently in batch_queue until drained (C4).
 */
export interface InboundSpectrumMessage {
  messageId: string;
  /** The line's phone (E.164), or the literal "shared" on pool lines. */
  phone?: string | undefined;
  platform: "imessage";
  senderId?: string | undefined;
  spaceId: string;
  webhookId?: string | undefined;
  text?: string | undefined;
  /** Metadata only — bytes are fetched via getAttachment through the SDK. */
  attachmentIds: string[];
}

type UnknownRecord = Record<string, unknown>;

const asRecord = (value: unknown): UnknownRecord | undefined =>
  typeof value === "object" && value !== null
    ? (value as UnknownRecord)
    : undefined;

const asString = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;

export function spectrumWebhookHeaders(
  headers: Headers
): SpectrumWebhookHeaders {
  return {
    event: headers.get("x-spectrum-event") ?? undefined,
    signature: headers.get("x-spectrum-signature") ?? undefined,
    timestamp: headers.get("x-spectrum-timestamp") ?? undefined,
    webhookId: headers.get("x-spectrum-webhook-id") ?? undefined,
  };
}

/** Verifies the HMAC before JSON is parsed, preserving the exact bytes. */
export function verifySpectrumSignature(input: {
  headers: SpectrumWebhookHeaders;
  rawBody: Uint8Array;
  signingSecret: string;
  now?: number;
}): void {
  const { headers, rawBody, signingSecret } = input;
  const { signature, timestamp } = headers;
  if (!(signature && timestamp)) {
    throw new SpectrumWebhookError(400, "missing signature headers");
  }
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1_000);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_TOLERANCE_SECONDS
  ) {
    throw new SpectrumWebhookError(400, "stale or invalid timestamp");
  }
  const signedPrefix = Buffer.from(`v0:${timestamp}:`, "utf8");
  const expected = createHmac("sha256", signingSecret)
    .update(Buffer.concat([signedPrefix, Buffer.from(rawBody)]))
    .digest();
  const providedValue = signature.startsWith("v0=")
    ? signature.slice(3)
    : signature;
  const provided = Buffer.from(providedValue, "hex");
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    throw new SpectrumWebhookError(401, "invalid signature");
  }
}

/** Content types whose `id` is fetchable through getAttachment (voice memos included). */
const ATTACHMENT_TYPES = new Set(["attachment", "voice"]);

/**
 * Walk one content node, collecting attachment ids and text in message order.
 * A group bubble (photo + caption, an album) is `{type: "group", items:
 * Message[]}` where every item is a full message carrying its own `content`;
 * effects and replies wrap a single inner `content`. The pre-`items` shape
 * (`contents: Content[]`) is still accepted.
 */
function collectContent(
  node: UnknownRecord | undefined,
  attachmentIds: string[],
  textParts: string[]
): void {
  if (!node) return;
  const type = asString(node["type"])?.toLowerCase();
  if (type && ATTACHMENT_TYPES.has(type)) {
    const id = asString(node["id"]);
    if (id) attachmentIds.push(id);
    return;
  }
  const text = asString(node["text"]);
  if (text) textParts.push(text);
  const inner = asRecord(node["content"]);
  if (inner) collectContent(inner, attachmentIds, textParts);
  for (const key of ["items", "contents"] as const) {
    const items = node[key];
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const record = asRecord(item);
      if (!record) continue;
      // An `items` entry is a message (content nested); a `contents` entry
      // is the content itself.
      collectContent(asRecord(record["content"]) ?? record, attachmentIds, textParts);
    }
  }
}

/**
 * Reduces a verified Spectrum event to routing identifiers. Returns undefined
 * for non-conversational deliveries (outbound echoes, read receipts, other
 * platforms) that should be acknowledged and ignored.
 */
export function parseInboundSpectrumMessage(
  rawBody: Uint8Array,
  headers: SpectrumWebhookHeaders
): InboundSpectrumMessage | undefined {
  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(rawBody).toString("utf8"));
  } catch {
    throw new SpectrumWebhookError(400, "invalid JSON body");
  }
  const envelope = asRecord(payload);
  if (!envelope || envelope["event"] !== "messages") {
    return undefined;
  }
  const message = asRecord(envelope["message"]);
  if (!message) {
    throw new SpectrumWebhookError(400, "invalid message payload");
  }
  const content = asRecord(message["content"]);
  const isReadReceipt =
    asString(content?.["type"])?.toLowerCase() === "read";
  if (message["direction"] === "outbound" || isReadReceipt) {
    return undefined;
  }
  const embeddedSpace = asRecord(message["space"]);
  const space = asRecord(envelope["space"]) ?? embeddedSpace;
  const messageId = asString(message["id"]);
  const spaceId = asString(space?.["id"]);
  if (!(messageId && spaceId)) {
    throw new SpectrumWebhookError(400, "message payload is missing identifiers");
  }
  const platform =
    asString(message["platform"]) ??
    asString(embeddedSpace?.["platform"]) ??
    asString(space?.["platform"]);
  if (platform?.toLowerCase() !== "imessage") {
    return undefined;
  }
  const sender = asRecord(message["sender"]);
  const attachmentIds: string[] = [];
  const textParts: string[] = [];
  collectContent(content, attachmentIds, textParts);
  return {
    messageId,
    phone: asString(space?.["phone"]) ?? asString(embeddedSpace?.["phone"]),
    platform: "imessage",
    senderId: asString(sender?.["id"]),
    spaceId,
    webhookId: headers.webhookId,
    text: textParts.length > 0 ? textParts.join("\n") : undefined,
    attachmentIds,
  };
}
