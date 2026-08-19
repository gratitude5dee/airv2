/**
 * MA8 merchants: Stripe Connect Standard onboarding. Publishers connect
 * their OWN Stripe account — the platform creates the account link, records
 * the account id + capability flags, and is never in the money path.
 * charges_enabled flows in via signed `account.updated` webhooks only.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";
import { createAccountLink, createConnectAccount } from "../payments/stripe";

export class CommerceError extends Error {
  constructor(
    message: string,
    readonly status: number
  ) {
    super(message);
    this.name = "CommerceError";
  }
}

export interface Merchant {
  user_id: string;
  stripe_account_id: string;
  charges_enabled: boolean;
  details_submitted: boolean;
}

const MERCHANT_COLUMNS =
  "user_id, stripe_account_id, charges_enabled, details_submitted";

export async function getMerchant(
  supabase: SupabaseClient,
  userId: string
): Promise<Merchant | null> {
  const { data } = await supabase
    .from("merchants")
    .select(MERCHANT_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Merchant | null) ?? null;
}

/**
 * Start (or resume) Standard onboarding: create the connected account on
 * first call, then mint a fresh hosted account link. Returns the URL the
 * owner is redirected to; status flips arrive on `account.updated`.
 */
export async function startOnboarding(
  supabase: SupabaseClient,
  userId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<string> {
  let merchant = await getMerchant(supabase, userId);
  if (!merchant) {
    const accountId = await createConnectAccount();
    const { data, error } = await supabase
      .from("merchants")
      .insert({ user_id: userId, stripe_account_id: accountId })
      .select(MERCHANT_COLUMNS)
      .single();
    if (error || !data) {
      throw new CommerceError("could not record the merchant account", 500);
    }
    merchant = data as Merchant;
  }
  return await createAccountLink(
    merchant.stripe_account_id,
    refreshUrl,
    returnUrl
  );
}

/**
 * `account.updated` webhook: sync capability flags by connected-account id
 * (never client input). When charges become enabled the merchant's public
 * storefront row is auto-provisioned.
 */
export async function syncAccountFromEvent(
  supabase: SupabaseClient,
  account: Stripe.Account
): Promise<void> {
  const { data } = await supabase
    .from("merchants")
    .update({
      charges_enabled: account.charges_enabled === true,
      details_submitted: account.details_submitted === true,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", account.id)
    .select("user_id")
    .maybeSingle();
  if (data && account.charges_enabled === true) {
    await ensureStorefrontRow(supabase, data.user_id as string);
  }
}

/**
 * Auto-provision the merchant's public storefront registry row at
 * `<username>-shop` — a first-party-rendered published app (goal.md MA8 c).
 * If the slug already exists (e.g. the user published a bundle app named
 * "shop"), leave it: slugs are unique and theirs.
 */
export async function ensureStorefrontRow(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: user } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const username = (user?.username as string | null) ?? null;
  if (!username) return null;
  const slug = `${username}-shop`;
  const { data: existing } = await supabase
    .from("mini_apps")
    .select("id, owner_user_id")
    .eq("slug", slug)
    .maybeSingle();
  if (existing) return slug;
  await supabase.from("mini_apps").insert({
    slug,
    kind: "render",
    owner_user_id: userId,
    publisher_username: username,
    name: `${username}'s shop`,
    description: `Storefront by ${username}`,
    visibility: "public",
    access: "single",
    status: "published",
    listed_at: new Date().toISOString(),
  });
  return slug;
}

/** The storefront slug for a merchant, if their row exists. */
export async function storefrontSlug(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const { data: user } = await supabase
    .from("users")
    .select("username")
    .eq("id", userId)
    .maybeSingle();
  const username = (user?.username as string | null) ?? null;
  if (!username) return null;
  const slug = `${username}-shop`;
  const { data } = await supabase
    .from("mini_apps")
    .select("id")
    .eq("slug", slug)
    .eq("owner_user_id", userId)
    .maybeSingle();
  return data ? slug : null;
}
