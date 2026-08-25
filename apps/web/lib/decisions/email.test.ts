/**
 * Email-draft resolution (C10): approval is the only send, keyed by the
 * decision id; anything not an owner-scoped pending email_draft is refused,
 * and dismissal leaves the held draft unsent.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendDraft } from "../agentmail/client";
import { EmailDraftError, resolveEmailDraftDecision } from "./email";

vi.mock("../agentmail/client", () => ({ sendDraft: vi.fn() }));

interface Row {
  [key: string]: unknown;
}

function fakeSupabase(options: { decision: Row | null; inbox: string | null }) {
  const updates: Row[] = [];
  const client = {
    from(table: string) {
      const builder = {
        select() {
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
              table === "decisions"
                ? options.decision
                : table === "agent_addresses" && options.inbox
                  ? { agentmail_inbox_id: options.inbox }
                  : null,
          });
        },
        then(
          resolve: (value: { data: Row[] }) => unknown,
          reject?: (reason: unknown) => unknown
        ) {
          return Promise.resolve({ data: [] }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client: client as unknown as SupabaseClient, updates };
}

const PENDING = {
  id: "d1",
  kind: "email_draft",
  ref: "draft-1",
  status: "pending",
};

describe("resolveEmailDraftDecision", () => {
  beforeEach(() => {
    vi.mocked(sendDraft).mockReset().mockResolvedValue(undefined);
  });

  it("approval sends the held draft keyed by the decision id", async () => {
    const { client, updates } = fakeSupabase({
      decision: PENDING,
      inbox: "inbox-1",
    });
    await resolveEmailDraftDecision(client, "user-1", "d1", true);
    expect(vi.mocked(sendDraft)).toHaveBeenCalledWith(
      "inbox-1",
      "draft-1",
      "d1"
    );
    expect(updates).toHaveLength(1);
    expect((updates[0]?.["values"] as Row)["status"]).toBe("approved");
  });

  it("dismissal resolves the decision without any send", async () => {
    const { client, updates } = fakeSupabase({
      decision: PENDING,
      inbox: "inbox-1",
    });
    await resolveEmailDraftDecision(client, "user-1", "d1", false);
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
    expect((updates[0]?.["values"] as Row)["status"]).toBe("dismissed");
  });

  it("refuses an already-resolved decision — a replayed approval re-sends nothing", async () => {
    const { client } = fakeSupabase({
      decision: { ...PENDING, status: "approved" },
      inbox: "inbox-1",
    });
    await expect(
      resolveEmailDraftDecision(client, "user-1", "d1", true)
    ).rejects.toThrowError(EmailDraftError);
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
  });

  it("refuses a decision of another kind", async () => {
    const { client } = fakeSupabase({
      decision: { ...PENDING, kind: "purchase_review" },
      inbox: "inbox-1",
    });
    await expect(
      resolveEmailDraftDecision(client, "user-1", "d1", true)
    ).rejects.toThrowError("not found");
  });

  it("refuses when the owner-scoped lookup finds nothing (cross-user id)", async () => {
    const { client } = fakeSupabase({ decision: null, inbox: "inbox-1" });
    await expect(
      resolveEmailDraftDecision(client, "user-1", "d1", true)
    ).rejects.toThrowError("not found");
    expect(vi.mocked(sendDraft)).not.toHaveBeenCalled();
  });

  it("refuses approval when no primary inbox exists, leaving the decision pending", async () => {
    const { client, updates } = fakeSupabase({
      decision: PENDING,
      inbox: null,
    });
    await expect(
      resolveEmailDraftDecision(client, "user-1", "d1", true)
    ).rejects.toThrowError("no inbox");
    expect(updates).toHaveLength(0);
  });

  it("a failed send leaves the decision pending for retry", async () => {
    vi.mocked(sendDraft).mockRejectedValueOnce(new Error("503"));
    const { client, updates } = fakeSupabase({
      decision: PENDING,
      inbox: "inbox-1",
    });
    await expect(
      resolveEmailDraftDecision(client, "user-1", "d1", true)
    ).rejects.toThrowError("503");
    expect(updates).toHaveLength(0);
  });
});
