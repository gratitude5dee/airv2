/**
 * M8 operations dashboard: box start rate against the 600/hr and 1,500/day
 * platform ceilings (alert at 70%), line health (per-line daily volume
 * against the 5,000/day server quota, dormant lines nearing two months),
 * and per-user gateway spend against caps.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
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
