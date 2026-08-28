/**
 * Operator onboarding telemetry (admin.wzrd.tech): the step funnel across
 * all users, mirror health (warm/cold/stale), and a per-user progress table.
 * Everything comes from the Postgres status mirror and card_sends — no Box
 * reads, and metadata only (C4): step statuses, timestamps, and counts.
 * The Link pairing phrase/verification URL are never in the mirror.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import {
  ONBOARDING_STEPS,
  normalizeOnboardingState,
  type OnboardingStepId,
  type OnboardingStepStatus,
} from "@/lib/miniapps/onboarding";
import { MIRROR_STALE_MS } from "@/lib/miniapps/onboardingMirror";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type StepCounts = Record<OnboardingStepStatus, number>;

interface UserRow {
  user_id: string;
  username: string | null;
  created_at: string | null;
  done: number;
  skipped: number;
  todo: number;
  next_step: OnboardingStepId | null;
  mirror_refreshed_at: string | null;
  card_sent_at: string | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();

  const [usersRes, mirrorsRes, cardsRes] = await Promise.all([
    supabase.from("users").select("id, username, created_at"),
    supabase
      .from("onboarding_status_mirror")
      .select("user_id, state, refreshed_at"),
    supabase.from("card_sends").select("user_id, sent_at").eq("kind", "onboarding"),
  ]);

  const mirrors = new Map<
    string,
    { steps: Record<OnboardingStepId, OnboardingStepStatus>; refreshedAt: string }
  >();
  for (const row of mirrorsRes.data ?? []) {
    mirrors.set(String(row.user_id), {
      steps: normalizeOnboardingState(row.state).steps,
      refreshedAt: String(row.refreshed_at),
    });
  }
  const cards = new Map<string, string>();
  for (const row of cardsRes.data ?? []) {
    cards.set(String(row.user_id), String(row.sent_at));
  }

  const funnel: Record<string, StepCounts> = {};
  for (const step of ONBOARDING_STEPS) {
    funnel[step] = { done: 0, skipped: 0, todo: 0 };
  }

  const now = Date.now();
  let completed = 0;
  let stale = 0;
  const users: UserRow[] = [];
  for (const user of usersRes.data ?? []) {
    const userId = String(user.id);
    const mirror = mirrors.get(userId) ?? null;
    let done = 0;
    let skipped = 0;
    let nextStep: OnboardingStepId | null = null;
    if (mirror) {
      for (const step of ONBOARDING_STEPS) {
        const status = mirror.steps[step];
        const counts = funnel[step];
        if (counts) counts[status] += 1;
        if (status === "done") done += 1;
        else if (status === "skipped") skipped += 1;
        else if (nextStep === null) nextStep = step;
      }
      if (nextStep === null) completed += 1;
      if (now - Date.parse(mirror.refreshedAt) > MIRROR_STALE_MS) stale += 1;
    }
    users.push({
      user_id: userId,
      username: (user.username as string | null) ?? null,
      created_at: (user.created_at as string | null) ?? null,
      done,
      skipped,
      todo: mirror ? ONBOARDING_STEPS.length - done - skipped : ONBOARDING_STEPS.length,
      next_step: mirror ? nextStep : ONBOARDING_STEPS[0],
      mirror_refreshed_at: mirror?.refreshedAt ?? null,
      card_sent_at: cards.get(userId) ?? null,
    });
  }

  users.sort((a, b) => {
    const left = a.mirror_refreshed_at ?? "";
    const right = b.mirror_refreshed_at ?? "";
    return right.localeCompare(left) || a.user_id.localeCompare(b.user_id);
  });

  return NextResponse.json({
    steps: [...ONBOARDING_STEPS],
    stale_after_ms: MIRROR_STALE_MS,
    totals: {
      users: users.length,
      mirrored: mirrors.size,
      cold: users.length - mirrors.size,
      stale,
      completed,
      cards_sent: cards.size,
    },
    funnel,
    users,
  });
}
