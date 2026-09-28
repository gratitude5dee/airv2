/**
 * Draft-review backstop (C10 hardening): a recent box-created draft with no
 * decision row gets an email_draft review filed; drafts already covered by
 * any decision (pending or resolved), too-fresh drafts (grace period), and
 * stale drafts are left alone.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { listDrafts } from "../agentmail/client";
import { queueEmailDraftReview } from "./review";
import { sweepUnfiledDrafts } from "./draftSweep";

vi.mock("../agentmail/client", () => ({ listDrafts: vi.fn() }));
vi.mock("./review", () => ({ queueEmailDraftReview: vi.fn() }));

const db = new FakeSupabase();

/** A box active inside the 30-minute sweep window at NOW. */
const ACTIVE_BOX = { user_id: "user-1", last_active_at: "2026-08-26T11:59:00Z" };
const PRIMARY_INBOX = {
  user_id: "user-1",
  agentmail_inbox_id: "inbox-1",
  retired_at: null,
};

function seed(options: {
  boxes: Record<string, unknown>[];
  addresses: Record<string, unknown>[];
  decisionRefs: string[];
}) {
  db.tables["boxes"] = options.boxes.map((row) => ({ ...row }));
  db.tables["agent_addresses"] = options.addresses.map((row) => ({ ...row }));
  db.tables["decisions"] = options.decisionRefs.map((ref) => ({
    user_id: "user-1",
    kind: "email_draft",
    ref,
  }));
}

const NOW = new Date("2026-08-26T12:00:00Z");
const AGE_OK = new Date(NOW.getTime() - 10 * 60_000).toISOString();
const TOO_FRESH = new Date(NOW.getTime() - 60_000).toISOString();
const TOO_OLD = new Date(NOW.getTime() - 72 * 3600_000).toISOString();

describe("sweepUnfiledDrafts", () => {
  beforeEach(() => {
    process.env["MAIL_PROVIDER"] = "agentmail";
    db.reset();
    vi.mocked(listDrafts).mockReset();
    vi.mocked(queueEmailDraftReview).mockReset().mockResolvedValue(undefined);
  });

  it("files a review for an uncovered recent draft", async () => {
    vi.mocked(listDrafts).mockResolvedValue([
      {
        draft_id: "draft-1",
        subject: "Tour announce",
        to: ["a@example.com"],
        updated_at: AGE_OK,
      },
    ]);
    seed({
      boxes: [ACTIVE_BOX],
      addresses: [PRIMARY_INBOX],
      decisionRefs: [],
    });
    const client = db.client();
    const filed = await sweepUnfiledDrafts(client, NOW);
    expect(filed).toBe(1);
    expect(vi.mocked(queueEmailDraftReview)).toHaveBeenCalledWith(
      client,
      "user-1",
      { draftId: "draft-1", to: "a@example.com", subject: "Tour announce" }
    );
  });

  it("skips drafts already covered by any decision row", async () => {
    vi.mocked(listDrafts).mockResolvedValue([
      { draft_id: "draft-1", updated_at: AGE_OK },
    ]);
    seed({
      boxes: [ACTIVE_BOX],
      addresses: [PRIMARY_INBOX],
      decisionRefs: ["draft-1"],
    });
    const filed = await sweepUnfiledDrafts(db.client(), NOW);
    expect(filed).toBe(0);
    expect(vi.mocked(queueEmailDraftReview)).not.toHaveBeenCalled();
  });

  it("leaves too-fresh, stale, and unstamped drafts alone", async () => {
    vi.mocked(listDrafts).mockResolvedValue([
      { draft_id: "fresh", updated_at: TOO_FRESH },
      { draft_id: "stale", updated_at: TOO_OLD },
      { draft_id: "no-stamp" },
      { draft_id: "bad-stamp", updated_at: "not-a-date" },
    ]);
    seed({
      boxes: [ACTIVE_BOX],
      addresses: [PRIMARY_INBOX],
      decisionRefs: [],
    });
    const filed = await sweepUnfiledDrafts(db.client(), NOW);
    expect(filed).toBe(0);
    expect(vi.mocked(queueEmailDraftReview)).not.toHaveBeenCalled();
  });

  it("does nothing when no box was recently active", async () => {
    seed({ boxes: [], addresses: [], decisionRefs: [] });
    const filed = await sweepUnfiledDrafts(db.client(), NOW);
    expect(vi.mocked(listDrafts)).not.toHaveBeenCalled();
    expect(filed).toBe(0);
  });
});
