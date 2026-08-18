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
 * A supabase stub whose conditional update only matches while the stored
 * next_run_at equals the caller's expectation — the same compare-and-swap
 * the real claim relies on.
 */
function makeSupabase(row: { next_run_at: string; status: string }) {
  const updates: Array<Record<string, unknown>> = [];
  const client = {
    from: (table: string) => {
      expect(table).toBe("agent_schedules");
      return {
        update: (values: Record<string, unknown>) => {
          const filters: Record<string, unknown> = {};
          const builder = {
            eq: (column: string, value: unknown) => {
              filters[column] = value;
              return builder;
            },
            select: () => {
              const matches =
                filters.id === SCHEDULE.id &&
                filters.status === row.status &&
                filters.next_run_at === row.next_run_at;
              if (!matches) return Promise.resolve({ data: [] });
              row.next_run_at = values.next_run_at as string;
              updates.push(values);
              return Promise.resolve({
                data: [{ ...SCHEDULE, ...values }],
              });
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, updates };
}

describe("claimSchedule", () => {
  it("claims a due row and advances next_run_at", async () => {
    const { client, updates } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "active",
    });
    const claimed = await claimSchedule(client, SCHEDULE);
    expect(claimed).toBeDefined();
    expect(updates).toHaveLength(1);
    expect(updates[0]?.next_run_at).not.toBe(SCHEDULE.next_run_at);
  });

  it("is idempotent — a second racing claim of the same fire loses", async () => {
    const { client, updates } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "active",
    });
    const first = await claimSchedule(client, SCHEDULE);
    const second = await claimSchedule(client, SCHEDULE);
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
    expect(updates).toHaveLength(1);
  });

  it("does not claim a paused schedule", async () => {
    const { client } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "paused",
    });
    expect(await claimSchedule(client, SCHEDULE)).toBeUndefined();
  });
});
