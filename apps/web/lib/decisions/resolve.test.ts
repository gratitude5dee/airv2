import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";

vi.mock("../vault/client", () => ({
  applyStagedFile: vi.fn(async () => []),
}));
vi.mock("../box/client", () => ({
  command: vi.fn(async () => ({ exitCode: 0, stdout: "", stderr: "" })),
}));
vi.mock("../orchestrator/boxes", () => ({
  ensureBoxAwake: vi.fn(async () => ({ boxId: "box-awake" })),
  armStopAfter: vi.fn(async () => undefined),
}));
vi.mock("./email", () => ({
  EmailDraftError: class EmailDraftError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  sendHeldDraft: vi.fn(async () => undefined),
}));
vi.mock("../calendar/store", () => ({
  approveInboxEvent: vi.fn(async () => undefined),
  dismissInboxEvent: vi.fn(async () => undefined),
}));
vi.mock("../crm/store", () => ({
  applyPatchOnBox: vi.fn(async () => ({ id: "person-1" })),
  sanitizePatch: vi.fn((p: unknown) => p),
}));
vi.mock("../muse/capabilities", () => ({
  MuseCapabilityError: class MuseCapabilityError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  resolveMuseActionDecision: vi.fn(async () => undefined),
}));
vi.mock("../wallet/send", () => ({
  findPendingTransfer: vi.fn(async () => null),
  executeTransfer: vi.fn(async () => undefined),
  denyTransfer: vi.fn(async () => undefined),
  WalletSendError: class WalletSendError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
  WalletSubmitUnknownError: class WalletSubmitUnknownError extends Error {
    readonly status: number;
    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  },
}));

import { applyStagedFile } from "../vault/client";
import { command } from "../box/client";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { sendHeldDraft, EmailDraftError } from "./email";
import { approveInboxEvent, dismissInboxEvent } from "../calendar/store";
import { applyPatchOnBox } from "../crm/store";
import { resolveMuseActionDecision } from "../muse/capabilities";
import { findPendingTransfer } from "../wallet/send";
import { resolveDecision, type PendingDecisionRow } from "./resolve";

/**
 * The claim tail runs the same for every kind: update … where status =
 * 'pending', then read the current row when the update claimed nothing.
 * Seeded row's status reproduces both outcomes: pending = claim won,
 * anything else = someone else resolved it first.
 */
function fakeDecisions(opts: {
  /** Rows the pending-claim update returns (empty = someone else won). */
  updated?: { id: string }[] | null;
  updateError?: { message: string } | null;
  /** The row's status when the claim lost and the current value is read. */
  currentStatus?: string;
}) {
  const db = new FakeSupabase();
  const won = (opts.updated?.length ?? 0) > 0;
  db.tables["decisions"] = [
    { id: "d1", user_id: "user-1", status: won ? "pending" : (opts.currentStatus ?? "resolved") },
  ];
  if (opts.updateError) db.opErrors["decisions:update"] = opts.updateError;
  return { supabase: db.client(), db };
}

const decision = (over: Partial<PendingDecisionRow>): PendingDecisionRow => ({
  id: "d1",
  kind: "social_post",
  ref: null,
  status: "pending",
  payload: null,
  ...over,
});

describe("resolveDecision", () => {
  it("refuses to approve a social_post with no paused-run ref", async () => {
    const { supabase, db } = fakeDecisions({});
    const res = await resolveDecision(
      supabase,
      "user-1",
      decision({ ref: null }),
      "approve",
    );
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({
      error: "the agent is no longer waiting on this — dismiss it instead",
    });
    // The refused approval never reaches the claim update.
    expect(db.updates).toHaveLength(0);
  });

  it("claims a still-pending row and reports the choice", async () => {
    const { supabase, db } = fakeDecisions({ updated: [{ id: "d1" }] });
    const res = await resolveDecision(
      supabase,
      "user-1",
      decision({ ref: null }),
      "dismiss",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.updates[0]?.patch["status"]).toBe("dismissed");
  });

  it("reports the opposite choice as a conflict when the row already resolved", async () => {
    const { supabase } = fakeDecisions({
      updated: [],
      currentStatus: "approved",
    });
    const res = await resolveDecision(
      supabase,
      "user-1",
      decision({ ref: null }),
      "dismiss",
    );
    expect(res.status).toBe(409);
  });

  it("reports the same choice as done when the row already resolved", async () => {
    const { supabase } = fakeDecisions({
      updated: [],
      currentStatus: "dismissed",
    });
    const res = await resolveDecision(
      supabase,
      "user-1",
      decision({ ref: null }),
      "dismiss",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("maps a failed claim update to a 500", async () => {
    const { supabase } = fakeDecisions({
      updated: null,
      updateError: { message: "connection lost" },
    });
    const res = await resolveDecision(
      supabase,
      "user-1",
      decision({ kind: "note" }),
      "approve",
    );
    expect(res.status).toBe(500);
  });

  describe("vault_fill (K196)", () => {
    const staging = ".hermes/vault/.inbox/agent-3f9a1c2e-8b7d-4e5f-9a6b-0c1d2e3f4a5b.json";
    const vaultDecision = (payload: unknown) =>
      decision({ kind: "vault_fill", ref: staging, payload });

    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("approve applies the staged inbox file on the filing box", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        vaultDecision({ name: "passport", kind: "identity", box_id: "box-7" }),
        "approve",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(applyStagedFile)).toHaveBeenCalledWith(
        "box-7",
        "user-1",
        staging,
      );
      // The filing box is named in the payload — no wake fallback.
      expect(vi.mocked(ensureBoxAwake)).not.toHaveBeenCalled();
      expect(vi.mocked(command)).not.toHaveBeenCalled();
    });

    it("dismiss shreds the staged file and never applies it", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        vaultDecision({ name: "passport", kind: "identity", box_id: "box-7" }),
        "dismiss",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(applyStagedFile)).not.toHaveBeenCalled();
      const shred = vi.mocked(command).mock.calls[0];
      expect(shred?.[0]).toBe("box-7");
      expect(shred?.[1]).toContain("shred -u");
      expect(shred?.[1]).toContain(staging);
    });

    it("wakes the owner's box when the payload names no box_id", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        vaultDecision({ name: "passport", kind: "identity" }),
        "approve",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(ensureBoxAwake)).toHaveBeenCalledWith(
        expect.anything(),
        "user-1",
      );
      expect(vi.mocked(applyStagedFile)).toHaveBeenCalledWith(
        "box-awake",
        "user-1",
        staging,
      );
    });
  });

  describe("kind side effects", () => {
    beforeEach(() => {
      vi.clearAllMocks();
    });

    it("email_draft approve sends the held draft", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "email_draft", ref: "draft-9" }),
        "approve",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(sendHeldDraft)).toHaveBeenCalledWith(
        expect.anything(),
        "user-1",
        "draft-9",
        "d1",
      );
    });

    it("email_draft approve maps EmailDraftError to its status", async () => {
      vi.mocked(sendHeldDraft).mockRejectedValueOnce(
        new EmailDraftError(409, "draft already sent"),
      );
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "email_draft", ref: "draft-9" }),
        "approve",
      );
      expect(res.status).toBe(409);
      expect(await res.json()).toEqual({ error: "draft already sent" });
    });

    it("email_draft dismiss never sends", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "email_draft", ref: "draft-9" }),
        "dismiss",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(sendHeldDraft)).not.toHaveBeenCalled();
    });

    it("calendar_add approve confirms the inbox event on the box", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "calendar_add", ref: "evt-3" }),
        "approve",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(approveInboxEvent)).toHaveBeenCalledWith(
        "box-awake",
        "evt-3",
      );
    });

    it("calendar_add dismiss tombstones the invite", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "calendar_add", ref: "evt-3" }),
        "dismiss",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(dismissInboxEvent)).toHaveBeenCalledWith(
        "box-awake",
        "evt-3",
      );
      expect(vi.mocked(approveInboxEvent)).not.toHaveBeenCalled();
    });

    it("crm_update approve applies the stored patch; box failure is a 502", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "crm_update", payload: { name: "Jane" } }),
        "approve",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(applyPatchOnBox)).toHaveBeenCalledOnce();

      vi.mocked(applyPatchOnBox).mockRejectedValueOnce(new Error("unreachable"));
      const { supabase: supabase2 } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res2 = await resolveDecision(
        supabase2,
        "user-1",
        decision({ kind: "crm_update", payload: { name: "Jane" } }),
        "approve",
      );
      expect(res2.status).toBe(502);
    });

    it("muse_action approve delegates to the capability resolver", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "muse_action", payload: { cap: "calendar" } }),
        "approve",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(resolveMuseActionDecision)).toHaveBeenCalledWith(
        expect.anything(),
        "user-1",
        { id: "d1", payload: { cap: "calendar" } },
        true,
      );
    });

    it("run_approval approve with no pending transfer falls through to the claim", async () => {
      const { supabase } = fakeDecisions({ updated: [{ id: "d1" }] });
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "run_approval", ref: "tr-5" }),
        "approve",
      );
      expect(res.status).toBe(200);
      expect(vi.mocked(findPendingTransfer)).toHaveBeenCalledWith(
        expect.anything(),
        "user-1",
        "tr-5",
      );
    });

    it("reconnect/revise re-queues the parked content slot", async () => {
      const { supabase, db } = fakeDecisions({ updated: [{ id: "d1" }] });
      db.tables["content_slots"] = [
        { id: "slot-1", user_id: "user-1", status: "parked" },
      ];
      const res = await resolveDecision(
        supabase,
        "user-1",
        decision({ kind: "reconnect", ref: "slot-1" }),
        "approve",
      );
      expect(res.status).toBe(200);
      const slotUpdate = db.updates.find((u) => u.table === "content_slots");
      expect(slotUpdate?.patch["status"]).toBe("scheduled");
    });
  });
});
