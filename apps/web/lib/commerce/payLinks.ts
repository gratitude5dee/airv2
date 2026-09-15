/**
 * Payment links (Phase 3): link.wzrd.tech/<slug> product pages — a short,
 * shareable URL per published product that lands on the existing Connect
 * Checkout (card + Link inbound). Slugs are unique, owner-managed, and the
 * public surface reads only `active` rows plus the product's published
 * fields — never the owner's ids, Stripe account, or margins.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { CommerceError } from "./merchants";

export interface PayLink {
  id: string;
  user_id: string;
  product_id: string;
  slug: string;
  status: "active" | "paused";
  views: number;
  checkouts: number;
  created_at: string;
  updated_at: string;
}

export interface PayLinkProduct {
  product_key: string;
  name: string;
  description: string | null;
  image_url: string | null;
  price_cents: number;
  kind: string;
  inventory: number | null;
  active: boolean;
}

const PAY_LINK_COLUMNS =
  "id, user_id, product_id, slug, status, views, checkouts, created_at, updated_at";
const PRODUCT_COLUMNS =
  "id, user_id, product_key, kind, name, description, image_url, price_cents, inventory, active";
const SLUG_RE = /^[a-z0-9][a-z0-9-]{1,63}[a-z0-9]$/;
const SLUG_TAKEN = "23505";

function hydrate(row: Record<string, unknown>): PayLink {
  return {
    id: row["id"] as string,
    user_id: row["user_id"] as string,
    product_id: row["product_id"] as string,
    slug: row["slug"] as string,
    status: row["status"] as PayLink["status"],
    views: (row["views"] as number) ?? 0,
    checkouts: (row["checkouts"] as number) ?? 0,
    created_at: row["created_at"] as string,
    updated_at: row["updated_at"] as string,
  };
}

function hydrateProduct(row: Record<string, unknown> | null): PayLinkProduct | null {
  if (!row) return null;
  return {
    product_key: row["product_key"] as string,
    name: row["name"] as string,
    description: (row["description"] as string | null) ?? null,
    image_url: (row["image_url"] as string | null) ?? null,
    price_cents: row["price_cents"] as number,
    kind: row["kind"] as string,
    inventory: (row["inventory"] as number | null) ?? null,
    active: row["active"] as boolean,
  };
}

export function slugifyPayLink(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .replace(/-+$/g, "");
  return base.length >= 3 ? base : `${base}-link`;
}

export function payLinkUrl(slug: string): string {
  return `${env.linkappOrigin()}/${slug}`;
}

/**
 * Public read: an active link + its product. Paused links and unpublished
 * products are a 404 to buyers — the public surface never confirms a
 * product exists without an active link.
 */
export async function getPayLinkBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<{ link: PayLink; product: PayLinkProduct } | null> {
  if (!SLUG_RE.test(slug)) return null;
  const { data, error } = await supabase
    .from("pay_links")
    .select(`${PAY_LINK_COLUMNS}, storefront_products(${PRODUCT_COLUMNS})`)
    .eq("slug", slug)
    .eq("status", "active")
    .maybeSingle();
  if (error || !data) return null;
  const product = hydrateProduct(
    (data["storefront_products"] as unknown as Record<string, unknown> | null) ??
      null
  );
  if (!product || !product.active) return null;
  return { link: hydrate(data), product };
}

export async function listPayLinks(
  supabase: SupabaseClient,
  userId: string
): Promise<Array<PayLink & { product: PayLinkProduct | null }>> {
  const { data, error } = await supabase
    .from("pay_links")
    .select(`${PAY_LINK_COLUMNS}, storefront_products(${PRODUCT_COLUMNS})`)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    throw new CommerceError("could not read payment links", 500);
  }
  return (data ?? []).map((row) => ({
    ...hydrate(row),
    product: hydrateProduct(
      (row["storefront_products"] as unknown as Record<
        string,
        unknown
      > | null) ?? null
    ),
  }));
}

/**
 * Create a link for a published product. One active link per product (the
 * product_id unique index enforces it) — a second create returns the
 * existing row, which keeps copy-link idempotent.
 */
export async function createPayLink(
  supabase: SupabaseClient,
  userId: string,
  productId: string
): Promise<PayLink> {
  const { data: existing } = await supabase
    .from("pay_links")
    .select(PAY_LINK_COLUMNS)
    .eq("user_id", userId)
    .eq("product_id", productId)
    .maybeSingle();
  if (existing) return hydrate(existing);

  const { data: product } = await supabase
    .from("storefront_products")
    .select(PRODUCT_COLUMNS)
    .eq("id", productId)
    .eq("user_id", userId)
    .maybeSingle();
  const parsed = hydrateProduct(product ?? null);
  if (!parsed || !parsed.active) {
    throw new CommerceError("product not found or unpublished", 404);
  }
  const base = slugifyPayLink(parsed.name);
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const slug = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const { data, error } = await supabase
      .from("pay_links")
      .insert({ user_id: userId, product_id: productId, slug })
      .select(PAY_LINK_COLUMNS)
      .single();
    if (!error && data) return hydrate(data);
    if (error?.code === SLUG_TAKEN) {
      // Either the slug collided (retry with suffix) or the product's link
      // already exists (concurrent create) — re-read the product row.
      const { data: raced } = await supabase
        .from("pay_links")
        .select(PAY_LINK_COLUMNS)
        .eq("user_id", userId)
        .eq("product_id", productId)
        .maybeSingle();
      if (raced) return hydrate(raced);
      continue;
    }
    throw new CommerceError("could not create the payment link", 500);
  }
  throw new CommerceError("could not find a free slug — name the product differently", 409);
}

export async function setPayLinkStatus(
  supabase: SupabaseClient,
  userId: string,
  id: string,
  status: "active" | "paused"
): Promise<void> {
  const { error } = await supabase
    .from("pay_links")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new CommerceError("could not update the payment link", 500);
}

export async function deletePayLink(
  supabase: SupabaseClient,
  userId: string,
  id: string
): Promise<void> {
  const { error } = await supabase
    .from("pay_links")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) throw new CommerceError("could not delete the payment link", 500);
}

/** Public counters — best-effort increments, never on the money path. */
export async function recordPayLinkEvent(
  supabase: SupabaseClient,
  id: string,
  field: "views" | "checkouts"
): Promise<void> {
  const { data } = await supabase
    .from("pay_links")
    .select("views, checkouts")
    .eq("id", id)
    .maybeSingle();
  if (!data) return;
  const current = (data[field] as number) ?? 0;
  await supabase
    .from("pay_links")
    .update({ [field]: current + 1 })
    .eq("id", id);
}
