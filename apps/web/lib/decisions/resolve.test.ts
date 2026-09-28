import { describe, expect, it } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";
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
});
