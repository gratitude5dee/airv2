import { describe, expect, it, vi } from "vitest";
import { listClaimableOverdueFlushJobs } from "./overdueFlush";

describe("listClaimableOverdueFlushJobs", () => {
  it("requires active claims to age past the five-minute lease", async () => {
    const calls: Array<[string, ...unknown[]]> = [];
    const rows = [
      {
        space_id: "space-1",
        user_id: "user-1",
        phone: "shared",
        run_at: "2026-09-14T23:14:00.000Z",
        attempts: 0,
        sender_tier: 0,
      },
    ];
    const chain = {
      select: vi.fn((...args: unknown[]) => {
        calls.push(["select", ...args]);
        return chain;
      }),
      lt: vi.fn((...args: unknown[]) => {
        calls.push(["lt", ...args]);
        return chain;
      }),
      or: vi.fn((...args: unknown[]) => {
        calls.push(["or", ...args]);
        return chain;
      }),
      limit: vi.fn((...args: unknown[]) => {
        calls.push(["limit", ...args]);
        return Promise.resolve({ data: rows, error: null });
      }),
    };
    const supabase = { from: vi.fn(() => chain) };

    const result = await listClaimableOverdueFlushJobs(
      supabase as never,
      new Date("2026-09-14T23:20:00.000Z"),
    );

    expect(result).toEqual(rows);
    expect(calls).toContainEqual([
      "lt",
      "run_at",
      "2026-09-14T23:19:30.000Z",
    ]);
    expect(calls).toContainEqual([
      "or",
      "chain_started_at.is.null,chain_started_at.lt.2026-09-14T23:15:00.000Z",
    ]);
  });

  it("fails visibly when the queue cannot be inspected", async () => {
    const chain = {
      select: vi.fn(() => chain),
      lt: vi.fn(() => chain),
      or: vi.fn(() => chain),
      limit: vi.fn(() =>
        Promise.resolve({ data: null, error: { message: "offline" } }),
      ),
    };
    const supabase = { from: vi.fn(() => chain) };

    await expect(
      listClaimableOverdueFlushJobs(supabase as never),
    ).rejects.toThrow("overdue flush read failed: offline");
  });
});
