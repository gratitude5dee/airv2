/**
 * Outbound email review escalation: a held draft becomes an email_draft
 * decision plus an inline iMessage inbox card carrying safe metadata only
 * (recipient + subject, never the body or any credential). A failed card
 * never fails the escalation — the decision is the invariant.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createDecision } from "../routing/trust";
import { sendMiniAppCard } from "../miniapps/cards";
import { claimCardSend } from "../miniapps/cardSends";
import { queueEmailDraftReview } from "./review";

vi.mock("../routing/trust", () => ({ createDecision: vi.fn() }));
vi.mock("../miniapps/cards", () => ({ sendMiniAppCard: vi.fn() }));
vi.mock("../miniapps/cardSends", () => ({ claimCardSend: vi.fn() }));

function fakeSupabase(dest: { space_id?: string; phone?: string } | null) {
  const client = {
    from() {
      const builder = {
        select() {
          return builder;
        },
        eq() {
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({ data: dest });
        },
      };
      return builder;
    },
  };
  return client as unknown as SupabaseClient;
}

describe("queueEmailDraftReview", () => {
  beforeEach(() => {
    vi.mocked(createDecision).mockReset().mockResolvedValue(undefined);
    vi.mocked(sendMiniAppCard).mockReset().mockResolvedValue(undefined);
    vi.mocked(claimCardSend)
      .mockReset()
      .mockResolvedValue({ release: vi.fn() });
  });

  it("files the email_draft decision and sends an inline inbox review card", async () => {
    const supabase = fakeSupabase({ space_id: "space-1", phone: "+1555" });
    await queueEmailDraftReview(supabase, "user-1", {
      draftId: "draft-1",
      to: "friend@example.com",
      subject: "Re: dinner",
    });
    expect(vi.mocked(createDecision)).toHaveBeenCalledWith(supabase, {
      userId: "user-1",
      kind: "email_draft",
      platform: "email",
      sender: "friend@example.com",
      ref: "draft-1",
      label: "Draft: Re: dinner",
    });
    expect(vi.mocked(sendMiniAppCard)).toHaveBeenCalledWith(
      supabase,
      "space-1",
      "+1555",
      "user-1",
      "inbox",
      "default",
      expect.objectContaining({
        caption: "Review email",
        subcaption: "To friend@example.com — Re: dinner",
      })
    );
  });

  it("card metadata never carries the draft body", async () => {
    const supabase = fakeSupabase({ space_id: "space-1", phone: "+1555" });
    await queueEmailDraftReview(supabase, "user-1", {
      draftId: "draft-1",
      to: "friend@example.com",
      subject: "Hello",
    });
    const layout = vi.mocked(sendMiniAppCard).mock.calls[0]?.[6] as Record<
      string,
      string
    >;
    for (const value of Object.values(layout)) {
      expect(value).not.toContain("draft-1");
    }
  });

  it("skips the card without a destination — the decision still exists", async () => {
    const supabase = fakeSupabase(null);
    await queueEmailDraftReview(supabase, "user-1", { draftId: "draft-1" });
    expect(vi.mocked(createDecision)).toHaveBeenCalled();
    expect(vi.mocked(sendMiniAppCard)).not.toHaveBeenCalled();
  });

  it("respects the cooldown claim — no claim, no card", async () => {
    vi.mocked(claimCardSend).mockResolvedValue(undefined);
    const supabase = fakeSupabase({ space_id: "space-1", phone: "+1555" });
    await queueEmailDraftReview(supabase, "user-1", { draftId: "draft-1" });
    expect(vi.mocked(sendMiniAppCard)).not.toHaveBeenCalled();
  });

  it("a failed card send releases the claim and never throws", async () => {
    const release = vi.fn().mockResolvedValue(undefined);
    vi.mocked(claimCardSend).mockResolvedValue({ release });
    vi.mocked(sendMiniAppCard).mockRejectedValue(new Error("spectrum down"));
    const supabase = fakeSupabase({ space_id: "space-1", phone: "+1555" });
    await expect(
      queueEmailDraftReview(supabase, "user-1", { draftId: "draft-1" })
    ).resolves.toBeUndefined();
    expect(release).toHaveBeenCalled();
  });
});
