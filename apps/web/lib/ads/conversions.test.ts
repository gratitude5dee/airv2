/**
 * P1-4 acceptance: conversion postbacks are idempotent by client-supplied
 * event_id — a replayed postback acknowledges without a second row, so
 * conversions and value_cents never double-count.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { FakeSupabase } from "../testing/fakeSupabase";

const db = new FakeSupabase();

const ACCOUNT = {
  id: "acct-1",
  user_id: "user-1",
  account_ref: "ref-1",
  status: "active",
  conversion_token: "tok_secret",
};

vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.client() }));

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
    db.reset();
    db.tables["ad_accounts"] = [{ ...ACCOUNT }];
  });

  it("rejects a postback without event_id", async () => {
    const { event_id: _omitted, ...rest } = POSTBACK;
    const response = await post(rest);
    expect(response.status).toBe(400);
  });

  it("records a conversion once and ignores replays", async () => {
    const first = await post(POSTBACK);
    expect(first.status).toBe(200);
    expect(db.rows("ad_conversions")).toHaveLength(1);
    expect(db.rows("ad_conversions")[0]?.["value_cents"]).toBe(500);

    const replay = await post(POSTBACK);
    expect(replay.status).toBe(200);
    expect(db.rows("ad_conversions")).toHaveLength(1);
  });

  it("records distinct event_ids separately", async () => {
    await post(POSTBACK);
    await post({ ...POSTBACK, event_id: "evt-2" });
    expect(db.rows("ad_conversions")).toHaveLength(2);
  });
});
