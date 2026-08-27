/**
 * Owner learning settings (goal.md V10 §5). Modes: off | observe | suggest;
 * auto_safe stays unavailable until M8 plus an operator flag. Writes land in
 * learning_settings and are mirrored to the Box daemon best-effort.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import {
  getSettings,
  isLearningMode,
  updateSettings,
  type LearningSettings,
} from "@/lib/learning/learning";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const settings = await getSettings(serviceClient(), userId);
  return NextResponse.json(settings);
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    mode?: string;
    daily_budget_usd?: number;
    retention_raw_days?: number;
    schedule?: string;
  };
  const patch: Partial<LearningSettings> = {};
  if (body.mode !== undefined) {
    if (!isLearningMode(body.mode)) {
      return NextResponse.json({ error: "invalid mode" }, { status: 400 });
    }
    if (body.mode === "auto_safe") {
      return NextResponse.json(
        { error: "auto_safe is not available yet" },
        { status: 400 },
      );
    }
    patch.mode = body.mode;
  }
  if (body.daily_budget_usd !== undefined) {
    const budget = Number(body.daily_budget_usd);
    if (!Number.isFinite(budget) || budget < 0 || budget > 100) {
      return NextResponse.json({ error: "invalid budget" }, { status: 400 });
    }
    patch.daily_budget_usd = budget;
  }
  if (body.retention_raw_days !== undefined) {
    const days = Number(body.retention_raw_days);
    if (!Number.isInteger(days) || days < 1 || days > 365) {
      return NextResponse.json({ error: "invalid retention" }, { status: 400 });
    }
    patch.retention_raw_days = days;
  }
  if (body.schedule !== undefined) {
    if (!["idle_only", "scheduled", "manual"].includes(body.schedule)) {
      return NextResponse.json({ error: "invalid schedule" }, { status: 400 });
    }
    patch.schedule = body.schedule as LearningSettings["schedule"];
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "no valid fields" }, { status: 400 });
  }
  const settings = await updateSettings(serviceClient(), userId, patch);
  return NextResponse.json(settings);
}
