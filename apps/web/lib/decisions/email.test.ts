/**
 * Email-draft resolution (C10): approval is the only send, keyed by the
 * decision id; anything not an owner-scoped pending email_draft is refused,
 * and dismissal leaves the held draft unsent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { sendDraft } from "../agentmail/client";
import { EmailDraftError, resolveEmailDraftDecision } from "./email";

vi.mock("../agentmail/client", () => ({ sendDraft: vi.fn() }));

const PENDING = {
  id: "d1",
  user_id: "user-1",
  kind: "email_draft",
  ref: "draft-1",
  status: "pending",
};

const db = new FakeSupabase();

function seed(options: { decision: object | null; inbox: string | null }) {
  db.tables["decisions"] = options.decision
    ? [{ ...(options.decision as Record<string, unknown>) }]
    : [];
  db.tables["agent_addresses"] = options.inbox
    ? [
        {
          user_id: "user-1",
          agentmail_inbox_id: options.inbox,
          is_primary: true,
          retired_at: null,
        },
      ]
    : [];
}

describe("resolveEmailDraftDecision", () => {
  beforeEach(() => {
    process.env["MAIL_PROVIDER"] = "agentmail";
    db.reset();
    vi.mocked(sendDraft).mockReset().mockResolvedValue(undefined);
  });

  it("approval sends the held draft keyed by the decision id", async () => {
    seed({ decision: PENDING, inbox: "inbox-1" });
    await resolveEmailDraftDecision(db.client(), "user-1", "d1", true);
    expect(vi.mocked(sendDraft)).toHaveBeenCalledWith(
      "inbox-1",
      "draft-1",
      "d1"
    );
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]?.patch["status"]).toBe("approved");
  });

  it("dismissal resolves the decision without any send", async () => {
    seed({ decision: PENDING, inbox: "inbox-1" });
    await resolveEmailDraftDecision(db.client(), "user-1", "d1", false);
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
    expect(db.updates[0]?.patch["status"]).toBe("dismissed");
  });

  it("refuses an already-resolved decision — a replayed approval re-sends nothing", async () => {
    seed({ decision: { ...PENDING, status: "approved" }, inbox: "inbox-1" });
    await expect(
      resolveEmailDraftDecision(db.client(), "user-1", "d1", true)
    ).rejects.toThrowError(EmailDraftError);
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
  });

  it("refuses a decision of another kind", async () => {
    seed({ decision: { ...PENDING, kind: "purchase_review" }, inbox: "inbox-1" });
    await expect(
      resolveEmailDraftDecision(db.client(), "user-1", "d1", true)
    ).rejects.toThrowError("not found");
  });

  it("refuses when the owner-scoped lookup finds nothing (cross-user id)", async () => {
    seed({ decision: null, inbox: "inbox-1" });
    await expect(
      resolveEmailDraftDecision(db.client(), "user-1", "d1", true)
    ).rejects.toThrowError("not found");
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
  });

  it("refuses approval when no primary inbox exists, leaving the decision pending", async () => {
    seed({ decision: PENDING, inbox: null });
    await expect(
      resolveEmailDraftDecision(db.client(), "user-1", "d1", true)
    ).rejects.toThrowError("no inbox");
    expect(db.updates).toHaveLength(0);
  });

  it("a failed send leaves the decision pending for retry", async () => {
    vi.mocked(sendDraft).mockRejectedValueOnce(new Error("503"));
    seed({ decision: PENDING, inbox: "inbox-1" });
    await expect(
      resolveEmailDraftDecision(db.client(), "user-1", "d1", true)
    ).rejects.toThrowError("503");
    expect(db.updates).toHaveLength(0);
  });
});
