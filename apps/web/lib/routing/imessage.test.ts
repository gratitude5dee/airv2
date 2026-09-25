import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const isBurstStart = vi.fn();
const carryQuickAckMarker = vi.fn();
const updateQuickAckMarker = vi.fn();
const dropQuickAckMarker = vi.fn();

vi.mock("../orchestrator/flush", () => ({
  isBurstStart: (...args: unknown[]) => isBurstStart(...(args as [])),
  carryQuickAckMarker: (...args: unknown[]) => carryQuickAckMarker(...(args as [])),
  updateQuickAckMarker: (...args: unknown[]) => updateQuickAckMarker(...(args as [])),
  dropQuickAckMarker: (...args: unknown[]) => dropQuickAckMarker(...(args as [])),
}));

import {
  composeInboundBody,
  sendImmediateReaction,
  sendInitialReply,
} from "./imessage";
import type { InboundMessage } from "../orchestrator/flush";
import type { FastReactionSender } from "../spectrum/fast-reaction";
import type { SpectrumSender } from "../spectrum/sender";
import type { InitialResponse } from "../orchestrator/sharedBridge";

const message: InboundMessage = {
  userId: "user-1",
  spaceId: "space-1",
  phone: "+15551234567",
  messageId: "msg-1",
  body: "thanks!",
};

const supabase = {} as SupabaseClient;

function fakeSender(over: Partial<Record<keyof SpectrumSender, unknown>> = {}) {
  return {
    sendText: vi.fn(async () => undefined),
    sendReply: vi.fn(async () => true),
    react: vi.fn(async () => true),
    markRead: vi.fn(async () => undefined),
    startTyping: vi.fn(async () => undefined),
    close: vi.fn(async () => undefined),
    ...over,
  } as unknown as SpectrumSender & { [K in keyof SpectrumSender]: ReturnType<typeof vi.fn> };
}

describe("composeInboundBody", () => {
  it("joins the attachment marker before the text", () => {
    expect(
      composeInboundBody({
        attachmentIds: ["a1", "a2"],
        text: "look at these",
      }),
    ).toBe("[attachment:a1,a2]\nlook at these");
  });

  it("keeps a location share to the marker plus text", () => {
    expect(
      composeInboundBody({
        attachmentIds: [],
        locationSignal: true,
        text: "here",
      }),
    ).toBe("[location shared]\nhere");
  });

  it("returns an empty string when nothing parsed to content", () => {
    expect(composeInboundBody({ attachmentIds: [] })).toBe("");
  });
});

describe("sendImmediateReaction", () => {
  it("reacts over the fast sender and never opens the warm one", async () => {
    const fast = {
      react: vi.fn(async () => true),
      close: vi.fn(async () => undefined),
    } as unknown as FastReactionSender;
    const warm = fakeSender();
    await sendImmediateReaction(
      Promise.resolve(fast),
      Promise.resolve(warm),
      message,
      Date.now(),
    );
    expect(fast.react).toHaveBeenCalledWith("space-1", "msg-1", "👀");
    expect(fast.close).toHaveBeenCalled();
    expect(warm.react).not.toHaveBeenCalled();
  });

  it("falls back to the warm spectrum sender when the fast one cannot react", async () => {
    const fast = {
      react: vi.fn(async () => false),
      close: vi.fn(async () => undefined),
    } as unknown as FastReactionSender;
    const warm = fakeSender();
    await sendImmediateReaction(
      Promise.resolve(fast),
      Promise.resolve(warm),
      message,
      Date.now(),
    );
    expect(warm.react).toHaveBeenCalledWith(
      "space-1",
      "+15551234567",
      "msg-1",
      "👀",
    );
  });

  it("does not throw when both transports fail", async () => {
    const warm = fakeSender({ react: vi.fn(async () => false) });
    await expect(
      sendImmediateReaction(
        Promise.resolve(undefined),
        Promise.resolve(warm),
        message,
        Date.now(),
      ),
    ).resolves.toBeUndefined();
  });
});

describe("sendInitialReply", () => {
  it("returns false without a sender or outside a burst start", async () => {
    await expect(
      sendInitialReply(supabase, undefined, message, "hi", response("final"), 0),
    ).resolves.toBe(false);
    isBurstStart.mockResolvedValueOnce(false);
    await expect(
      sendInitialReply(supabase, fakeSender(), message, "hi", response("holding"), 0),
    ).resolves.toBe(false);
    expect(carryQuickAckMarker).not.toHaveBeenCalled();
  });

  it("sends a final reply with no marker and reports the turn complete", async () => {
    isBurstStart.mockResolvedValue(true);
    const sender = fakeSender();
    const done = await sendInitialReply(
      supabase,
      sender,
      message,
      "thanks!",
      response("final"),
      0,
    );
    expect(done).toBe(true);
    expect(sender.sendText).toHaveBeenCalledWith("space-1", "+15551234567", "ok!");
    expect(carryQuickAckMarker).not.toHaveBeenCalled();
  });

  it("carries a quick-ack marker for non-final agent turns", async () => {
    isBurstStart.mockResolvedValue(true);
    carryQuickAckMarker.mockResolvedValue("marker-1");
    const sender = fakeSender();
    const done = await sendInitialReply(
      supabase,
      sender,
      message,
      "thanks!",
      response("holding"),
      0,
    );
    expect(done).toBe(false);
    expect(carryQuickAckMarker).toHaveBeenCalledWith(supabase, "user-1", "space-1");
    expect(updateQuickAckMarker).toHaveBeenCalledWith(
      supabase,
      "space-1",
      "marker-1",
      "ok!",
    );
    expect(dropQuickAckMarker).not.toHaveBeenCalled();
  });

  it("drops the marker when the send fails", async () => {
    isBurstStart.mockResolvedValue(true);
    carryQuickAckMarker.mockResolvedValue("marker-2");
    const sender = fakeSender({
      sendText: vi.fn(async () => {
        throw new Error("send failed");
      }),
    });
    await expect(
      sendInitialReply(supabase, sender, message, "thanks!", response("holding"), 0),
    ).rejects.toThrow("send failed");
    expect(dropQuickAckMarker).toHaveBeenCalledWith(supabase, "space-1", "marker-2");
  });
});

function response(disposition: InitialResponse["disposition"]): InitialResponse {
  return { body: "ok!", disposition, source: "fallback" };
}
