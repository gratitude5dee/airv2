/**
 * V8 batch approval: only pending tier-1 email drafts send; everything else
 * is skipped with a reason, and each send reuses the idempotent control-plane
 * path (C10) keyed by the decision id.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDraft } from "../agentmail/client";
import { batchApproveEmailDrafts } from "./batch";

vi.mock("../agentmail/client", () => ({ sendDraft: vi.fn() }));

interface Row {
  [key: string]: unknown;
}

function fakeSupabase(options: {
  decisions: Row[];
  inbox: string | null;
  senders: Row[];
}) {
  const updates: Row[] = [];
  const client = {
    from(table: string) {
      const builder = {
        select() {
          return builder;
        },
        in() {
          return builder;
        },
        eq() {
          return builder;
        },
        is() {
          return builder;
        },
        update(values: Row) {
          updates.push({ table, values });
          return builder;
        },
        maybeSingle() {
          return Promise.resolve({
            data:
              table === "agent_addresses" && options.inbox
                ? { agentmail_inbox_id: options.inbox }
                : null,
          });
        },
        then(
          resolve: (value: { data: Row[] }) => unknown,
          reject?: (reason: unknown) => unknown
        ) {
          const data =
            table === "decisions"
              ? options.decisions
              : table === "senders"
                ? options.senders
                : [];
          return Promise.resolve({ data }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, updates };
}

const KNOWN = {
  id: "d1",
  kind: "email_draft",
  ref: "draft-1",
  status: "pending",
  sender: "Friend@example.com",
  platform: "email",
};

describe("batchApproveEmailDrafts", () => {
  beforeEach(() => {
    vi.mocked(sendDraft).mockReset().mockResolvedValue(undefined);
  });

  it("sends pending tier-1 drafts with the decision id as idempotency key", async () => {
    const { client, updates } = fakeSupabase({
      decisions: [KNOWN],
      inbox: "inbox-1",
      senders: [{ address: "friend@example.com", trust_tier: 1 }],
    });
    const result = await batchApproveEmailDrafts(client, "user-1", ["d1"]);
    expect(result.approved).toEqual(["d1"]);
    expect(result.skipped).toEqual([]);
    expect(vi.mocked(sendDraft)).toHaveBeenCalledWith("inbox-1", "draft-1", "d1");
    expect(updates).toHaveLength(1);
  });

  it("skips tier-2 senders — unknown counterparties stay one-at-a-time", async () => {
    const { client } = fakeSupabase({
      decisions: [KNOWN],
      inbox: "inbox-1",
      senders: [{ address: "friend@example.com", trust_tier: 2 }],
    });
    const result = await batchApproveEmailDrafts(client, "user-1", ["d1"]);
    expect(result.approved).toEqual([]);
    expect(result.skipped).toEqual([{ id: "d1", reason: "sender is not tier 1" }]);
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
  });

  it("skips resolved rows, other kinds, and unknown ids without sending", async () => {
    const { client } = fakeSupabase({
      decisions: [
        { ...KNOWN, id: "d2", status: "approved" },
        { ...KNOWN, id: "d3", kind: "social_post" },
        { ...KNOWN, id: "d4", ref: null },
      ],
      inbox: "inbox-1",
      senders: [{ address: "friend@example.com", trust_tier: 1 }],
    });
    const result = await batchApproveEmailDrafts(client, "user-1", [
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
    const { client, updates } = fakeSupabase({
      decisions: [KNOWN, { ...KNOWN, id: "d6", ref: "draft-6" }],
      inbox: "inbox-1",
      senders: [{ address: "friend@example.com", trust_tier: 1 }],
    });
    const result = await batchApproveEmailDrafts(client, "user-1", ["d1", "d6"]);
    expect(result.approved).toEqual(["d6"]);
    expect(result.skipped).toEqual([{ id: "d1", reason: "send failed" }]);
    expect(updates).toHaveLength(1);
  });

  it("caps a batch at 20 unique ids", async () => {
    const decisions = Array.from({ length: 30 }, (_, i) => ({
      ...KNOWN,
      id: `d${i}`,
      ref: `draft-${i}`,
    }));
    const { client } = fakeSupabase({
      decisions,
      inbox: "inbox-1",
      senders: [{ address: "friend@example.com", trust_tier: 1 }],
    });
    const result = await batchApproveEmailDrafts(
      client,
      "user-1",
      decisions.map((d) => d.id as string)
    );
    expect(result.approved).toHaveLength(20);
  });
});
