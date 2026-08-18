/**
 * C22 standing rules: disabled rules and exhausted caps refuse, quiet hours
 * refuse, the local-day rollover resets the Postgres-held counter (a box
 * restart can't), and every allowed claim leaves a content-free Needs-you
 * receipt.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { claimRuleUnit, inQuietHours } from "./rules";

interface Row {
  [key: string]: unknown;
}

/** Minimal stand-in for the three queries claimRuleUnit issues. */
function fakeSupabase(options: {
  rule: Row | null;
  timezone?: string;
  updateWins?: boolean;
}) {
  const inserts: { table: string; row: Row }[] = [];
  const updates: Row[] = [];
  const from = (table: string) => ({
    select: () => {
      if (table === "automation_rules") {
        const chain = {
          eq: () => chain,
          maybeSingle: () => Promise.resolve({ data: options.rule }),
        };
        return chain;
      }
      // agent_schedules — timezone source
      const chain = {
        eq: () => chain,
        order: () => chain,
        limit: () => chain,
        maybeSingle: () =>
          Promise.resolve({
            data: options.timezone ? { timezone: options.timezone } : null,
          }),
      };
      return chain;
    },
    update: (row: Row) => {
      updates.push(row);
      const chain = {
        eq: () => chain,
        select: () =>
          Promise.resolve({
            data: options.updateWins === false ? [] : [{ id: "rule-1" }],
          }),
      };
      return chain;
    },
    insert: (row: Row) => {
      inserts.push({ table, row });
      return Promise.resolve({ error: null });
    },
  });
  return { client: { from } as unknown as SupabaseClient, inserts, updates };
}

// Noon UTC — inside the 8:00–22:00 waking window for UTC users.
const NOON = new Date("2026-08-18T12:00:00Z");
// 02:00 UTC — quiet hours for UTC users.
const NIGHT = new Date("2026-08-18T02:00:00Z");

function rule(overrides: Row = {}): Row {
  return {
    id: "rule-1",
    playbook: "social-engage",
    platform: "x",
    enabled: true,
    daily_cap: 25,
    used_today: 0,
    last_reset_at: NOON.toISOString(),
    ...overrides,
  };
}

describe("claimRuleUnit", () => {
  it("refuses when no rule exists (default off)", async () => {
    const db = fakeSupabase({ rule: null });
    const result = await claimRuleUnit(
      db.client,
      "user-1",
      "social-engage",
      "x",
      "a post",
      NOON
    );
    expect(result).toEqual({ allowed: false, reason: "rule_disabled" });
  });

  it("refuses a disabled rule", async () => {
    const db = fakeSupabase({ rule: rule({ enabled: false }) });
    const result = await claimRuleUnit(
      db.client,
      "user-1",
      "social-engage",
      "x",
      "a post",
      NOON
    );
    expect(result).toEqual({ allowed: false, reason: "rule_disabled" });
  });

  it("refuses during quiet hours", async () => {
    const db = fakeSupabase({ rule: rule() });
    const result = await claimRuleUnit(
      db.client,
      "user-1",
      "social-engage",
      "x",
      "a post",
      NIGHT
    );
    expect(result).toEqual({ allowed: false, reason: "quiet_hours" });
  });

  it("refuses when the daily cap is spent", async () => {
    const db = fakeSupabase({
      rule: rule({ daily_cap: 25, used_today: 25 }),
    });
    const result = await claimRuleUnit(
      db.client,
      "user-1",
      "social-engage",
      "x",
      "a post",
      NOON
    );
    expect(result).toEqual({ allowed: false, reason: "cap_reached" });
  });

  it("allows under the cap and leaves a content-free receipt", async () => {
    const db = fakeSupabase({ rule: rule({ used_today: 3 }) });
    const result = await claimRuleUnit(
      db.client,
      "user-1",
      "social-engage",
      "x",
      "https://x.com/somebody/status/1",
      NOON
    );
    expect(result).toEqual({ allowed: true, remaining: 21 });
    expect(db.updates[0]).toMatchObject({ used_today: 4 });
    const receipt = db.inserts.find((entry) => entry.table === "decisions");
    expect(receipt?.row).toMatchObject({
      kind: "social_post",
      status: "approved",
    });
    // Receipt carries the target, never post content or credentials.
    expect(JSON.stringify(receipt?.row)).not.toContain("password");
  });

  it("resets the counter when the local day rolls over", async () => {
    const yesterday = new Date("2026-08-17T12:00:00Z").toISOString();
    const db = fakeSupabase({
      rule: rule({ used_today: 25, last_reset_at: yesterday }),
    });
    const result = await claimRuleUnit(
      db.client,
      "user-1",
      "social-engage",
      "x",
      "a post",
      NOON
    );
    expect(result).toEqual({ allowed: true, remaining: 24 });
    expect(db.updates[0]).toMatchObject({ used_today: 1 });
    expect(db.updates[0]).toHaveProperty("last_reset_at");
  });

  it("treats a lost concurrent update as cap pressure (no double spend)", async () => {
    const db = fakeSupabase({ rule: rule(), updateWins: false });
    const result = await claimRuleUnit(
      db.client,
      "user-1",
      "social-engage",
      "x",
      "a post",
      NOON
    );
    expect(result).toEqual({ allowed: false, reason: "cap_reached" });
    expect(db.inserts).toHaveLength(0);
  });
});

describe("inQuietHours", () => {
  it("tracks the user's timezone, not the server's", () => {
    // 12:00 UTC is 21:00 in Tokyo (awake) and 05:00 in Los Angeles (quiet).
    expect(inQuietHours(NOON, "Asia/Tokyo")).toBe(false);
    expect(inQuietHours(NOON, "America/Los_Angeles")).toBe(true);
  });
});
