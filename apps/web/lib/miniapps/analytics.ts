/**
 * MA7 #10 — analytics as a strictly read-only surface over ledgers that
 * already exist. Every panel is a straight filtered read of its source
 * table (no drifting aggregates — tests reconcile panel numbers against the
 * same rows), scoped to one user: their own activity ledgers, and store
 * events only for apps they publish. Storefront revenue stays a wired but
 * empty panel until the MA8 storefront (Session G) lands.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const WINDOW_DAYS = 30;

export function windowStart(now: Date = new Date()): string {
  const start = new Date(now);
  start.setUTCDate(start.getUTCDate() - WINDOW_DAYS);
  start.setUTCHours(0, 0, 0, 0);
  return start.toISOString();
}

export interface Panel {
  key: string;
  title: string;
  note: string | null;
  columns: string[];
  rows: (string | number)[][];
}

/* --------------------------------------------------------------- sources */

interface AgentRunRow {
  trigger: string | null;
  started_at: string;
  box_seconds: number | null;
  cost_usd: number | string | null;
}

interface AdMetricsRow {
  metric_date: string;
  impressions: number;
  clicks: number;
  spend_cents: number;
  conversions: number;
  conversion_value_cents: number;
}

interface AdConversionRow {
  creative_ref: string;
  event: string;
  value_cents: number | null;
}

interface GateEventRow {
  app_id: string;
  kind: string;
}

interface ReceiptRow {
  app_id: string;
  amount_usdc: number | string;
}

interface PublishedApp {
  id: string;
  slug: string;
}

interface CostEventRow {
  kind: string;
  amount_cents: number;
}

interface EntitlementRow {
  plan: string;
  monthly_cap_usd: number | string;
  spend_mtd_usd: number | string;
}

const num = (value: number | string | null | undefined): number =>
  value === null || value === undefined ? 0 : Number(value);

function fail(table: string, message: string): never {
  throw new Error(`analytics read failed (${table}): ${message}`);
}

/* ---------------------------------------------------------------- panels */

export async function agentActivityPanel(
  supabase: SupabaseClient,
  userId: string,
  since: string
): Promise<Panel> {
  const { data, error } = await supabase
    .from("agent_runs")
    .select("trigger, started_at, box_seconds, cost_usd")
    .eq("user_id", userId)
    .gte("started_at", since);
  if (error) fail("agent_runs", error.message);
  const rows = (data ?? []) as AgentRunRow[];
  const byDay = new Map<
    string,
    { runs: number; boxSeconds: number; costUsd: number; triggers: Map<string, number> }
  >();
  for (const run of rows) {
    const day = run.started_at.slice(0, 10);
    const entry =
      byDay.get(day) ??
      { runs: 0, boxSeconds: 0, costUsd: 0, triggers: new Map<string, number>() };
    entry.runs += 1;
    entry.boxSeconds += run.box_seconds ?? 0;
    entry.costUsd += num(run.cost_usd);
    const trigger = run.trigger ?? "unknown";
    entry.triggers.set(trigger, (entry.triggers.get(trigger) ?? 0) + 1);
    byDay.set(day, entry);
  }
  return {
    key: "agent",
    title: "Agent activity",
    note: null,
    columns: ["day", "runs", "box_seconds", "cost_usd", "by_trigger"],
    rows: [...byDay.entries()]
      .sort(([a], [b]) => (a < b ? 1 : -1))
      .map(([day, entry]) => [
        day,
        entry.runs,
        entry.boxSeconds,
        Number(entry.costUsd.toFixed(6)),
        [...entry.triggers.entries()]
          .sort()
          .map(([trigger, count]) => `${trigger}:${count}`)
          .join(" "),
      ]),
  };
}

export async function adsPanel(
  supabase: SupabaseClient,
  userId: string,
  since: string
): Promise<Panel> {
  // Account-level rows only — summing every level would double count.
  const { data, error } = await supabase
    .from("ad_metrics_daily")
    .select(
      "metric_date, impressions, clicks, spend_cents, conversions, conversion_value_cents"
    )
    .eq("user_id", userId)
    .eq("level", "account")
    .gte("metric_date", since.slice(0, 10));
  if (error) fail("ad_metrics_daily", error.message);
  const rows = (data ?? []) as AdMetricsRow[];
  const byDay = new Map<string, AdMetricsRow>();
  for (const row of rows) {
    const entry = byDay.get(row.metric_date) ?? {
      metric_date: row.metric_date,
      impressions: 0,
      clicks: 0,
      spend_cents: 0,
      conversions: 0,
      conversion_value_cents: 0,
    };
    entry.impressions += row.impressions;
    entry.clicks += row.clicks;
    entry.spend_cents += row.spend_cents;
    entry.conversions += row.conversions;
    entry.conversion_value_cents += row.conversion_value_cents;
    byDay.set(row.metric_date, entry);
  }
  return {
    key: "ads",
    title: "Ads (account-level daily)",
    note: null,
    columns: [
      "day",
      "impressions",
      "clicks",
      "spend_cents",
      "conversions",
      "conversion_value_cents",
    ],
    rows: [...byDay.values()]
      .sort((a, b) => (a.metric_date < b.metric_date ? 1 : -1))
      .map((entry) => [
        entry.metric_date,
        entry.impressions,
        entry.clicks,
        entry.spend_cents,
        entry.conversions,
        entry.conversion_value_cents,
      ]),
  };
}

export async function conversionsPanel(
  supabase: SupabaseClient,
  userId: string,
  since: string
): Promise<Panel> {
  const { data, error } = await supabase
    .from("ad_conversions")
    .select("creative_ref, event, value_cents")
    .eq("user_id", userId)
    .gte("occurred_at", since);
  if (error) fail("ad_conversions", error.message);
  const rows = (data ?? []) as AdConversionRow[];
  const byKey = new Map<string, { count: number; valueCents: number }>();
  for (const row of rows) {
    const key = `${row.creative_ref}\u0000${row.event}`;
    const entry = byKey.get(key) ?? { count: 0, valueCents: 0 };
    entry.count += 1;
    entry.valueCents += row.value_cents ?? 0;
    byKey.set(key, entry);
  }
  return {
    key: "conversions",
    title: "Pixels & conversions",
    note: null,
    columns: ["creative_ref", "event", "conversions", "value_cents"],
    rows: [...byKey.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .map(([key, entry]) => {
        const [creativeRef = "", event = ""] = key.split("\u0000");
        return [creativeRef, event, entry.count, entry.valueCents];
      }),
  };
}

/** Apps this user publishes — the publisher scope for store panels. */
export async function publishedApps(
  supabase: SupabaseClient,
  userId: string
): Promise<PublishedApp[]> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select("id, slug")
    .eq("owner_user_id", userId);
  if (error) fail("mini_apps", error.message);
  return (data ?? []) as PublishedApp[];
}

export async function storePanel(
  supabase: SupabaseClient,
  userId: string,
  since: string
): Promise<Panel> {
  const apps = await publishedApps(supabase, userId);
  const note =
    apps.length === 0
      ? "you have no published apps yet — store numbers appear once you publish one."
      : null;
  if (apps.length === 0) {
    return {
      key: "store",
      title: "Store (your apps)",
      note,
      columns: ["app", "opens", "gates_challenged", "gates_settled", "receipts_usdc"],
      rows: [],
    };
  }
  const appIds = apps.map((app) => app.id);
  const [events, receipts] = await Promise.all([
    supabase
      .from("miniapp_gate_events")
      .select("app_id, kind")
      .in("app_id", appIds)
      .gte("created_at", since),
    supabase
      .from("x402_receipts")
      .select("app_id, amount_usdc")
      .in("app_id", appIds)
      .gte("settled_at", since),
  ]);
  if (events.error) fail("miniapp_gate_events", events.error.message);
  if (receipts.error) fail("x402_receipts", receipts.error.message);
  const eventRows = (events.data ?? []) as GateEventRow[];
  const receiptRows = (receipts.data ?? []) as ReceiptRow[];
  const rows = apps.map((app) => {
    const mine = eventRows.filter((event) => event.app_id === app.id);
    const usdc = receiptRows
      .filter((receipt) => receipt.app_id === app.id)
      .reduce((sum, receipt) => sum + num(receipt.amount_usdc), 0);
    return [
      app.slug,
      mine.filter((event) => event.kind === "app_opened").length,
      mine.filter((event) => event.kind === "gate_challenged").length,
      mine.filter((event) => event.kind === "gate_settled").length,
      Number(usdc.toFixed(6)),
    ];
  });
  return {
    key: "store",
    title: "Store (your apps)",
    note,
    columns: ["app", "opens", "gates_challenged", "gates_settled", "receipts_usdc"],
    rows,
  };
}

/** MA8: paid orders by day — reconciles with the orders table exactly. */
export async function storefrontPanel(
  supabase: SupabaseClient,
  userId: string,
  since: string
): Promise<Panel> {
  const { data, error } = await supabase
    .from("orders")
    .select("amount_cents, status, resolved_at")
    .eq("user_id", userId)
    .in("status", ["paid", "refunded"])
    .gte("resolved_at", since);
  if (error) fail("orders", error.message);
  const byDay = new Map<string, { orders: number; cents: number }>();
  for (const order of (data ?? []) as {
    amount_cents: number;
    status: string;
    resolved_at: string;
  }[]) {
    if (order.status !== "paid") continue;
    const day = order.resolved_at.slice(0, 10);
    const entry = byDay.get(day) ?? { orders: 0, cents: 0 };
    entry.orders += 1;
    entry.cents += order.amount_cents;
    byDay.set(day, entry);
  }
  const rows = [...byDay.entries()]
    .sort()
    .map(([day, entry]): (string | number)[] => [
      day,
      entry.orders,
      Number((entry.cents / 100).toFixed(2)),
    ]);
  return {
    key: "storefront",
    title: "Storefront revenue",
    note: rows.length === 0 ? "no paid orders in the window yet." : null,
    columns: ["day", "orders", "revenue_usd"],
    rows,
  };
}

export async function spendPanel(
  supabase: SupabaseClient,
  userId: string,
  since: string
): Promise<Panel> {
  const [entitlement, costs] = await Promise.all([
    supabase
      .from("entitlements")
      .select("plan, monthly_cap_usd, spend_mtd_usd")
      .eq("user_id", userId)
      .maybeSingle(),
    supabase
      .from("cost_events")
      .select("kind, amount_cents")
      .eq("user_id", userId)
      .gte("occurred_at", since),
  ]);
  if (entitlement.error) fail("entitlements", entitlement.error.message);
  if (costs.error) fail("cost_events", costs.error.message);
  const row = (entitlement.data ?? null) as EntitlementRow | null;
  const costRows = (costs.data ?? []) as CostEventRow[];
  const byKind = new Map<string, number>();
  for (const cost of costRows) {
    byKind.set(cost.kind, (byKind.get(cost.kind) ?? 0) + cost.amount_cents);
  }
  const rows: (string | number)[][] = [
    ["plan", row?.plan ?? "—"],
    ["monthly_cap_usd", num(row?.monthly_cap_usd)],
    ["spend_mtd_usd", num(row?.spend_mtd_usd)],
    ...[...byKind.entries()]
      .sort()
      .map(([kind, cents]): (string | number)[] => [
        `cost_${kind}_cents_30d`,
        cents,
      ]),
  ];
  return {
    key: "spend",
    title: "Spend vs cap",
    note: null,
    columns: ["metric", "value"],
    rows,
  };
}

export async function allPanels(
  supabase: SupabaseClient,
  userId: string,
  since: string = windowStart()
): Promise<Panel[]> {
  return [
    await agentActivityPanel(supabase, userId, since),
    await adsPanel(supabase, userId, since),
    await conversionsPanel(supabase, userId, since),
    await storePanel(supabase, userId, since),
    await storefrontPanel(supabase, userId, since),
    await spendPanel(supabase, userId, since),
  ];
}

/* ------------------------------------------------------------------- csv */

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

export function panelToCsv(panel: Panel): string {
  const lines = [panel.columns.map(csvCell).join(",")];
  for (const row of panel.rows) {
    lines.push(row.map(csvCell).join(","));
  }
  return `${lines.join("\n")}\n`;
}
