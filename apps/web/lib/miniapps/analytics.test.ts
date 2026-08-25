/**
 * MA7 #10 acceptance: panel numbers reconcile with the underlying tables
 * (the fake supabase filters rows exactly the way Postgres would, and the
 * assertions recompute expectations from the same seed rows), publisher
 * scoping holds, CSV escapes correctly, and the module is read-only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import {
  adsPanel,
  agentActivityPanel,
  allPanels,
  conversionsPanel,
  panelToCsv,
  spendPanel,
  storefrontPanel,
  storePanel,
} from "./analytics";
import { analytics } from "./apps/analytics";

type Row = Record<string, unknown>;

/** Minimal supabase read surface: select/eq/gte/in chains + maybeSingle. */
function makeFakeSupabase(tables: Record<string, Row[]>): SupabaseClient {
  function builder(table: string) {
    const filters: ((row: Row) => boolean)[] = [];
    const chain = {
      select: () => chain,
      eq(column: string, value: unknown) {
        filters.push((row) => row[column] === value);
        return chain;
      },
      gte(column: string, value: string) {
        filters.push((row) => String(row[column]) >= value);
        return chain;
      },
      in(column: string, values: unknown[]) {
        filters.push((row) => values.includes(row[column]));
        return chain;
      },
      async maybeSingle() {
        const rows = (tables[table] ?? []).filter((row) =>
          filters.every((f) => f(row))
        );
        return { data: rows[0] ?? null, error: null };
      },
      then(
        resolve: (result: { data: Row[]; error: null }) => void
      ) {
        const rows = (tables[table] ?? []).filter((row) =>
          filters.every((f) => f(row))
        );
        resolve({ data: rows, error: null });
      },
    };
    return chain;
  }
  return { from: builder } as unknown as SupabaseClient;
}

const ME = "user-me";
const OTHER = "user-other";
const SINCE = "2026-08-01T00:00:00.000Z";

const AGENT_RUNS: Row[] = [
    { user_id: ME, trigger: "web", started_at: "2026-08-10T10:00:00Z", box_seconds: 60, cost_usd: "0.05" },
    { user_id: ME, trigger: "imessage", started_at: "2026-08-10T11:00:00Z", box_seconds: 30, cost_usd: "0.02" },
    { user_id: ME, trigger: "web", started_at: "2026-08-11T09:00:00Z", box_seconds: null, cost_usd: null },
    { user_id: ME, trigger: "web", started_at: "2026-07-01T09:00:00Z", box_seconds: 999, cost_usd: "9" }, // outside window
    { user_id: OTHER, trigger: "web", started_at: "2026-08-10T10:00:00Z", box_seconds: 500, cost_usd: "5" },
];

const seed: Record<string, Row[]> = {
  agent_runs: AGENT_RUNS,
  ad_metrics_daily: [
    { user_id: ME, level: "account", metric_date: "2026-08-10", impressions: 100, clicks: 10, spend_cents: 500, conversions: 2, conversion_value_cents: 900 },
    { user_id: ME, level: "account", metric_date: "2026-08-10", impressions: 50, clicks: 5, spend_cents: 250, conversions: 1, conversion_value_cents: 100 },
    { user_id: ME, level: "ad", metric_date: "2026-08-10", impressions: 999, clicks: 99, spend_cents: 9999, conversions: 9, conversion_value_cents: 9 }, // wrong level
    { user_id: OTHER, level: "account", metric_date: "2026-08-10", impressions: 7, clicks: 7, spend_cents: 7, conversions: 7, conversion_value_cents: 7 },
  ],
  ad_conversions: [
    { user_id: ME, creative_ref: "cr-1", event: "purchase", value_cents: 1000, occurred_at: "2026-08-09T00:00:00Z" },
    { user_id: ME, creative_ref: "cr-1", event: "purchase", value_cents: 500, occurred_at: "2026-08-10T00:00:00Z" },
    { user_id: ME, creative_ref: "cr-2", event: "lead", value_cents: null, occurred_at: "2026-08-10T00:00:00Z" },
    { user_id: OTHER, creative_ref: "cr-1", event: "purchase", value_cents: 9999, occurred_at: "2026-08-10T00:00:00Z" },
  ],
  mini_apps: [
    { id: "app-mine", slug: "my-app", owner_user_id: ME },
    { id: "app-theirs", slug: "their-app", owner_user_id: OTHER },
  ],
  miniapp_gate_events: [
    { app_id: "app-mine", kind: "app_opened", created_at: "2026-08-10T00:00:00Z" },
    { app_id: "app-mine", kind: "app_opened", created_at: "2026-08-11T00:00:00Z" },
    { app_id: "app-mine", kind: "gate_challenged", created_at: "2026-08-11T00:00:00Z" },
    { app_id: "app-mine", kind: "gate_settled", created_at: "2026-08-11T01:00:00Z" },
    { app_id: "app-theirs", kind: "app_opened", created_at: "2026-08-11T00:00:00Z" },
  ],
  x402_receipts: [
    { app_id: "app-mine", amount_usdc: "0.25", settled_at: "2026-08-11T01:00:00Z" },
    { app_id: "app-mine", amount_usdc: "0.50", settled_at: "2026-08-12T01:00:00Z" },
    { app_id: "app-theirs", amount_usdc: "9.99", settled_at: "2026-08-12T01:00:00Z" },
  ],
  entitlements: [
    { user_id: ME, plan: "paid", monthly_cap_usd: "20.00", spend_mtd_usd: "3.1400" },
  ],
  orders: [
    { user_id: ME, amount_cents: 2500, status: "paid", resolved_at: "2026-08-10T12:00:00Z" },
    { user_id: ME, amount_cents: 1000, status: "paid", resolved_at: "2026-08-10T13:00:00Z" },
    { user_id: ME, amount_cents: 500, status: "paid", resolved_at: "2026-08-11T09:00:00Z" },
    { user_id: ME, amount_cents: 9999, status: "refunded", resolved_at: "2026-08-11T10:00:00Z" }, // refunded excluded from revenue
    { user_id: ME, amount_cents: 9999, status: "pending", resolved_at: null }, // unpaid excluded
    { user_id: OTHER, amount_cents: 7777, status: "paid", resolved_at: "2026-08-11T00:00:00Z" },
  ],
  cost_events: [
    { user_id: ME, kind: "render", amount_cents: 12, occurred_at: "2026-08-10T00:00:00Z" },
    { user_id: ME, kind: "render", amount_cents: 8, occurred_at: "2026-08-11T00:00:00Z" },
    { user_id: ME, kind: "ad", amount_cents: 100, occurred_at: "2026-08-11T00:00:00Z" },
    { user_id: OTHER, kind: "render", amount_cents: 777, occurred_at: "2026-08-11T00:00:00Z" },
  ],
};

const supabase = makeFakeSupabase(seed);

describe("analytics reconciliation", () => {
  it("agent activity matches agent_runs rows in the window", async () => {
    const panel = await agentActivityPanel(supabase, ME, SINCE);
    // Reconcile against the source rows directly.
    const source = AGENT_RUNS.filter(
      (r) => r["user_id"] === ME && String(r["started_at"]) >= SINCE
    );
    const totalRuns = panel.rows.reduce((sum, row) => sum + Number(row[1]), 0);
    expect(totalRuns).toBe(source.length);
    const aug10 = panel.rows.find((row) => row[0] === "2026-08-10");
    expect(aug10).toEqual([
      "2026-08-10",
      2,
      90,
      0.07,
      "imessage:1 web:1",
    ]);
    const aug11 = panel.rows.find((row) => row[0] === "2026-08-11");
    expect(aug11).toEqual(["2026-08-11", 1, 0, 0, "web:1"]);
  });

  it("ads panel sums account-level rows only, per day", async () => {
    const panel = await adsPanel(supabase, ME, SINCE);
    expect(panel.rows).toEqual([["2026-08-10", 150, 15, 750, 3, 1000]]);
  });

  it("conversions group by creative_ref/event with value sums", async () => {
    const panel = await conversionsPanel(supabase, ME, SINCE);
    expect(panel.rows).toEqual([
      ["cr-1", "purchase", 2, 1500],
      ["cr-2", "lead", 1, 0],
    ]);
  });

  it("store panel is publisher-scoped: my apps only", async () => {
    const panel = await storePanel(supabase, ME, SINCE);
    expect(panel.rows).toEqual([["my-app", 2, 1, 1, 0.75]]);
    // Nothing from app-theirs leaks in.
    expect(JSON.stringify(panel.rows)).not.toContain("their-app");
  });

  it("store panel is honest when the user publishes nothing", async () => {
    const panel = await storePanel(supabase, "user-nobody", SINCE);
    expect(panel.rows).toEqual([]);
    expect(panel.note).toContain("no published apps");
  });

  it("storefront revenue reconciles with paid orders by day (MA8)", async () => {
    const panel = await storefrontPanel(supabase, ME, SINCE);
    expect(panel.rows).toEqual([
      ["2026-08-10", 2, 35],
      ["2026-08-11", 1, 5],
    ]);
    // Refunded, pending, and other users' orders never count as revenue.
    expect(JSON.stringify(panel.rows)).not.toContain("99.99");
    expect(JSON.stringify(panel.rows)).not.toContain("77.77");
  });

  it("spend panel reflects entitlements and cost_events", async () => {
    const panel = await spendPanel(supabase, ME, SINCE);
    expect(panel.rows).toEqual([
      ["plan", "paid"],
      ["monthly_cap_usd", 20],
      ["spend_mtd_usd", 3.14],
      ["cost_ad_cents_30d", 100],
      ["cost_render_cents_30d", 20],
    ]);
  });

  it("allPanels returns every panel with a unique key", async () => {
    const panels = await allPanels(supabase, ME, SINCE);
    const keys = panels.map((p) => p.key);
    expect(keys).toEqual([
      "agent",
      "ads",
      "conversions",
      "store",
      "storefront",
      "spend",
    ]);
  });
});

describe("csv export", () => {
  it("emits a header plus one line per row, escaping as needed", async () => {
    const panel = await adsPanel(supabase, ME, SINCE);
    const csv = panelToCsv(panel);
    expect(csv).toBe(
      "day,impressions,clicks,spend_cents,conversions,conversion_value_cents\n" +
        "2026-08-10,150,15,750,3,1000\n"
    );
  });

  it("quotes commas, quotes, and newlines", () => {
    const csv = panelToCsv({
      key: "x",
      title: "x",
      note: null,
      columns: ["a"],
      rows: [['he said "hi", twice\nline2']],
    });
    expect(csv).toBe('a\n"he said ""hi"", twice\nline2"\n');
  });
});

describe("read-only surface", () => {
  it("the analytics module defines no action — POSTs never mutate", () => {
    expect(analytics.action).toBeUndefined();
    expect(analytics.guestActions).toBeUndefined();
  });
});
