/**
 * Operator learning-plane view (goal.md V10 §17.2, admin.wzrd.tech). Serves
 * the V10 learning plan snapshot plus fleet-wide, content-free aggregates:
 * mode distribution, feedback reason counts, experiment/profile receipts,
 * and the recent learning_events stream. Only opaque IDs, enums, versions,
 * timestamps, and aggregate numbers cross this boundary — never prompts,
 * corrections, fixtures, candidate bodies, or profile bodies (L4/C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import { LEARNING_PLAN } from "@/lib/learning/plan";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const dayAgo = new Date(Date.now() - 86_400_000).toISOString();

  const [settings, feedback, experiments, profiles, events] = await Promise.all([
    supabase.from("learning_settings").select("mode"),
    supabase
      .from("run_feedback")
      .select("reason, delivery, created_at")
      .order("created_at", { ascending: false })
      .limit(1000),
    supabase
      .from("learning_experiments")
      .select(
        "experiment_id, status, backend, os_class, sample_count, task_success_delta, task_success_delta_lower95, hard_gate_failures, tokens, cost_usd, latency_ms_p95, error_class, created_at, finished_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("learning_profiles")
      .select(
        "profile_id, status, rollback_reason, activated_at, rolled_back_at, created_at",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("learning_events")
      .select(
        "event_type, status, backend, error_class, rollback_reason, occurred_at",
      )
      .order("seq", { ascending: false })
      .limit(200),
  ]);

  const modeCounts: Record<string, number> = { off: 0, observe: 0, suggest: 0, auto_safe: 0 };
  for (const row of settings.data ?? []) {
    const mode = row.mode as string;
    modeCounts[mode] = (modeCounts[mode] ?? 0) + 1;
  }

  const reasonCounts: Record<string, number> = {};
  let feedback24h = 0;
  let forwarded = 0;
  for (const row of feedback.data ?? []) {
    const reason = row.reason as string;
    reasonCounts[reason] = (reasonCounts[reason] ?? 0) + 1;
    if ((row.created_at as string) >= dayAgo) feedback24h += 1;
    if (row.delivery === "forwarded") forwarded += 1;
  }

  const experimentStatusCounts: Record<string, number> = {};
  for (const row of experiments.data ?? []) {
    const status = row.status as string;
    experimentStatusCounts[status] = (experimentStatusCounts[status] ?? 0) + 1;
  }

  const eventTypeCounts: Record<string, number> = {};
  for (const row of events.data ?? []) {
    const type = row.event_type as string;
    eventTypeCounts[type] = (eventTypeCounts[type] ?? 0) + 1;
  }

  return NextResponse.json({
    plan: LEARNING_PLAN,
    modes: modeCounts,
    feedback: {
      total: feedback.data?.length ?? 0,
      last24h: feedback24h,
      forwarded,
      byReason: reasonCounts,
    },
    experiments: {
      recent: experiments.data ?? [],
      byStatus: experimentStatusCounts,
    },
    profiles: profiles.data ?? [],
    events: {
      recent: events.data ?? [],
      byType: eventTypeCounts,
    },
  });
}
