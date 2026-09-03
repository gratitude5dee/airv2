import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  SpectrumWebhookError,
  parseInboundSpectrumMessage,
  verifySpectrumSignature,
} from "./spectrum";

const SECRET = "test-signing-secret";

function sign(rawBody: Uint8Array, timestamp: number): string {
  const digest = createHmac("sha256", SECRET)
    .update(Buffer.concat([Buffer.from(`v0:${timestamp}:`), Buffer.from(rawBody)]))
    .digest("hex");
  return `v0=${digest}`;
}

function makeBody(overrides?: Record<string, unknown>): Uint8Array {
  return Buffer.from(
    JSON.stringify({
      event: "messages",
      space: { id: "space-1", phone: "+15550001111", platform: "imessage" },
      message: {
        id: "msg-1",
        direction: "inbound",
        platform: "imessage",
        sender: { id: "+15552223333" },
        content: { type: "text", text: "hello there" },
      },
      ...overrides,
    })
  );
}

describe("verifySpectrumSignature", () => {
  it("accepts a valid signature within tolerance", () => {
    const body = makeBody();
    const timestamp = Math.floor(Date.now() / 1000);
    expect(() =>
      verifySpectrumSignature({
        headers: { signature: sign(body, timestamp), timestamp: String(timestamp) },
        rawBody: body,
        signingSecret: SECRET,
      })
    ).not.toThrow();
  });

  it("rejects a missing signature", () => {
    expect(() =>
      verifySpectrumSignature({
        headers: {},
        rawBody: makeBody(),
        signingSecret: SECRET,
      })
    ).toThrowError(SpectrumWebhookError);
  });

  it("rejects a stale timestamp (>5 minutes)", () => {
    const body = makeBody();
    const stale = Math.floor(Date.now() / 1000) - 6 * 60;
    expect(() =>
      verifySpectrumSignature({
        headers: { signature: sign(body, stale), timestamp: String(stale) },
        rawBody: body,
        signingSecret: SECRET,
      })
    ).toThrowError(/stale/);
  });

  it("rejects a tampered body", () => {
    const body = makeBody();
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = sign(body, timestamp);
    const tampered = makeBody({ extra: true });
    expect(() =>
      verifySpectrumSignature({
        headers: { signature, timestamp: String(timestamp) },
        rawBody: tampered,
        signingSecret: SECRET,
      })
    ).toThrowError(/invalid signature/);
  });
});

describe("parseInboundSpectrumMessage", () => {
  it("reduces a message to routing identifiers only", () => {
    const inbound = parseInboundSpectrumMessage(makeBody(), {
      webhookId: "wh-1",
    });
    expect(inbound).toEqual({
      messageId: "msg-1",
      phone: "+15550001111",
      platform: "imessage",
      senderId: "+15552223333",
      spaceId: "space-1",
      webhookId: "wh-1",
      text: "hello there",
      attachmentIds: [],
    });
  });

  it("extracts text and attachment ids from a group bubble", () => {
    const body = makeBody({
      message: {
        id: "msg-4",
        direction: "inbound",
        platform: "imessage",
        sender: { id: "+15552223333" },
        content: {
          type: "group",
          contents: [
            { type: "attachment", id: "att-1", name: "logo.png" },
            { type: "text", text: "/zap intro animation" },
          ],
        },
      },
    });
    const inbound = parseInboundSpectrumMessage(body, {});
    expect(inbound?.text).toBe("/zap intro animation");
    expect(inbound?.attachmentIds).toEqual(["att-1"]);
  });

  it("reads a Spectrum group whose items are nested messages (photo + caption)", () => {
    const body = makeBody({
      message: {
        id: "msg-5",
        direction: "inbound",
        platform: "imessage",
        sender: { id: "+15552223333" },
        content: {
          type: "group",
          items: [
            {
              id: "msg-5a",
              content: { type: "attachment", id: "att-heic", mimeType: "image/heic" },
            },
            {
              id: "msg-5b",
              content: { type: "attachment", id: "att-mov", mimeType: "video/quicktime" },
            },
            { id: "msg-5c", content: { type: "text", text: "/zap make it rain" } },
          ],
        },
      },
    });
    const inbound = parseInboundSpectrumMessage(body, {});
    expect(inbound?.text).toBe("/zap make it rain");
    expect(inbound?.attachmentIds).toEqual(["att-heic", "att-mov"]);
  });

  it("treats a voice memo as a fetchable attachment", () => {
    const body = makeBody({
      message: {
        id: "msg-6",
        direction: "inbound",
        platform: "imessage",
        sender: { id: "+15552223333" },
        content: { type: "voice", id: "att-voice", mimeType: "audio/x-m4a" },
      },
    });
    const inbound = parseInboundSpectrumMessage(body, {});
    expect(inbound?.text).toBeUndefined();
    expect(inbound?.attachmentIds).toEqual(["att-voice"]);
  });

  it("unwraps effect and reply envelopes without following reply targets", () => {
    const body = makeBody({
      message: {
        id: "msg-7",
        direction: "inbound",
        platform: "imessage",
        sender: { id: "+15552223333" },
        content: {
          type: "reply",
          content: {
            type: "effect",
            effect: "slam",
            content: { type: "text", text: "/zap louder" },
          },
          target: {
            id: "msg-old",
            content: { type: "attachment", id: "att-old" },
          },
        },
      },
    });
    const inbound = parseInboundSpectrumMessage(body, {});
    expect(inbound?.text).toBe("/zap louder");
    expect(inbound?.attachmentIds).toEqual([]);
  });

  it("ignores outbound echoes", () => {
    const body = Buffer.from(
      JSON.stringify({
        event: "messages",
        space: { id: "space-1", platform: "imessage" },
        message: { id: "msg-2", direction: "outbound", platform: "imessage" },
      })
    );
    expect(parseInboundSpectrumMessage(body, {})).toBeUndefined();
  });

  it("ignores read receipts", () => {
    const body = makeBody({
      message: {
        id: "msg-3",
        direction: "inbound",
        platform: "imessage",
        content: { type: "read" },
      },
    });
    expect(parseInboundSpectrumMessage(body, {})).toBeUndefined();
  });
});
