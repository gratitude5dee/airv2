/**
 * V8 hardening item 4 — the dashboard math: the sweeper's start consumption
 * is alarmed at 70% of its budget share, and per-user social usage alarms
 * at 70% of the summed daily caps.
 */
import { describe, expect, it } from "vitest";
import {
  ALERT_RATIO,
  DAILY_START_CEILING,
  SCHEDULE_BUDGET_SHARE,
  scheduleBudget,
  socialUsage,
} from "./ops";

describe("scheduleBudget", () => {
  const share = DAILY_START_CEILING * SCHEDULE_BUDGET_SHARE; // 500/day

  it("stays quiet under 70% of the schedule share", () => {
    const budget = scheduleBudget(200, 100); // 300 < 350
    expect(budget.alert).toBe(false);
    expect(budget.share_used).toBeCloseTo(300 / share);
  });

  it("alarms at exactly 70% of the share", () => {
    const consumed = Math.ceil(share * ALERT_RATIO); // 350
    expect(scheduleBudget(consumed, 0).alert).toBe(true);
    expect(scheduleBudget(consumed - 1, 0).alert).toBe(false);
  });

  it("keep-awake wakes count against the same share", () => {
    expect(scheduleBudget(0, 350).alert).toBe(true);
  });
});

describe("socialUsage", () => {
  it("sums per-user actions and caps across rules", () => {
    const usage = socialUsage([
      { user_id: "u1", used_today: 10, daily_cap: 25 },
      { user_id: "u1", used_today: 8, daily_cap: 25 },
      { user_id: "u2", used_today: 1, daily_cap: 25 },
    ]);
    const u1 = usage.find((row) => row.user_id === "u1");
    expect(u1?.actions_today).toBe(18);
    expect(u1?.daily_cap).toBe(50);
    expect(u1?.alert).toBe(false);
  });

  it("alarms a user at 70% of their summed cap", () => {
    const [row] = socialUsage([
      { user_id: "u1", used_today: 18, daily_cap: 25 },
    ]);
    expect(row?.alert).toBe(true); // 18 >= 17.5
  });

  it("a zero-cap user never divides by zero", () => {
    const [row] = socialUsage([{ user_id: "u1", used_today: 0, daily_cap: 0 }]);
    expect(row?.cap_ratio).toBe(0);
    expect(row?.alert).toBe(false);
  });
});
