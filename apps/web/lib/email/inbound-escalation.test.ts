/**
 * Tier-gated reply escalation: tier 0 (the owner's own handle) auto-sends;
 * tier 1 holds the reply as a threaded AgentMail draft and queues an
 * email_draft review — no direct send exists on that path; tier 2 produces
 * a decision only.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createDraft,
  getMessage,
  replyToMessage,
} from "../agentmail/client";
import { createRun, runEvents } from "../hermes/client";
import { hermesDeltas } from "../orchestrator/flush";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import {
  createDecision,
  resolveTrustTier,
  senderIdFor,
} from "../routing/trust";
import { queueEmailDraftReview } from "./review";
import { processInboundEmail } from "./inbound";

vi.mock("../agentmail/client", () => ({
  createDraft: vi.fn(),
  getAttachmentBytes: vi.fn(),
  getMessage: vi.fn(),
  replyToMessage: vi.fn(),
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

async function* deltas(): AsyncGenerator<string> {
  yield "Sounds good — see you Thursday.";
}

describe("processInboundEmail reply escalation", () => {
  beforeEach(() => {
    vi.mocked(getMessage).mockReset().mockResolvedValue({
      message_id: "<msg-1@example.com>",
      inbox_id: "inbox-1",
      thread_id: "thread-1",
      from: "Friend <friend@example.com>",
      subject: "dinner",
      text: "Are we still on?",
    });
    vi.mocked(createDraft).mockReset().mockResolvedValue("draft-1");
    vi.mocked(replyToMessage).mockReset().mockResolvedValue(undefined);
    vi.mocked(createRun).mockReset().mockResolvedValue({ run_id: "run-1" });
    vi.mocked(runEvents).mockReset().mockResolvedValue(
      undefined as unknown as Awaited<ReturnType<typeof runEvents>>
    );
    vi.mocked(hermesDeltas).mockReset().mockReturnValue(deltas());
    vi.mocked(ensureBoxAwake).mockReset().mockResolvedValue({
      boxId: "box-1",
      target: { baseUrl: "http://box", token: "t" },
    } as unknown as Awaited<ReturnType<typeof ensureBoxAwake>>);
    vi.mocked(armStopAfter).mockReset().mockResolvedValue(undefined);
    vi.mocked(senderIdFor).mockReset().mockResolvedValue(null);
    vi.mocked(createDecision).mockReset().mockResolvedValue(undefined);
    vi.mocked(queueEmailDraftReview).mockReset().mockResolvedValue(undefined);
    vi.mocked(resolveTrustTier).mockReset();
  });

  it("tier 0: the reply auto-sends through the control plane", async () => {
    vi.mocked(resolveTrustTier).mockResolvedValue(0);
    await processInboundEmail(supabase, "user-1", "inbox-1", "<msg-1@example.com>");
    expect(vi.mocked(replyToMessage)).toHaveBeenCalled();
    expect(vi.mocked(createDraft)).not.toHaveBeenCalled();
    expect(vi.mocked(queueEmailDraftReview)).not.toHaveBeenCalled();
  });

  it("tier 1: the reply is escalated as a threaded held draft + review", async () => {
    vi.mocked(resolveTrustTier).mockResolvedValue(1);
    await processInboundEmail(supabase, "user-1", "inbox-1", "<msg-1@example.com>");
    expect(vi.mocked(replyToMessage)).not.toHaveBeenCalled();
    expect(vi.mocked(createDraft)).toHaveBeenCalledWith(
      "inbox-1",
      expect.objectContaining({
        in_reply_to: "<msg-1@example.com>",
        text: "Sounds good — see you Thursday.",
      })
    );
    expect(vi.mocked(queueEmailDraftReview)).toHaveBeenCalledWith(
      supabase,
      "user-1",
      expect.objectContaining({
        draftId: "draft-1",
        to: "friend@example.com",
        subject: "Re: dinner",
      })
    );
  });

  it("tier 2: a decision only — no run, no draft, no send", async () => {
    vi.mocked(resolveTrustTier).mockResolvedValue(2);
    await processInboundEmail(supabase, "user-1", "inbox-1", "<msg-1@example.com>");
    expect(vi.mocked(createDecision)).toHaveBeenCalledWith(
      supabase,
      expect.objectContaining({ kind: "tier2_contact" })
    );
    expect(vi.mocked(createRun)).not.toHaveBeenCalled();
    expect(vi.mocked(replyToMessage)).not.toHaveBeenCalled();
    expect(vi.mocked(createDraft)).not.toHaveBeenCalled();
  });
});
