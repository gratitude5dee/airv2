/**
 * CM8 task 3: daily spend reconciliation. Platform-reported spend lands in
 * spend_reports (the ledger); a campaign whose reported daily spend runs
 * ahead of its mirrored budget raises a 'spend_divergence' decision within
 * the day — budgets edited platform-side, out of band, are exactly the
 * failure this catches. Meta campaigns carry no stored credential (OAuth
 * lives in the box's MCP registration), so reconciliation covers accounts
 * we can read directly: OpenAI today.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { campaignInsights, openAdsKey } from "./openai";

/** A report is divergent when it exceeds the mirrored budget by both this
 * ratio and an absolute floor — small drifts don't page anyone. */
export const DIVERGENCE_RATIO = 1.2;
export const DIVERGENCE_FLOOR_CENTS = 500;

export interface ReconcileResult {
  campaignsChecked: number;
  reportsRecorded: number;
  divergences: number;
}

interface CampaignRow {
  id: string;
  user_id: string;
  account_id: string;
  campaign_ref: string;
  daily_budget_cents: number;
}

export function isDivergent(
  spendCents: number,
  budgetCents: number
): boolean {
  if (spendCents <= DIVERGENCE_FLOOR_CENTS) return false;
  if (budgetCents <= 0) return true; // any spend on a zero-budget mirror
  return spendCents > budgetCents * DIVERGENCE_RATIO;
}

/** Pull the day's spend out of an insights response without trusting its
 * shape: accepts spend as dollars (`spend`) or cents (`spend_cents`). */
export function parseSpendCents(insights: unknown): number | null {
  if (insights === null || typeof insights !== "object") return null;
  const record = insights as Record<string, unknown>;
  const data = (record.data ?? record) as Record<string, unknown>;
  if (typeof data.spend_cents === "number" && Number.isFinite(data.spend_cents)) {
    return Math.round(data.spend_cents);
  }
  const spend =
    typeof data.spend === "number"
      ? data.spend
      : typeof data.spend === "string"
        ? Number(data.spend)
        : NaN;
  if (!Number.isFinite(spend)) return null;
  return Math.round(spend * 100);
}

export async function reconcileSpend(
  supabase: SupabaseClient
): Promise<ReconcileResult> {
  const result: ReconcileResult = {
    campaignsChecked: 0,
    reportsRecorded: 0,
    divergences: 0,
  };
  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("id, user_id, account_id, campaign_ref, daily_budget_cents")
    .eq("status", "active")
    .limit(500);
  if (!campaigns || campaigns.length === 0) return result;

  const accountIds = [...new Set(campaigns.map((c) => c.account_id as string))];
  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, provider, api_key_sealed, status")
    .in("id", accountIds);
  const readable = new Map<string, string>();
  for (const account of accounts ?? []) {
    if (
      account.provider === "openai" &&
      account.status === "active" &&
      account.api_key_sealed
    ) {
      readable.set(account.id as string, account.api_key_sealed as string);
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  for (const campaign of campaigns as CampaignRow[]) {
    const sealed = readable.get(campaign.account_id);
    if (!sealed) continue;
    result.campaignsChecked += 1;
    let spendCents: number | null;
    try {
      const apiKey = openAdsKey(sealed);
      spendCents = parseSpendCents(
        await campaignInsights(apiKey, campaign.campaign_ref)
      );
    } catch {
      continue; // unreadable today; tomorrow's run retries
    }
    if (spendCents === null) continue;

    const { error } = await supabase.from("spend_reports").upsert(
      {
        user_id: campaign.user_id,
        account_id: campaign.account_id,
        campaign_ref: campaign.campaign_ref,
        report_date: today,
        spend_cents: spendCents,
      },
      { onConflict: "account_id,campaign_ref,report_date" }
    );
    if (!error) result.reportsRecorded += 1;

    if (isDivergent(spendCents, campaign.daily_budget_cents)) {
      result.divergences += 1;
      await raiseDivergence(supabase, campaign, spendCents);
    }
  }
  return result;
}

async function raiseDivergence(
  supabase: SupabaseClient,
  campaign: CampaignRow,
  spendCents: number
): Promise<void> {
  const { data: pending } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", campaign.user_id)
    .eq("kind", "spend_divergence")
    .eq("ref", campaign.id)
    .eq("status", "pending")
    .limit(1)
    .maybeSingle();
  if (pending) return;
  await supabase.from("decisions").insert({
    user_id: campaign.user_id,
    kind: "spend_divergence",
    ref: campaign.id,
    label: "Ad spend diverges from the approved budget",
    payload: {
      campaign_ref: campaign.campaign_ref,
      reported_spend_cents: spendCents,
      mirrored_daily_budget_cents: campaign.daily_budget_cents,
    },
  });
}
