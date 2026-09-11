import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimSchedule } from "./sweep";
import type { AgentSchedule } from "./schedule";

const SCHEDULE: AgentSchedule = {
  id: "s1",
  user_id: "u1",
  name: "Morning brief",
  cron: "0 9 * * *",
  timezone: "UTC",
  prompt_ref: ".hermes/schedules/s1.md",
  deliver: "imessage",
  source: "calendar",
  status: "active",
  next_run_at: "2026-08-18T09:00:00.000Z",
  last_run_at: null,
  failure_count: 0,
  one_shot: false,
};

/**
 * A supabase stub whose claim_schedule RPC emulates the real one's contract:
 * CAS on (id, status=active, next_run_at=expected) + admission check +
 * delivery-receipt dedupe, all in one statement.
 */
function makeSupabase(
  row: { next_run_at: string; status: string },
  opts: { admission?: "open" | "closed"; receipts?: Map<string, string> } = {}
) {
  const claims: string[][] = [];
  const receipts = opts.receipts ?? new Map<string, string>();
  const client = {
    rpc: (name: string, args: Record<string, unknown>) => {
      expect(name).toBe("claim_schedule");
      const expected = args["p_expected_next_run_at"] as string;
      const next = args["p_next_run_at"] as string;
      claims.push([expected, next]);
      const stableId = `${SCHEDULE.id}@${expected}`;
      if (opts.admission === "closed") {
        return Promise.resolve({ data: { claimed: false, reason: "admission_closed" } });
      }
      if (row.status !== "active" || row.next_run_at !== expected) {
        return Promise.resolve({ data: { claimed: false, reason: "lost" } });
      }
      row.next_run_at = next;
      const existing = receipts.get(stableId);
      if (existing && existing !== "held") {
        return Promise.resolve({
          data: { claimed: true, duplicate: true, schedule: { ...SCHEDULE, next_run_at: next } },
        });
      }
      receipts.set(stableId, "running");
      return Promise.resolve({
        data: {
          claimed: true,
          duplicate: false,
          schedule: { ...SCHEDULE, next_run_at: next },
          operation_id: "op-1",
        },
      });
    },
    from: () => {
      throw new Error("claimSchedule must not touch tables directly — the RPC owns the claim");
    },
  } as unknown as SupabaseClient;
  return { client, claims, receipts };
}
describe("claimSchedule", () => {
  it("claims a due row and returns the advanced schedule + lease", async () => {
    const { client } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "active",
    });
    const claimed = await claimSchedule(client, SCHEDULE);
    expect(claimed).toBeDefined();
    expect(claimed?.schedule.next_run_at).not.toBe(SCHEDULE.next_run_at);
    expect(claimed?.operationId).toBe("op-1");
    expect(claimed?.duplicate).toBe(false);
  });

  it("is idempotent — a second racing claim of the same fire loses", async () => {
    const { client } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "active",
    });
    const first = await claimSchedule(client, SCHEDULE);
    const second = await claimSchedule(client, SCHEDULE);
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("does not claim a paused schedule", async () => {
    const { client } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "paused",
    });
    expect(await claimSchedule(client, SCHEDULE)).toBeUndefined();
  });

  it("does not claim while admission is closed (migration pause)", async () => {
    const { client } = makeSupabase(
      { next_run_at: SCHEDULE.next_run_at, status: "active" },
      { admission: "closed" }
    );
    expect(await claimSchedule(client, SCHEDULE)).toBeUndefined();
  });

  it("flags a delivered occurrence as duplicate (no second run)", async () => {
    const stableId = `${SCHEDULE.id}@${SCHEDULE.next_run_at}`;
    const { client } = makeSupabase(
      { next_run_at: SCHEDULE.next_run_at, status: "active" },
      { receipts: new Map([[stableId, "completed"]]) }
    );
    const claimed = await claimSchedule(client, SCHEDULE);
    expect(claimed?.duplicate).toBe(true);
  });
});
