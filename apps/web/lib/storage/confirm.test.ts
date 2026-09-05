/**
 * Confirm reconciles the client's declared size against the object that
 * actually landed. Bytes over the declaration are charged through the same
 * atomic reserve as a fresh upload, so an understated presign cannot carry an
 * object past the quota; a smaller object refunds the difference.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

const r2 = vi.hoisted(() => ({
  objects: new Map<string, { body: Buffer; contentType: string }>(),
  log: [] as string[],
}));
vi.mock("./r2", () => ({
  headObject: vi.fn(async (key: string) => {
    const object = r2.objects.get(key);
    return object
      ? { sizeBytes: object.body.length, contentType: object.contentType }
      : null;
  }),
  getObject: vi.fn(async (key: string) => r2.objects.get(key) ?? null),
  putObject: vi.fn(async (key: string, body: Buffer, contentType: string) => {
    r2.log.push(`put ${key}`);
    r2.objects.set(key, { body, contentType });
  }),
  deleteObject: vi.fn(async (key: string) => {
    r2.log.push(`delete ${key}`);
    r2.objects.delete(key);
  }),
  publicUrl: (key: string) => `https://cdn.test/${key}`,
}));
vi.mock("./guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./guard")>();
  return {
    ...actual,
    // Identity guard: the object is what the client uploaded.
    guardMediaUpload: (bytes: Buffer) => bytes,
  };
});

import { confirmUpload } from "./confirm";

const KEY = "u/a/media/abc-photo.png";

const db: {
  pending: { key: string; user_id: string; charged_bytes: number }[];
  used: number;
  quota: number;
  rpcs: string[];
} = { pending: [], used: 0, quota: 0, rpcs: [] };

function fakeSupabase(): SupabaseClient {
  return {
    from(table: string) {
      if (table !== "pending_uploads") throw new Error(`unexpected table ${table}`);
      return {
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
      const bytes = Number(args["p_bytes"]);
      db.rpcs.push(`${name} ${bytes}`);
      if (name === "user_bucket_reserve") {
        if (bytes >= 0 && db.used + bytes <= db.quota) {
          db.used += bytes;
          return { data: true, error: null };
        }
        return { data: false, error: null };
      }
      if (name === "user_bucket_release") {
        db.used = Math.max(db.used - bytes, 0);
        return { data: db.used, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  } as unknown as SupabaseClient;
}

function presigned(charged: number, used: number, quota: number): void {
  db.pending = [{ key: KEY, user_id: "user-1", charged_bytes: charged }];
  db.used = used;
  db.quota = quota;
}

function uploaded(size: number): void {
  r2.objects.set(KEY, { body: Buffer.alloc(size, 1), contentType: "image/png" });
}

describe("confirmUpload size reconciliation", () => {
  beforeEach(() => {
    db.pending = [];
    db.rpcs = [];
    r2.objects.clear();
    r2.log = [];
  });

  it("an object matching its declaration leaves the charge as reserved", async () => {
    presigned(100, 100, 1000);
    uploaded(100);
    const result = await confirmUpload(fakeSupabase(), "user-1", KEY);
    expect(result).toEqual({ ok: true, publicUrl: `https://cdn.test/${KEY}` });
    expect(db.used).toBe(100);
    expect(db.rpcs).toEqual([]);
  });

  it("an understated declaration is charged for the excess through the atomic reserve", async () => {
    presigned(100, 100, 1000);
    uploaded(400);
    const result = await confirmUpload(fakeSupabase(), "user-1", KEY);
    expect(result.ok).toBe(true);
    expect(db.rpcs).toEqual(["user_bucket_reserve 300"]);
    expect(db.used).toBe(400);
    expect(r2.objects.has(KEY)).toBe(true);
  });

  it("an understated upload near a full bucket is refused: object deleted, original charge released", async () => {
    // 100 declared and reserved; 950 of 1000 used; the object is 400 bytes.
    presigned(100, 950, 1000);
    uploaded(400);
    const result = await confirmUpload(fakeSupabase(), "user-1", KEY);
    expect(result).toMatchObject({ ok: false, status: 413 });
    expect(db.rpcs).toEqual(["user_bucket_reserve 300", "user_bucket_release 100"]);
    expect(db.used).toBe(850);
    expect(r2.log).toEqual([`delete ${KEY}`]);
    expect(r2.objects.has(KEY)).toBe(false);
    expect(db.pending).toHaveLength(0);
  });

  it("racing understated confirms cannot both land past the quota", async () => {
    // Two 100-byte reservations already hold 200 of 900; both objects are 500,
    // so only one excess of 400 fits.
    const other = "u/a/media/def-other.png";
    db.pending = [
      { key: KEY, user_id: "user-1", charged_bytes: 100 },
      { key: other, user_id: "user-1", charged_bytes: 100 },
    ];
    db.used = 200;
    db.quota = 900;
    uploaded(500);
    r2.objects.set(other, { body: Buffer.alloc(500, 2), contentType: "image/png" });
    const [a, b] = await Promise.all([
      confirmUpload(fakeSupabase(), "user-1", KEY),
      confirmUpload(fakeSupabase(), "user-1", other),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(db.used).toBe(500);
    expect(r2.objects.size).toBe(1);
  });

  it("a smaller object refunds the difference", async () => {
    presigned(400, 400, 1000);
    uploaded(150);
    const result = await confirmUpload(fakeSupabase(), "user-1", KEY);
    expect(result.ok).toBe(true);
    expect(db.rpcs).toEqual(["user_bucket_release 250"]);
    expect(db.used).toBe(150);
  });

  it("a missing object releases the whole charge", async () => {
    presigned(100, 100, 1000);
    const result = await confirmUpload(fakeSupabase(), "user-1", KEY);
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(db.rpcs).toEqual(["user_bucket_release 100"]);
    expect(db.used).toBe(0);
  });

  it("confirming twice consumes the reservation once", async () => {
    presigned(100, 100, 1000);
    uploaded(100);
    await confirmUpload(fakeSupabase(), "user-1", KEY);
    const again = await confirmUpload(fakeSupabase(), "user-1", KEY);
    expect(again).toMatchObject({ ok: false, status: 409 });
    expect(db.used).toBe(100);
  });
});
