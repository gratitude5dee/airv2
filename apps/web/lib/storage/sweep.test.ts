/**
 * P1-5 acceptance: the sweeper deletes pending_uploads older than the presign
 * TTL and refunds each stored pre-charge via addUsage, so an abandoned
 * presign no longer leaks storage quota.
 */
import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { SWEEP_AFTER_SECONDS, sweepAbandonedUploads } from "./confirm";

interface PendingRow {
  key: string;
  user_id: string;
  charged_bytes: number;
  created_at: string;
}

const db: {
  pending: PendingRow[];
  usage: Record<string, number>;
} = { pending: [], usage: {} };

function fakeSupabase(): SupabaseClient {
  return {
    from(table: string) {
      if (table === "pending_uploads") {
        return {
          delete() {
            return {
              lt(_column: string, cutoff: string) {
                return {
                  async select(_columns: string) {
                    const stale = db.pending.filter(
                      (row) => row.created_at < cutoff
                    );
                    db.pending = db.pending.filter(
                      (row) => row.created_at >= cutoff
                    );
                    return { data: stale, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "user_buckets") {
        return {
          select() {
            return {
              eq(_column: string, userId: string) {
                return {
                  async maybeSingle() {
                    if (!(userId in db.usage)) {
                      return { data: null, error: null };
                    }
                    return {
                      data: { bytes_used: db.usage[userId] },
                      error: null,
                    };
                  },
                };
              },
            };
          },
          update(patch: { bytes_used: number }) {
            const filters: Record<string, unknown> = {};
            const chain = {
              eq(column: string, value: unknown) {
                filters[column] = value;
                return chain;
              },
              async select(_columns: string) {
                const userId = filters.user_id as string;
                if (db.usage[userId] !== filters.bytes_used) {
                  return { data: [], error: null };
                }
                db.usage[userId] = patch.bytes_used;
                return { data: [{ user_id: userId }], error: null };
              },
            };
            return chain;
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  } as unknown as SupabaseClient;
}

function ago(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe("sweepAbandonedUploads", () => {
  beforeEach(() => {
    db.pending = [];
    db.usage = {};
  });

  it("refunds the stored charge for each stale reservation", async () => {
    db.usage = { "user-1": 1000, "user-2": 700 };
    db.pending = [
      {
        key: "u/a/media/stale1",
        user_id: "user-1",
        charged_bytes: 300,
        created_at: ago(SWEEP_AFTER_SECONDS + 60),
      },
      {
        key: "u/b/media/stale2",
        user_id: "user-2",
        charged_bytes: 700,
        created_at: ago(SWEEP_AFTER_SECONDS + 120),
      },
    ];
    const released = await sweepAbandonedUploads(fakeSupabase());
    expect(released).toBe(2);
    expect(db.pending).toHaveLength(0);
    expect(db.usage["user-1"]).toBe(700);
    expect(db.usage["user-2"]).toBe(0);
  });

  it("leaves fresh reservations (and their charge) untouched", async () => {
    db.usage = { "user-1": 500 };
    db.pending = [
      {
        key: "u/a/media/fresh",
        user_id: "user-1",
        charged_bytes: 500,
        created_at: ago(30),
      },
    ];
    const released = await sweepAbandonedUploads(fakeSupabase());
    expect(released).toBe(0);
    expect(db.pending).toHaveLength(1);
    expect(db.usage["user-1"]).toBe(500);
  });

  it("never drives usage below zero on refund", async () => {
    db.usage = { "user-1": 100 };
    db.pending = [
      {
        key: "u/a/media/stale",
        user_id: "user-1",
        charged_bytes: 400,
        created_at: ago(SWEEP_AFTER_SECONDS + 60),
      },
    ];
    await sweepAbandonedUploads(fakeSupabase());
    expect(db.usage["user-1"]).toBe(0);
  });
});
