import { describe, expect, it } from "vitest";
import { listClaimableOverdueFlushJobs } from "./overdueFlush";
import { FakeSupabase } from "../testing/fakeSupabase";

describe("listClaimableOverdueFlushJobs", () => {
  it("requires active claims to age past the five-minute lease", async () => {
    const db = new FakeSupabase();
    db.tables["flush_jobs"] = [
      {
        space_id: "space-1",
        user_id: "user-1",
        phone: "shared",
        run_at: "2026-09-14T23:14:00.000Z",
        attempts: 0,
        sender_tier: 0,
        chain_started_at: null,
      },
    ];

    const result = await listClaimableOverdueFlushJobs(
      db.client(),
      new Date("2026-09-14T23:20:00.000Z"),
    );

    expect(result).toEqual([
      {
        space_id: "space-1",
        user_id: "user-1",
        phone: "shared",
        run_at: "2026-09-14T23:14:00.000Z",
        attempts: 0,
        sender_tier: 0,
        chain_started_at: null,
      },
    ]);
    expect(db.filters).toContainEqual({
      table: "flush_jobs",
      op: "lt",
      column: "run_at",
      value: "2026-09-14T23:19:30.000Z",
    });
    expect(db.filters).toContainEqual({
      table: "flush_jobs",
      op: "or",
      column: "*",
      value:
        "chain_started_at.is.null,chain_started_at.lt.2026-09-14T23:15:00.000Z",
    });
  });

  it("fails visibly when the queue cannot be inspected", async () => {
    const db = new FakeSupabase();
    db.errors["flush_jobs"] = { message: "offline" };

    await expect(
      listClaimableOverdueFlushJobs(db.client()),
    ).rejects.toThrow("overdue flush read failed: offline");
  });
});
