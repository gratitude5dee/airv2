import { describe, expect, it } from "vitest";
import {
  MAX_PUSH_ROWS,
  MetricsValidationError,
  validatePushedRows,
} from "./metrics";

const USER = "00000000-0000-0000-0000-000000000001";
const ACCOUNTS = [{ id: "acc-1", account_ref: "act_123" }];

function yesterday(): string {
  return new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function goodRow(overrides: Record<string, unknown> = {}) {
  return {
    provider: "meta",
    level: "campaign",
    entity_ref: "cmp_1",
    metric_date: yesterday(),
    impressions: 100,
    clicks: 5,
    spend_cents: 250,
    conversions: 1,
    conversion_value_cents: 999,
    ...overrides,
  };
}

describe("validatePushedRows (hostile input, C9)", () => {
  it("accepts a valid batch attributed to the authenticated user", () => {
    const rows = validatePushedRows({ rows: [goodRow()] }, USER, ACCOUNTS);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      user_id: USER,
      account_id: "acc-1",
      provider: "meta",
      spend_cents: 250,
    });
  });

  it("rejects empty, missing, and oversized batches", () => {
    expect(() => validatePushedRows({}, USER, ACCOUNTS)).toThrow(
      MetricsValidationError
    );
    expect(() => validatePushedRows({ rows: [] }, USER, ACCOUNTS)).toThrow(
      MetricsValidationError
    );
    const flood = { rows: Array(MAX_PUSH_ROWS + 1).fill(goodRow()) };
    expect(() => validatePushedRows(flood, USER, ACCOUNTS)).toThrow(
      MetricsValidationError
    );
  });

  it("rejects negative and non-integer counters", () => {
    for (const bad of [
      { impressions: -1 },
      { clicks: 1.5 },
      { spend_cents: -100 },
      { conversions: Number.NaN },
      { conversion_value_cents: Number.POSITIVE_INFINITY },
      { spend_cents: 10_000_000_000_000 },
    ]) {
      expect(() =>
        validatePushedRows({ rows: [goodRow(bad)] }, USER, ACCOUNTS)
      ).toThrow(MetricsValidationError);
    }
  });

  it("rejects future and stale dates", () => {
    const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    const stale = new Date(Date.now() - 91 * 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);
    for (const metric_date of [future, stale, "not-a-date", "2026-1-1"]) {
      expect(() =>
        validatePushedRows({ rows: [goodRow({ metric_date })] }, USER, ACCOUNTS)
      ).toThrow(MetricsValidationError);
    }
  });

  it("rejects unknown providers, levels, and entity refs", () => {
    for (const bad of [
      { provider: "openai" },
      { provider: "tiktok" },
      { level: "user" },
      { entity_ref: "" },
      { entity_ref: "x".repeat(129) },
    ]) {
      expect(() =>
        validatePushedRows({ rows: [goodRow(bad)] }, USER, ACCOUNTS)
      ).toThrow(MetricsValidationError);
    }
  });

  it("cannot write into another user's account", () => {
    // A row naming a foreign account_ref never matches the authenticated
    // user's accounts — the batch is rejected whole.
    expect(() =>
      validatePushedRows(
        { rows: [goodRow({ account_ref: "act_someone_else" })] },
        USER,
        ACCOUNTS
      )
    ).toThrow(MetricsValidationError);
  });

  it("requires account_ref when several accounts are connected", () => {
    const two = [
      ...ACCOUNTS,
      { id: "acc-2", account_ref: "act_456" },
    ];
    expect(() =>
      validatePushedRows({ rows: [goodRow()] }, USER, two)
    ).toThrow(MetricsValidationError);
    const rows = validatePushedRows(
      { rows: [goodRow({ account_ref: "act_456" })] },
      USER,
      two
    );
    expect(rows[0]?.account_id).toBe("acc-2");
  });
});
