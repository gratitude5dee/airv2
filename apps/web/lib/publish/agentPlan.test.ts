/**
 * A plan the box files must land in the same shape the cron sweep produces —
 * proposed slots plus one pending content_plan decision — and it must not
 * leave half a plan behind when an insert fails.
 */
import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { AgentPlanError, proposeAgentPlan } from "./agentPlan";

interface Insert {
  table: string;
  rows: unknown;
}

function fakeSupabase(
  options: {
    slotError?: boolean;
    /** The first moment insert collides, as a same-key replan does. */
    momentConflict?: boolean;
    /** Status of the decision the colliding moment already points at. */
    existingStatus?: string;
  } = {}
) {
  let momentInserts = 0;
  const inserts: Insert[] = [];
  const deletes: string[] = [];
  const updates: { table: string; row: Record<string, unknown> }[] = [];
  const client = {
    from(table: string) {
      return {
        insert(rows: unknown) {
          inserts.push({ table, rows });
          if (table === "content_slots") {
            if (options.slotError) {
              return {
                select: () =>
                  Promise.resolve({ data: null, error: { message: "boom" } }),
              };
            }
            const list = rows as { scheduled_at: string; platform: string }[];
            return {
              select: () =>
                Promise.resolve({
                  data: list.map((row, index) => ({
                    id: `slot-${index + 1}`,
                    scheduled_at: row.scheduled_at,
                    platform: row.platform,
                  })),
                  error: null,
                }),
            };
          }
          if (table === "calendar_moments") {
            momentInserts += 1;
            if (options.momentConflict && momentInserts === 1) {
              return {
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: "duplicate key" },
                    }),
                }),
              };
            }
          }
          const id = table === "calendar_moments" ? "moment-1" : "decision-1";
          return {
            select: () => ({
              single: () => Promise.resolve({ data: { id }, error: null }),
            }),
          };
        },
        select() {
          const data =
            table === "calendar_moments"
              ? { id: "moment-0", decision_id: "decision-0" }
              : { status: options.existingStatus ?? "pending" };
          const node: Record<string, unknown> = {
            maybeSingle: () => Promise.resolve({ data, error: null }),
          };
          node["eq"] = () => node;
          return node;
        },
        update(row: Record<string, unknown>) {
          updates.push({ table, row });
          return { eq: () => Promise.resolve({ error: null }) };
        },
        delete() {
          deletes.push(table);
          return {
            eq: () => ({
              eq: () => Promise.resolve({ error: null }),
              then: (resolve: (value: { error: null }) => unknown) =>
                resolve({ error: null }),
            }),
          };
        },
      };
    },
  };
  return {
    client: client as unknown as SupabaseClient,
    inserts,
    deletes,
    updates,
  };
}

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

describe("proposeAgentPlan", () => {
  it("files proposed slots and one pending content_plan decision", async () => {
    const supabase = fakeSupabase();
    const result = await proposeAgentPlan(supabase.client, "user-1", {
      label: "Launch week",
      timezone: "America/Los_Angeles",
      steps: STEPS,
    });
    expect(result).toEqual({
      momentId: "moment-1",
      decisionId: "decision-1",
      slots: 2,
    });

    const slots = supabase.inserts.find(
      (insert) => insert.table === "content_slots"
    )?.rows as { status: string; source_id: string }[];
    expect(slots.map((slot) => slot.status)).toEqual(["proposed", "proposed"]);
    expect(slots.every((slot) => slot.source_id === "agent")).toBe(true);

    const decision = supabase.inserts.find(
      (insert) => insert.table === "decisions"
    )?.rows as { kind: string; ref: string; payload: { steps: unknown[] } };
    expect(decision.kind).toBe("content_plan");
    expect(decision.ref).toBe("moment-1");
    expect(decision.payload.steps).toHaveLength(2);
    expect(supabase.updates[0]?.row["decision_id"]).toBe("decision-1");
  });

  it("never schedules a slot for the moment of approval", async () => {
    const supabase = fakeSupabase();
    await proposeAgentPlan(supabase.client, "user-1", {
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
    const slot = (
      supabase.inserts.find((insert) => insert.table === "content_slots")
        ?.rows as { scheduled_at: string }[]
    )[0];
    expect(new Date(slot!.scheduled_at).getTime()).toBeGreaterThan(
      Date.now() + 3_000_000
    );
  });

  it("shifts a backdated plan as a sequence so the cadence survives", async () => {
    const supabase = fakeSupabase();
    await proposeAgentPlan(supabase.client, "user-1", {
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
    const slots = supabase.inserts.find(
      (insert) => insert.table === "content_slots"
    )?.rows as { scheduled_at: string }[];
    const times = slots.map((slot) => new Date(slot.scheduled_at).getTime());
    expect(times[0]!).toBeGreaterThan(Date.now() + 3_000_000);
    expect(times[1]! - times[0]!).toBe(86_400_000);
  });

  it("reuses the staged plan while its decision is still pending", async () => {
    const supabase = fakeSupabase({ momentConflict: true });
    const result = await proposeAgentPlan(supabase.client, "user-1", {
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
      const supabase = fakeSupabase({
        momentConflict: true,
        existingStatus: status,
      });
      const result = await proposeAgentPlan(supabase.client, "user-1", {
        label: "Launch week",
        timezone: "UTC",
        steps: STEPS,
      });
      expect(result).toEqual({
        momentId: "moment-1",
        decisionId: "decision-1",
        slots: 2,
      });
      const moments = supabase.inserts.filter(
        (insert) => insert.table === "calendar_moments"
      );
      expect(
        (moments.at(-1)?.rows as { moment_key: string }).moment_key
      ).toContain(":v2");
    }
  );

  it("rolls the moment back when the slots cannot be staged", async () => {
    const supabase = fakeSupabase({ slotError: true });
    await expect(
      proposeAgentPlan(supabase.client, "user-1", {
        label: "Launch week",
        timezone: "UTC",
        steps: STEPS,
      })
    ).rejects.toBeInstanceOf(AgentPlanError);
    expect(supabase.deletes).toContain("calendar_moments");
    expect(
      supabase.inserts.some((insert) => insert.table === "decisions")
    ).toBe(false);
  });

  it("rejects an empty plan", async () => {
    const supabase = fakeSupabase();
    await expect(
      proposeAgentPlan(supabase.client, "user-1", {
        label: "Empty",
        timezone: "UTC",
        steps: [],
      })
    ).rejects.toBeInstanceOf(AgentPlanError);
  });
});
