/**
 * Read-only ads analytics rollup for the dashboard: last-30-day reported
 * spend (spend_reports, the reconciliation ledger), conversions by event,
 * and per-campaign spend — all from Postgres, no platform call. Deeper
 * questions go to the agent, which holds the Meta Ads MCP tools.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const WINDOW_DAYS = 30;
const PAGE_SIZE = 1000;
const MAX_PAGES = 100;

/** Page through the full window so totals never silently truncate; the
 * deterministic order + page cap bound the worst case, and `truncated`
 * tells the caller when the cap was hit. */
async function fetchAll<T>(
  page: (from: number, to: number) => PromiseLike<{
    data: T[] | null;
    error: { message: string } | null;
  }>
): Promise<{ rows: T[]; truncated: boolean } | null> {
  const rows: T[] = [];
  for (let i = 0; i < MAX_PAGES; i++) {
    const { data, error } = await page(i * PAGE_SIZE, (i + 1) * PAGE_SIZE - 1);
    if (error) return null;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return { rows, truncated: false };
  }
  return { rows, truncated: true };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const sinceDate = since.toISOString().slice(0, 10);
  const [reportsResult, conversionsResult] = await Promise.all([
    fetchAll<{
      campaign_ref: string;
      report_date: string;
      spend_cents: number | null;
    }>((from, to) =>
      supabase
        .from("spend_reports")
        .select("campaign_ref, report_date, spend_cents")
        .eq("user_id", userId)
        .gte("report_date", sinceDate)
        .order("report_date", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
    fetchAll<{
      creative_ref: string | null;
      event: string;
      value_cents: number | null;
      occurred_at: string;
    }>((from, to) =>
      supabase
        .from("ad_conversions")
        .select("creative_ref, event, value_cents, occurred_at")
        .eq("user_id", userId)
        .gte("occurred_at", since.toISOString())
        .order("occurred_at", { ascending: true })
        .order("id", { ascending: true })
        .range(from, to)
    ),
  ]);
  if (!reportsResult || !conversionsResult) {
    return NextResponse.json({ error: "rollup failed" }, { status: 502 });
  }
  const reports = reportsResult.rows;
  const conversions = conversionsResult.rows;

  const spendByCampaign = new Map<string, number>();
  let spendTotal = 0;
  for (const row of reports) {
    const cents = Number(row.spend_cents ?? 0);
    spendTotal += cents;
    spendByCampaign.set(
      row.campaign_ref,
      (spendByCampaign.get(row.campaign_ref) ?? 0) + cents
    );
  }

  const conversionsByEvent = new Map<
    string,
    { count: number; value_cents: number }
  >();
  for (const row of conversions) {
    const key = row.event;
    const entry = conversionsByEvent.get(key) ?? { count: 0, value_cents: 0 };
    entry.count += 1;
    entry.value_cents += Number(row.value_cents ?? 0);
    conversionsByEvent.set(key, entry);
  }

  return NextResponse.json({
    window_days: WINDOW_DAYS,
    spend_total_cents: spendTotal,
    spend_by_campaign: [...spendByCampaign.entries()].map(
      ([campaign_ref, spend_cents]) => ({ campaign_ref, spend_cents })
    ),
    conversions_by_event: [...conversionsByEvent.entries()].map(
      ([event, agg]) => ({ event, ...agg })
    ),
    conversion_count: conversions.length,
    truncated: reportsResult.truncated || conversionsResult.truncated,
  });
}
