/**
 * Agent-authored content plans. The cron sweep in propose.ts builds plans
 * from sources; this builds one from the box when the owner asks for a
 * calendar in conversation. Both land the same shape — a moment row, proposed
 * slots, and one pending 'content_plan' decision — so approval, dismissal and
 * the publish worker need no second code path, and nothing publishes until
 * the owner approves.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export class AgentPlanError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "AgentPlanError";
  }
}

export interface AgentPlanStep {
  platform: string;
  brief: string;
  scheduledAt: Date;
}

export interface AgentPlanRequest {
  label: string;
  timezone: string;
  steps: readonly AgentPlanStep[];
}

/** Slots must not fire the instant the owner approves. */
const MIN_LEAD_MS = 3_600_000;

/** A replanned key gets a version suffix; a few rounds is plenty. */
const MAX_RESTAGE_ATTEMPTS = 8;

export async function proposeAgentPlan(
  supabase: SupabaseClient,
  userId: string,
  request: AgentPlanRequest,
  attempt = 0
): Promise<{ momentId: string; decisionId: string; slots: number }> {
  if (request.steps.length === 0) {
    throw new AgentPlanError("a plan needs at least one step", 400);
  }
  const occursAt = new Date(
    Math.min(...request.steps.map((step) => step.scheduledAt.getTime()))
  );
  const momentKey = `agent:${request.label.slice(0, 120)}:${occursAt
    .toISOString()
    .slice(0, 10)}${attempt > 0 ? `:v${attempt + 1}` : ""}`;

  const { data: moment, error: momentError } = await supabase
    .from("calendar_moments")
    .insert({
      user_id: userId,
      source_id: "agent",
      moment_key: momentKey,
      kind: "agent_plan",
      occurs_at: occursAt.toISOString(),
    })
    .select("id")
    .single();
  if (momentError || !moment) {
    // The unique (user_id, source_id, moment_key) row is the dedupe gate: the
    // same plan proposed twice in a day is the first plan, not a second one.
    const { data: existing } = await supabase
      .from("calendar_moments")
      .select("id, decision_id")
      .eq("user_id", userId)
      .eq("source_id", "agent")
      .eq("moment_key", momentKey)
      .maybeSingle();
    if (existing?.decision_id) {
      // Only a still-pending decision is the same plan. Once the owner has
      // approved or dismissed it, asking again is a new ask and must produce
      // something they can act on.
      const { data: decision } = await supabase
        .from("decisions")
        .select("status")
        .eq("id", existing.decision_id)
        .maybeSingle();
      if (decision?.status === "pending") {
        return {
          momentId: existing.id as string,
          decisionId: existing.decision_id as string,
          slots: 0,
        };
      }
      if (attempt < MAX_RESTAGE_ATTEMPTS) {
        return proposeAgentPlan(supabase, userId, request, attempt + 1);
      }
    }
    throw new AgentPlanError("could not stage the plan", 500);
  }

  const momentId = moment.id as string;
  // Backdated plans move as a sequence: one shift for the whole calendar keeps
  // the cadence the owner asked for instead of stacking every late post on the
  // same minute.
  const rawTimes = request.steps.map((step) => step.scheduledAt.getTime());
  const shift = Math.max(0, Date.now() + MIN_LEAD_MS - Math.min(...rawTimes));
  const slotRows = request.steps.map((step, index) => ({
    user_id: userId,
    platform: step.platform,
    account_ref: "primary",
    package_ref: `plan:${momentId}:s${index + 1}`,
    scheduled_at: new Date((rawTimes[index] as number) + shift).toISOString(),
    timezone: request.timezone,
    status: "proposed",
    source_id: "agent",
    moment_key: momentKey,
  }));
  const { data: slots, error: slotError } = await supabase
    .from("content_slots")
    .insert(slotRows)
    .select("id, scheduled_at, platform");
  if (slotError || !slots) {
    await supabase.from("calendar_moments").delete().eq("id", momentId);
    throw new AgentPlanError("could not stage the plan's slots", 500);
  }

  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "content_plan",
      ref: momentId,
      label: request.label.slice(0, 200),
      payload: {
        source_id: "agent",
        moment_key: momentKey,
        moment_kind: "agent_plan",
        occurs_at: occursAt.toISOString(),
        steps: request.steps.map((step, index) => ({
          step: `s${index + 1}`,
          platform: step.platform,
          brief: step.brief,
          slot_id: (slots[index] as { id: string }).id,
          scheduled_at: (slots[index] as { scheduled_at: string }).scheduled_at,
        })),
      },
    })
    .select("id")
    .single();
  if (decisionError || !decision) {
    await supabase
      .from("content_slots")
      .delete()
      .eq("user_id", userId)
      .eq("moment_key", momentKey);
    await supabase.from("calendar_moments").delete().eq("id", momentId);
    throw new AgentPlanError("could not stage the plan's decision", 500);
  }

  await supabase
    .from("calendar_moments")
    .update({ decision_id: decision.id })
    .eq("id", momentId);

  return {
    momentId,
    decisionId: decision.id as string,
    slots: slots.length,
  };
}
