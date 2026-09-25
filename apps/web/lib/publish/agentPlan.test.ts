/**
 * A plan the box files must land in the same shape the cron sweep produces —
 * proposed slots plus one pending content_plan decision — and it must not
 * leave half a plan behind when an insert fails.
 */
import { beforeEach, describe, expect, it } from "vitest";
import { FakeSupabase } from "../testing/fakeSupabase";
import { AgentPlanError, proposeAgentPlan } from "./agentPlan";

const db = new FakeSupabase();
const supabase = db.client();

beforeEach(() => {
  db.reset();
  // (user_id, source_id, moment_key) is the dedupe gate: a same-key replan
  // collides on insert exactly like the real unique constraint.
  db.uniques["calendar_moments"] = ["user_id,source_id,moment_key"];
});

const STEPS = [
  {
    platform: "instagram",
    brief: "teaser",
    scheduledAt: new Date(Date.now() + 86_400_000),
  },
  {
    platform: "tiktok",
    brief: "announce",
    scheduledAt: new Date(Date.now() + 172_800_000),
  },
];

/** The moment_key proposeAgentPlan computes for a label + steps, pre-attempt. */
function momentKeyFor(
  label: string,
  steps: readonly { scheduledAt: Date }[]
): string {
  const occursAt = new Date(
    Math.min(...steps.map((step) => step.scheduledAt.getTime()))
  );
  return `agent:${label.slice(0, 120)}:${occursAt.toISOString().slice(0, 10)}`;
}

/** The moment a replan collides with, plus the decision it already points at. */
function stageExistingPlan(decisionStatus: string) {
  const momentKey = momentKeyFor("Launch week", STEPS);
  db.tables["decisions"] = [{ id: "decision-0", status: decisionStatus }];
  db.tables["calendar_moments"] = [
    {
      id: "moment-0",
      user_id: "user-1",
      source_id: "agent",
      moment_key: momentKey,
      decision_id: "decision-0",
    },
  ];
}

describe("proposeAgentPlan", () => {
  it("files proposed slots and one pending content_plan decision", async () => {
    const result = await proposeAgentPlan(supabase, "user-1", {
      label: "Launch week",
      timezone: "America/Los_Angeles",
      steps: STEPS,
    });

    const moment = db.rows("calendar_moments")[0];
    const decisionRow = db.inserts.find(
      (insert) => insert.table === "decisions"
    )?.row as { id: string };
    expect(result).toEqual({
      momentId: moment?.["id"],
      decisionId: decisionRow.id,
      slots: 2,
    });

    const slots = db.inserts
      .filter((insert) => insert.table === "content_slots")
      .map((insert) => insert.row);
    expect(slots.map((slot) => slot["status"])).toEqual([
      "proposed",
      "proposed",
    ]);
    expect(slots.every((slot) => slot["source_id"] === "agent")).toBe(true);

    const decision = db.inserts.find(
      (insert) => insert.table === "decisions"
    )?.row as {
      kind: string;
      ref: string;
      payload: { steps: unknown[] };
    };
    expect(decision.kind).toBe("content_plan");
    expect(decision.ref).toBe(result.momentId);
    expect(decision.payload.steps).toHaveLength(2);
    expect(db.updates[0]?.patch["decision_id"]).toBe(result.decisionId);
  });

  it("never schedules a slot for the moment of approval", async () => {
    await proposeAgentPlan(supabase, "user-1", {
      label: "Backdated",
      timezone: "UTC",
      steps: [
        {
          platform: "x",
          brief: "late teaser",
          scheduledAt: new Date(Date.now() - 86_400_000),
        },
      ],
    });
    const slot = db.inserts.find(
      (insert) => insert.table === "content_slots"
    )?.row as { scheduled_at: string };
    expect(new Date(slot.scheduled_at).getTime()).toBeGreaterThan(
      Date.now() + 3_000_000
    );
  });

  it("shifts a backdated plan as a sequence so the cadence survives", async () => {
    await proposeAgentPlan(supabase, "user-1", {
      label: "Backdated week",
      timezone: "UTC",
      steps: [
        {
          platform: "instagram",
          brief: "teaser",
          scheduledAt: new Date(Date.now() - 172_800_000),
        },
        {
          platform: "tiktok",
          brief: "announce",
          scheduledAt: new Date(Date.now() - 86_400_000),
        },
      ],
    });
    const slots = db.inserts
      .filter((insert) => insert.table === "content_slots")
      .map((insert) => insert.row as { scheduled_at: string });
    const times = slots.map((slot) => new Date(slot.scheduled_at).getTime());
    expect(times[0]!).toBeGreaterThan(Date.now() + 3_000_000);
    expect(times[1]! - times[0]!).toBe(86_400_000);
  });

  it("reuses the staged plan while its decision is still pending", async () => {
    stageExistingPlan("pending");
    const result = await proposeAgentPlan(supabase, "user-1", {
      label: "Launch week",
      timezone: "UTC",
      steps: STEPS,
    });
    expect(result).toEqual({
      momentId: "moment-0",
      decisionId: "decision-0",
      slots: 0,
    });
  });

  it.each(["approved", "dismissed"])(
    "restages the plan once the earlier decision is %s",
    async (status) => {
      stageExistingPlan(status);
      const result = await proposeAgentPlan(supabase, "user-1", {
        label: "Launch week",
        timezone: "UTC",
        steps: STEPS,
      });
      const restaged = db
        .rows("calendar_moments")
        .find((row) => row["id"] !== "moment-0");
      const decisionRow = db.inserts.find(
        (insert) => insert.table === "decisions"
      )?.row as { id: string };
      expect(result).toEqual({
        momentId: restaged?.["id"],
        decisionId: decisionRow.id,
        slots: 2,
      });
      expect(restaged?.["moment_key"] as string).toContain(":v2");
    }
  );

  it("rolls the moment back when the slots cannot be staged", async () => {
    db.opErrors["content_slots:insert"] = { message: "boom" };
    await expect(
      proposeAgentPlan(supabase, "user-1", {
        label: "Launch week",
        timezone: "UTC",
        steps: STEPS,
      })
    ).rejects.toBeInstanceOf(AgentPlanError);
    expect(
      db.deletes.some((entry) => entry.table === "calendar_moments")
    ).toBe(true);
    expect(db.rows("calendar_moments")).toHaveLength(0);
    expect(
      db.inserts.some((insert) => insert.table === "decisions")
    ).toBe(false);
  });

  it("rejects an empty plan", async () => {
    await expect(
      proposeAgentPlan(supabase, "user-1", {
        label: "Empty",
        timezone: "UTC",
        steps: [],
      })
    ).rejects.toBeInstanceOf(AgentPlanError);
  });
});
