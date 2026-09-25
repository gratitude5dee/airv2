/**
 * Idempotency: replaying the identical webhook delivery must produce exactly
 * one dispatched effect — the second and third insert conflict on the
 * (webhook_id, message_id) primary key and report already-seen.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";
import { dedupeInboundEvent, resolveInboundRoute } from "./inbound";

const db = new FakeSupabase();
const supabase = db.client();

beforeEach(() => {
  db.reset();
  // The (webhook_id, message_id) primary key dedupes replayed deliveries.
  db.uniques["inbound_events"] = ["webhook_id,message_id"];
});

describe("dedupeInboundEvent", () => {
  it("replaying the identical delivery three times yields one effect", async () => {
    const key = { webhookId: "wh-1", messageId: "msg-1" };
    const first = await dedupeInboundEvent(supabase, key, null);
    const second = await dedupeInboundEvent(supabase, key, null);
    const third = await dedupeInboundEvent(supabase, key, null);
    expect(first.alreadySeen).toBe(false);
    expect(second.alreadySeen).toBe(true);
    expect(third.alreadySeen).toBe(true);
    expect(db.rows("inbound_events")).toHaveLength(1);
  });

  it("distinct messages are not deduped", async () => {
    const first = await dedupeInboundEvent(
      supabase,
      { webhookId: "wh-1", messageId: "msg-1" },
      null
    );
    const second = await dedupeInboundEvent(
      supabase,
      { webhookId: "wh-1", messageId: "msg-2" },
      null
    );
    expect(first.alreadySeen).toBe(false);
    expect(second.alreadySeen).toBe(false);
  });

  it("throws on non-conflict database errors", async () => {
    db.opErrors["inbound_events:insert"] = {
      code: "08000",
      message: "connection lost",
    };
    await expect(
      dedupeInboundEvent(supabase, { webhookId: "wh", messageId: "m" }, null)
    ).rejects.toThrowError(/insert failed/);
  });
});

describe("resolveInboundRoute", () => {
  it("queries line and sender lookups together and prefers the line", async () => {
    db.tables["lines"] = [
      { phone: "+14155550100", assigned_user_id: "line-owner" },
    ];
    db.tables["handles"] = [
      {
        platform: "imessage",
        address: "+14155550101",
        user_id: "sender-owner",
      },
    ];

    const result = await resolveInboundRoute(supabase, {
      phone: "+14155550100",
      senderAddress: "+14155550101",
    });
    expect(result).toEqual({ userId: "line-owner" });
    // Both lookups fired: the sender route is resolved concurrently, not
    // skipped by the line hit (sequential resolution would never ask handles).
    db.expectQuery({ table: "lines", filters: { phone: "+14155550100" } });
    db.expectQuery({
      table: "handles",
      filters: { platform: "imessage", address: "+14155550101" },
    });
  });

  it("falls back to the shared-line sender route", async () => {
    db.tables["handles"] = [
      {
        platform: "imessage",
        address: "+14155550101",
        user_id: "owner",
      },
    ];

    await expect(
      resolveInboundRoute(supabase, {
        phone: "shared",
        senderAddress: "+14155550101",
      })
    ).resolves.toEqual({ userId: "owner" });
  });
});
