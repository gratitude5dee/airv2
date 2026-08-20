/**
 * P1-4 acceptance: conversion postbacks are idempotent by client-supplied
 * event_id — a replayed postback acknowledges without a second row, so
 * conversions and value_cents never double-count.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

interface ConversionRow {
  account_id: string;
  event_id: string;
  value_cents: number | null;
  [key: string]: unknown;
}

const db: { conversions: ConversionRow[] } = { conversions: [] };

const ACCOUNT = {
  id: "acct-1",
  user_id: "user-1",
  conversion_token: "tok_secret",
};

function fakeSupabase() {
  return {
    from(table: string) {
      if (table === "ad_accounts") {
        const chain = {
          select: () => chain,
          eq: () => chain,
          limit: async () => ({ data: [ACCOUNT], error: null }),
        };
        return chain;
      }
      if (table === "ad_conversions") {
        return {
          async upsert(
            row: ConversionRow,
            options?: { onConflict?: string; ignoreDuplicates?: boolean }
          ) {
            const keys = (options?.onConflict ?? "").split(",");
            const duplicate = db.conversions.some((existing) =>
              keys.every((key) => existing[key] === row[key])
            );
            if (duplicate) {
              if (options?.ignoreDuplicates) return { error: null };
              return { error: { code: "23505", message: "duplicate" } };
            }
            db.conversions.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

vi.mock("@/lib/supabase", () => ({ serviceClient: () => fakeSupabase() }));

import { POST } from "../../app/api/ads/conversions/route";

function post(body: Record<string, unknown>): Promise<Response> {
  return POST(
    new NextRequest("https://airv2.vercel.app/api/ads/conversions", {
      method: "POST",
      body: JSON.stringify(body),
    })
  );
}

const POSTBACK = {
  token: "tok_secret",
  account_ref: "ref-1",
  creative_ref: "creative-1",
  event: "purchase",
  event_id: "evt-1",
  value_cents: 500,
};

describe("POST /api/ads/conversions", () => {
  beforeEach(() => {
    db.conversions = [];
  });

  it("rejects a postback without event_id", async () => {
    const { event_id: _omitted, ...rest } = POSTBACK;
    const response = await post(rest);
    expect(response.status).toBe(400);
  });

  it("records a conversion once and ignores replays", async () => {
    const first = await post(POSTBACK);
    expect(first.status).toBe(200);
    expect(db.conversions).toHaveLength(1);
    expect(db.conversions[0]?.value_cents).toBe(500);

    const replay = await post(POSTBACK);
    expect(replay.status).toBe(200);
    expect(db.conversions).toHaveLength(1);
  });

  it("records distinct event_ids separately", async () => {
    await post(POSTBACK);
    await post({ ...POSTBACK, event_id: "evt-2" });
    expect(db.conversions).toHaveLength(2);
  });
});
