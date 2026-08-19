/**
 * M8 operations dashboard: box start rate against the 600/hr and 1,500/day
 * platform ceilings (alert at 70%), line health (per-line daily volume
 * against the 5,000/day server quota, dormant lines nearing two months),
 * and per-user gateway spend against caps.
 *
 * V8 hardening item 4 adds the wave's rate/limit counters: schedule fire
 * counts against the box-start budget (the V3 sweeper and V8 keep-awake
 * are new start consumers — alarmed at 70% of their budget share), fill
 * ticket mints/redemptions, per-user social actions/day, and bot counts.
 * Thresholds are documented in docs/platform.md §Operations.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { miniAppOps, scheduleBudget, socialUsage } from "@/lib/admin/ops";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOURLY_CEILING = 600;
const DAILY_CEILING = 1500;
const LINE_DAILY_QUOTA = 5000;
const ALERT_RATIO = 0.7;
const DORMANT_DAYS = 50; // alert before Apple's ~2-month deactivation

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const now = Date.now();
  const hourAgo = new Date(now - 3600_000).toISOString();
  const dayAgo = new Date(now - 86_400_000).toISOString();

  const [{ count: startsHour }, { count: startsDay }] = await Promise.all([
    supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", hourAgo),
    supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .gte("started_at", dayAgo),
  ]);

  const { data: lines } = await supabase
    .from("lines")
    .select("phone, mode, assigned_user_id, assigned_at");

  const { data: recentInbound } = await supabase
    .from("inbound_events")
    .select("user_id, received_at")
    .gte("received_at", dayAgo);

  const inboundByUser = new Map<string, number>();
  for (const event of recentInbound ?? []) {
    inboundByUser.set(
      event.user_id as string,
      (inboundByUser.get(event.user_id as string) ?? 0) + 1
    );
  }

  const { data: lastSeen } = await supabase
    .from("inbound_events")
    .select("user_id, received_at")
    .order("received_at", { ascending: false })
    .limit(1000);
  const lastByUser = new Map<string, string>();
  for (const event of lastSeen ?? []) {
    if (!lastByUser.has(event.user_id as string)) {
      lastByUser.set(event.user_id as string, event.received_at as string);
    }
  }

  const lineHealth = (lines ?? []).map((line) => {
    const userId = line.assigned_user_id as string | null;
    const daily = userId ? (inboundByUser.get(userId) ?? 0) : 0;
    const last = userId ? lastByUser.get(userId) : undefined;
    const dormantDays = last
      ? Math.floor((now - new Date(last).getTime()) / 86_400_000)
      : null;
    return {
      phone: line.phone,
      mode: line.mode,
      assigned: Boolean(userId),
      messages_24h: daily,
      quota_ratio: daily / LINE_DAILY_QUOTA,
      dormant_days: dormantDays,
      alerts: [
        ...(daily / LINE_DAILY_QUOTA >= ALERT_RATIO ? ["quota"] : []),
        ...(dormantDays !== null && dormantDays >= DORMANT_DAYS
          ? ["dormant"]
          : []),
      ],
    };
  });

  const { data: spend } = await supabase
    .from("entitlements")
    .select("user_id, speed_tier, spend_mtd_usd, monthly_cap_usd");

  // V8 counters. Schedule fires come from the sweeper's agent_runs receipts
  // (trigger='cron'); keep-awake fires from their dedicated 'keepawake'
  // receipts in the power ledger (disjoint from cron receipts and from the
  // 'ready' rows every wake writes). Bot runs have no control-plane attribution
  // (bot turns run inside the user's box — C4), so the bot section reports
  // roster counts plus bot-sourced schedule fires, honestly labelled.
  const [
    { count: cronRuns },
    { count: keepawakeWakes },
    { count: ticketMints },
    { count: ticketRedemptions },
    { data: socialRules },
    { count: botCount },
    { count: botScheduleFires },
  ] = await Promise.all([
    supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("trigger", "cron")
      .gte("started_at", dayAgo),
    supabase
      .from("box_state_events")
      .select("id", { count: "exact", head: true })
      .eq("state", "keepawake")
      .gte("created_at", dayAgo),
    supabase
      .from("vault_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "ticket_minted")
      .gte("created_at", dayAgo),
    supabase
      .from("vault_events")
      .select("id", { count: "exact", head: true })
      .eq("action", "ticket_redeemed")
      .gte("created_at", dayAgo),
    supabase
      .from("automation_rules")
      .select("user_id, used_today, daily_cap")
      .eq("enabled", true),
    supabase
      .from("bots")
      .select("id", { count: "exact", head: true })
      .neq("status", "deleted"),
    supabase
      .from("agent_runs")
      .select("id", { count: "exact", head: true })
      .eq("trigger", "cron")
      .eq("schedule_source", "bots")
      .gte("started_at", dayAgo),
  ]);

  // MA11 mini-app counters: the ops_events ledger (launch/publish/upload/
  // guest_session/rate_limited) plus the gate ledger and the x402 receipt
  // ledger. Sums are bounded reads — the 24h windows stay small at beta scale.
  const opsKindCount = (kind: string) =>
    supabase
      .from("ops_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", kind)
      .gte("created_at", dayAgo);
  const [
    { count: storeOpens },
    { count: launches },
    { count: guestSessions },
    { count: publishes },
    { count: uploads },
    { data: uploadBytesRows },
    { count: uploadRejections },
    { count: rateLimited },
    { count: gateSettlements },
    { count: x402Settlements },
    { count: x402Receipts },
    { data: receiptAmounts },
  ] = await Promise.all([
    opsKindCount("store_open"),
    opsKindCount("launch"),
    opsKindCount("guest_session"),
    opsKindCount("publish"),
    opsKindCount("upload"),
    supabase
      .from("ops_events")
      .select("bytes")
      .eq("kind", "upload")
      .gte("created_at", dayAgo)
      .limit(10000),
    opsKindCount("upload_rejected"),
    opsKindCount("rate_limited"),
    supabase
      .from("miniapp_gate_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "gate_settled")
      .gte("created_at", dayAgo),
    supabase
      .from("miniapp_gate_events")
      .select("id", { count: "exact", head: true })
      .eq("kind", "gate_settled")
      .eq("ref", "x402")
      .gte("created_at", dayAgo),
    supabase
      .from("x402_receipts")
      .select("jti", { count: "exact", head: true })
      .gte("settled_at", dayAgo),
    supabase
      .from("x402_receipts")
      .select("amount_usdc")
      .gte("settled_at", dayAgo)
      .limit(10000),
  ]);

  const hour = startsHour ?? 0;
  const day = startsDay ?? 0;
  return NextResponse.json({
    start_rate: {
      last_hour: hour,
      hourly_ceiling: HOURLY_CEILING,
      last_24h: day,
      daily_ceiling: DAILY_CEILING,
      alerts: [
        ...(hour >= HOURLY_CEILING * ALERT_RATIO ? ["hourly"] : []),
        ...(day >= DAILY_CEILING * ALERT_RATIO ? ["daily"] : []),
      ],
    },
    schedules: scheduleBudget(cronRuns ?? 0, keepawakeWakes ?? 0),
    fill_tickets: {
      minted_24h: ticketMints ?? 0,
      redeemed_24h: ticketRedemptions ?? 0,
    },
    social: socialUsage(
      (socialRules ?? []).map((rule) => ({
        user_id: rule.user_id as string,
        used_today: Number(rule.used_today ?? 0),
        daily_cap: Number(rule.daily_cap ?? 0),
      }))
    ),
    bots: {
      active: botCount ?? 0,
      schedule_fires_24h: botScheduleFires ?? 0,
      note: "bot chat turns run inside the user's box (C4) — no per-turn control-plane attribution",
    },
    miniapps: miniAppOps({
      store_opens_24h: storeOpens ?? 0,
      launches_24h: launches ?? 0,
      guest_sessions_24h: guestSessions ?? 0,
      publishes_24h: publishes ?? 0,
      uploads_24h: uploads ?? 0,
      upload_bytes_24h: (uploadBytesRows ?? []).reduce(
        (sum, row) => sum + Number(row.bytes ?? 0),
        0
      ),
      upload_rejections_24h: uploadRejections ?? 0,
      rate_limited_24h: rateLimited ?? 0,
      gate_settlements_24h: gateSettlements ?? 0,
      x402_settlements_24h: x402Settlements ?? 0,
      x402_receipts_24h: x402Receipts ?? 0,
      x402_revenue_usdc_24h: (receiptAmounts ?? []).reduce(
        (sum, row) => sum + Number(row.amount_usdc ?? 0),
        0
      ),
    }),
    lines: lineHealth,
    spend: (spend ?? []).map((row) => ({
      ...row,
      cap_ratio:
        Number(row.monthly_cap_usd) > 0
          ? Number(row.spend_mtd_usd) / Number(row.monthly_cap_usd)
          : 0,
      alert:
        Number(row.spend_mtd_usd) >=
        Number(row.monthly_cap_usd) * ALERT_RATIO,
    })),
  });
}
