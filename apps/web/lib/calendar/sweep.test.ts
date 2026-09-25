import { beforeEach, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { FakeSupabase, type Row } from "../testing/fakeSupabase";
import { claimSchedule, classifyTickOutput } from "./sweep";
import type { AgentSchedule } from "./schedule";

const db = new FakeSupabase();

beforeEach(() => db.reset());

const SCHEDULE: AgentSchedule = {
  id: "s1",
  user_id: "u1",
  name: "Morning brief",
  cron: "0 9 * * *",
  timezone: "UTC",
  prompt_ref: ".hermes/schedules/s1.md",
  deliver: "imessage",
  source: "calendar",
  status: "active",
  next_run_at: "2026-08-18T09:00:00.000Z",
  last_run_at: null,
  failure_count: 0,
  one_shot: false,
};

/**
 * The claim_schedule RPC emulated the way the real one behaves: a CAS on the
 * agent_schedules row (status=active, next_run_at=expected → advance) plus
 * admission check + delivery-receipt dedupe, all in one statement. Row state
 * lives in the fake's table, so a lost CAS leaves the row visibly advanced.
 */
function makeSupabase(
  row: { next_run_at: string; status: string },
  opts: { admission?: "open" | "closed"; receipts?: Map<string, string> } = {}
) {
  const claims: string[][] = [];
  const receipts = opts.receipts ?? new Map<string, string>();
  db.tables["agent_schedules"] = [{ ...SCHEDULE, ...row }];
  db.rpcResults["claim_schedule"] = (rawArgs: unknown) => {
    const args = rawArgs as Record<string, unknown>;
    const expected = args["p_expected_next_run_at"] as string;
    const next = args["p_next_run_at"] as string;
    claims.push([expected, next]);
    const stored = db
      .rows("agent_schedules")
      .find((r: Row) => r["id"] === args["p_schedule_id"]);
    if (!stored) return { claimed: false, reason: "lost" };
    const stableId = `${stored["id"] as string}@${expected}`;
    if (opts.admission === "closed") {
      return { claimed: false, reason: "admission_closed" };
    }
    if (stored["status"] !== "active" || stored["next_run_at"] !== expected) {
      return { claimed: false, reason: "lost" };
    }
    stored["next_run_at"] = next;
    const existing = receipts.get(stableId);
    if (existing && existing !== "held") {
      return { claimed: true, duplicate: true, schedule: { ...stored } };
    }
    receipts.set(stableId, "running");
    return {
      claimed: true,
      duplicate: false,
      schedule: { ...stored },
      operation_id: "op-1",
    };
  };
  const base = db.client();
  const client = {
    ...base,
    from: () => {
      throw new Error("claimSchedule must not touch tables directly — the RPC owns the claim");
    },
  } as unknown as SupabaseClient;
  return { client, claims, receipts };
}
describe("claimSchedule", () => {
  it("claims a due row and returns the advanced schedule + lease", async () => {
    const { client } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "active",
    });
    const claimed = await claimSchedule(client, SCHEDULE);
    expect(claimed).toBeDefined();
    expect(claimed?.schedule.next_run_at).not.toBe(SCHEDULE.next_run_at);
    expect(claimed?.operationId).toBe("op-1");
    expect(claimed?.duplicate).toBe(false);
  });

  it("is idempotent — a second racing claim of the same fire loses", async () => {
    const { client } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "active",
    });
    const first = await claimSchedule(client, SCHEDULE);
    const second = await claimSchedule(client, SCHEDULE);
    expect(first).toBeDefined();
    expect(second).toBeUndefined();
  });

  it("does not claim a paused schedule", async () => {
    const { client } = makeSupabase({
      next_run_at: SCHEDULE.next_run_at,
      status: "paused",
    });
    expect(await claimSchedule(client, SCHEDULE)).toBeUndefined();
  });

  it("does not claim while admission is closed (migration pause)", async () => {
    const { client } = makeSupabase(
      { next_run_at: SCHEDULE.next_run_at, status: "active" },
      { admission: "closed" }
    );
    expect(await claimSchedule(client, SCHEDULE)).toBeUndefined();
  });

  it("flags a delivered occurrence as duplicate (no second run)", async () => {
    const stableId = `${SCHEDULE.id}@${SCHEDULE.next_run_at}`;
    const { client } = makeSupabase(
      { next_run_at: SCHEDULE.next_run_at, status: "active" },
      { receipts: new Map([[stableId, "completed"]]) }
    );
    const claimed = await claimSchedule(client, SCHEDULE);
    expect(claimed?.duplicate).toBe(true);
  });
});

describe("classifyTickOutput", () => {
  it("suppresses empty output and the [SILENT] token", () => {
    expect(classifyTickOutput("")).toBe("suppressed_silent");
    expect(classifyTickOutput("[SILENT]")).toBe("suppressed_silent");
    expect(classifyTickOutput("checked the page — [SILENT]")).toBe(
      "suppressed_silent"
    );
  });

  it("does not suppress prose that describes silence", () => {
    expect(classifyTickOutput("Staying silent — nothing new.")).toBe("send");
    expect(classifyTickOutput("Still at $1,124.99.")).toBe("send");
  });

  it("suppresses transient model-error output", () => {
    expect(
      classifyTickOutput(
        "Operation interrupted: waiting for model response (5.7s elapsed)"
      )
    ).toBe("suppressed_transient");
    expect(
      classifyTickOutput("429 insufficient_quota — raise the usage cap")
    ).toBe("suppressed_transient");
  });

  it("sends real hits", () => {
    expect(
      classifyTickOutput("Back in stock: $1,115.09 https://example.com/gpu")
    ).toBe("send");
  });
});
