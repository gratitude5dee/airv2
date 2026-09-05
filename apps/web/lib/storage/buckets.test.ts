import { describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { assertWithinQuota, releaseQuota, reserveQuota, type UserBucket } from "./buckets";
import { MediaGuardError } from "./guard";

/** Postgres-shaped user_bucket_reserve/release over one in-memory row. */
function ledger(used: number, quota: number) {
  const row = { bytes_used: used, quota_bytes: quota };
  const calls: { name: string; args: Record<string, unknown> }[] = [];
  const supabase = {
    rpc: async (name: string, args: Record<string, unknown>) => {
      calls.push({ name, args });
      const bytes = Number(args["p_bytes"]);
      if (name === "user_bucket_reserve") {
        if (bytes >= 0 && row.bytes_used + bytes <= row.quota_bytes) {
          row.bytes_used += bytes;
          return { data: true, error: null };
        }
        return { data: false, error: null };
      }
      row.bytes_used = Math.max(row.bytes_used - bytes, 0);
      return { data: row.bytes_used, error: null };
    },
  } as unknown as SupabaseClient;
  return { row, calls, supabase };
}

describe("reserveQuota / releaseQuota", () => {
  it("charges through the RPC and hands back a hold for exactly those bytes", async () => {
    const { row, calls, supabase } = ledger(10, 100);
    const hold = await reserveQuota(supabase, "u1", 90);
    expect(hold).toEqual({ userId: "u1", bytes: 90 });
    expect(row.bytes_used).toBe(100);
    expect(calls).toEqual([
      { name: "user_bucket_reserve", args: { p_user_id: "u1", p_bytes: 90 } },
    ]);
  });

  it("maps a refused reservation to the same 413 MediaGuardError as assertWithinQuota", async () => {
    const { row, supabase } = ledger(10, 100);
    await expect(reserveQuota(supabase, "u1", 91)).rejects.toMatchObject({
      status: 413,
    });
    await expect(reserveQuota(supabase, "u1", 91)).rejects.toBeInstanceOf(MediaGuardError);
    expect(row.bytes_used).toBe(10);
  });

  it("serial reservations observe each other: the second is refused once the first fills the row", async () => {
    const { row, supabase } = ledger(0, 100);
    await reserveQuota(supabase, "u1", 60);
    await expect(reserveQuota(supabase, "u1", 60)).rejects.toBeInstanceOf(MediaGuardError);
    expect(row.bytes_used).toBe(60);
  });

  it("release gives the held bytes back and never goes negative", async () => {
    const { row, supabase } = ledger(0, 100);
    const hold = await reserveQuota(supabase, "u1", 60);
    await releaseQuota(supabase, hold);
    expect(row.bytes_used).toBe(0);
    await releaseQuota(supabase, hold);
    expect(row.bytes_used).toBe(0);
  });

  it("surfaces an RPC failure on reserve as an error, not as a charge", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    } as unknown as SupabaseClient;
    await expect(reserveQuota(supabase, "u1", 1)).rejects.toThrow(/quota reserve failed/);
  });

  it("logs a failed release content-free and does not throw", async () => {
    const supabase = {
      rpc: async () => ({ data: null, error: { message: "boom" } }),
    } as unknown as SupabaseClient;
    const spy = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await expect(releaseQuota(supabase, { userId: "u1", bytes: 5 })).resolves.toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).not.toContain("u1");
    spy.mockRestore();
  });
});

const bucket = (used: number, quota: number): UserBucket => ({
  user_id: "u1",
  prefix: "u/alice/",
  bytes_used: used,
  quota_bytes: quota,
});

describe("assertWithinQuota", () => {
  it("allows writes under quota", () => {
    expect(() => assertWithinQuota(bucket(0, 100), 100)).not.toThrow();
    expect(() => assertWithinQuota(bucket(50, 100), 50)).not.toThrow();
  });
  it("refuses overflow with a clean 413", () => {
    try {
      assertWithinQuota(bucket(2_147_483_648 - 10, 2_147_483_648), 11);
      expect.unreachable();
    } catch (error) {
      expect(error).toBeInstanceOf(MediaGuardError);
      expect((error as MediaGuardError).status).toBe(413);
    }
  });
});
