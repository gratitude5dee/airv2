/**
 * M14 tasks 5–6: the two ingest paths into `ad_metrics_daily` (0019).
 * OpenAI metrics are pulled control-plane-side with the per-account sealed
 * key; Meta metrics are pushed by the box (the control plane holds no Meta
 * credential) and validated as hostile input (C9). Both paths upsert by the
 * table's unique key, so replays are idempotent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  adInsights,
  campaignInsights,
  listCampaigns,
  microsToCents,
  openAdsKey,
} from "./openai";
import { armStopAfter, ensureBoxAwake } from "../orchestrator/boxes";
import { createRun } from "../hermes/client";

export const MAX_PUSH_ROWS = 200;
export const MAX_METRIC_AGE_DAYS = 90;
/** Sanity bound on any pushed counter — beyond this is garbage, not data. */
const MAX_COUNT = 1_000_000_000_000;
const METRIC_LEVELS = ["account", "campaign", "ad_group", "ad"] as const;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type MetricLevel = (typeof METRIC_LEVELS)[number];

export interface NormalizedMetricRow {
  account_id: string;
  user_id: string;
  provider: "meta" | "openai";
  level: MetricLevel;
  entity_ref: string;
  metric_date: string;
  impressions: number;
  clicks: number;
  spend_cents: number;
  conversions: number;
  conversion_value_cents: number;
}

export class MetricsValidationError extends Error {}

function boundedInt(value: unknown, field: string): number {
  const n = Number(value ?? 0);
  if (!Number.isInteger(n) || n < 0 || n > MAX_COUNT) {
    throw new MetricsValidationError(`bad ${field}`);
  }
  return n;
}

function validDate(value: unknown): string {
  if (typeof value !== "string" || !DATE_RE.test(value)) {
    throw new MetricsValidationError("bad metric_date");
  }
  const time = Date.parse(`${value}T00:00:00Z`);
  if (Number.isNaN(time)) throw new MetricsValidationError("bad metric_date");
  const now = Date.now();
  if (time > now) throw new MetricsValidationError("future metric_date");
  if (time < now - MAX_METRIC_AGE_DAYS * 24 * 60 * 60 * 1000) {
    throw new MetricsValidationError("metric_date too old");
  }
  return value;
}

/**
 * Validate a pushed batch in full before any write — a payload with one bad
 * row writes nothing. The tenant is the authenticated box's owner: rows may
 * name one of that user's own active Meta accounts (`account_ref`); no field
 * in the body can point at another user's account.
 */
/** Loose pushed-row shape: box-pushed metrics are hostile input, so fields
 * stay unknown and are validated below. */
const PushedRowSchema = z.object({
  provider: z.unknown(),
  level: z.unknown(),
  entity_ref: z.unknown(),
  account_ref: z.unknown(),
  metric_date: z.unknown(),
  impressions: z.unknown(),
  clicks: z.unknown(),
  spend_cents: z.unknown(),
  conversions: z.unknown(),
  conversion_value_cents: z.unknown(),
});

export function validatePushedRows(
  body: unknown,
  userId: string,
  metaAccounts: { id: string; account_ref: string }[]
): NormalizedMetricRow[] {
  const rows = (body as { rows?: unknown })?.rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new MetricsValidationError("rows required");
  }
  if (rows.length > MAX_PUSH_ROWS) {
    throw new MetricsValidationError(`more than ${MAX_PUSH_ROWS} rows`);
  }
  return rows.map((raw) => {
    const parsed = PushedRowSchema.safeParse(raw);
    const row: z.infer<typeof PushedRowSchema> = parsed.success
      ? parsed.data
      : {};
    if (row.provider !== "meta") {
      throw new MetricsValidationError("bad provider");
    }
    if (!METRIC_LEVELS.includes(row.level as MetricLevel)) {
      throw new MetricsValidationError("bad level");
    }
    const entityRef =
      typeof row.entity_ref === "string" ? row.entity_ref.trim() : "";
    if (!entityRef || entityRef.length > 128) {
      throw new MetricsValidationError("bad entity_ref");
    }
    let account: { id: string; account_ref: string } | undefined =
      metaAccounts[0];
    if (typeof row.account_ref === "string" && row.account_ref) {
      account = metaAccounts.find((a) => a.account_ref === row.account_ref);
    } else if (metaAccounts.length > 1) {
      throw new MetricsValidationError("account_ref required");
    }
    if (!account) throw new MetricsValidationError("unknown account_ref");
    return {
      account_id: account.id,
      user_id: userId,
      provider: "meta",
      level: row.level as MetricLevel,
      entity_ref: entityRef,
      metric_date: validDate(row.metric_date),
      impressions: boundedInt(row.impressions, "impressions"),
      clicks: boundedInt(row.clicks, "clicks"),
      spend_cents: boundedInt(row.spend_cents, "spend_cents"),
      conversions: boundedInt(row.conversions, "conversions"),
      conversion_value_cents: boundedInt(
        row.conversion_value_cents,
        "conversion_value_cents"
      ),
    };
  });
}

/** Idempotent landing: replaying a batch rewrites the same rows. */
export async function upsertMetricRows(
  supabase: SupabaseClient,
  rows: NormalizedMetricRow[]
): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase.from("ad_metrics_daily").upsert(
    rows.map((row) => ({ ...row, fetched_at: new Date().toISOString() })),
    { onConflict: "account_id,level,entity_ref,metric_date" }
  );
  if (error) throw new Error(`ad_metrics_daily upsert failed: ${error.message}`);
}

/** Last-3-days window: late attribution rewrites recent days on each pull. */
const PULL_WINDOW_DAYS = 3;
const PAGE_LIMIT = 100;
const MAX_PAGES = 10;

const InsightRowSchema = z.object({
  date: z.unknown(),
  metric_date: z.unknown(),
  impressions: z.unknown(),
  clicks: z.unknown(),
  spend_micros: z.unknown(),
  spend: z.unknown(),
  conversions: z.unknown(),
  conversion_value_micros: z.unknown(),
  conversion_value: z.unknown(),
});

function pulledRow(
  base: Omit<
    NormalizedMetricRow,
    | "entity_ref"
    | "metric_date"
    | "level"
    | "impressions"
    | "clicks"
    | "spend_cents"
    | "conversions"
    | "conversion_value_cents"
  >,
  level: MetricLevel,
  entityRef: string,
  raw: unknown
): NormalizedMetricRow | null {
  const parsedInsight = InsightRowSchema.safeParse(raw);
  const insight: z.infer<typeof InsightRowSchema> = parsedInsight.success
    ? parsedInsight.data
    : {};
  const date =
    typeof insight.date === "string"
      ? insight.date
      : typeof insight.metric_date === "string"
        ? insight.metric_date
        : null;
  if (!date || !DATE_RE.test(date)) return null;
  const cutoff = new Date(Date.now() - PULL_WINDOW_DAYS * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  if (date < cutoff) return null;
  const int = (value: unknown): number => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) && n >= 0 ? Math.round(n) : 0;
  };
  // Spend arrives in micros; cents land in Postgres — never raw micros.
  const cents = (value: unknown): number => {
    const n = Number(value ?? 0);
    return Number.isFinite(n) && n >= 0 ? microsToCents(n) : 0;
  };
  return {
    ...base,
    level,
    entity_ref: entityRef,
    metric_date: date,
    impressions: int(insight.impressions),
    clicks: int(insight.clicks),
    spend_cents: cents(insight.spend_micros ?? insight.spend),
    conversions: int(insight.conversions),
    conversion_value_cents: cents(
      insight.conversion_value_micros ?? insight.conversion_value
    ),
  };
}

/**
 * Control-plane pull for every active OpenAI account: daily campaign and ad
 * insights for the last 3 days, upserted by the unique key. Ad refs come
 * from executed `create_ad` writes — the only ads that exist through us.
 */
export async function ingestOpenAiMetrics(
  supabase: SupabaseClient
): Promise<{ accounts: number; rows: number }> {
  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, user_id, api_key_sealed")
    .eq("provider", "openai")
    .eq("status", "active")
    .not("api_key_sealed", "is", null);
  let totalRows = 0;
  let pulled = 0;
  for (const account of accounts ?? []) {
    try {
      const apiKey = openAdsKey(account.api_key_sealed as string);
      const base = {
        account_id: account.id as string,
        user_id: account.user_id as string,
        provider: "openai" as const,
      };
      const rows: NormalizedMetricRow[] = [];

      const campaignRefs: string[] = [];
      let after: string | undefined;
      for (let page = 0; page < MAX_PAGES; page++) {
        const envelope = await listCampaigns(apiKey, {
          limit: PAGE_LIMIT,
          ...(after ? { after } : {}),
        });
        for (const campaign of envelope.data) {
          if (typeof campaign["id"] === "string") campaignRefs.push(campaign["id"]);
        }
        const last = envelope.data[envelope.data.length - 1];
        after = typeof last?.["id"] === "string" ? last["id"] : undefined;
        if (!envelope.hasMore || !after) break;
      }
      for (const campaignRef of campaignRefs) {
        const insights = await campaignInsights(apiKey, campaignRef, {
          time_granularity: "daily",
          limit: PAGE_LIMIT,
        });
        for (const insight of insights.data) {
          const row = pulledRow(base, "campaign", campaignRef, insight);
          if (row) rows.push(row);
        }
      }

      const { data: adWrites } = await supabase
        .from("ad_writes")
        .select("result")
        .eq("account_id", account.id)
        .eq("kind", "create_ad")
        .eq("status", "executed");
      const adRefs = [
        ...new Set(
          (adWrites ?? [])
            .map((w) => {
              const result = z
                .object({ ad_ref: z.unknown() })
                .safeParse(w.result);
              return result.success ? result.data.ad_ref : undefined;
            })
            .filter((ref): ref is string => typeof ref === "string" && !!ref)
        ),
      ];
      for (const adRef of adRefs) {
        const insights = await adInsights(apiKey, adRef, {
          time_granularity: "daily",
          limit: PAGE_LIMIT,
        });
        for (const insight of insights.data) {
          const row = pulledRow(base, "ad", adRef, insight);
          if (row) rows.push(row);
        }
      }

      await upsertMetricRows(supabase, rows);
      totalRows += rows.length;
      pulled += 1;
    } catch (error) {
      // One account's failure must not starve the rest of the sweep.
      console.error(
        JSON.stringify({
          msg: "openai metrics pull failed",
          account_id: account.id,
          error: error instanceof Error ? error.message : "unknown",
        })
      );
    }
  }
  return { accounts: pulled, rows: totalRows };
}

/** Skip enqueueing when Meta metrics already landed within this window. */
const META_REPORT_COOLDOWN_MS = 20 * 60 * 60 * 1000;

/**
 * Meta metrics travel box-side (the OAuth lives in the box's MCP), so the
 * cron enqueues one Hermes run per Meta-connected user per day telling the
 * agent to run its ads-reporting skill. The run lands in a dedicated
 * `ads-reporting` session — never MAIN_SESSION — so the user's chat thread
 * is not polluted.
 */
export async function enqueueMetaReporting(
  supabase: SupabaseClient
): Promise<{ enqueued: number }> {
  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("user_id")
    .eq("provider", "meta")
    .eq("status", "active");
  const userIds = [...new Set((accounts ?? []).map((a) => a.user_id as string))];
  let enqueued = 0;
  for (const userId of userIds) {
    try {
      const { data: recent } = await supabase
        .from("ad_metrics_daily")
        .select("fetched_at")
        .eq("user_id", userId)
        .eq("provider", "meta")
        .order("fetched_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (
        recent?.fetched_at &&
        Date.now() - Date.parse(recent.fetched_at as string) <
          META_REPORT_COOLDOWN_MS
      ) {
        continue;
      }
      const box = await ensureBoxAwake(supabase, userId);
      await createRun(box.target, {
        input:
          "Run your ads-reporting skill for yesterday: fetch yesterday's Meta ads insights via the Meta Ads MCP reporting tools and post them to the control plane as the skill describes.",
        sessionId: "ads-reporting",
        metadata: { trigger: "ads-reporting-cron" },
      });
      await armStopAfter(supabase, userId);
      enqueued += 1;
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "ads-reporting enqueue failed",
          user_id: userId,
          error: error instanceof Error ? error.message : "unknown",
        })
      );
    }
  }
  return { enqueued };
}
