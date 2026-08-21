/**
 * MA8 catalog: the source of truth is box-side at
 * .hermes/miniapps/shop/catalog.json (the agent edits it conversationally
 * via shop_update). Publishing projects PUBLIC listing data only into
 * storefront_products — price, name, image on R2, inventory (C4 kept:
 * published listing data is public by definition). Publication is a
 * decision: the agent can stage, only the owner approves.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { readAppState } from "../miniapps/store";
import { CommerceError } from "./merchants";

export const PRODUCT_KINDS = [
  "physical",
  "digital",
  "service",
  "event_ticket",
] as const;
export type ProductKind = (typeof PRODUCT_KINDS)[number];

export interface CatalogItem {
  key: string;
  kind: ProductKind;
  name: string;
  description: string;
  imageUrl: string | null;
  priceCents: number;
  inventory: number | null;
  active: boolean;
}

export interface StorefrontProduct {
  id: string;
  user_id: string;
  product_key: string;
  kind: ProductKind;
  name: string;
  description: string;
  image_url: string | null;
  price_cents: number;
  inventory: number | null;
  active: boolean;
}

export const PRODUCT_COLUMNS =
  "id, user_id, product_key, kind, name, description, image_url, " +
  "price_cents, inventory, active";

const KEY_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

function isProductKind(value: unknown): value is ProductKind {
  return PRODUCT_KINDS.includes(value as ProductKind);
}

/** Validate a selected storefront_products row before using it for checkout. */
export function parseStorefrontProduct(
  value: unknown
): StorefrontProduct | null {
  if (typeof value !== "object" || value === null) return null;
  const row = value as Record<string, unknown>;
  if (
    typeof row.id !== "string" ||
    typeof row.user_id !== "string" ||
    typeof row.product_key !== "string" ||
    !isProductKind(row.kind) ||
    typeof row.name !== "string" ||
    typeof row.description !== "string" ||
    (row.image_url !== null && typeof row.image_url !== "string") ||
    typeof row.price_cents !== "number" ||
    !Number.isInteger(row.price_cents) ||
    (row.inventory !== null &&
      (typeof row.inventory !== "number" ||
        !Number.isInteger(row.inventory))) ||
    typeof row.active !== "boolean"
  ) {
    return null;
  }
  return {
    id: row.id,
    user_id: row.user_id,
    product_key: row.product_key,
    kind: row.kind,
    name: row.name,
    description: row.description,
    image_url: row.image_url,
    price_cents: row.price_cents,
    inventory: row.inventory,
    active: row.active,
  };
}

/** Only public R2 URLs may be projected — never signed/private links. */
function publicImageUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length === 0) return null;
  return value.startsWith(env.r2PublicBaseUrl()) ? value : null;
}

/** Validate one raw catalog entry into a projectable item, or null. */
export function sanitizeCatalogItem(raw: unknown): CatalogItem | null {
  if (raw === null || typeof raw !== "object") return null;
  const item = raw as Record<string, unknown>;
  const key = typeof item.key === "string" ? item.key.toLowerCase() : "";
  if (!KEY_RE.test(key)) return null;
  const kind = item.kind as ProductKind;
  if (!PRODUCT_KINDS.includes(kind)) return null;
  const name = typeof item.name === "string" ? item.name.trim().slice(0, 200) : "";
  if (!name) return null;
  const priceCents = item.priceCents;
  if (
    typeof priceCents !== "number" ||
    !Number.isInteger(priceCents) ||
    priceCents <= 0 ||
    priceCents > 100_000_00
  ) {
    return null;
  }
  const inventory =
    typeof item.inventory === "number" &&
    Number.isInteger(item.inventory) &&
    item.inventory >= 0
      ? item.inventory
      : null;
  return {
    key,
    kind,
    name,
    description:
      typeof item.description === "string"
        ? item.description.slice(0, 2000)
        : "",
    imageUrl: publicImageUrl(item.imageUrl),
    priceCents,
    inventory,
    active: item.active !== false,
  };
}

/** Read + validate the box-side catalog. */
export async function readCatalog(
  supabase: SupabaseClient,
  userId: string
): Promise<CatalogItem[]> {
  const raw = await readAppState(supabase, userId, "shop", "catalog");
  const items =
    raw !== null && typeof raw === "object" && Array.isArray((raw as { items?: unknown }).items)
      ? ((raw as { items: unknown[] }).items)
      : [];
  const out: CatalogItem[] = [];
  const seen = new Set<string>();
  for (const entry of items.slice(0, 200)) {
    const item = sanitizeCatalogItem(entry);
    if (!item || seen.has(item.key)) continue;
    seen.add(item.key);
    out.push(item);
  }
  return out;
}

/**
 * Stage a catalog publish: file a shop_publish decision (one pending per
 * user — restaging must not pile up Needs-you items). Nothing is projected
 * until the owner approves.
 */
export async function requestCatalogPublish(
  supabase: SupabaseClient,
  userId: string
): Promise<{ decisionId: string; staged: boolean }> {
  const { data: pending } = await supabase
    .from("decisions")
    .select("id")
    .eq("user_id", userId)
    .eq("kind", "shop_publish")
    .eq("status", "pending")
    .maybeSingle();
  if (pending) return { decisionId: pending.id as string, staged: false };
  const { data: decision, error } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "shop_publish",
      ref: "catalog",
      label: "Publish your shop catalog",
      payload: {},
    })
    .select("id")
    .single();
  if (error || !decision) {
    throw new CommerceError("could not stage the catalog publish", 500);
  }
  return { decisionId: decision.id as string, staged: true };
}

/**
 * Owner-approved projection: read the box catalog and upsert the public
 * rows; catalog entries that disappeared are deactivated (their orders keep
 * their history via the FK).
 */
export async function applyCatalogPublish(
  supabase: SupabaseClient,
  userId: string
): Promise<number> {
  const items = await readCatalog(supabase, userId);
  const now = new Date().toISOString();
  for (const item of items) {
    const { error } = await supabase.from("storefront_products").upsert(
      {
        user_id: userId,
        product_key: item.key,
        kind: item.kind,
        name: item.name,
        description: item.description,
        image_url: item.imageUrl,
        price_cents: item.priceCents,
        inventory: item.inventory,
        active: item.active,
        updated_at: now,
      },
      { onConflict: "user_id,product_key" }
    );
    if (error) {
      throw new CommerceError(`catalog publish failed: ${error.message}`, 500);
    }
  }
  const keys = items.map((item) => item.key);
  if (keys.length > 0) {
    await supabase
      .from("storefront_products")
      .update({ active: false, updated_at: now })
      .eq("user_id", userId)
      .not("product_key", "in", `(${keys.join(",")})`);
  } else {
    await supabase
      .from("storefront_products")
      .update({ active: false, updated_at: now })
      .eq("user_id", userId);
  }
  return items.length;
}

/** Public listing for the storefront page: active products only. */
export async function listPublishedProducts(
  supabase: SupabaseClient,
  userId: string
): Promise<StorefrontProduct[]> {
  const { data } = await supabase
    .from("storefront_products")
    .select(PRODUCT_COLUMNS)
    .eq("user_id", userId)
    .eq("active", true)
    .order("published_at", { ascending: true });
  return (data ?? [])
    .map(parseStorefrontProduct)
    .filter((product): product is StorefrontProduct => product !== null);
}

export async function getPublishedProduct(
  supabase: SupabaseClient,
  userId: string,
  productKey: string
): Promise<StorefrontProduct | null> {
  const { data } = await supabase
    .from("storefront_products")
    .select(PRODUCT_COLUMNS)
    .eq("user_id", userId)
    .eq("product_key", productKey)
    .eq("active", true)
    .maybeSingle();
  return parseStorefrontProduct(data);
}
