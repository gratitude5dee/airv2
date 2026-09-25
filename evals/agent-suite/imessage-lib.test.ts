import { describe, expect, it } from "vitest";
import {
  parseInboundSpectrumMessage,
  verifySpectrumSignature,
  SpectrumWebhookError,
} from "../../apps/web/lib/routing/spectrum";
import {
  buildSignedInboundWebhook,
  percentile,
  summarizeTimings,
  timingFromEvents,
  type RecordedSenderEvent,
} from "./imessage-lib";

const TARGET = {
  signingSecret: "test-secret",
  spaceId: "space-abc",
  phone: "+15551234567",
  senderId: "+15550001111",
};

describe("buildSignedInboundWebhook", () => {
  it("signs the envelope the way verifySpectrumSignature verifies", () => {
    const webhook = buildSignedInboundWebhook(TARGET, "hello air");
    const now = Number(webhook.headers["x-spectrum-timestamp"]) * 1000;
    expect(() =>
      verifySpectrumSignature({
        headers: {
          signature: webhook.headers["x-spectrum-signature"],
          timestamp: webhook.headers["x-spectrum-timestamp"],
        },
        rawBody: new TextEncoder().encode(webhook.rawBody),
        signingSecret: TARGET.signingSecret,
        now,
      })
    ).not.toThrow();
  });

  it("produces a tamper-evident signature", () => {
    const webhook = buildSignedInboundWebhook(TARGET, "hello air");
    const now = Number(webhook.headers["x-spectrum-timestamp"]) * 1000;
    const headers = {
      signature: webhook.headers["x-spectrum-signature"],
      timestamp: webhook.headers["x-spectrum-timestamp"],
    };
    expect(() =>
      verifySpectrumSignature({
        headers,
        rawBody: new TextEncoder().encode(webhook.rawBody + " "),
        signingSecret: TARGET.signingSecret,
        now,
      })
    ).toThrowError(SpectrumWebhookError);
    expect(() =>
      verifySpectrumSignature({
        headers,
        rawBody: new TextEncoder().encode(webhook.rawBody),
        signingSecret: "wrong-secret",
        now,
      })
    ).toThrowError(SpectrumWebhookError);
  });

  it("parses into an inbound iMessage routing envelope", () => {
    const webhook = buildSignedInboundWebhook(TARGET, "check my calendar");
    const parsed = parseInboundSpectrumMessage(
      new TextEncoder().encode(webhook.rawBody),
      {
        event: webhook.headers["x-spectrum-event"],
        webhookId: webhook.headers["x-spectrum-webhook-id"],
      }
    );
    expect(parsed).toMatchObject({
      messageId: webhook.messageId,
      spaceId: TARGET.spaceId,
      phone: TARGET.phone,
      platform: "imessage",
      senderId: TARGET.senderId,
      text: "check my calendar",
    });
  });
});

describe("timingFromEvents", () => {
  it("measures first/final bubble and first reaction from listener stamps", () => {
    const postedAt = 10_000;
    const events: RecordedSenderEvent[] = [
      { kind: "typing", received_ms: 10_200 },
      { kind: "react", received_ms: 10_800 },
      { kind: "sendText", received_ms: 14_000 },
      { kind: "markRead", received_ms: 14_050 },
      { kind: "sendText", received_ms: 21_000 },
    ];
    expect(timingFromEvents(events, postedAt)).toEqual({
      firstBubbleMs: 4_000,
      finalBubbleMs: 11_000,
      firstReactionMs: 800,
      bubbles: 2,
      reactions: 1,
    });
  });

  it("reports nulls when nothing outbound was recorded", () => {
    expect(timingFromEvents([], 0)).toEqual({
      firstBubbleMs: null,
      finalBubbleMs: null,
      firstReactionMs: null,
      bubbles: 0,
      reactions: 0,
    });
  });
});

describe("percentile", () => {
  it("uses nearest-rank over sorted values", () => {
    const values = [10, 1, 7, 3, 9, 5, 8, 2, 4, 6];
    expect(percentile(values, 50)).toBe(5);
    expect(percentile(values, 95)).toBe(10);
    expect(percentile(values, 100)).toBe(10);
    expect(percentile(values, 1)).toBe(1);
  });

  it("returns null for empty input", () => {
    expect(percentile([], 95)).toBeNull();
  });
});

describe("summarizeTimings", () => {
  it("aggregates across cases and counts unanswered ones", () => {
    const summary = summarizeTimings([
      {
        firstBubbleMs: 1_000,
        finalBubbleMs: 5_000,
        firstReactionMs: 300,
        bubbles: 2,
        reactions: 1,
      },
      {
        firstBubbleMs: 2_000,
        finalBubbleMs: 6_000,
        firstReactionMs: null,
        bubbles: 1,
        reactions: 0,
      },
      {
        firstBubbleMs: null,
        finalBubbleMs: null,
        firstReactionMs: null,
        bubbles: 0,
        reactions: 0,
      },
    ]);
    expect(summary.cases).toBe(3);
    expect(summary.answered).toBe(2);
    expect(summary.firstBubbleP50Ms).toBe(1_000);
    expect(summary.firstBubbleP95Ms).toBe(2_000);
    expect(summary.finalBubbleP50Ms).toBe(5_000);
    expect(summary.firstReactionP50Ms).toBe(300);
  });
});
