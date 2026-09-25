/**
 * P1-5 acceptance: the sweeper reclaims pending_uploads older than the presign
 * TTL — the object a client PUT without confirming is deleted (it never went
 * through the guard), then the stored pre-charge is released through the
 * quota RPC — so an abandoned presign leaks neither quota nor an unguarded
 * public object.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";

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

const db = new FakeSupabase();
const supabase = db.client();

/** Local bucket bookkeeping the user_bucket_release RPC maintains in prod. */
const usage: Record<string, number> = {};
const releases: { userId: string; bytes: number }[] = [];

function ago(seconds: number): string {
  return new Date(Date.now() - seconds * 1000).toISOString();
}

describe("sweepAbandonedUploads", () => {
  beforeEach(() => {
    db.reset();
    for (const key of Object.keys(usage)) delete usage[key];
    releases.length = 0;
    db.rpcResults["user_bucket_release"] = (args: unknown) => {
      const userId = String((args as Record<string, unknown>)?.["p_user_id"]);
      const bytes = Number((args as Record<string, unknown>)?.["p_bytes"]);
      releases.push({ userId, bytes });
      r2.order.push(`release ${userId} ${bytes}`);
      usage[userId] = Math.max((usage[userId] ?? 0) - bytes, 0);
      return usage[userId];
    };
    r2.objects.clear();
    r2.order = [];
    r2.deleteObject.mockClear();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
  });

  it("refunds the stored charge for each stale reservation", async () => {
    Object.assign(usage, { "user-1": 1000, "user-2": 700 });
    db.tables["pending_uploads"] = [
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
    const released = await sweepAbandonedUploads(supabase);
    expect(released).toBe(2);
    expect(db.rows("pending_uploads")).toHaveLength(0);
    expect(usage["user-1"]).toBe(700);
    expect(usage["user-2"]).toBe(0);
  });

  it("leaves fresh reservations (and their charge) untouched", async () => {
    Object.assign(usage, { "user-1": 500 });
    db.tables["pending_uploads"] = [
      {
        key: "u/a/media/fresh",
        user_id: "user-1",
        charged_bytes: 500,
        created_at: ago(30),
      },
    ];
    const released = await sweepAbandonedUploads(supabase);
    expect(released).toBe(0);
    expect(db.rows("pending_uploads")).toHaveLength(1);
    expect(usage["user-1"]).toBe(500);
    expect(r2.deleteObject).not.toHaveBeenCalled();
  });

  it("never drives usage below zero on refund", async () => {
    Object.assign(usage, { "user-1": 100 });
    db.tables["pending_uploads"] = [
      {
        key: "u/a/media/stale",
        user_id: "user-1",
        charged_bytes: 400,
        created_at: ago(SWEEP_AFTER_SECONDS + 60),
      },
    ];
    await sweepAbandonedUploads(supabase);
    expect(usage["user-1"]).toBe(0);
  });

  it("an uploaded-but-unconfirmed object is deleted before its charge is released", async () => {
    Object.assign(usage, { "user-1": 300 });
    r2.objects.add("u/a/media/uploaded");
    db.tables["pending_uploads"] = [
      {
        key: "u/a/media/uploaded",
        user_id: "user-1",
        charged_bytes: 300,
        created_at: ago(SWEEP_AFTER_SECONDS + 60),
      },
    ];
    const released = await sweepAbandonedUploads(supabase);
    expect(released).toBe(1);
    expect(r2.objects.has("u/a/media/uploaded")).toBe(false);
    expect(r2.order).toEqual(["delete u/a/media/uploaded", "release user-1 300"]);
    expect(usage["user-1"]).toBe(0);
  });

  it("an R2 failure keeps the row and the charge for the next sweep; other rows proceed", async () => {
    Object.assign(usage, { "user-1": 300, "user-2": 200 });
    r2.objects.add("u/a/media/stuck");
    r2.deleteObject.mockImplementationOnce(async () => {
      throw new Error("r2 delete failed: 503");
    });
    db.tables["pending_uploads"] = [
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
    const released = await sweepAbandonedUploads(supabase);
    expect(released).toBe(1);
    expect(db.rows("pending_uploads").map((row) => row["key"])).toEqual(["u/a/media/stuck"]);
    expect(usage["user-1"]).toBe(300);
    expect(usage["user-2"]).toBe(0);
    expect(r2.objects.has("u/a/media/stuck")).toBe(true);

    const again = await sweepAbandonedUploads(supabase);
    expect(again).toBe(1);
    expect(db.rows("pending_uploads")).toHaveLength(0);
    expect(usage["user-1"]).toBe(0);
    expect(r2.objects.has("u/a/media/stuck")).toBe(false);
  });

  it("two sweeps racing on the same row release its charge once", async () => {
    Object.assign(usage, { "user-1": 300 });
    db.tables["pending_uploads"] = [
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
    const a = sweepAbandonedUploads(supabase);
    const b = sweepAbandonedUploads(supabase);
    await Promise.resolve();
    unblock();
    const [ra, rb] = await Promise.all([a, b]);
    expect(ra + rb).toBe(1);
    expect(releases).toEqual([{ userId: "user-1", bytes: 300 }]);
    expect(usage["user-1"]).toBe(0);
  });
});
