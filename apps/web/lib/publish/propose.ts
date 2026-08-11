/**
 * CM7 tasks 3–4: moments become *proposed* slots plus one 'content_plan'
 * decision. Proposed slots are invisible to the publish worker (it only
 * selects 'scheduled'); approving the plan flips them and asks the agent —
 * in the one durable air-main session — to produce a package per brief under
 * the slot's package_ref. Nothing here can publish: the human decision is
 * the only path from proposal to schedule.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { allSources } from "./sources";
import type { BriefStep, DateRange, Moment, SourceDeps } from "./sources";
import { executeTool } from "@/lib/composio/client";
import { validateBrandSource } from "@/lib/brand/compile";
import type { BrandSource } from "@/lib/brand/types";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { createRun, MAIN_SESSION } from "@/lib/hermes/client";

/** How far ahead a sweep looks for moments. */
export const PROPOSAL_HORIZON_DAYS = 14;
/** And how far back, so a product published overnight is still a launch. */
export const PROPOSAL_LOOKBACK_DAYS = 2;

export interface ProposeResult {
  usersSwept: number;
  momentsProposed: number;
  slotsProposed: number;
}

/** Union of every source's candidate users — the cron sweep's worklist. */
export async function candidateUsers(
  supabase: SupabaseClient
): Promise<string[]> {
  const deps: SourceDeps = { supabase, executeTool };
  const userIds = new Set<string>();
  for (const source of allSources()) {
    for (const userId of await source.candidates(deps)) {
      userIds.add(userId);
    }
  }
  return [...userIds];
}

async function loadBrand(
  supabase: SupabaseClient,
  userId: string
): Promise<BrandSource | null> {
  const { data } = await supabase
    .from("brand_kits")
    .select("source")
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.source) return null;
  try {
    return validateBrandSource(data.source);
  } catch {
    return null;
  }
}

function packageRef(momentRowId: string, step: string): string {
  return `plan:${momentRowId}:${step}`;
}

/** Sweep one user's enabled sources and land new moments as proposals. */
export async function proposeForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ momentsProposed: number; slotsProposed: number }> {
  const deps: SourceDeps = { supabase, executeTool };
  const now = Date.now();
  const window: DateRange = {
    start: new Date(now - PROPOSAL_LOOKBACK_DAYS * 86_400_000),
    end: new Date(now + PROPOSAL_HORIZON_DAYS * 86_400_000),
  };
  const brand = await loadBrand(supabase, userId);
  let momentsProposed = 0;
  let slotsProposed = 0;

  for (const source of allSources()) {
    if (!(await source.enabled(deps, userId))) continue;
    const moments = await source.moments(deps, userId, window);
    for (const moment of moments) {
      const steps = source.brief(moment, brand);
      if (steps.length === 0) continue;
      const created = await proposeMoment(
        supabase,
        userId,
        source.id,
        moment,
        steps
      );
      if (created > 0) {
        momentsProposed += 1;
        slotsProposed += created;
      }
    }
  }
  return { momentsProposed, slotsProposed };
}

async function proposeMoment(
  supabase: SupabaseClient,
  userId: string,
  sourceId: string,
  moment: Moment,
  steps: BriefStep[]
): Promise<number> {
  // The unique (user_id, source_id, moment_key) row is the dedupe gate: a
  // replayed sweep conflicts here and proposes nothing twice.
  const { data: momentRow, error } = await supabase
    .from("calendar_moments")
    .insert({
      user_id: userId,
      source_id: sourceId,
      moment_key: moment.key,
      kind: moment.kind,
      occurs_at: moment.occursAt.toISOString(),
    })
    .select("id")
    .single();
  if (error || !momentRow) return 0; // already proposed (or insert failed)

  // A moment inside the lookback window can put early steps (e.g. the -24h
  // teaser) in the past; shift the whole sequence forward together so the
  // relative order survives and nothing fires immediately on approval.
  const rawTimes = steps.map(
    (step) => moment.occursAt.getTime() + step.offsetHours * 3_600_000
  );
  const floor = Date.now() + 3_600_000;
  const shift = Math.max(0, floor - Math.min(...rawTimes));
  const slotRows = steps.map((step, i) => ({
    user_id: userId,
    platform: step.platform,
    account_ref: "primary",
    package_ref: packageRef(momentRow.id as string, step.step),
    scheduled_at: new Date((rawTimes[i] as number) + shift).toISOString(),
    timezone: moment.timezone,
    status: "proposed",
    source_id: sourceId,
    moment_key: moment.key,
  }));
  const { data: slots, error: slotError } = await supabase
    .from("content_slots")
    .insert(slotRows)
    .select("id, package_ref, scheduled_at, platform");
  if (slotError || !slots) {
    await supabase.from("calendar_moments").delete().eq("id", momentRow.id);
    return 0;
  }

  const { data: decision } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "content_plan",
      ref: momentRow.id as string,
      label: moment.label.slice(0, 200),
      payload: {
        source_id: sourceId,
        moment_key: moment.key,
        moment_kind: moment.kind,
        occurs_at: moment.occursAt.toISOString(),
        entity: moment.entity,
        steps: steps.map((step, i) => ({
          step: step.step,
          platform: step.platform,
          brief: step.brief,
          slot_id: (slots[i] as { id: string }).id,
          scheduled_at: (slots[i] as { scheduled_at: string }).scheduled_at,
        })),
      },
    })
    .select("id")
    .single();
  if (decision) {
    await supabase
      .from("calendar_moments")
      .update({ decision_id: decision.id })
      .eq("id", momentRow.id);
  }
  return slots.length;
}

/**
 * Approve a content plan: flip its proposed slots to scheduled and brief the
 * agent (best-effort — a slot whose package isn't ready by fire time rides
 * the worker's normal capped retry/park path, it does not publish blind).
 */
export async function approveContentPlan(
  supabase: SupabaseClient,
  userId: string,
  momentRowId: string,
  payload: Record<string, unknown> | null
): Promise<void> {
  const { data: slots } = await supabase
    .from("content_slots")
    .select("id, package_ref, scheduled_at, platform")
    .eq("user_id", userId)
    .eq("status", "proposed")
    .like("package_ref", `plan:${momentRowId}:%`);
  if (!slots || slots.length === 0) return;

  await supabase
    .from("content_slots")
    .update({ status: "scheduled" })
    .eq("user_id", userId)
    .eq("status", "proposed")
    .in(
      "id",
      slots.map((slot) => (slot as { id: string }).id)
    );

  const steps = Array.isArray(payload?.steps)
    ? (payload.steps as Array<{ brief?: string; slot_id?: string }>)
    : [];
  const briefBySlot = new Map<string, string>();
  for (const step of steps) {
    if (step.slot_id && step.brief) briefBySlot.set(step.slot_id, step.brief);
  }
  const briefLines = (
    slots as Array<{
      id: string;
      package_ref: string;
      scheduled_at: string;
      platform: string;
    }>
  )
    .map(
      (slot) =>
        `- package id "${slot.package_ref}" (${slot.platform}, ` +
        `publishes ${slot.scheduled_at}): ` +
        (briefBySlot.get(slot.id) ?? "use the plan context")
    )
    .join("\n");

  try {
    const box = await ensureBoxAwake(supabase, userId);
    await createRun(box.target, {
      input:
        "An approved content plan needs creative packages. For each item, " +
        "produce the media and caption per the brief and save a creative " +
        "package with exactly the given package id:\n" +
        briefLines,
      sessionId: MAIN_SESSION,
      metadata: { channel: "calendar" },
    });
    await armStopAfter(supabase, userId);
  } catch {
    // Box wake failed: the slots stay scheduled; the worker's resolve-draft
    // retry path (capped, then parked as fix-content) handles the rest.
  }
}

/** Dismiss a content plan: its proposed slots are cancelled, the moment row
 * stays so the source never re-proposes the same moment. */
export async function dismissContentPlan(
  supabase: SupabaseClient,
  userId: string,
  momentRowId: string
): Promise<void> {
  await supabase
    .from("content_slots")
    .update({ status: "cancelled" })
    .eq("user_id", userId)
    .eq("status", "proposed")
    .like("package_ref", `plan:${momentRowId}:%`);
}
