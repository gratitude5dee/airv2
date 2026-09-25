import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolveDecision, type PendingDecisionRow } from "./resolve";

/**
 * The claim tail runs the same for every kind: update … where status =
 * 'pending', then read the current row when the update claimed nothing.
 */
function fakeDecisions(opts: {
  /** Rows the pending-claim update returns (empty = someone else won). */
  updated?: { id: string }[] | null;
  updateError?: { message: string } | null;
  /** The row's status when the claim lost and the current value is read. */
  currentStatus?: string;
}) {
  const updates: Record<string, unknown>[] = [];
  const supabase = {
    from(table: string) {
      if (table !== "decisions") {
        throw new Error(`unexpected table: ${table}`);
      }
      return {
        update(values: Record<string, unknown>) {
          updates.push(values);
          const filters = {
            eq: () => filters,
            select: async () => ({
              data: opts.updated ?? [],
              error: opts.updateError ?? null,
            }),
          };
          return filters;
        },
        select: () => {
          const filters = {
            eq: () => filters,
            maybeSingle: async () => ({
              data:
                opts.currentStatus !== undefined
                  ? { status: opts.currentStatus }
                  : null,
              error: null,
            }),
          };
          return filters;
        },
      };
    },
  };
  return { supabase: supabase as unknown as SupabaseClient, updates };
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
    const { supabase, updates } = fakeDecisions({});
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
    expect(updates).toHaveLength(0);
  });

  it("claims a still-pending row and reports the choice", async () => {
    const { supabase, updates } = fakeDecisions({ updated: [{ id: "d1" }] });
    const res = await resolveDecision(
      supabase,
      "user-1",
      decision({ ref: null }),
      "dismiss",
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(updates[0]?.["status"]).toBe("dismissed");
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
