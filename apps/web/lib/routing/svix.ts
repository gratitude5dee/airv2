/**
 * Svix webhook signature verification for the AgentMail inbound webhook —
 * the same discipline as lib/routing/spectrum.ts adapted to Svix's scheme:
 * HMAC-SHA256 over `{id}.{timestamp}.{rawBody}` keyed by the base64 portion
 * of the `whsec_` secret, compared with timingSafeEqual, with 5-minute
 * staleness rejection.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

const TIMESTAMP_TOLERANCE_SECONDS = 5 * 60;

export class SvixWebhookError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "SvixWebhookError";
    this.status = status;
  }
}

export interface SvixHeaders {
  id?: string | undefined;
  timestamp?: string | undefined;
  signature?: string | undefined;
}

export function svixHeaders(headers: Headers): SvixHeaders {
  return {
    id: headers.get("svix-id") ?? undefined,
    timestamp: headers.get("svix-timestamp") ?? undefined,
    signature: headers.get("svix-signature") ?? undefined,
  };
}

export function verifySvixSignature(input: {
  headers: SvixHeaders;
  rawBody: Uint8Array;
  /** The `whsec_...` webhook secret. */
  secret: string;
  now?: number;
}): void {
  const { headers, rawBody, secret } = input;
  const { id, timestamp, signature } = headers;
  if (!(id && timestamp && signature)) {
    throw new SvixWebhookError(400, "missing svix headers");
  }
  const timestampSeconds = Number(timestamp);
  const nowSeconds = Math.floor((input.now ?? Date.now()) / 1_000);
  if (
    !Number.isFinite(timestampSeconds) ||
    Math.abs(nowSeconds - timestampSeconds) > TIMESTAMP_TOLERANCE_SECONDS
  ) {
    throw new SvixWebhookError(400, "stale or invalid timestamp");
  }
  const key = Buffer.from(
    secret.startsWith("whsec_") ? secret.slice(6) : secret,
    "base64"
  );
  const signedContent = Buffer.concat([
    Buffer.from(`${id}.${timestamp}.`, "utf8"),
    Buffer.from(rawBody),
  ]);
  const expected = createHmac("sha256", key).update(signedContent).digest();
  // svix-signature is space-delimited: "v1,<base64> v1,<base64> ..."
  for (const candidate of signature.split(" ")) {
    const [version, value] = candidate.split(",", 2);
    if (version !== "v1" || !value) {
      continue;
    }
    const provided = Buffer.from(value, "base64");
    if (provided.length === expected.length && timingSafeEqual(provided, expected)) {
      return;
    }
  }
  throw new SvixWebhookError(401, "invalid signature");
}
