/**
 * M14 task 7: ads analytics off the normalized `ad_metrics_daily` table
 * (both providers land there — OpenAI by control-plane pull, Meta by box
 * push). Indexed reads only: one window-bounded scan (current + prior
 * period + month-to-date) over (user_id, metric_date). Conversions fall
 * back to the pixel ledger (`ad_conversions`) where provider numbers are
 * absent, labeled so the UI can say which source it is showing.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { spendCeilingCents } from "@/lib/ads/spend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 1000;
const MAX_PAGES = 20;

interface MetricRow {
  account_id: string;
  provider: "meta" | "openai";
  level: string;
  entity_ref: string;
  metric_date: string;
  impressions: number;
  clicks: number;
  spend_cents: number;
  conversions: number;
  conversion_value_cents: number;
}

function isoDate(time: number): string {
  return new Date(time).toISOString().slice(0, 10);
}

interface Bucket {
  spend_cents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value_cents: number;
}

function emptyBucket(): Bucket {
  return {
    spend_cents: 0,
    impressions: 0,
    clicks: 0,
    conversions: 0,
    conversion_value_cents: 0,
  };
}

function add(bucket: Bucket, row: MetricRow): void {
  bucket.spend_cents += Number(row.spend_cents ?? 0);
  bucket.impressions += Number(row.impressions ?? 0);
  bucket.clicks += Number(row.clicks ?? 0);
  bucket.conversions += Number(row.conversions ?? 0);
  bucket.conversion_value_cents += Number(row.conversion_value_cents ?? 0);
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const days = request.nextUrl.searchParams.get("days") === "7" ? 7 : 30;
  const dayMs = 24 * 60 * 60 * 1000;
  const now = Date.now();
  const sinceDate = isoDate(now - (days - 1) * dayMs);
  const prevSinceDate = isoDate(now - (2 * days - 1) * dayMs);
  const monthStart = new Date(now).toISOString().slice(0, 8) + "01";
  const scanSince = prevSinceDate < monthStart ? prevSinceDate : monthStart;

  const supabase = serviceClient();
  const rows: MetricRow[] = [];
  for (let page = 0; page < MAX_PAGES; page++) {
    const { data, error } = await supabase
      .from("ad_metrics_daily")
      .select(
        "account_id, provider, level, entity_ref, metric_date, impressions, clicks, spend_cents, conversions, conversion_value_cents"
      )
      .eq("user_id", userId)
      .gte("metric_date", scanSince)
      .order("metric_date", { ascending: true })
      .order("id", { ascending: true })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
    if (error) {
      return NextResponse.json({ error: "rollup failed" }, { status: 502 });
    }
    rows.push(...((data ?? []) as MetricRow[]));
    if (!data || data.length < PAGE_SIZE) break;
  }

  const [{ data: campaigns }, { data: accounts }, ceiling] = await Promise.all([
    supabase
      .from("ad_campaigns")
      .select("account_id, campaign_ref, name, daily_budget_cents, status")
      .eq("user_id", userId),
    supabase
      .from("ad_accounts")
      .select("id, provider, label, account_ref")
      .eq("user_id", userId),
    spendCeilingCents(supabase, userId),
  ]);
  const campaignMeta = new Map(
    (campaigns ?? []).map((c) => [
      `${c.account_id}:${c.campaign_ref}`,
      {
        name: (c.name as string | null) ?? null,
        daily_budget_cents: Number(c.daily_budget_cents ?? 0),
        status: (c.status as string) ?? "active",
      },
    ])
  );

  // Totals/series count campaign-level rows; accounts that only report
  // account-level fall back to those — never both, to avoid double counting.
  const hasCampaignLevel = new Set(
    rows.filter((r) => r.level === "campaign").map((r) => r.account_id)
  );
  const countable = (row: MetricRow): boolean =>
    row.level === "campaign" ||
    (row.level === "account" && !hasCampaignLevel.has(row.account_id));

  const totals: Record<"meta" | "openai", { current: Bucket; prev: Bucket }> = {
    meta: { current: emptyBucket(), prev: emptyBucket() },
    openai: { current: emptyBucket(), prev: emptyBucket() },
  };
  const byDay = new Map<string, Record<"meta" | "openai", Bucket>>();
  const byCampaign = new Map<
    string,
    {
      account_id: string;
      provider: "meta" | "openai";
      entity_ref: string;
      current: Bucket;
      prev: Bucket;
    }
  >();
  let monthToDateSpend = 0;

  for (const row of rows) {
    if (!countable(row)) continue;
    if (row.metric_date >= monthStart) {
      monthToDateSpend += Number(row.spend_cents ?? 0);
    }
    const inCurrent = row.metric_date >= sinceDate;
    const inPrev = !inCurrent && row.metric_date >= prevSinceDate;
    if (!inCurrent && !inPrev) continue;
    add(totals[row.provider][inCurrent ? "current" : "prev"], row);
    if (row.level === "campaign") {
      const key = `${row.account_id}:${row.entity_ref}`;
      const entry = byCampaign.get(key) ?? {
        account_id: row.account_id,
        provider: row.provider,
        entity_ref: row.entity_ref,
        current: emptyBucket(),
        prev: emptyBucket(),
      };
      add(entry[inCurrent ? "current" : "prev"], row);
      byCampaign.set(key, entry);
    }
    if (inCurrent) {
      const day = byDay.get(row.metric_date) ?? {
        meta: emptyBucket(),
        openai: emptyBucket(),
      };
      add(day[row.provider], row);
      byDay.set(row.metric_date, day);
    }
  }

  // Pixel-reported conversions (the existing ledger) stay the source of
  // truth where the provider reported none.
  const { count: pixelCount } = await supabase
    .from("ad_conversions")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("occurred_at", new Date(now - days * dayMs).toISOString());

  const series = [...byDay.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, buckets]) => ({
      date,
      meta: buckets.meta,
      openai: buckets.openai,
    }));

  const campaignTable = [...byCampaign.values()].map((entry) => {
    const meta = campaignMeta.get(`${entry.account_id}:${entry.entity_ref}`);
    return {
      entity_ref: entry.entity_ref,
      provider: entry.provider,
      name: meta?.name ?? entry.entity_ref,
      status: meta?.status ?? null,
      daily_budget_cents: meta?.daily_budget_cents ?? null,
      spend_cents: entry.current.spend_cents,
      impressions: entry.current.impressions,
      clicks: entry.current.clicks,
      conversions: entry.current.conversions,
      conversion_value_cents: entry.current.conversion_value_cents,
      prev_spend_cents: entry.prev.spend_cents,
    };
  });

  return NextResponse.json({
    days,
    providers: (accounts ?? []).map((a) => ({
      id: a.id,
      provider: a.provider,
      label: a.label ?? a.account_ref,
    })),
    totals: {
      meta: totals.meta.current,
      openai: totals.openai.current,
      prev: {
        meta: totals.meta.prev,
        openai: totals.openai.prev,
      },
    },
    pixel_conversions: pixelCount ?? 0,
    series,
    campaigns: campaignTable,
    ceiling: {
      spend_ceiling_cents: ceiling,
      month_to_date_spend_cents: monthToDateSpend,
    },
  });
}
