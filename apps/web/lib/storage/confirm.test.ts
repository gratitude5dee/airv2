/**
 * Confirm reconciles the client's declared size against the object that
 * actually landed. Bytes over the declaration are charged through the same
 * atomic reserve as a fresh upload, so an understated presign cannot carry an
 * object past the quota; a smaller object refunds the difference.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";

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

const db = new FakeSupabase();
const supabase = db.client();

/** Local bucket bookkeeping the user_bucket_* RPCs maintain in prod. */
const bucket = { used: 0, cap: 0 };

function rpcs(): string[] {
  return db.rpcCalls.map(
    (call) => `${call.fn} ${String((call.args as Record<string, unknown>)?.["p_bytes"])}`
  );
}

function presigned(charged: number, used: number, quota: number): void {
  db.tables["pending_uploads"] = [
    { key: KEY, user_id: "user-1", charged_bytes: charged },
  ];
  bucket.used = used;
  bucket.cap = quota;
}

function uploaded(size: number): void {
  r2.objects.set(KEY, { body: Buffer.alloc(size, 1), contentType: "image/png" });
}

describe("confirmUpload size reconciliation", () => {
  beforeEach(() => {
    db.reset();
    bucket.used = 0;
    bucket.cap = 0;
    db.rpcResults["user_bucket_reserve"] = (args: unknown) => {
      const bytes = Number((args as Record<string, unknown>)?.["p_bytes"]);
      if (bytes >= 0 && bucket.used + bytes <= bucket.cap) {
        bucket.used += bytes;
        return true;
      }
      return false;
    };
    db.rpcResults["user_bucket_release"] = (args: unknown) => {
      const bytes = Number((args as Record<string, unknown>)?.["p_bytes"]);
      bucket.used = Math.max(bucket.used - bytes, 0);
      return bucket.used;
    };
    r2.objects.clear();
    r2.log = [];
  });

  it("an object matching its declaration leaves the charge as reserved", async () => {
    presigned(100, 100, 1000);
    uploaded(100);
    const result = await confirmUpload(supabase, "user-1", KEY);
    expect(result).toEqual({ ok: true, publicUrl: `https://cdn.test/${KEY}` });
    expect(bucket.used).toBe(100);
    expect(rpcs()).toEqual([]);
  });

  it("an understated declaration is charged for the excess through the atomic reserve", async () => {
    presigned(100, 100, 1000);
    uploaded(400);
    const result = await confirmUpload(supabase, "user-1", KEY);
    expect(result.ok).toBe(true);
    expect(rpcs()).toEqual(["user_bucket_reserve 300"]);
    expect(bucket.used).toBe(400);
    expect(r2.objects.has(KEY)).toBe(true);
  });

  it("an understated upload near a full bucket is refused: object deleted, original charge released", async () => {
    // 100 declared and reserved; 950 of 1000 used; the object is 400 bytes.
    presigned(100, 950, 1000);
    uploaded(400);
    const result = await confirmUpload(supabase, "user-1", KEY);
    expect(result).toMatchObject({ ok: false, status: 413 });
    expect(rpcs()).toEqual(["user_bucket_reserve 300", "user_bucket_release 100"]);
    expect(bucket.used).toBe(850);
    expect(r2.log).toEqual([`delete ${KEY}`]);
    expect(r2.objects.has(KEY)).toBe(false);
    expect(db.rows("pending_uploads")).toHaveLength(0);
  });

  it("racing understated confirms cannot both land past the quota", async () => {
    // Two 100-byte reservations already hold 200 of 900; both objects are 500,
    // so only one excess of 400 fits.
    const other = "u/a/media/def-other.png";
    db.tables["pending_uploads"] = [
      { key: KEY, user_id: "user-1", charged_bytes: 100 },
      { key: other, user_id: "user-1", charged_bytes: 100 },
    ];
    bucket.used = 200;
    bucket.cap = 900;
    uploaded(500);
    r2.objects.set(other, { body: Buffer.alloc(500, 2), contentType: "image/png" });
    const [a, b] = await Promise.all([
      confirmUpload(supabase, "user-1", KEY),
      confirmUpload(supabase, "user-1", other),
    ]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(bucket.used).toBe(500);
    expect(r2.objects.size).toBe(1);
  });

  it("a smaller object refunds the difference", async () => {
    presigned(400, 400, 1000);
    uploaded(150);
    const result = await confirmUpload(supabase, "user-1", KEY);
    expect(result.ok).toBe(true);
    expect(rpcs()).toEqual(["user_bucket_release 250"]);
    expect(bucket.used).toBe(150);
  });

  it("a missing object releases the whole charge", async () => {
    presigned(100, 100, 1000);
    const result = await confirmUpload(supabase, "user-1", KEY);
    expect(result).toMatchObject({ ok: false, status: 404 });
    expect(rpcs()).toEqual(["user_bucket_release 100"]);
    expect(bucket.used).toBe(0);
  });

  it("confirming twice consumes the reservation once", async () => {
    presigned(100, 100, 1000);
    uploaded(100);
    await confirmUpload(supabase, "user-1", KEY);
    const again = await confirmUpload(supabase, "user-1", KEY);
    expect(again).toMatchObject({ ok: false, status: 409 });
    expect(bucket.used).toBe(100);
  });
});
