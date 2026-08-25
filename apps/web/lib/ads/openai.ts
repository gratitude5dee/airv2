/**
 * ChatGPT Ads Advertiser API adapter (CM6 tier 1, per Phase 0 V1 —
 * docs/verify-creative.md). Keys are issued in Ads Manager and scoped to one
 * ad account; ours live sealed in `ad_accounts.api_key_sealed` and are
 * opened server-side only — no key ever reaches a box or browser.
 * Citation: https://developers.openai.com/ads (verified 2026-08-10).
 */
import { env } from "../env";
import { openSecret } from "../crypto/secretbox";
import { asRecord } from "../records";

const BASE_URL = "https://api.ads.openai.com/v1";

export class OpenAIAdsError extends Error {
  constructor(
    message: string,
    readonly status: number | null = null
  ) {
    super(message);
  }
}

export function openAdsKey(sealed: string): string {
  const key = env.adsVaultKey();
  if (!key) throw new OpenAIAdsError("ads vault key unavailable");
  return openSecret(sealed, key);
}

/**
 * The Advertiser API prices in micros (`*_micros`); Postgres stores cents
 * (`daily_budget_cents` convention, 0014_ads.sql). Convert exactly at this
 * boundary — raw micros never leave the adapter.
 */
export const MICROS_PER_CENT = 10_000;

export function centsToMicros(cents: number): number {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new OpenAIAdsError(`bad cents value: ${cents}`);
  }
  return cents * MICROS_PER_CENT;
}

export function microsToCents(micros: number): number {
  if (!Number.isFinite(micros) || micros < 0) {
    throw new OpenAIAdsError(`bad micros value: ${micros}`);
  }
  return Math.round(micros / MICROS_PER_CENT);
}

async function adsFetch(
  apiKey: string,
  method: "GET" | "POST" | "PATCH",
  path: string,
  body?: unknown,
  idempotencyKey?: string
): Promise<unknown> {
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${apiKey}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(idempotencyKey ? { "idempotency-key": idempotencyKey } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!response.ok) {
    await response.body?.cancel();
    throw new OpenAIAdsError(`ads api ${path} failed`, response.status);
  }
  return response.json();
}

export interface CreatedCampaign {
  campaignRef: string;
}

/** Callers speak cents (`lifetime_spend_limit_cents`); the wire field is
 * `lifetime_spend_limit_micros`. Any stray `*_cents` key is dropped so raw
 * cents never reach the API and raw micros never leave it. */
function campaignPayload(args: Record<string, unknown>): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...args };
  const cents = payload["lifetime_spend_limit_cents"];
  delete payload["lifetime_spend_limit_cents"];
  delete payload["daily_budget_cents"];
  if (typeof cents === "number") {
    payload["lifetime_spend_limit_micros"] = centsToMicros(cents);
  }
  return payload;
}

export async function createCampaign(
  apiKey: string,
  args: Record<string, unknown>,
  idempotencyKey?: string
): Promise<CreatedCampaign> {
  // The idempotency key (derived from the ad_writes row id) makes a retried
  // approval after an ambiguous failure return the same campaign instead of
  // creating a duplicate.
  const result = (await adsFetch(
    apiKey,
    "POST",
    "/campaigns",
    campaignPayload(args),
    idempotencyKey
  )) as {
    id?: string;
  };
  if (!result.id) throw new OpenAIAdsError("campaign create returned no id");
  return { campaignRef: result.id };
}

export async function updateCampaign(
  apiKey: string,
  campaignRef: string,
  args: Record<string, unknown>,
  idempotencyKey?: string
): Promise<void> {
  await adsFetch(
    apiKey,
    "PATCH",
    `/campaigns/${encodeURIComponent(campaignRef)}`,
    campaignPayload(args),
    idempotencyKey
  );
}

/** Connect verification: the account the key is scoped to, including
 * `review.status`. */
export interface AdAccountInfo {
  id: string;
  name: string | null;
  reviewStatus: string | null;
}

export async function getAdAccount(apiKey: string): Promise<AdAccountInfo> {
  const result = (await adsFetch(apiKey, "GET", "/ad_account")) as {
    id?: string;
    name?: string;
    review?: { status?: string };
  };
  if (!result.id) throw new OpenAIAdsError("ad account returned no id");
  return {
    id: result.id,
    name: result.name ?? null,
    reviewStatus: result.review?.status ?? null,
  };
}

/** Creative upload — not spend-mutating, so ungated (C22). JSON `image_url`
 * for remote assets; multipart for local bytes. */
export async function uploadAsset(
  apiKey: string,
  source: { image_url: string } | { bytes: Uint8Array; filename: string }
): Promise<{ fileId: string }> {
  let result: { file_id?: string; id?: string };
  if ("image_url" in source) {
    result = (await adsFetch(apiKey, "POST", "/upload", {
      image_url: source.image_url,
    })) as { file_id?: string; id?: string };
  } else {
    const form = new FormData();
    form.append(
      "file",
      new Blob([source.bytes as BlobPart]),
      source.filename
    );
    const response = await fetch(`${BASE_URL}/upload`, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: form,
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new OpenAIAdsError("ads api /upload failed", response.status);
    }
    result = (await response.json()) as { file_id?: string; id?: string };
  }
  const fileId = result.file_id ?? result.id;
  if (!fileId) throw new OpenAIAdsError("upload returned no file id");
  return { fileId };
}

/** List envelope shared by /campaigns and /insights reads. */
export interface ListEnvelope<T> {
  data: T[];
  hasMore: boolean;
}

function asListEnvelope<T>(result: unknown): ListEnvelope<T> {
  const record = (result ?? {}) as { data?: T[]; has_more?: boolean };
  return {
    data: Array.isArray(record.data) ? record.data : [],
    hasMore: record.has_more === true,
  };
}

export async function listCampaigns(
  apiKey: string,
  options: { limit?: number; after?: string } = {}
): Promise<ListEnvelope<Record<string, unknown>>> {
  const params = new URLSearchParams();
  if (options.limit) params.set("limit", String(options.limit));
  if (options.after) params.set("after", options.after);
  const query = params.size > 0 ? `?${params}` : "";
  return asListEnvelope(await adsFetch(apiKey, "GET", `/campaigns${query}`));
}

export async function getCampaign(
  apiKey: string,
  campaignRef: string
): Promise<Record<string, unknown>> {
  return (
    asRecord(
      await adsFetch(apiKey, "GET", `/campaigns/${encodeURIComponent(campaignRef)}`)
    ) ?? {}
  );
}

export interface AdGroupArgs {
  campaignId: string;
  name: string;
  status?: "active" | "paused";
  contextHints?: string[];
  /** Converted to `max_bid_micros` at this boundary. */
  maxBidCents?: number;
}

function adGroupPayload(args: Partial<AdGroupArgs>): Record<string, unknown> {
  return {
    ...(args.campaignId ? { campaign_id: args.campaignId } : {}),
    ...(args.name ? { name: args.name } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.contextHints ? { context_hints: args.contextHints } : {}),
    ...(args.maxBidCents !== undefined
      ? {
          bidding_config: {
            billing_event_type: "impression",
            max_bid_micros: centsToMicros(args.maxBidCents),
          },
        }
      : {}),
  };
}

export async function createAdGroup(
  apiKey: string,
  args: AdGroupArgs,
  idempotencyKey?: string
): Promise<{ adGroupRef: string }> {
  const result = (await adsFetch(
    apiKey,
    "POST",
    "/ad_groups",
    adGroupPayload(args),
    idempotencyKey
  )) as { id?: string };
  if (!result.id) throw new OpenAIAdsError("ad group create returned no id");
  return { adGroupRef: result.id };
}

export async function updateAdGroup(
  apiKey: string,
  adGroupRef: string,
  args: Partial<AdGroupArgs>,
  idempotencyKey?: string
): Promise<void> {
  await adsFetch(
    apiKey,
    "PATCH",
    `/ad_groups/${encodeURIComponent(adGroupRef)}`,
    adGroupPayload(args),
    idempotencyKey
  );
}

export interface ChatCardCreative {
  title: string;
  body: string;
  targetUrl: string;
  fileId?: string;
}

export interface AdArgs {
  adGroupId: string;
  name?: string | undefined;
  status?: "active" | "paused" | undefined;
  creative?: ChatCardCreative | undefined;
}

function adPayload(args: Partial<AdArgs>): Record<string, unknown> {
  return {
    ...(args.adGroupId ? { ad_group_id: args.adGroupId } : {}),
    ...(args.name ? { name: args.name } : {}),
    ...(args.status ? { status: args.status } : {}),
    ...(args.creative
      ? {
          creative: {
            type: "chat_card",
            title: args.creative.title,
            body: args.creative.body,
            target_url: args.creative.targetUrl,
            ...(args.creative.fileId ? { file_id: args.creative.fileId } : {}),
          },
        }
      : {}),
  };
}

export async function createAd(
  apiKey: string,
  args: AdArgs,
  idempotencyKey?: string
): Promise<{ adRef: string; reviewStatus: string | null }> {
  const result = (await adsFetch(
    apiKey,
    "POST",
    "/ads",
    adPayload(args),
    idempotencyKey
  )) as { id?: string; review_status?: string };
  if (!result.id) throw new OpenAIAdsError("ad create returned no id");
  return { adRef: result.id, reviewStatus: result.review_status ?? null };
}

export async function updateAd(
  apiKey: string,
  adRef: string,
  args: Partial<AdArgs>,
  idempotencyKey?: string
): Promise<void> {
  await adsFetch(
    apiKey,
    "PATCH",
    `/ads/${encodeURIComponent(adRef)}`,
    adPayload(args),
    idempotencyKey
  );
}

/** Reporting reads are allowed without approval (CM6). */
export async function campaignInsights(
  apiKey: string,
  campaignRef: string,
  options: { time_granularity?: string; limit?: number; after?: string } = {}
): Promise<ListEnvelope<Record<string, unknown>> & Record<string, unknown>> {
  const params = new URLSearchParams({
    campaign_id: campaignRef,
  });
  if (options.time_granularity) {
    params.set("time_granularity", options.time_granularity);
  }
  if (options.limit) params.set("limit", String(options.limit));
  if (options.after) params.set("after", options.after);
  const result = await adsFetch(apiKey, "GET", `/insights?${params}`);
  return {
    ...(asRecord(result) ?? {}),
    ...asListEnvelope<Record<string, unknown>>(result),
  };
}

export async function adInsights(
  apiKey: string,
  adRef: string,
  options: { time_granularity?: string; limit?: number; after?: string } = {}
): Promise<ListEnvelope<Record<string, unknown>>> {
  const params = new URLSearchParams();
  if (options.time_granularity) {
    params.set("time_granularity", options.time_granularity);
  }
  if (options.limit) params.set("limit", String(options.limit));
  if (options.after) params.set("after", options.after);
  const query = params.size > 0 ? `?${params}` : "";
  return asListEnvelope(
    await adsFetch(
      apiKey,
      "GET",
      `/ads/${encodeURIComponent(adRef)}/insights${query}`
    )
  );
}
