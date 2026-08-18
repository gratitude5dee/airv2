/**
 * V3 agent_schedules CRUD. Create writes the prompt body to
 * .hermes/schedules/<id>.md in the box and only the reference (prompt_ref)
 * to Postgres — prompt content stays in the box (C4) and is never logged.
 * Firing is the control plane's job (/api/cron/schedules), never box cron.
 */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { command, writeFile } from "@/lib/box/client";
import { ensureBoxAwake } from "@/lib/orchestrator/boxes";
import {
  DELIVER_VALUES,
  isValidTimeZone,
  nextRunAt,
  SCHEDULE_COLUMNS,
  validateCron,
  type AgentSchedule,
  type Deliver,
} from "@/lib/calendar/schedule";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

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
  return NextResponse.json({ schedules: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    cron?: string;
    timezone?: string;
    prompt?: string;
    deliver?: string;
  };
  const name = body.name?.trim();
  const cron = body.cron?.trim();
  const timezone = body.timezone?.trim();
  const prompt = body.prompt?.trim();
  const deliver = (body.deliver ?? "imessage") as Deliver;
  if (!name || !cron || !timezone || !prompt) {
    return NextResponse.json(
      { error: "name, cron, timezone, prompt required" },
      { status: 400 }
    );
  }
  if (!DELIVER_VALUES.includes(deliver)) {
    return NextResponse.json({ error: "invalid deliver" }, { status: 400 });
  }
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

  const box = await ensureBoxAwake(supabase, userId);
  await command(box.boxId, "mkdir -p /home/user/.hermes/schedules");
  await writeFile(box.boxId, promptRef, prompt);

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
    next_run_at: nextRunAt(cron, timezone).toISOString(),
  });
  if (error) {
    await command(box.boxId, `rm -f /home/user/${promptRef}`).catch(
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
  const body = (await request.json().catch(() => ({}))) as {
    id?: string;
    name?: string;
    cron?: string;
    timezone?: string;
    prompt?: string;
    deliver?: string;
    status?: string;
  };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("agent_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("id", body.id)
    .eq("user_id", userId)
    .neq("status", "deleted")
    .maybeSingle();
  const existing = data as unknown as AgentSchedule | null;
  if (!existing) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const updates: Record<string, string | number> = {};
  const cron = body.cron?.trim() ?? existing.cron;
  const timezone = body.timezone?.trim() ?? existing.timezone;
  if (body.name?.trim()) updates.name = body.name.trim();
  if (body.deliver) {
    if (!DELIVER_VALUES.includes(body.deliver as Deliver)) {
      return NextResponse.json({ error: "invalid deliver" }, { status: 400 });
    }
    updates.deliver = body.deliver;
  }
  if (body.status) {
    if (!["active", "paused"].includes(body.status)) {
      return NextResponse.json({ error: "invalid status" }, { status: 400 });
    }
    updates.status = body.status;
    if (body.status === "active") updates.failure_count = 0;
  }
  if (body.cron || body.timezone) {
    if (!isValidTimeZone(timezone)) {
      return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
    }
    const cronError = validateCron(cron, timezone);
    if (cronError) {
      return NextResponse.json({ error: cronError }, { status: 400 });
    }
    updates.cron = cron;
    updates.timezone = timezone;
    updates.next_run_at = nextRunAt(cron, timezone).toISOString();
  }
  if (body.prompt?.trim()) {
    const box = await ensureBoxAwake(supabase, userId);
    await writeFile(box.boxId, existing.prompt_ref, body.prompt.trim());
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
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  if (!body.id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("agent_schedules")
    .update({ status: "deleted" })
    .eq("id", body.id)
    .eq("user_id", userId)
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
  }
  return NextResponse.json({ ok: true });
}
