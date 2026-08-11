/**
 * CM6: the ceiling sweep. When a user's committed 30-day exposure exceeds
 * their control-plane ceiling (budgets can be edited platform-side, out of
 * band), the sweep pauses their campaigns and raises a 'spend_ceiling'
 * decision — within one sweep, not eventually.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { committedExposureCents, spendCeilingCents } from "./spend";
import { updateCampaign, openAdsKey } from "./openai";

interface ActiveCampaign {
  id: string;
  user_id: string;
  account_id: string;
  campaign_ref: string;
}

export interface SweepResult {
  usersChecked: number;
  usersPaused: number;
}

export async function sweepSpendCeilings(
  supabase: SupabaseClient
): Promise<SweepResult> {
  const { data: campaigns } = await supabase
    .from("ad_campaigns")
    .select("id, user_id, account_id, campaign_ref")
    .eq("status", "active");
  const byUser = new Map<string, ActiveCampaign[]>();
  for (const campaign of (campaigns ?? []) as ActiveCampaign[]) {
    const list = byUser.get(campaign.user_id) ?? [];
    list.push(campaign);
    byUser.set(campaign.user_id, list);
  }

  let usersPaused = 0;
  for (const [userId, userCampaigns] of byUser) {
    const [ceiling, committed] = await Promise.all([
      spendCeilingCents(supabase, userId),
      committedExposureCents(supabase, userId),
    ]);
    if (committed <= ceiling && ceiling > 0) continue;
    usersPaused += 1;
    await pauseAll(supabase, userId, userCampaigns);
    await raiseCeilingDecision(supabase, userId, committed, ceiling);
  }
  return { usersChecked: byUser.size, usersPaused };
}

async function pauseAll(
  supabase: SupabaseClient,
  userId: string,
  campaigns: ActiveCampaign[]
): Promise<void> {
  const accountIds = [...new Set(campaigns.map((c) => c.account_id))];
  const { data: accounts } = await supabase
    .from("ad_accounts")
    .select("id, provider, api_key_sealed")
    .in("id", accountIds)
    .eq("user_id", userId);
  const byId = new Map(
    (accounts ?? []).map((account) => [account.id as string, account])
  );
  for (const campaign of campaigns) {
    const account = byId.get(campaign.account_id);
    // Pausing reduces spend — it is the one write allowed without approval.
    if (account?.provider === "openai" && account.api_key_sealed) {
      try {
        const apiKey = openAdsKey(account.api_key_sealed as string);
        await updateCampaign(apiKey, campaign.campaign_ref, {
          status: "paused",
        });
      } catch {
        // Mirror still flips below; the decision card surfaces the breach.
      }
    }
    await supabase
      .from("ad_campaigns")
      .update({ status: "paused", updated_at: new Date().toISOString() })
      .eq("id", campaign.id);
  }
}

async function raiseCeilingDecision(
  supabase: SupabaseClient,
  userId: string,
  committedCents: number,
  ceilingCents: number
): Promise<void> {
  const { data: pending } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "spend_ceiling")
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return;
  await supabase.from("decisions").insert({
    user_id: userId,
    kind: "spend_ceiling",
    label: "Ad spend ceiling exceeded — campaigns paused",
    payload: {
      committed_30d_cents: committedCents,
      ceiling_cents: ceilingCents,
    },
  });
}
