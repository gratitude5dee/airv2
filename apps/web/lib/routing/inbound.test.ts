/**
 * Idempotency: replaying the identical webhook delivery must produce exactly
 * one dispatched effect — the second and third insert conflict on the
 * (webhook_id, message_id) primary key and report already-seen.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { dedupeInboundEvent } from "./inbound";

function fakeSupabase(): SupabaseClient {
  const seen = new Set<string>();
  return {
    from(table: string) {
      if (table !== "inbound_events") throw new Error(`unexpected table ${table}`);
      return {
        insert(row: { webhook_id: string; message_id: string }) {
          const key = `${row.webhook_id}:${row.message_id}`;
          if (seen.has(key)) {
            return Promise.resolve({
              error: { code: "23505", message: "duplicate key value" },
            });
          }
          seen.add(key);
          return Promise.resolve({ error: null });
        },
      };
    },
  } as unknown as SupabaseClient;
}

describe("dedupeInboundEvent", () => {
  it("replaying the identical delivery three times yields one effect", async () => {
    const supabase = fakeSupabase();
    const key = { webhookId: "wh-1", messageId: "msg-1" };
    const first = await dedupeInboundEvent(supabase, key, null);
    const second = await dedupeInboundEvent(supabase, key, null);
    const third = await dedupeInboundEvent(supabase, key, null);
    expect(first.alreadySeen).toBe(false);
    expect(second.alreadySeen).toBe(true);
    expect(third.alreadySeen).toBe(true);
  });

  it("distinct messages are not deduped", async () => {
    const supabase = fakeSupabase();
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
    const supabase = {
      from: () => ({
        insert: () =>
          Promise.resolve({ error: { code: "08000", message: "connection lost" } }),
      }),
    } as unknown as SupabaseClient;
    await expect(
      dedupeInboundEvent(supabase, { webhookId: "wh", messageId: "m" }, null)
    ).rejects.toThrowError(/insert failed/);
  });
});
