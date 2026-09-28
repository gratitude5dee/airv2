/**
 * P1-2: the monthly cap window rolls on read — a stale spend_period_start
 * resets the counter before the cap is evaluated, and concurrent rolls
 * serialize through the guarded update.
 */
import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { currentPeriodSpend, spendPeriodRolled } from "./spend";

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
    const db = new FakeSupabase();
    const spend = await currentPeriodSpend(
      db.client(),
      "u1",
      { spend_mtd_usd: "12.5000", spend_period_start: "2026-08-01T00:00:00Z" },
      now
    );
    expect(spend).toBe(12.5);
    expect(db.queries).toHaveLength(0);
  });

  it("resets a stale period and evaluates the cap against zero", async () => {
    const db = new FakeSupabase();
    db.tables["entitlements"] = [
      {
        user_id: "u1",
        spend_mtd_usd: "19.9900",
        spend_period_start: "2026-07-01T00:00:00Z",
      },
    ];
    const spend = await currentPeriodSpend(
      db.client(),
      "u1",
      { spend_mtd_usd: "19.9900", spend_period_start: "2026-07-01T00:00:00Z" },
      now
    );
    expect(spend).toBe(0);
    expect(db.updates).toHaveLength(1);
    expect(db.updates[0]?.patch).toMatchObject({ spend_mtd_usd: 0 });
    expect(db.updates[0]?.patch["spend_period_start"]).toBe(now.toISOString());
    // The guarded update fences on the previously-read spend value.
    db.expectQuery({
      table: "entitlements",
      filters: { user_id: "u1", spend_mtd_usd: "19.9900" },
    });
  });

  it("re-reads the row when it loses the guarded update", async () => {
    const db = new FakeSupabase();
    // A concurrent roll (or add_spend) won: the row no longer carries the
    // spend the caller read, so the CAS update matches nothing.
    db.tables["entitlements"] = [
      {
        user_id: "u1",
        spend_mtd_usd: 0.25,
        spend_period_start: "2026-08-20T07:00:00Z",
      },
    ];
    const spend = await currentPeriodSpend(
      db.client(),
      "u1",
      { spend_mtd_usd: "19.9900", spend_period_start: "2026-07-01T00:00:00Z" },
      now
    );
    expect(spend).toBe(0.25);
    expect(db.updates).toHaveLength(1);
  });
});
