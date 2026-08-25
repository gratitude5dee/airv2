/**
 * Bot routines (V7): CRUD over the profile's Hermes cron jobs
 * (/p/<name>/api/jobs). Names are namespaced `[bot:<name>] …`; prompts carry
 * the exact `[NEEDS-USER]` escalation instruction; listing doubles as the
 * post-run scan that converts markers into run_approval decisions. Prompt
 * bodies never persist in Postgres — they live in the profile's cron store.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { parseBody } from "@/lib/http/body";
import { armStopAfter, StartLimitError } from "@/lib/orchestrator/boxes";
import {
  createJob,
  deleteJob,
  listJobs,
  pauseJob,
  resumeJob,
  runJob,
  updateJob,
  type HermesJob,
} from "@/lib/hermes/client";
import { botBoxTarget } from "@/lib/bots/chat";
import { isValidBotName } from "@/lib/bots/client";
import { getBot, type BotRow } from "@/lib/bots/store";
import {
  displayRoutineName,
  isBotRoutineJob,
  routineJobName,
  routinePrompt,
  scanRoutineEscalations,
} from "@/lib/bots/routines";
import type { SupabaseClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

const JOB_ID = /^[A-Za-z0-9_-]+$/;

const JobId = z.string().trim().min(1).regex(JOB_ID);

const RoutineName = z
  .string()
  .trim()
  .min(1)
  .transform((v) => v.slice(0, 80));

const ActionBody = z.object({
  action: z.enum(["run", "pause", "resume"]),
  id: JobId,
});

const CreateBody = z.object({
  name: RoutineName,
  schedule: z.string().trim().min(1),
  prompt: z.string().trim().min(1),
});

const PostBody = z.union([ActionBody, CreateBody]);

const PatchBody = z.object({
  id: JobId,
  name: RoutineName.optional(),
  schedule: z.string().trim().min(1).optional(),
  prompt: z.string().trim().min(1).optional(),
});

const DeleteBody = z.object({
  id: JobId,
});

async function resolveBot(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
): Promise<
  | { userId: string; supabase: SupabaseClient; bot: BotRow }
  | { response: NextResponse }
> {
  const userId = sessionUserId(request);
  if (!userId) {
    return {
      response: NextResponse.json({ error: "unauthorized" }, { status: 401 }),
    };
  }
  const { name } = await context.params;
  if (!isValidBotName(name)) {
    return {
      response: NextResponse.json({ error: "bad bot name" }, { status: 400 }),
    };
  }
  const supabase = serviceClient();
  const bot = await getBot(supabase, userId, name);
  if (!bot || bot.status !== "ready") {
    return {
      response: NextResponse.json({ error: "bot not found" }, { status: 404 }),
    };
  }
  return { userId, supabase, bot };
}

function publicRoutine(bot: BotRow, job: HermesJob) {
  return {
    id: job.id,
    name: displayRoutineName(bot.name, job.name),
    schedule: job.schedule,
    prompt: job.prompt,
    paused: job.paused ?? job.enabled === false,
    next_run_at: job.next_run_at ?? null,
    last_run_at: job.last_run_at ?? null,
  };
}

function failure(error: unknown, what: string): NextResponse {
  if (error instanceof StartLimitError) {
    return NextResponse.json({ error: "box is rate limited" }, { status: 429 });
  }
  const message = error instanceof Error ? error.message : "unknown error";
  console.error(JSON.stringify({ msg: `routine ${what} failed`, error: message }));
  return NextResponse.json({ error: `${what} failed` }, { status: 502 });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const resolved = await resolveBot(request, context);
  if ("response" in resolved) return resolved.response;
  const { userId, supabase, bot } = resolved;
  try {
    const target = await botBoxTarget(supabase, userId, bot);
    const jobs = (await listJobs(target)).filter((job) =>
      isBotRoutineJob(bot.name, job.name)
    );
    // Post-run escalation scan (the [NEEDS-USER] string-match) piggybacks on
    // every listing, so the Needs-you card appears next time the tab renders.
    await scanRoutineEscalations(supabase, userId, bot, jobs);
    return NextResponse.json({
      routines: jobs.map((job) => publicRoutine(bot, job)),
    });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ routines: [], box_asleep: true });
    }
    return failure(error, "list");
  } finally {
    // Re-arm the box's idle shut-off deadline (botBoxTarget cleared it).
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const resolved = await resolveBot(request, context);
  if ("response" in resolved) return resolved.response;
  const { userId, supabase, bot } = resolved;
  const parsed = await parseBody(request, PostBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  try {
    const target = await botBoxTarget(supabase, userId, bot);
    if ("action" in body) {
      const id = body.id;
      if (!JOB_ID.test(id)) {
        return NextResponse.json({ error: "bad job id" }, { status: 400 });
      }
      if (body.action === "run") await runJob(target, id);
      else if (body.action === "pause") await pauseJob(target, id);
      else if (body.action === "resume") await resumeJob(target, id);
      else {
        return NextResponse.json({ error: "bad action" }, { status: 400 });
      }
      return NextResponse.json({ ok: true });
    }
    const routineName = body.name;
    const schedule = body.schedule;
    const prompt = body.prompt;
    if (!routineName || !schedule || !prompt) {
      return NextResponse.json(
        { error: "name, schedule, and prompt are required" },
        { status: 400 }
      );
    }
    const { data: userRow } = await supabase
      .from("users")
      .select("username")
      .eq("id", userId)
      .maybeSingle();
    const userLabel = (userRow?.username as string | null) ?? "the user";
    await createJob(target, {
      name: routineJobName(bot.name, routineName),
      schedule,
      prompt: routinePrompt(prompt, userLabel),
      // Output lands in the bot's own chat (box-cron half of V3's split —
      // no delivery adapter).
      deliver: "local",
    });
    return NextResponse.json({ ok: true }, { status: 201 });
  } catch (error) {
    return failure(error, "create");
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const resolved = await resolveBot(request, context);
  if ("response" in resolved) return resolved.response;
  const { userId, supabase, bot } = resolved;
  const parsed = await parseBody(request, PatchBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const id = body.id;
  if (!JOB_ID.test(id)) {
    return NextResponse.json({ error: "bad job id" }, { status: 400 });
  }
  try {
    const target = await botBoxTarget(supabase, userId, bot);
    const patch: { name?: string; schedule?: string; prompt?: string } = {};
    if (body.name !== undefined) {
      patch.name = routineJobName(bot.name, body.name);
    }
    if (body.schedule !== undefined) patch.schedule = body.schedule;
    if (body.prompt !== undefined) {
      const { data: userRow } = await supabase
        .from("users")
        .select("username")
        .eq("id", userId)
        .maybeSingle();
      const userLabel = (userRow?.username as string | null) ?? "the user";
      patch.prompt = routinePrompt(body.prompt, userLabel);
    }
    const job = await updateJob(target, id, patch);
    return NextResponse.json({ routine: publicRoutine(bot, job) });
  } catch (error) {
    return failure(error, "update");
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const resolved = await resolveBot(request, context);
  if ("response" in resolved) return resolved.response;
  const { userId, supabase, bot } = resolved;
  const parsed = await parseBody(request, DeleteBody);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const id = body.id;
  if (!JOB_ID.test(id)) {
    return NextResponse.json({ error: "bad job id" }, { status: 400 });
  }
  try {
    const target = await botBoxTarget(supabase, userId, bot);
    await deleteJob(target, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return failure(error, "delete");
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}
