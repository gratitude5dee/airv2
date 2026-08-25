/**
 * Keep-awake schedules (V8 Computer ▸ Screen): agent_schedules rows with
 * deliver 'none' and source 'computer'. The prompt file exists only so the
 * row looks like every other schedule in the box (C4-consistent); firing is
 * handled by the sweeper's keep-awake branch — wake + hold, no Hermes run.
 */
import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { parseBody } from "@/lib/http/body";
import { command, writeFile } from "@/lib/box/client";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import {
  isValidTimeZone,
  nextRunAt,
  SCHEDULE_COLUMNS,
  validateCron,
} from "@/lib/calendar/schedule";
import {
  clampKeepAwakeMinutes,
  KEEPAWAKE_SOURCE,
  keepAwakePromptRef,
} from "@/lib/computer/keepawake";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CreateKeepAwakeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  cron: z.string().trim().min(1),
  timezone: z.string().trim().min(1),
  minutes: z.number().int().positive(),
});

const DeleteKeepAwakeSchema = z.object({
  id: z.string().trim().min(1),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data } = await serviceClient()
    .from("agent_schedules")
    .select(SCHEDULE_COLUMNS)
    .eq("user_id", userId)
    .eq("source", KEEPAWAKE_SOURCE)
    .neq("status", "deleted")
    .order("next_run_at", { ascending: true });
  return NextResponse.json({ schedules: data ?? [] });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, CreateKeepAwakeSchema);
  if (!parsed.ok) return parsed.response;
  const { name, cron, timezone, minutes } = parsed.data;

  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
  }
  const cronError = validateCron(cron, timezone);
  if (cronError) {
    return NextResponse.json({ error: cronError }, { status: 400 });
  }
  const clampedMinutes = clampKeepAwakeMinutes(minutes);
  const scheduleName = name ?? `Keep awake ${clampedMinutes} min`;

  const supabase = serviceClient();
  const id = randomUUID();
  const promptRef = keepAwakePromptRef(id, clampedMinutes);
  try {
    const box = await ensureBoxAwake(supabase, userId);
    await command(box.boxId, "mkdir -p /home/user/.hermes/schedules");
    await writeFile(
      box.boxId,
      promptRef,
      `Keep-awake window (${clampedMinutes} minutes) — managed by the Computer tab; no agent run.`
    );
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    throw error;
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }

  const { error } = await supabase.from("agent_schedules").insert({
    id,
    user_id: userId,
    name: scheduleName,
    cron,
    timezone,
    prompt_ref: promptRef,
    deliver: "none",
    source: KEEPAWAKE_SOURCE,
    status: "active",
    // deliver 'none' is never clamped to waking hours — keep-awake windows
    // are exactly the off-hours use case.
    next_run_at: nextRunAt(cron, timezone).toISOString(),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ id });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, DeleteKeepAwakeSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;

  const supabase = serviceClient();
  const { data } = await supabase
    .from("agent_schedules")
    .update({ status: "deleted" })
    .eq("id", id)
    .eq("user_id", userId)
    .eq("source", KEEPAWAKE_SOURCE)
    .select("prompt_ref");
  if (!data || data.length === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
