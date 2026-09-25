import { describe, expect, it } from "vitest";
import { FakeSupabase } from "@/lib/testing/fakeSupabase";
import { CARD_COOLDOWN_MS, claimCardSend } from "./cardSends";

/**
 * The card_sends table: a (user_id, kind) unique key so the insert wins the
 * first send and afterwards only the conditional `.lt` update on sent_at can
 * claim — the same shape the atomic claim relies on.
 */
function makeDb(initial?: { kind: string; sent_at: string }) {
  const db = new FakeSupabase();
  db.uniques["card_sends"] = ["user_id,kind"];
  if (initial)
    db.tables["card_sends"] = [
      { user_id: "u1", kind: initial.kind, sent_at: initial.sent_at },
    ];
  return db;
}

describe("claimCardSend", () => {
  it("claims when no row exists yet", async () => {
    const db = makeDb();
    expect(await claimCardSend(db.client(), "u1", "calendar")).toBeDefined();
  });

  it("refuses a second claim inside the cooldown", async () => {
    const db = makeDb();
    expect(await claimCardSend(db.client(), "u1", "calendar")).toBeDefined();
    expect(
      await claimCardSend(db.client(), "u1", "calendar")
    ).toBeUndefined();
  });

  it("claims again after the cooldown has passed", async () => {
    const stale = new Date(
      Date.now() - CARD_COOLDOWN_MS - 1000
    ).toISOString();
    const db = makeDb({ kind: "calendar", sent_at: stale });
    expect(await claimCardSend(db.client(), "u1", "calendar")).toBeDefined();
  });

  it("tracks kinds independently", async () => {
    const db = makeDb();
    expect(await claimCardSend(db.client(), "u1", "computer")).toBeDefined();
    expect(await claimCardSend(db.client(), "u1", "calendar")).toBeDefined();
    expect(
      await claimCardSend(db.client(), "u1", "calendar")
    ).toBeUndefined();
  });

  it("release backdates the claim so a failed send can retry sooner", async () => {
    const db = makeDb();
    const claim = await claimCardSend(db.client(), "u1", "calendar");
    expect(claim).toBeDefined();
    const before = db.rows("card_sends")[0]?.sent_at;
    await claim?.release();
    const after = db.rows("card_sends")[0]?.sent_at;
    expect(after).toBeDefined();
    expect(String(after) < String(before)).toBe(true);
  });
});
