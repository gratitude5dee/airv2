import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { CARD_COOLDOWN_MS, claimCardSend } from "./cardSends";

/**
 * Stub of the card_sends table: a (user_id, kind) primary key with insert
 * unique-violation semantics and a conditional update matching `.lt` on
 * sent_at — the same shape the atomic claim relies on.
 */
function makeSupabase(initial?: { kind: string; sent_at: string }) {
  const rows = new Map<string, string>();
  if (initial) rows.set(`u1:${initial.kind}`, initial.sent_at);
  const client = {
    from: (table: string) => {
      expect(table).toBe("card_sends");
      return {
        insert: (values: { user_id: string; kind: string; sent_at: string }) => {
          const key = `${values.user_id}:${values.kind}`;
          if (rows.has(key)) {
            return Promise.resolve({
              error: { code: "23505", message: "duplicate key" },
            });
          }
          rows.set(key, values.sent_at);
          return Promise.resolve({ error: null });
        },
        update: (values: { sent_at: string }) => {
          const filters: Record<string, unknown> = {};
          const builder = {
            eq: (column: string, value: unknown) => {
              filters[column] = value;
              return builder;
            },
            lt: (column: string, value: unknown) => {
              filters[`lt:${column}`] = value;
              return builder;
            },
            select: () => {
              const key = `${filters.user_id}:${filters.kind}`;
              const current = rows.get(key);
              if (current === undefined) return Promise.resolve({ data: [] });
              if (
                "lt:sent_at" in filters &&
                !(current < (filters["lt:sent_at"] as string))
              ) {
                return Promise.resolve({ data: [] });
              }
              if (
                "sent_at" in filters &&
                current !== (filters.sent_at as string)
              ) {
                return Promise.resolve({ data: [] });
              }
              rows.set(key, values.sent_at);
              return Promise.resolve({ data: [{ sent_at: values.sent_at }] });
            },
            then: (
              resolve: (value: { data: unknown[]; error: null }) => unknown
            ) => {
              // Await without .select(): apply the same filters.
              return builder.select().then((r) =>
                resolve({ data: (r.data ?? []) as unknown[], error: null })
              );
            },
          };
          return builder;
        },
      };
    },
  } as unknown as SupabaseClient;
  return { client, rows };
}

describe("claimCardSend", () => {
  it("claims when no row exists yet", async () => {
    const { client } = makeSupabase();
    expect(await claimCardSend(client, "u1", "calendar")).toBeDefined();
  });

  it("refuses a second claim inside the cooldown", async () => {
    const { client } = makeSupabase();
    expect(await claimCardSend(client, "u1", "calendar")).toBeDefined();
    expect(await claimCardSend(client, "u1", "calendar")).toBeUndefined();
  });

  it("claims again after the cooldown has passed", async () => {
    const stale = new Date(
      Date.now() - CARD_COOLDOWN_MS - 1000
    ).toISOString();
    const { client } = makeSupabase({ kind: "calendar", sent_at: stale });
    expect(await claimCardSend(client, "u1", "calendar")).toBeDefined();
  });

  it("tracks kinds independently", async () => {
    const { client } = makeSupabase();
    expect(await claimCardSend(client, "u1", "computer")).toBeDefined();
    expect(await claimCardSend(client, "u1", "calendar")).toBeDefined();
    expect(await claimCardSend(client, "u1", "calendar")).toBeUndefined();
  });

  it("release backdates the claim so a failed send can retry sooner", async () => {
    const { client, rows } = makeSupabase();
    const claim = await claimCardSend(client, "u1", "calendar");
    expect(claim).toBeDefined();
    const before = rows.get("u1:calendar");
    await claim?.release();
    const after = rows.get("u1:calendar");
    expect(after).toBeDefined();
    expect(String(after) < String(before)).toBe(true);
  });
});
