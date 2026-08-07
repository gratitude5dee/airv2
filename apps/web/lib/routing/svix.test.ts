import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { SvixWebhookError, verifySvixSignature } from "./svix";

const KEY = Buffer.from("super-secret-webhook-key");
const SECRET = `whsec_${KEY.toString("base64")}`;

function sign(id: string, timestamp: number, rawBody: Uint8Array): string {
  const digest = createHmac("sha256", KEY)
    .update(Buffer.concat([Buffer.from(`${id}.${timestamp}.`), Buffer.from(rawBody)]))
    .digest("base64");
  return `v1,${digest}`;
}

describe("verifySvixSignature", () => {
  const body = Buffer.from(JSON.stringify({ type: "message.received" }));

  it("accepts a valid v1 signature", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    expect(() =>
      verifySvixSignature({
        headers: {
          id: "msg_1",
          timestamp: String(timestamp),
          signature: sign("msg_1", timestamp, body),
        },
        rawBody: body,
        secret: SECRET,
      })
    ).not.toThrow();
  });

  it("rejects missing headers", () => {
    expect(() =>
      verifySvixSignature({ headers: {}, rawBody: body, secret: SECRET })
    ).toThrowError(SvixWebhookError);
  });

  it("rejects a stale timestamp", () => {
    const stale = Math.floor(Date.now() / 1000) - 6 * 60;
    expect(() =>
      verifySvixSignature({
        headers: {
          id: "msg_1",
          timestamp: String(stale),
          signature: sign("msg_1", stale, body),
        },
        rawBody: body,
        secret: SECRET,
      })
    ).toThrowError(/stale/);
  });

  it("rejects a wrong signature", () => {
    const timestamp = Math.floor(Date.now() / 1000);
    expect(() =>
      verifySvixSignature({
        headers: {
          id: "msg_1",
          timestamp: String(timestamp),
          signature: sign("msg_other", timestamp, body),
        },
        rawBody: body,
        secret: SECRET,
      })
    ).toThrowError(/invalid signature/);
  });
});
