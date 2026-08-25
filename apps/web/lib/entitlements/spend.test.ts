/**
 * P1-2: the monthly cap window rolls on read — a stale spend_period_start
 * resets the counter before the cap is evaluated, and concurrent rolls
 * serialize through the guarded update.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { currentPeriodSpend, spendPeriodRolled } from "./spend";

interface UpdateCall {
  values: Record<string, unknown>;
  filters: Record<string, unknown>;
}

function fakeSupabase(options: {
  casWins: boolean;
  freshSpend?: number;
  calls: UpdateCall[];
}): SupabaseClient {
  return {
    from: (table: string) => {
      if (table !== "entitlements") throw new Error(`unexpected table ${table}`);
      return {
        update: (values: Record<string, unknown>) => {
          const call: UpdateCall = { values, filters: {} };
          options.calls.push(call);
          const chain = {
            eq: (column: string, value: unknown) => {
              call.filters[column] = value;
              return chain;
            },
            select: async () =>
              options.casWins
                ? { data: [{ user_id: "u1" }], error: null }
                : { data: [], error: null },
          };
          return chain;
        },
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data:
                options.freshSpend === undefined
                  ? null
                  : { spend_mtd_usd: options.freshSpend },
              error: null,
            }),
          }),
        }),
      };
    },
  } as unknown as SupabaseClient;
}

describe("spendPeriodRolled", () => {
  it("is false within the same UTC month", () => {
    expect(
      spendPeriodRolled(new Date("2026-08-01T00:00:00Z"), new Date("2026-08-20T07:00:00Z"))
    ).toBe(false);
  });

  it("is true once the month (or year) moves on", () => {
    expect(
      spendPeriodRolled(new Date("2026-07-31T23:59:59Z"), new Date("2026-08-01T00:00:00Z"))
    ).toBe(true);
    expect(
      spendPeriodRolled(new Date("2025-08-15T00:00:00Z"), new Date("2026-08-15T00:00:00Z"))
    ).toBe(true);
  });
});

describe("currentPeriodSpend", () => {
  const now = new Date("2026-08-20T07:00:00Z");

  it("returns the stored spend when the period is current", async () => {
    const calls: UpdateCall[] = [];
    const spend = await currentPeriodSpend(
      fakeSupabase({ casWins: true, calls }),
      "u1",
      { spend_mtd_usd: "12.5000", spend_period_start: "2026-08-01T00:00:00Z" },
      now
    );
    expect(spend).toBe(12.5);
    expect(calls).toHaveLength(0);
  });

  it("resets a stale period and evaluates the cap against zero", async () => {
    const calls: UpdateCall[] = [];
    const spend = await currentPeriodSpend(
      fakeSupabase({ casWins: true, calls }),
      "u1",
      { spend_mtd_usd: "19.9900", spend_period_start: "2026-07-01T00:00:00Z" },
      now
    );
    expect(spend).toBe(0);
    expect(calls).toHaveLength(1);
    const call = calls[0]!;
    expect(call.values).toMatchObject({ spend_mtd_usd: 0 });
    expect(call.values["spend_period_start"]).toBe(now.toISOString());
    expect(call.filters).toMatchObject({
      user_id: "u1",
      spend_mtd_usd: "19.9900",
    });
  });

  it("re-reads the row when it loses the guarded update", async () => {
    const calls: UpdateCall[] = [];
    const spend = await currentPeriodSpend(
      fakeSupabase({ casWins: false, freshSpend: 0.25, calls }),
      "u1",
      { spend_mtd_usd: "19.9900", spend_period_start: "2026-07-01T00:00:00Z" },
      now
    );
    expect(spend).toBe(0.25);
    expect(calls).toHaveLength(1);
  });
});
