/**
 * V3 agent_schedules CRUD. Create writes the prompt body to
 * .hermes/schedules/<id>.md in the box and only the reference (prompt_ref)
 * to Postgres — prompt content stays in the box (C4) and is never logged.
 * Firing is the control plane's job (/api/cron/schedules), never box cron.
 */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { parseBody } from "@/lib/http/body";
import { command, writeFile } from "@/lib/box/client";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import {
  clampToWakingHours,
  DELIVER_VALUES,
  isValidTimeZone,
  nextRunAt,
  parseAgentSchedule,
  SCHEDULE_COLUMNS,
  validateCron,
  type AgentSchedule,
  type Deliver,
} from "@/lib/calendar/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CreateScheduleSchema = z.object({
  name: z.string().trim().min(1).max(80),
  cron: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
  deliver: z.enum(DELIVER_VALUES).default("imessage"),
});

const PatchScheduleSchema = z.object({
  id: z.string().trim().min(1),
  name: z.string().trim().min(1).max(80).optional(),
  cron: z.string().trim().min(1).optional(),
  timezone: z.string().trim().min(1).optional(),
  prompt: z.string().trim().min(1).optional(),
  deliver: z.enum(DELIVER_VALUES).optional(),
  status: z.enum(["active", "paused"]).optional(),
});

const DeleteScheduleSchema = z.object({
  id: z.string().trim().min(1),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("agent_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("user_id", userId)
    .neq("status", "deleted")
    .order("next_run_at", { ascending: true });
  const schedules = (data ?? [])
    .map(parseAgentSchedule)
    .filter((schedule): schedule is AgentSchedule => schedule !== null);
  return NextResponse.json({ schedules });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, CreateScheduleSchema);
  if (!parsed.ok) return parsed.response;
  const { name, cron, timezone, prompt, deliver } = parsed.data;

  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
  }
  const cronError = validateCron(cron, timezone);
  if (cronError) {
    return NextResponse.json({ error: cronError }, { status: 400 });
  }

  const supabase = serviceClient();
  const id = randomUUID();
  const promptRef = `.hermes/schedules/${id}.md`;

  let boxId: string;
  try {
    const box = await ensureBoxAwake(supabase, userId);
    boxId = box.boxId;
    await command(boxId, "mkdir -p /home/user/.hermes/schedules");
    await writeFile(boxId, promptRef, prompt);
  } finally {
    // ensureBoxAwake nulls stop_after before it can fail; re-arm on every exit.
    await armStopAfter(supabase, userId).catch(() => undefined);
  }

  const { error } = await supabase.from("agent_schedules").insert({
    id,
    user_id: userId,
    name,
    cron,
    timezone,
    prompt_ref: promptRef,
    deliver,
    source: "calendar",
    status: "active",
    next_run_at: clampToWakingHours(
      nextRunAt(cron, timezone),
      timezone,
      deliver
    ).toISOString(),
  });
  if (error) {
    await command(boxId, `rm -f /home/user/${promptRef}`).catch(
      () => undefined
    );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, PatchScheduleSchema);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;

  const supabase = serviceClient();
  const { data } = await supabase
    .from("agent_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("id", body.id)
    .eq("user_id", userId)
    .neq("status", "deleted")
    .maybeSingle();
  const existing = parseAgentSchedule(data);
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updates: Record<string, string | number> = {};
  const cron = body.cron ?? existing.cron;
  const timezone = body.timezone ?? existing.timezone;
  if (body.name !== undefined) updates.name = body.name;
  if (body.deliver !== undefined) {
    updates.deliver = body.deliver;
  }
  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === "active") updates.failure_count = 0;
  }
  if (body.cron !== undefined || body.timezone !== undefined) {
    if (!isValidTimeZone(timezone)) {
      return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
    }
    const cronError = validateCron(cron, timezone);
    if (cronError) {
      return NextResponse.json({ error: cronError }, { status: 400 });
    }
    updates.cron = cron;
    updates.timezone = timezone;
    const deliver = (updates.deliver as Deliver | undefined) ?? existing.deliver;
    updates.next_run_at = clampToWakingHours(
      nextRunAt(cron, timezone),
      timezone,
      deliver
    ).toISOString();
  } else if (updates.deliver && updates.deliver !== existing.deliver) {
    // Deliver-only change: the stored next_run_at may have been computed for
    // a silent schedule (never clamped) — re-clamp so switching to a channel
    // cannot message the user off-hours.
    updates.next_run_at = clampToWakingHours(
      new Date(existing.next_run_at),
      timezone,
      updates.deliver as Deliver
    ).toISOString();
  }
  if (body.prompt !== undefined) {
    try {
      const box = await ensureBoxAwake(supabase, userId);
      await writeFile(box.boxId, existing.prompt_ref, body.prompt);
    } finally {
      await armStopAfter(supabase, userId).catch(() => undefined);
    }
  }
  if (Object.keys(updates).length > 0) {
    const { error } = await supabase
      .from("agent_schedules")
      .update(updates)
      .eq("id", body.id)
      .eq("user_id", userId);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, DeleteScheduleSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;

  const supabase = serviceClient();
  const { data } = await supabase
    .from("agent_schedules")
    .update({ status: "deleted" })
    .eq("id", id)
    .eq("user_id", userId)
    .neq("status", "deleted")
    .select("prompt_ref");
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  // Best-effort: remove the prompt from the box too (only if it's awake).
  try {
    const box = await ensureBoxAwake(supabase, userId);
    await command(
      box.boxId,
      `rm -f /home/user/${(data[0] as { prompt_ref: string }).prompt_ref}`
    );
  } catch {
    // box asleep — the row is gone; an orphaned prompt file is inert.
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
  return NextResponse.json({ ok: true });
}
