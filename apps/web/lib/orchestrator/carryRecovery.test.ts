import { describe, expect, it } from "vitest";
import { recoverOrphanedCarriedJobs } from "./carryRecovery";
import { FakeSupabase } from "../testing/fakeSupabase";

type Row = Record<string, unknown>;

function fakeSupabase(tables: Record<string, Row[]>) {
  const db = new FakeSupabase();
  for (const [table, rows] of Object.entries(tables)) {
    db.tables[table] = rows.map((row) => ({ ...row }));
  }
  return { client: db.client(), db };
}

describe("recoverOrphanedCarriedJobs", () => {
  it("re-arms an old carried conversation using its exact durable destination", async () => {
    const { client, db } = fakeSupabase({
      carried_messages: [
        {
          user_id: "user-1",
          space_id: "space-1",
          sender_id: "sender-1",
          received_at: "2026-09-14T17:39:19.000Z",
        },
      ],
      flush_jobs: [],
      imessage_destinations: [
        { user_id: "user-1", space_id: "space-1", phone: "shared" },
      ],
      lines: [{ assigned_user_id: "user-1", phone: "+14155952354", mode: "shared" }],
      senders: [{ address: "sender-1", trust_tier: 0 }],
    });

    const result = await recoverOrphanedCarriedJobs(
      client as never,
      new Date("2026-09-14T21:30:00.000Z"),
    );

    expect(result).toEqual({ restored: 1, unresolved: 0 });
    expect(db.upserts.map((u) => ({ table: u.table, row: u.row }))).toEqual([
      {
        table: "flush_jobs",
        row: expect.objectContaining({
          space_id: "space-1",
          user_id: "user-1",
          phone: "shared",
          sender_tier: 0,
          attempts: 0,
          chain_started_at: null,
          hermes_run_id: null,
        }),
      },
    ]);
  });

  it("does not overwrite a live flush job for the carried conversation", async () => {
    const { client, db } = fakeSupabase({
      carried_messages: [
        {
          user_id: "user-1",
          space_id: "space-1",
          sender_id: null,
          received_at: "2026-09-14T17:39:19.000Z",
        },
      ],
      flush_jobs: [{ space_id: "space-1" }],
    });

    const result = await recoverOrphanedCarriedJobs(
      client as never,
      new Date("2026-09-14T21:30:00.000Z"),
    );

    expect(result).toEqual({ restored: 0, unresolved: 0 });
    expect(db.upserts).toEqual([]);
  });

  it("leaves a body-preserving orphan untouched when its line cannot be inferred", async () => {
    const { client, db } = fakeSupabase({
      carried_messages: [
        {
          user_id: "user-1",
          space_id: "space-unknown",
          sender_id: null,
          received_at: "2026-09-14T17:39:19.000Z",
        },
      ],
      flush_jobs: [],
      imessage_destinations: [],
      lines: [],
      senders: [],
    });

    const result = await recoverOrphanedCarriedJobs(
      client as never,
      new Date("2026-09-14T21:30:00.000Z"),
    );

    expect(result).toEqual({ restored: 0, unresolved: 1 });
    expect(db.upserts).toEqual([]);
  });
});
