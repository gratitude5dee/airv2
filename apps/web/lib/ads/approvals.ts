/**
 * CM6 CC0: every ad write is a proposal. The interceptor is a real control,
 * not a prompt instruction — a write lands here as a pending `ad_writes` row
 * plus an 'ad_write' decision whose card carries the ad account, campaign,
 * daily budget, total 30-day exposure, and the exact requested changes.
 * Nothing executes from 'pending'; approval runs the ceiling check and only
 * then executes (OpenAI: control-plane API call; Meta: the box's MCP write
 * is released by the approved gate).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { asRecord } from "../records";
import {
  ceilingAllows,
  committedExposureCents,
  exposure30dCents,
  spendCeilingCents,
  type CeilingCheck,
} from "./spend";
import {
  createCampaign,
  updateCampaign,
  createAdGroup,
  createAd,
  updateAd,
  uploadAsset,
  openAdsKey,
  OpenAIAdsError,
  type ChatCardCreative,
} from "./openai";

export type AdWriteKind =
  | "create_campaign"
  | "update_budget"
  | "set_status"
  | "create_ad_group"
  | "create_ad"
  | "update_ad";

/** Kinds that commit new 30-day budget exposure. Ad-group and ad mutations
 * are spend-mutating (they place bids and creative) so they stay gated
 * (C22), but their spend is bounded by the campaign budget the ceiling
 * already counts — they add no exposure of their own. */
const BUDGET_KINDS: AdWriteKind[] = [
  "create_campaign",
  "update_budget",
  "set_status",
];

export interface AdWriteRequest {
  accountId: string;
  kind: AdWriteKind;
  campaignRef?: string | undefined;
  campaignName?: string | undefined;
  dailyBudgetCents?: number | undefined;
  status?: "active" | "paused" | undefined;
  args?: Record<string, unknown> | undefined;
}

export interface AdAccount {
  id: string;
  provider: "meta" | "openai";
  account_ref: string;
  api_key_sealed: string | null;
}

export class AdWriteError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

/** The additional 30-day exposure a write commits if approved. Pauses and
 * budget decreases commit nothing; resumes recommit the campaign's budget;
 * a budget change commits only the increase over the campaign's current
 * budget (which committedExposureCents already counts). */
export function requestedExposureCents(
  kind: AdWriteKind,
  dailyBudgetCents: number,
  status: "active" | "paused" | undefined,
  currentDailyBudgetCents = 0
): number {
  if (!BUDGET_KINDS.includes(kind)) return 0;
  if (kind === "set_status") {
    return status === "active" ? exposure30dCents(dailyBudgetCents) : 0;
  }
  if (kind === "update_budget") {
    return exposure30dCents(
      Math.max(0, dailyBudgetCents - currentDailyBudgetCents)
    );
  }
  return exposure30dCents(dailyBudgetCents);
}

/**
 * Loose write-args shape: names the fields the approval path reads while
 * `.passthrough()` keeps the rest, since create_campaign forwards the whole
 * args object to the platform call.
 */
const WriteArgsSchema = z
  .object({
    parent_write_id: z.unknown(),
    ad_group_ref: z.unknown(),
    ad_ref: z.unknown(),
    name: z.unknown(),
    context_hints: z.unknown(),
    max_bid_cents: z.unknown(),
    image_url: z.unknown(),
    status: z.unknown(),
    creative: z.unknown(),
  })
  .passthrough();

type WriteArgs = z.infer<typeof WriteArgsSchema>;

function parseWriteArgs(value: unknown): WriteArgs {
  const parsed = WriteArgsSchema.safeParse(value);
  return parsed.success ? parsed.data : {};
}

export async function requestAdWrite(
  supabase: SupabaseClient,
  userId: string,
  request: AdWriteRequest
): Promise<{ writeId: string; decisionId: string }> {
  const { data: account } = await supabase
    .from("ad_accounts")
    .select("id, provider, account_ref, api_key_sealed")
    .eq("id", request.accountId)
    .eq("user_id", userId)
    .eq("status", "active")
    .maybeSingle();
  if (!account) throw new AdWriteError("ad account not found", 404);

  const args = parseWriteArgs(request.args ?? {});
  if (
    (request.kind === "update_budget" || request.kind === "set_status") &&
    !request.campaignRef
  ) {
    throw new AdWriteError("campaign_ref required", 400);
  }
  if (
    request.kind === "create_ad_group" &&
    !request.campaignRef &&
    typeof args.parent_write_id !== "string"
  ) {
    throw new AdWriteError("campaign_ref or parent_write_id required", 400);
  }
  if (
    request.kind === "create_ad" &&
    typeof args.ad_group_ref !== "string" &&
    typeof args.parent_write_id !== "string"
  ) {
    throw new AdWriteError("ad_group_ref or parent_write_id required", 400);
  }
  if (request.kind === "update_ad" && typeof args.ad_ref !== "string") {
    throw new AdWriteError("ad_ref required", 400);
  }
  let dailyBudgetCents = request.dailyBudgetCents ?? 0;
  let currentDailyBudgetCents = 0;
  if (BUDGET_KINDS.includes(request.kind) && request.kind !== "create_campaign" && request.campaignRef) {
    const { data: campaign } = await supabase
      .from("ad_campaigns")
      .select("daily_budget_cents")
      .eq("account_id", account.id)
      .eq("campaign_ref", request.campaignRef)
      .maybeSingle();
    currentDailyBudgetCents = Number(campaign?.daily_budget_cents ?? 0);
  }
  if (request.kind === "set_status" && request.status === "active") {
    // A resume commits the campaign's real budget. If the campaign was never
    // mirrored, the caller must state the budget — an unknown budget must
    // not price the resume at zero and slip past the ceiling.
    dailyBudgetCents =
      currentDailyBudgetCents > 0
        ? currentDailyBudgetCents
        : (request.dailyBudgetCents ?? 0);
    if (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents <= 0) {
      throw new AdWriteError(
        "daily_budget_cents required to resume an untracked campaign",
        409
      );
    }
  }
  if (
    (request.kind === "create_campaign" || request.kind === "update_budget") &&
    (!Number.isInteger(dailyBudgetCents) || dailyBudgetCents <= 0)
  ) {
    throw new AdWriteError("daily_budget_cents required", 400);
  }

  const exposure = requestedExposureCents(
    request.kind,
    dailyBudgetCents,
    request.status,
    currentDailyBudgetCents
  );
  const { data: write, error } = await supabase
    .from("ad_writes")
    .insert({
      user_id: userId,
      account_id: account.id,
      kind: request.kind,
      campaign_ref: request.campaignRef ?? null,
      args: {
        ...(request.args ?? {}),
        ...(request.campaignName ? { name: request.campaignName } : {}),
        ...(request.status ? { status: request.status } : {}),
      },
      daily_budget_cents: dailyBudgetCents || null,
      exposure_30d_cents: exposure,
    })
    .select("id")
    .single();
  if (error || !write) throw new AdWriteError("write insert failed", 500);

  // The decision card names the money: account, campaign, daily budget,
  // 30-day exposure, and the exact requested changes (CM6 task 3).
  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "ad_write",
      platform: account.provider,
      ref: write.id,
      label: `${request.kind} on ${account.provider} ${account.account_ref}`,
      payload: {
        provider: account.provider,
        account_ref: account.account_ref,
        campaign_ref: request.campaignRef ?? null,
        campaign_name: request.campaignName ?? null,
        write_kind: request.kind,
        daily_budget_cents: dailyBudgetCents || null,
        exposure_30d_cents: exposure,
        changes: request.args ?? {},
        status: request.status ?? null,
      },
    })
    .select("id")
    .single();
  if (decisionError || !decision) {
    throw new AdWriteError("decision insert failed", 500);
  }
  return { writeId: write.id, decisionId: decision.id };
}

async function ceilingCheck(
  supabase: SupabaseClient,
  userId: string,
  requestedCents: number
): Promise<CeilingCheck> {
  const [ceiling, committed] = await Promise.all([
    spendCeilingCents(supabase, userId),
    committedExposureCents(supabase, userId),
  ]);
  return ceilingAllows(ceiling, committed, requestedCents);
}

async function mirrorCampaign(
  supabase: SupabaseClient,
  userId: string,
  accountId: string,
  campaignRef: string,
  patch: { name?: string | undefined; daily_budget_cents?: number | undefined; status?: string | undefined }
): Promise<void> {
  const { data: existing } = await supabase
    .from("ad_campaigns")
    .select("id")
    .eq("account_id", accountId)
    .eq("campaign_ref", campaignRef)
    .maybeSingle();
  if (existing) {
    await supabase
      .from("ad_campaigns")
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
  } else {
    await supabase.from("ad_campaigns").insert({
      user_id: userId,
      account_id: accountId,
      campaign_ref: campaignRef,
      name: patch.name ?? null,
      daily_budget_cents: patch.daily_budget_cents ?? 0,
      status: patch.status ?? "active",
    });
  }
}

/** A wizard write may reference the ref its parent write creates (the ad
 * group can't name a campaign that doesn't exist yet). The parent must have
 * executed first — approving out of order refuses with a retryable 409. */
async function parentResultRef(
  supabase: SupabaseClient,
  userId: string,
  parentWriteId: string,
  key: "campaign_ref" | "ad_group_ref"
): Promise<string> {
  const { data: parent } = await supabase
    .from("ad_writes")
    .select("id, status, result")
    .eq("id", parentWriteId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!parent) throw new AdWriteError("parent write not found", 404);
  const ref = (asRecord(parent.result) ?? {})[key];
  if (parent.status !== "executed" || typeof ref !== "string" || !ref) {
    throw new AdWriteError("approve the earlier step first", 409);
  }
  return ref;
}

const CreativeRow = z.object({
  title: z.unknown(),
  body: z.unknown(),
  target_url: z.unknown(),
});

function chatCardFromArgs(args: WriteArgs): ChatCardCreative | undefined {
  const creative = CreativeRow.safeParse(args.creative);
  if (!creative.success) return undefined;
  return {
    title: String(creative.data.title ?? ""),
    body: String(creative.data.body ?? ""),
    targetUrl: String(creative.data.target_url ?? ""),
  };
}

/**
 * Approve and execute a pending write. Refuses (without executing anything)
 * when the write would push committed 30-day exposure past the control-plane
 * ceiling — that is the hard, platform-independent limit.
 */
export async function approveAdWrite(
  supabase: SupabaseClient,
  userId: string,
  writeId: string
): Promise<{ outcome: "executed" | "approved"; ceiling?: CeilingCheck }> {
  const { data: write } = await supabase
    .from("ad_writes")
    .select(
      "id, account_id, kind, campaign_ref, args, daily_budget_cents, exposure_30d_cents, status"
    )
    .eq("id", writeId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!write) throw new AdWriteError("write not found", 404);
  if (write.status !== "pending") {
    throw new AdWriteError(`write already ${write.status}`, 409);
  }

  const args = parseWriteArgs(write.args);
  const spendIncreasing =
    write.kind === "create_campaign" ||
    write.kind === "update_budget" ||
    (write.kind === "set_status" && args.status === "active");
  if (spendIncreasing) {
    const check = await ceilingCheck(
      supabase,
      userId,
      Number(write.exposure_30d_cents ?? 0)
    );
    if (!check.allowed) {
      throw new AdWriteError(
        `spend ceiling: ${check.committedCents + check.requestedCents} would exceed ${check.ceilingCents}`,
        403
      );
    }
  }

  const { data: account } = await supabase
    .from("ad_accounts")
    .select("id, provider, account_ref, api_key_sealed")
    .eq("id", write.account_id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!account) throw new AdWriteError("ad account not found", 404);

  if (account.provider === "meta") {
    // Meta writes run in-box through the Meta Ads MCP; approval releases the
    // gate the box polls before invoking the write tool. The approved budget
    // is mirrored here so committedExposureCents and the ceiling sweep see
    // Meta spend too; a create's placeholder ref is reconciled to the real
    // campaign id once the box reports it back.
    const campaignRef =
      (write.campaign_ref as string | null) ?? `write:${write.id}`;
    if (write.kind === "create_campaign") {
      await mirrorCampaign(supabase, userId, account.id, campaignRef, {
        name: typeof args.name === "string" ? args.name : undefined,
        daily_budget_cents: Number(write.daily_budget_cents ?? 0),
        status: "active",
      });
    } else if (write.kind === "update_budget") {
      await mirrorCampaign(supabase, userId, account.id, campaignRef, {
        daily_budget_cents: Number(write.daily_budget_cents ?? 0),
      });
    } else if (write.kind === "set_status") {
      const active = args.status === "active";
      await mirrorCampaign(supabase, userId, account.id, campaignRef, {
        status: active ? "active" : "paused",
        ...(active && Number(write.daily_budget_cents ?? 0) > 0
          ? { daily_budget_cents: Number(write.daily_budget_cents) }
          : {}),
      });
    }
    await supabase
      .from("ad_writes")
      .update({
        status: "approved",
        error: null,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", write.id);
    return { outcome: "approved" };
  }

  if (!account.api_key_sealed) {
    throw new AdWriteError("ad account has no credential", 409);
  }
  const apiKey = openAdsKey(account.api_key_sealed);
  try {
    let campaignRef = write.campaign_ref as string | null;
    let result: Record<string, unknown> = {};
    if (write.kind === "create_ad_group") {
      const campaignId =
        campaignRef ??
        (await parentResultRef(
          supabase,
          userId,
          String(args.parent_write_id),
          "campaign_ref"
        ));
      const created = await createAdGroup(
        apiKey,
        {
          campaignId,
          name: typeof args.name === "string" ? args.name : "Ad group",
          ...(Array.isArray(args.context_hints)
            ? { contextHints: args.context_hints.map(String) }
            : {}),
          ...(typeof args.max_bid_cents === "number"
            ? { maxBidCents: Math.round(args.max_bid_cents) }
            : {}),
        },
        `ad-write-${write.id}`
      );
      campaignRef = campaignId;
      result = { campaign_ref: campaignId, ad_group_ref: created.adGroupRef };
    } else if (write.kind === "create_ad") {
      const adGroupId =
        typeof args.ad_group_ref === "string" && args.ad_group_ref
          ? args.ad_group_ref
          : await parentResultRef(
              supabase,
              userId,
              String(args.parent_write_id),
              "ad_group_ref"
            );
      const creative = chatCardFromArgs(args);
      if (!creative) throw new AdWriteError("creative required", 409);
      if (typeof args.image_url === "string" && args.image_url) {
        const upload = await uploadAsset(apiKey, { image_url: args.image_url });
        creative.fileId = upload.fileId;
      }
      const created = await createAd(
        apiKey,
        {
          adGroupId,
          ...(typeof args.name === "string" ? { name: args.name } : {}),
          creative,
        },
        `ad-write-${write.id}`
      );
      result = {
        ad_group_ref: adGroupId,
        ad_ref: created.adRef,
        review_status: created.reviewStatus,
      };
    } else if (write.kind === "update_ad") {
      const adRef = String(args.ad_ref);
      await updateAd(
        apiKey,
        adRef,
        {
          ...(args.status === "active" || args.status === "paused"
            ? { status: args.status }
            : {}),
          ...(chatCardFromArgs(args)
            ? { creative: chatCardFromArgs(args) }
            : {}),
        },
        `ad-write-${write.id}`
      );
      result = { ad_ref: adRef };
    } else if (write.kind === "create_campaign") {
      const created = await createCampaign(
        apiKey,
        {
          ...args,
          lifetime_spend_limit_cents: Number(
            write.exposure_30d_cents ??
              exposure30dCents(Number(write.daily_budget_cents ?? 0))
          ),
        },
        `ad-write-${write.id}`
      );
      campaignRef = created.campaignRef;
      result = { campaign_ref: campaignRef };
      await mirrorCampaign(supabase, userId, account.id, campaignRef, {
        name: typeof args.name === "string" ? args.name : undefined,
        daily_budget_cents: Number(write.daily_budget_cents ?? 0),
        status: "active",
      });
    } else if (write.kind === "update_budget" && campaignRef) {
      result = { campaign_ref: campaignRef };
      await updateCampaign(
        apiKey,
        campaignRef,
        {
          lifetime_spend_limit_cents: exposure30dCents(
            Number(write.daily_budget_cents ?? 0)
          ),
        },
        `ad-write-${write.id}`
      );
      await mirrorCampaign(supabase, userId, account.id, campaignRef, {
        daily_budget_cents: Number(write.daily_budget_cents ?? 0),
      });
    } else if (write.kind === "set_status" && campaignRef) {
      const status = args.status === "active" ? "active" : "paused";
      result = { campaign_ref: campaignRef };
      await updateCampaign(apiKey, campaignRef, { status });
      await mirrorCampaign(supabase, userId, account.id, campaignRef, {
        status,
        ...(status === "active" && Number(write.daily_budget_cents ?? 0) > 0
          ? { daily_budget_cents: Number(write.daily_budget_cents) }
          : {}),
      });
    }
    await supabase
      .from("ad_writes")
      .update({
        status: "executed",
        error: null,
        campaign_ref: campaignRef,
        result,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", write.id);
    return { outcome: "executed" };
  } catch (error) {
    const message =
      error instanceof OpenAIAdsError ? error.message : "execute failed";
    // A platform failure is retryable: the write stays pending (with the
    // error recorded) so the still-open decision card can be approved again
    // once the transient condition clears.
    await supabase
      .from("ad_writes")
      .update({ error: message })
      .eq("id", write.id);
    throw new AdWriteError(message, 502);
  }
}

export async function dismissAdWrite(
  supabase: SupabaseClient,
  userId: string,
  writeId: string
): Promise<void> {
  await supabase
    .from("ad_writes")
    .update({ status: "dismissed", resolved_at: new Date().toISOString() })
    .eq("id", writeId)
    .eq("user_id", userId)
    .eq("status", "pending");
}
