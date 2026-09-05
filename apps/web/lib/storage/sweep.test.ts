/**
 * P1-5 acceptance: the sweeper reclaims pending_uploads older than the presign
 * TTL — the object a client PUT without confirming is deleted (it never went
 * through the guard), then the stored pre-charge is released through the
 * quota RPC — so an abandoned presign leaks neither quota nor an unguarded
 * public object.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const r2 = vi.hoisted(() => ({
  objects: new Set<string>(),
  order: [] as string[],
  deleteObject: vi.fn(async (key: string) => {
    r2.order.push(`delete ${key}`);
    r2.objects.delete(key);
  }),
}));
vi.mock("./r2", () => ({
  deleteObject: r2.deleteObject,
  getObject: vi.fn(),
  headObject: vi.fn(),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
  putObject: vi.fn(),
}));

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
  releases: { userId: string; bytes: number }[];
} = { pending: [], usage: {}, releases: [] };

function fakeSupabase(): SupabaseClient {
  return {
    from(table: string) {
      if (table !== "pending_uploads") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return {
            lt(_column: string, cutoff: string) {
              return {
                async limit(n: number) {
                  const stale = db.pending
                    .filter((row) => row.created_at < cutoff)
                    .slice(0, n)
                    .map(({ key, user_id }) => ({ key, user_id }));
                  return { data: stale, error: null };
                },
              };
            },
          };
        },
        delete() {
          const filters: Record<string, unknown> = {};
          const chain = {
            eq(column: string, value: unknown) {
              filters[column] = value;
              return chain;
            },
            async select(_columns: string) {
              const taken = db.pending.filter(
                (row) => row.key === filters["key"] && row.user_id === filters["user_id"]
              );
              db.pending = db.pending.filter((row) => !taken.includes(row));
              return {
                data: taken.map((row) => ({ charged_bytes: row.charged_bytes })),
                error: null,
              };
            },
          };
          return chain;
        },
      };
    },
    async rpc(name: string, args: Record<string, unknown>) {
      if (name !== "user_bucket_release") throw new Error(`unexpected rpc ${name}`);
      const userId = String(args["p_user_id"]);
      const bytes = Number(args["p_bytes"]);
      db.releases.push({ userId, bytes });
      r2.order.push(`release ${userId} ${bytes}`);
      db.usage[userId] = Math.max((db.usage[userId] ?? 0) - bytes, 0);
      return { data: db.usage[userId], error: null };
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
    db.releases = [];
    r2.objects.clear();
    r2.order = [];
    r2.deleteObject.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
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
    expect(r2.deleteObject).not.toHaveBeenCalled();
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

  it("an uploaded-but-unconfirmed object is deleted before its charge is released", async () => {
    db.usage = { "user-1": 300 };
    r2.objects.add("u/a/media/uploaded");
    db.pending = [
      {
        key: "u/a/media/uploaded",
        user_id: "user-1",
        charged_bytes: 300,
        created_at: ago(SWEEP_AFTER_SECONDS + 60),
      },
    ];
    const released = await sweepAbandonedUploads(fakeSupabase());
    expect(released).toBe(1);
    expect(r2.objects.has("u/a/media/uploaded")).toBe(false);
    expect(r2.order).toEqual(["delete u/a/media/uploaded", "release user-1 300"]);
    expect(db.usage["user-1"]).toBe(0);
  });

  it("an R2 failure keeps the row and the charge for the next sweep; other rows proceed", async () => {
    db.usage = { "user-1": 300, "user-2": 200 };
    r2.objects.add("u/a/media/stuck");
    r2.deleteObject.mockImplementationOnce(async () => {
      throw new Error("r2 delete failed: 503");
    });
    db.pending = [
      {
        key: "u/a/media/stuck",
        user_id: "user-1",
        charged_bytes: 300,
        created_at: ago(SWEEP_AFTER_SECONDS + 60),
      },
      {
        key: "u/b/media/fine",
        user_id: "user-2",
        charged_bytes: 200,
        created_at: ago(SWEEP_AFTER_SECONDS + 60),
      },
    ];
    const released = await sweepAbandonedUploads(fakeSupabase());
    expect(released).toBe(1);
    expect(db.pending.map((row) => row.key)).toEqual(["u/a/media/stuck"]);
    expect(db.usage["user-1"]).toBe(300);
    expect(db.usage["user-2"]).toBe(0);
    expect(r2.objects.has("u/a/media/stuck")).toBe(true);

    const again = await sweepAbandonedUploads(fakeSupabase());
    expect(again).toBe(1);
    expect(db.pending).toHaveLength(0);
    expect(db.usage["user-1"]).toBe(0);
    expect(r2.objects.has("u/a/media/stuck")).toBe(false);
  });

  it("two sweeps racing on the same row release its charge once", async () => {
    db.usage = { "user-1": 300 };
    db.pending = [
      {
        key: "u/a/media/stale",
        user_id: "user-1",
        charged_bytes: 300,
        created_at: ago(SWEEP_AFTER_SECONDS + 60),
      },
    ];
    // Both sweeps read the stale row before either takes it.
    let unblock!: () => void;
    const gate = new Promise<void>((resolve) => (unblock = resolve));
    r2.deleteObject.mockImplementation(async (key: string) => {
      await gate;
      r2.order.push(`delete ${key}`);
      r2.objects.delete(key);
    });
    const a = sweepAbandonedUploads(fakeSupabase());
    const b = sweepAbandonedUploads(fakeSupabase());
    await Promise.resolve();
    unblock();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra + rb).toBe(1);
    expect(db.releases).toEqual([{ userId: "user-1", bytes: 300 }]);
    expect(db.usage["user-1"]).toBe(0);
  });
});
