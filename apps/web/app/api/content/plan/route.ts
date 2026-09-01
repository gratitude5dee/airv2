/**
 * Box-facing plan staging: when the owner asks for a content calendar, the
 * box files the plan here and it lands in Needs-you as a pending
 * 'content_plan' decision. Describing the calendar in chat leaves the owner
 * nothing to approve, so this route is the difference between a plan and a
 * paragraph. Nothing publishes here — approval does that.
 */
import { NextRequest, NextResponse } from "next/server";
import { boxUserId } from "@/lib/auth/box";
import { serviceClient } from "@/lib/supabase";
import {
  AgentPlanError,
  proposeAgentPlan,
  type AgentPlanStep,
} from "@/lib/publish/agentPlan";
import { SLOT_PLATFORMS } from "@/lib/publish/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_STEPS = 40;

interface StepBody {
  platform?: unknown;
  brief?: unknown;
  scheduled_at?: unknown;
}

function parseSteps(value: unknown): AgentPlanStep[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > MAX_STEPS) {
    return null;
  }
  const steps: AgentPlanStep[] = [];
  for (const raw of value as StepBody[]) {
    if (
      typeof raw?.platform !== "string" ||
      !(SLOT_PLATFORMS as readonly string[]).includes(raw.platform) ||
      typeof raw.brief !== "string" ||
      raw.brief.length === 0 ||
      typeof raw.scheduled_at !== "string"
    ) {
      return null;
    }
    const scheduledAt = new Date(raw.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) return null;
    steps.push({
      platform: raw.platform,
      brief: raw.brief.slice(0, 2000),
      scheduledAt,
    });
  }
  return steps;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    label?: unknown;
    timezone?: unknown;
    steps?: unknown;
  } | null;
  const label = typeof body?.label === "string" ? body.label.trim() : "";
  const steps = parseSteps(body?.steps);
  if (!label || !steps) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const timezone =
    typeof body?.timezone === "string" && body.timezone.length > 0
      ? body.timezone
      : "UTC";
  try {
    const result = await proposeAgentPlan(supabase, userId, {
      label,
      timezone,
      steps,
    });
    return NextResponse.json(
      {
        ok: true,
        status: "pending_approval",
        decision_id: result.decisionId,
        slots: result.slots,
      },
      { status: 202, headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof AgentPlanError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    return NextResponse.json({ error: "request failed" }, { status: 500 });
  }
}
