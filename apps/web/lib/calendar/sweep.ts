/**
 * The schedule sweeper (V3): due agent_schedules row → atomic claim (the
 * claimFlush primitive — the update only matches while next_run_at is
 * unchanged, so racing invocations cannot double-fire) → ensureBoxAwake →
 * read the prompt from prompt_ref in the box → POST /v1/runs (MAIN_SESSION,
 * metadata.channel = "schedule") → deliver through the EXISTING channel
 * plumbing → re-arm stop_after, write agent_runs (trigger 'cron'), update
 * next_run_at/failure_count. 5 consecutive failures auto-pause + surface in
 * Needs you.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, readFile } from "../box/client";
import { createDraft, sendDraft } from "../agentmail/client";
import { createRun, MAIN_SESSION, runEvents } from "../hermes/client";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { hermesDeltas } from "../orchestrator/flush";
import { createSpectrumSender } from "../spectrum/sender";
import { createDecision } from "../routing/trust";
import { keepAwakeMinutes } from "../computer/keepawake";
import { recordKeepAwakeFire } from "../box/events";
import {
  clampToWakingHours,
  nextRunAt,
  SCHEDULE_COLUMNS,
  type AgentSchedule,
} from "./schedule";

const MAX_FAILURES = 5;
const SWEEP_BATCH = 10;

/**
 * Claim a due schedule: advance next_run_at conditioned on the value we
 * read, so exactly one of any number of racing sweepers wins.
 */
export async function claimSchedule(
  supabase: SupabaseClient,
  schedule: AgentSchedule
): Promise<AgentSchedule | undefined> {
  // Compute from the later of now and the due time so the new next_run_at
  // is strictly after the claimed fire — the CAS below must change the value.
  const base = new Date(
    Math.max(Date.now(), Date.parse(schedule.next_run_at) || 0)
  );
  let next: Date;
  try {
    next = nextRunAt(schedule.cron, schedule.timezone, base);
  } catch {
    next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
  }
  const clamped = clampToWakingHours(next, schedule.timezone, schedule.deliver);
  const { data } = await supabase
    .from("agent_schedules")
    .update({
      next_run_at: clamped.toISOString(),
      last_run_at: new Date().toISOString(),
    })
    .eq("id", schedule.id)
    .eq("status", "active")
    .eq("next_run_at", schedule.next_run_at)
    .select(SCHEDULE_COLUMNS);
  if (!data || data.length === 0) return undefined;
  return data[0] as unknown as AgentSchedule;
}

async function deliverImessage(
  supabase: SupabaseClient,
  userId: string,
  output: string
): Promise<boolean> {
  const { data: destination } = await supabase
    .from("imessage_destinations")
    .select("space_id, phone")
    .eq("user_id", userId)
    .maybeSingle();
  if (!destination?.space_id || !destination.phone) return false;
  const sender = await createSpectrumSender();
  try {
    await sender.sendText(
      destination.space_id as string,
      destination.phone as string,
      output
    );
    return true;
  } finally {
    await sender.close().catch(() => undefined);
  }
}

async function deliverEmail(
  supabase: SupabaseClient,
  userId: string,
  schedule: AgentSchedule,
  output: string
): Promise<boolean> {
  const { data: address } = await supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .is("retired_at", null)
    .maybeSingle();
  const { data: handle } = await supabase
    .from("handles")
    .select("address")
    .eq("user_id", userId)
    .eq("platform", "email")
    .maybeSingle();
  if (!address?.agentmail_inbox_id || !handle?.address) return false;
  const inboxId = address.agentmail_inbox_id as string;
  const draftId = await createDraft(inboxId, {
    to: [handle.address as string],
    subject: schedule.name,
    text: output,
  });
  await sendDraft(inboxId, draftId, `schedule-${schedule.id}-${Date.now()}`);
  return true;
}

async function recordFailure(
  supabase: SupabaseClient,
  schedule: AgentSchedule,
  message: string
): Promise<void> {
  const failures = schedule.failure_count + 1;
  const paused = failures >= MAX_FAILURES;
  await supabase
    .from("agent_schedules")
    .update({
      failure_count: failures,
      ...(paused ? { status: "paused" } : {}),
    })
    .eq("id", schedule.id);
  if (paused) {
    await createDecision(supabase, {
      userId: schedule.user_id,
      kind: "run_approval",
      ref: schedule.id,
      label: `Schedule "${schedule.name}" paused after ${MAX_FAILURES} consecutive failures`,
    }).catch(() => undefined);
  }
  console.error(
    JSON.stringify({
      msg: "schedule run failed",
      schedule_id: schedule.id,
      user_id: schedule.user_id,
      failure_count: failures,
      error: message,
    })
  );
}

/** Run one claimed schedule end to end. */
export async function runSchedule(
  supabase: SupabaseClient,
  schedule: AgentSchedule
): Promise<void> {
  const startedAt = new Date().toISOString();
  try {
    // V8 Computer ▸ Screen: a keep-awake schedule wakes the box and holds it
    // awake for its window — no Hermes run, no delivery. armStopAfter is
    // monotonic, so the finally's 20-minute re-arm cannot shrink the window.
    const awakeWindow = keepAwakeMinutes(schedule);
    if (awakeWindow !== null) {
      await ensureBoxAwake(supabase, schedule.user_id);
      await armStopAfter(supabase, schedule.user_id, awakeWindow);
      await recordKeepAwakeFire(supabase, schedule.user_id);
      await supabase
        .from("agent_schedules")
        .update({ failure_count: 0 })
        .eq("id", schedule.id);
      return;
    }
    const box = await ensureBoxAwake(supabase, schedule.user_id);
    const prompt = await readFile(
      box.boxId,
      `/home/user/${schedule.prompt_ref}`
    );
    const run = await createRun(box.target, {
      input: prompt,
      sessionId: MAIN_SESSION,
      metadata: { channel: "schedule", schedule_id: schedule.id },
    });
    let output = "";
    for await (const delta of hermesDeltas(
      await runEvents(box.target, run.run_id)
    )) {
      output += delta;
    }

    // deliver: 'none' runs silently — output visible in History only.
    const trimmed = output.trim();
    if (trimmed && !trimmed.includes("[SILENT]")) {
      let delivered = true;
      if (schedule.deliver === "imessage") {
        delivered = await deliverImessage(supabase, schedule.user_id, trimmed);
      } else if (schedule.deliver === "email") {
        delivered = await deliverEmail(
          supabase,
          schedule.user_id,
          schedule,
          trimmed
        );
      }
      if (!delivered) {
        throw new Error(`no ${schedule.deliver} destination for delivery`);
      }
    }

    await supabase.from("agent_runs").insert({
      user_id: schedule.user_id,
      hermes_run_id: run.run_id,
      trigger: "cron",
      started_at: startedAt,
      ended_at: new Date().toISOString(),
      outcome: "completed",
    });
    if (schedule.one_shot) {
      // V4 "Remind me": one fire, then the row and the box prompt go away.
      await supabase
        .from("agent_schedules")
        .update({ status: "deleted", failure_count: 0 })
        .eq("id", schedule.id);
      await command(
        box.boxId,
        `rm -f /home/user/${schedule.prompt_ref}`
      ).catch(() => undefined);
    } else {
      await supabase
        .from("agent_schedules")
        .update({ failure_count: 0 })
        .eq("id", schedule.id);
    }
  } catch (error) {
    await recordFailure(
      supabase,
      schedule,
      error instanceof Error ? error.message : String(error)
    );
    if (schedule.one_shot) {
      // A one-shot never outlives its single fire attempt: the re-armed
      // cron would only recur a year out, delivering a stale reminder.
      await supabase
        .from("agent_schedules")
        .update({ status: "deleted" })
        .eq("id", schedule.id);
    }
  } finally {
    // Always re-arm: a failed run must not leave the box awake forever.
    await armStopAfter(supabase, schedule.user_id).catch(() => undefined);
  }
}

/** One sweeper tick: claim + run every due schedule (bounded batch). */
export async function sweepSchedules(
  supabase: SupabaseClient
): Promise<{ fired: number }> {
  const { data } = await supabase
    .from("agent_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("status", "active")
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at", { ascending: true })
    .limit(SWEEP_BATCH);
  const due = (data ?? []) as unknown as AgentSchedule[];
  let fired = 0;
  for (const schedule of due) {
    const claimed = await claimSchedule(supabase, schedule);
    if (!claimed) continue;
    fired += 1;
    await runSchedule(supabase, claimed);
  }
  return { fired };
}
