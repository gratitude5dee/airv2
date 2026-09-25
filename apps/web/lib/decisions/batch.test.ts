/**
 * V8 batch approval: only pending tier-1 email drafts send; everything else
 * is skipped with a reason, and each send reuses the idempotent control-plane
 * path (C10) keyed by the decision id.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { sendDraft } from "../agentmail/client";
import { batchApproveEmailDrafts } from "./batch";
import { FakeSupabase, type Row } from "../testing/fakeSupabase";

vi.mock("../agentmail/client", () => ({ sendDraft: vi.fn() }));

const db = new FakeSupabase();
const supabase = db.client();

function seed(options: { decisions: Row[]; inbox: string | null; senders: Row[] }): void {
  db.tables["decisions"] = options.decisions.map((row) => ({ ...row }));
  db.tables["agent_addresses"] = options.inbox
    ? [{ user_id: "user-1", agentmail_inbox_id: options.inbox, is_primary: true, retired_at: null }]
    : [];
  db.tables["senders"] = options.senders.map((row) => ({ ...row }));
}

const KNOWN = {
  id: "d1",
  user_id: "user-1",
  kind: "email_draft",
  ref: "draft-1",
  status: "pending",
  sender: "Friend@example.com",
  platform: "email",
};

describe("batchApproveEmailDrafts", () => {
  beforeEach(() => {
    db.reset();
    process.env["MAIL_PROVIDER"] = "agentmail";
    vi.mocked(sendDraft).mockReset().mockResolvedValue(undefined);
  });

  it("sends pending tier-1 drafts with the decision id as idempotency key", async () => {
    seed({
      decisions: [KNOWN],
      inbox: "inbox-1",
      senders: [{ user_id: "user-1", platform: "email", address: "friend@example.com", trust_tier: 1 }],
    });
    const result = await batchApproveEmailDrafts(supabase, "user-1", ["d1"]);
    expect(result.approved).toEqual(["d1"]);
    expect(result.skipped).toEqual([]);
    expect(vi.mocked(sendDraft)).toHaveBeenCalledWith("inbox-1", "draft-1", "d1");
    expect(db.updates).toHaveLength(1);
    expect(db.rows("decisions")[0]).toMatchObject({ status: "approved" });
  });

  it("skips tier-2 senders — unknown counterparties stay one-at-a-time", async () => {
    seed({
      decisions: [KNOWN],
      inbox: "inbox-1",
      senders: [{ user_id: "user-1", platform: "email", address: "friend@example.com", trust_tier: 2 }],
    });
    const result = await batchApproveEmailDrafts(supabase, "user-1", ["d1"]);
    expect(result.approved).toEqual([]);
    expect(result.skipped).toEqual([{ id: "d1", reason: "sender is not tier 1" }]);
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
  });

  it("skips resolved rows, other kinds, and unknown ids without sending", async () => {
    seed({
      decisions: [
        { ...KNOWN, id: "d2", status: "approved" },
        { ...KNOWN, id: "d3", kind: "social_post" },
        { ...KNOWN, id: "d4", ref: null },
      ],
      inbox: "inbox-1",
      senders: [{ user_id: "user-1", platform: "email", address: "friend@example.com", trust_tier: 1 }],
    });
    const result = await batchApproveEmailDrafts(supabase, "user-1", [
      "d2",
      "d3",
      "d4",
      "d5",
    ]);
    expect(result.approved).toEqual([]);
    expect(result.skipped.map((s) => s.reason)).toEqual([
      "already resolved",
      "not a batchable email draft",
      "not a batchable email draft",
      "not found",
    ]);
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
  });

  it("a failed send skips that draft and leaves it pending", async () => {
    vi.mocked(sendDraft).mockRejectedValueOnce(new Error("503"));
    seed({
      decisions: [KNOWN, { ...KNOWN, id: "d6", ref: "draft-6" }],
      inbox: "inbox-1",
      senders: [{ user_id: "user-1", platform: "email", address: "friend@example.com", trust_tier: 1 }],
    });
    const result = await batchApproveEmailDrafts(supabase, "user-1", ["d1", "d6"]);
    expect(result.approved).toEqual(["d6"]);
    expect(result.skipped).toEqual([{ id: "d1", reason: "send failed" }]);
    expect(db.updates).toHaveLength(1);
    expect(db.rows("decisions").find((r) => r["id"] === "d1")).toMatchObject({ status: "pending" });
  });

  it("caps a batch at 20 unique ids", async () => {
    const decisions = Array.from({ length: 30 }, (_, i) => ({
      ...KNOWN,
      id: `d${i}`,
      ref: `draft-${i}`,
    }));
    seed({
      decisions,
      inbox: "inbox-1",
      senders: [{ user_id: "user-1", platform: "email", address: "friend@example.com", trust_tier: 1 }],
    });
    const result = await batchApproveEmailDrafts(
      supabase,
      "user-1",
      decisions.map((d) => d.id as string)
    );
    expect(result.approved).toHaveLength(20);
    // Ids past the cap are reported, never silently dropped (they stay pending).
    expect(result.skipped).toEqual(
      decisions.slice(20).map((d) => ({
        id: d.id,
        reason: "batch limit reached",
      }))
    );
  });
});
