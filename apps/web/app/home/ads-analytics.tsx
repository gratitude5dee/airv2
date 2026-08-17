"use client";

/**
 * M14 task 7–8: Analytics subtab rebuilt on `ad_metrics_daily`. KPI stat
 * row, provider filter chips, a hand-rolled SVG chart (no chart dependency —
 * non-goal §2), the per-campaign table, and the spend-ceiling meter. Pixel
 * conversions (the existing ledger) are shown, labeled, when providers
 * report none.
 */

import { useEffect, useState } from "react";

interface Bucket {
  spend_cents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value_cents: number;
}

interface CampaignRow {
  entity_ref: string;
  provider: "meta" | "openai";
  name: string;
  status: string | null;
  daily_budget_cents: number | null;
  spend_cents: number;
  impressions: number;
  clicks: number;
  conversions: number;
  conversion_value_cents: number;
  prev_spend_cents: number;
}

interface Analytics {
  days: number;
  providers: { id: string; provider: string; label: string }[];
  totals: {
    meta: Bucket;
    openai: Bucket;
    prev: { meta: Bucket; openai: Bucket };
  };
  pixel_conversions: number;
  series: { date: string; meta: Bucket; openai: Bucket }[];
  campaigns: CampaignRow[];
  ceiling: {
    spend_ceiling_cents: number;
    month_to_date_spend_cents: number;
  };
}

type ProviderFilter = "all" | "meta" | "openai";

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

function addBuckets(a: Bucket, b: Bucket): Bucket {
  return {
    spend_cents: a.spend_cents + b.spend_cents,
    impressions: a.impressions + b.impressions,
    clicks: a.clicks + b.clicks,
    conversions: a.conversions + b.conversions,
    conversion_value_cents: a.conversion_value_cents + b.conversion_value_cents,
  };
}

const ZERO: Bucket = {
  spend_cents: 0,
  impressions: 0,
  clicks: 0,
  conversions: 0,
  conversion_value_cents: 0,
};

/** Hand-rolled daily spend bar chart — tokens only, no chart package. */
function SpendChart({
  series,
}: {
  series: { date: string; spend_cents: number }[];
}) {
  const width = 320;
  const height = 96;
  const pad = 4;
  const max = Math.max(1, ...series.map((p) => p.spend_cents));
  const barW = (width - pad * 2) / Math.max(1, series.length);
  return (
    <svg
      viewBox={`0 0 ${width} ${height + 14}`}
      className="w-full"
      role="img"
      aria-label="Daily spend"
    >
      {series.map((point, i) => {
        const h = Math.round((point.spend_cents / max) * (height - pad));
        return (
          <rect
            key={point.date}
            x={pad + i * barW + 0.5}
            y={height - h}
            width={Math.max(1, barW - 1)}
            height={h}
            fill="var(--accent)"
          >
            <title>{`${point.date}: ${usd(point.spend_cents)}`}</title>
          </rect>
        );
      })}
      <text x={pad} y={height + 11} fontSize="8" fill="var(--muted-2)">
        {series[0]?.date ?? ""}
      </text>
      <text
        x={width - pad}
        y={height + 11}
        fontSize="8"
        fill="var(--muted-2)"
        textAnchor="end"
      >
        {series[series.length - 1]?.date ?? ""}
      </text>
    </svg>
  );
}

export function AdsAnalyticsTab({
  active,
  onAskAgent,
}: {
  active: boolean;
  onAskAgent: (prefill: string) => void;
}) {
  const [days, setDays] = useState<7 | 30>(30);
  const [data, setData] = useState<Analytics | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<ProviderFilter>("all");

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    setFailed(false);
    void (async () => {
      try {
        const res = await fetch(`/api/ads/analytics?days=${days}`);
        if (cancelled) return;
        if (res.ok) setData((await res.json()) as Analytics);
        else setFailed(true);
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [active, days]);

  if (failed) {
    return (
      <p className="muted m-0 text-[13px]">
        Couldn{"\u2019"}t load analytics — try again shortly.
      </p>
    );
  }
  if (!data) {
    return <p className="muted m-0 text-[13px]">Loading analytics…</p>;
  }

  const current =
    filter === "all"
      ? addBuckets(data.totals.meta, data.totals.openai)
      : (data.totals[filter] ?? ZERO);
  const prev =
    filter === "all"
      ? addBuckets(data.totals.prev.meta, data.totals.prev.openai)
      : (data.totals.prev[filter] ?? ZERO);
  const providerConversions = current.conversions > 0;
  const conversions = providerConversions
    ? current.conversions
    : data.pixel_conversions;
  const ctr =
    current.impressions > 0 ? (current.clicks / current.impressions) * 100 : 0;
  const cpaCents = conversions > 0 ? current.spend_cents / conversions : 0;
  const roas =
    current.spend_cents > 0
      ? current.conversion_value_cents / current.spend_cents
      : 0;
  const spendDelta = current.spend_cents - prev.spend_cents;
  const series = data.series.map((point) => ({
    date: point.date,
    spend_cents:
      filter === "all"
        ? point.meta.spend_cents + point.openai.spend_cents
        : point[filter].spend_cents,
  }));
  const campaigns = data.campaigns.filter(
    (c) => filter === "all" || c.provider === filter
  );
  const hasMetrics = data.series.length > 0 || data.campaigns.length > 0;
  const ceiling = data.ceiling.spend_ceiling_cents;
  const mtd = data.ceiling.month_to_date_spend_cents;
  const meterPct =
    ceiling > 0 ? Math.min(100, Math.round((mtd / ceiling) * 100)) : 0;

  const kpis: [string, string][] = [
    ["Spend", usd(current.spend_cents)],
    ["Impressions", current.impressions.toLocaleString()],
    ["Clicks", current.clicks.toLocaleString()],
    ["CTR", `${ctr.toFixed(2)}%`],
    [
      providerConversions ? "Conversions" : "Conversions (pixel)",
      conversions.toLocaleString(),
    ],
    ["Conv. value", usd(current.conversion_value_cents)],
    ["CPA", conversions > 0 ? usd(Math.round(cpaCents)) : "—"],
    ["ROAS", current.spend_cents > 0 ? `${roas.toFixed(2)}×` : "—"],
  ];

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            ["all", "All"],
            ["meta", "Meta"],
            ["openai", "OpenAI"],
          ] as [ProviderFilter, string][]
        ).map(([id, label]) => (
          <button
            key={id}
            className={
              "btn !px-3 !py-1.5 !text-[12px]" +
              (filter === id ? " !bg-[var(--text)] !text-[var(--bg)]" : "")
            }
            onClick={() => setFilter(id)}
          >
            {label}
          </button>
        ))}
        <span className="flex-1" />
        {([7, 30] as const).map((d) => (
          <button
            key={d}
            className={
              "btn !px-3 !py-1.5 !text-[12px]" +
              (days === d ? " !bg-[var(--text)] !text-[var(--bg)]" : "")
            }
            onClick={() => setDays(d)}
          >
            {d}d
          </button>
        ))}
      </div>

      {!hasMetrics ? (
        <p className="muted m-0 text-[13px]">
          No metrics yet — they arrive within an hour of connecting
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {kpis.map(([label, value]) => (
              <div key={label} className="panel !p-3">
                <p className="muted m-0 text-[12px]">{label}</p>
                <strong className="text-[15px]">{value}</strong>
                {label === "Spend" && prev.spend_cents > 0 ? (
                  <p className="muted m-0 mt-0.5 text-[11px]">
                    {spendDelta >= 0 ? "+" : "−"}
                    {usd(Math.abs(spendDelta))} vs prior {data.days}d
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div className="panel !p-3">
            <p className="muted m-0 mb-1 text-[12px]">Daily spend</p>
            <SpendChart series={series} />
          </div>

          <h4 className="m-0 mt-1 text-[13px] font-semibold">Campaigns</h4>
          {campaigns.map((c) => {
            const delta = c.spend_cents - c.prev_spend_cents;
            return (
              <div key={`${c.provider}:${c.entity_ref}`} className="panel rise-in !p-3">
                <div className="flex items-center justify-between">
                  <strong className="text-[13px]">{c.name}</strong>
                  <span className="muted text-[11px]">{c.provider}</span>
                </div>
                <p className="muted m-0 mt-1 text-[12px]">
                  {[
                    c.status,
                    c.daily_budget_cents != null && c.daily_budget_cents > 0
                      ? `${usd(c.daily_budget_cents)}/day budget`
                      : null,
                    `${usd(c.spend_cents)} spent`,
                    `${c.conversions} conv.`,
                    `${delta >= 0 ? "+" : "−"}${usd(Math.abs(delta))} vs prior`,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              </div>
            );
          })}
          {campaigns.length === 0 ? (
            <p className="muted m-0 text-[13px]">
              No campaign-level metrics in this window.
            </p>
          ) : null}
        </>
      )}

      <h4 className="m-0 mt-2 text-[13px] font-semibold">Spend ceiling</h4>
      <div className="panel !p-3">
        <p className="muted m-0 text-[12px]">
          {usd(mtd)} spent this month
          {ceiling > 0
            ? ` of your ${usd(ceiling)} 30-day ceiling`
            : " — no ceiling set, so ad writes are blocked"}
        </p>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded bg-[var(--border)]">
          <div
            className="h-full rounded bg-[var(--accent)]"
            style={{ width: `${meterPct}%` }}
          />
        </div>
        <button
          className="btn mt-2 !px-3 !py-1.5 !text-[12px]"
          onClick={() =>
            onAskAgent(
              "I want to raise my ad spend ceiling — walk me through getting it raised."
            )
          }
        >
          Raise ceiling
        </button>
      </div>

      <h4 className="m-0 mt-2 text-[13px] font-semibold">
        Ask about your ads data
      </h4>
      <p className="muted m-0 text-[12px]">
        Your agent holds the ads tools — ask it anything about performance,
        audiences, or spend. Same agent as iMessage.
      </p>
      <div>
        <button
          className="btn !px-3 !py-1.5 !text-[12px]"
          onClick={() =>
            onAskAgent(
              "Summarize my ad performance over the last 30 days across Meta and OpenAI."
            )
          }
        >
          Chat with your ads data
        </button>
      </div>
    </>
  );
}
