/**
 * Shopify catalog sync (Phase 3): products live in storefront_products; a
 * box-side skill (`shopify-sync`) mirrors them to the owner's Shopify via
 * the Shopify CLI and reports the external ids back here. Each product's
 * `external_refs` map holds provider refs — value-free ids and URLs only,
 * never credentials (tokens stay in the owner's vault managers, C23).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { CommerceError } from "./merchants";

export interface ExternalRef {
  external_id: string;
  url?: string;
  synced_at?: string;
}

/**
 * Record the Shopify-side id for a product (upsert under `external_refs.
 * shopify`). The whole refs map is read-then-written under the product row —
 * concurrent writers for different providers keep each other's keys.
 */
export async function upsertExternalRef(
  supabase: SupabaseClient,
  userId: string,
  productKey: string,
  provider: "shopify",
  ref: ExternalRef
): Promise<void> {
  const { data: product, error: readError } = await supabase
    .from("storefront_products")
    .select("id, external_refs")
    .eq("user_id", userId)
    .eq("product_key", productKey)
    .maybeSingle();
  if (readError) {
    throw new CommerceError("could not read the product", 500);
  }
  if (!product) throw new CommerceError("product not found", 404);
  const refs =
    (product["external_refs"] as Record<string, unknown> | null) ?? {};
  refs[provider] = {
    external_id: ref.external_id,
    ...(ref.url ? { url: ref.url } : {}),
    synced_at: ref.synced_at ?? new Date().toISOString(),
  };
  const { error } = await supabase
    .from("storefront_products")
    .update({ external_refs: refs, updated_at: new Date().toISOString() })
    .eq("id", product["id"])
    .eq("user_id", userId);
  if (error) throw new CommerceError("could not record the Shopify id", 500);
}

/** Products + their external refs for the box-side sync skill. */
export async function listProductsWithRefs(
  supabase: SupabaseClient,
  userId: string
): Promise<
  Array<{
    product_key: string;
    name: string;
    price_cents: number;
    description: string | null;
    image_url: string | null;
    active: boolean;
    external_refs: Record<string, unknown>;
  }>
> {
  const { data, error } = await supabase
    .from("storefront_products")
    .select(
      "product_key, name, price_cents, description, image_url, active, external_refs"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (error) {
    throw new CommerceError("could not list the catalog", 500);
  }
  return (data ?? []).map((row) => ({
    product_key: row["product_key"] as string,
    name: row["name"] as string,
    price_cents: row["price_cents"] as number,
    description: (row["description"] as string | null) ?? null,
    image_url: (row["image_url"] as string | null) ?? null,
    active: row["active"] as boolean,
    external_refs:
      (row["external_refs"] as Record<string, unknown> | null) ?? {},
  }));
}
