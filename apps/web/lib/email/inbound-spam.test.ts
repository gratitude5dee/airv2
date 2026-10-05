/**
 * Tier-2 spam screen: a confident spam verdict labels the message + thread
 * control-plane-side and skips the Needs-you decision; the transactional
 * veto and any classifier failure leave the normal decision path intact.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  getMessage,
  patchMessage,
  patchThread,
} from "../agentmail/client";
import { classifyInboundMail } from "../jev/mail";
import { createDecision, resolveTrustTier } from "../routing/trust";
import { processInboundEmail } from "./inbound";

vi.mock("../agentmail/client", () => ({
  createDraft: vi.fn(),
  getAttachmentBytes: vi.fn(),
  getMessage: vi.fn(),
  patchMessage: vi.fn(),
  patchThread: vi.fn(),
  replyToMessage: vi.fn(),
}));
vi.mock("../jev/mail", () => ({
  classifyInboundMail: vi.fn(),
  isSpamVerdict: vi.fn((v: { spam: number; transactional: number }) => v.spam >= 0.8 && v.transactional < 0.6),
}));
vi.mock("../hermes/client", () => ({
  createRun: vi.fn(),
  runEvents: vi.fn(),
}));
vi.mock("../orchestrator/flush", () => ({ hermesDeltas: vi.fn() }));
vi.mock("../orchestrator/boxes", () => ({
  armStopAfter: vi.fn(),
  ensureBoxAwake: vi.fn(),
}));
vi.mock("../routing/trust", () => ({
  createDecision: vi.fn(),
  resolveTrustTier: vi.fn(),
  senderIdFor: vi.fn(),
}));
vi.mock("./review", () => ({ queueEmailDraftReview: vi.fn() }));
vi.mock("../miniapps/cards", () => ({ sendMiniAppCard: vi.fn() }));
vi.mock("../miniapps/cardSends", () => ({ claimCardSend: vi.fn() }));
vi.mock("../calendar/store", () => ({
  materializeIcs: vi.fn(),
  nudgeSync: vi.fn(),
}));

const supabase = {
  from() {
    return { insert: () => Promise.resolve({ error: null }) };
  },
} as unknown as SupabaseClient;

describe("processInboundEmail spam screen", () => {
  beforeEach(() => {
    process.env["MAIL_PROVIDER"] = "agentmail";
    vi.mocked(getMessage).mockReset().mockResolvedValue({
      message_id: "<msg-1@example.com>",
      inbox_id: "inbox-1",
      thread_id: "thread-1",
      from: "Unknown <unknown@example.com>",
      subject: "Winner notification",
      text: "You won",
    });
    vi.mocked(resolveTrustTier).mockReset().mockResolvedValue(2);
    vi.mocked(createDecision).mockReset().mockResolvedValue(undefined);
    vi.mocked(patchMessage).mockReset().mockResolvedValue({} as never);
    vi.mocked(patchThread).mockReset().mockResolvedValue({} as never);
    vi.mocked(classifyInboundMail).mockReset();
  });

  it("spam >= 0.8 labels message + thread and files no decision", async () => {
    vi.mocked(classifyInboundMail).mockResolvedValue({
      spam: 0.95,
      transactional: 0.1,
      needsReply: 0,
    });

    await processInboundEmail(supabase, "user-1", "inbox-1", "<msg-1@example.com>");

    expect(patchMessage).toHaveBeenCalledWith("inbox-1", "<msg-1@example.com>", {
      add_labels: ["spam"],
    });
    expect(patchThread).toHaveBeenCalledWith("inbox-1", "thread-1", {
      add_labels: ["spam"],
    });
    expect(createDecision).not.toHaveBeenCalled();
  });

  it("the transactional veto files the normal tier-2 decision", async () => {
    vi.mocked(classifyInboundMail).mockResolvedValue({
      spam: 0.95,
      transactional: 0.9,
      needsReply: 0,
    });

    await processInboundEmail(supabase, "user-1", "inbox-1", "<msg-1@example.com>");

    expect(patchMessage).not.toHaveBeenCalled();
    expect(createDecision).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ kind: "tier2_contact" })
    );
  });

  it("a classifier failure (null) files the normal tier-2 decision", async () => {
    vi.mocked(classifyInboundMail).mockResolvedValue(null);

    await processInboundEmail(supabase, "user-1", "inbox-1", "<msg-1@example.com>");

    expect(patchMessage).not.toHaveBeenCalled();
    expect(createDecision).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ kind: "tier2_contact" })
    );
  });
});
