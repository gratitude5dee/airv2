/**
 * R-TQ-06: wallet send composer. The route never sends — a valid request
 * files one pending wallet_transfers intent plus its run_approval decision;
 * tampered amounts/addresses die at validation before any row is written.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { NextRequest } from "next/server";

const db = new FakeSupabase();

const sessionUserId = vi.hoisted(() => vi.fn(() => "user-1" as string | null));

vi.mock("@/lib/supabase", () => ({ serviceClient: () => db.client() }));
vi.mock("@/lib/auth/user", () => ({ sessionUserId }));

import { POST } from "./route";

const TO = "0x00000000000000000000000000000000DeaDBeeF";
const TRANSFER_ID = "44444444-4444-4444-8444-444444444444";
const DECISION_ID = "55555555-5555-4555-8555-555555555555";

function post(body: unknown): Promise<Response> {
  return POST(
    new NextRequest("https://app.example/api/wallet/send", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    })
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  db.reset();
  db.defaults["wallet_transfers"] = { id: TRANSFER_ID };
  db.defaults["decisions"] = { id: DECISION_ID };
  sessionUserId.mockReturnValue("user-1");
});

describe("POST /api/wallet/send", () => {
  it("rejects unauthenticated callers with 401", async () => {
    sessionUserId.mockReturnValue(null);
    const response = await post({ to: TO, amount: "1.0" });
    expect(response.status).toBe(401);
    expect(db.queries).toHaveLength(0);
  });

  it("rejects a tampered amount — the regex refuses it before any insert", async () => {
    for (const amount of ["-1", "1e9", "1000000000", "1.0000000000000000000", "NaN", "1,000"]) {
      db.queries.length = 0;
      const response = await post({ to: TO, amount });
      expect(response.status).toBe(400);
      expect(db.queries.some((q) => q.mode === "insert")).toBe(false);
    }
  });

  it("rejects a non-0x recipient", async () => {
    const response = await post({ to: "vitalik.eth", amount: "1" });
    expect(response.status).toBe(400);
    expect(db.queries.some((q) => q.mode === "insert")).toBe(false);
  });

  it("rejects an unknown asset", async () => {
    const response = await post({ to: TO, amount: "1", asset: "doge" });
    expect(response.status).toBe(400);
  });

  it("files the transfer intent plus a run_approval decision on the happy path", async () => {
    const response = await post({ to: `  ${TO.toLowerCase()}  `, amount: "0.5" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true, decision_id: DECISION_ID });

    const transfer = db.inserts.find((i) => i.table === "wallet_transfers");
    expect(transfer?.row).toMatchObject({
      user_id: "user-1",
      to_address: TO.toLowerCase(),
      amount_display: "0.5",
      token_symbol: "ETH",
      amount_wei: "500000000000000000",
    });

    const decision = db.inserts.find((i) => i.table === "decisions");
    expect(decision?.row).toMatchObject({
      user_id: "user-1",
      kind: "run_approval",
      ref: TRANSFER_ID,
    });
    expect((decision?.row as { payload: Record<string, unknown> }).payload)
      .toMatchObject({ wallet_send: true, to_address: TO.toLowerCase() });
  });

  it("marks the intent failed when the decision insert fails (no dangling pending)", async () => {
    db.opErrors["decisions:insert"] = { message: "insert failed" };
    const response = await post({ to: TO, amount: "1" });
    expect(response.status).toBe(500);
    const cleanup = db.updates.find((u) => u.table === "wallet_transfers");
    expect(cleanup?.patch).toMatchObject({ status: "failed" });
  });
});
