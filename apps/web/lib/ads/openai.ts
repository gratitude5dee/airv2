/**
 * ChatGPT Ads Advertiser API adapter (CM6 tier 1, per Phase 0 V1 —
 * docs/verify-creative.md). Keys are issued in Ads Manager and scoped to one
 * ad account; ours live sealed in `ad_accounts.api_key_sealed` and are
 * opened server-side only — no key ever reaches a box or browser.
 * Citation: https://developers.openai.com/ads (verified 2026-08-10).
 */
import { env } from "../env";
import { openSecret } from "../crypto/secretbox";

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
    args,
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
  args: Record<string, unknown>
): Promise<void> {
  await adsFetch(
    apiKey,
    "PATCH",
    `/campaigns/${encodeURIComponent(campaignRef)}`,
    args
  );
}

/** Reporting reads are allowed without approval (CM6). */
export async function campaignInsights(
  apiKey: string,
  campaignRef: string
): Promise<unknown> {
  return adsFetch(
    apiKey,
    "GET",
    `/insights?campaign_id=${encodeURIComponent(campaignRef)}`
  );
}
