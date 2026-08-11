/**
 * CM7 task 1: the ecommerce persona. The connected store's catalog (Shopify
 * via Composio — token custody stays with Composio, goal.md M7) is the
 * source of moments: a launch expands into the teaser → reveal → detail →
 * social proof → last call sequence; low stock becomes a single urgency
 * post. Proposals only — nothing here publishes (CM7 task 4).
 */
import {
  brandConstraints,
  type BriefStep,
  type CalendarSource,
  type DateRange,
  type Moment,
  type SourceDeps,
} from "./source";
import type { BrandSource } from "@/lib/brand/types";

export const LOW_STOCK_THRESHOLD = 5;

interface ShopifyProduct {
  id?: string | number;
  title?: string;
  handle?: string;
  status?: string;
  created_at?: string;
  published_at?: string | null;
  variants?: Array<{ price?: string; inventory_quantity?: number }>;
}

function asProducts(result: unknown): ShopifyProduct[] {
  if (result === null || typeof result !== "object") return [];
  const data = (result as { data?: unknown }).data ?? result;
  if (data === null || typeof data !== "object") return [];
  const products = (data as { products?: unknown }).products;
  return Array.isArray(products) ? (products as ShopifyProduct[]) : [];
}

function entityFor(product: ShopifyProduct): Record<string, string> {
  const variant = product.variants?.[0];
  return {
    product: product.title ?? "",
    handle: product.handle ?? "",
    ...(variant?.price ? { price: variant.price } : {}),
  };
}

function totalInventory(product: ShopifyProduct): number | null {
  const variants = product.variants ?? [];
  if (variants.length === 0) return null;
  let total = 0;
  for (const variant of variants) {
    if (typeof variant.inventory_quantity !== "number") return null;
    total += variant.inventory_quantity;
  }
  return total;
}

export const ecommerceSource: CalendarSource = {
  id: "ecommerce",

  async candidates(deps: SourceDeps): Promise<string[]> {
    const { data } = await deps.supabase
      .from("connections")
      .select("user_id")
      .eq("toolkit", "shopify")
      .eq("status", "active")
      .limit(500);
    return (data ?? []).map((row) => row.user_id as string);
  },

  async enabled(deps: SourceDeps, userId: string): Promise<boolean> {
    const { data } = await deps.supabase
      .from("connections")
      .select("status")
      .eq("user_id", userId)
      .eq("toolkit", "shopify")
      .eq("status", "active")
      .maybeSingle();
    return data !== null;
  },

  async moments(
    deps: SourceDeps,
    userId: string,
    window: DateRange
  ): Promise<Moment[]> {
    const result = await deps.executeTool("SHOPIFY_GET_PRODUCTS", userId, {
      status: "active",
      limit: 50,
    });
    const moments: Moment[] = [];
    for (const product of asProducts(result)) {
      if (!product.id || !product.title) continue;
      const publishedAt = product.published_at ?? product.created_at;
      if (publishedAt) {
        const at = new Date(publishedAt);
        if (at >= window.start && at <= window.end) {
          moments.push({
            key: `launch:${product.id}`,
            kind: "launch",
            label: `Launch: ${product.title}`,
            occursAt: at,
            timezone: "UTC",
            entity: entityFor(product),
          });
        }
      }
      const inventory = totalInventory(product);
      if (inventory !== null && inventory > 0 && inventory <= LOW_STOCK_THRESHOLD) {
        moments.push({
          key: `low_stock:${product.id}:${inventory}`,
          kind: "low_stock",
          label: `Low stock (${inventory} left): ${product.title}`,
          occursAt: new Date(),
          timezone: "UTC",
          entity: { ...entityFor(product), remaining: String(inventory) },
        });
      }
    }
    return moments;
  },

  brief(moment: Moment, brand: BrandSource | null): BriefStep[] {
    const constraints = brandConstraints(brand);
    const product = moment.entity.product ?? "the product";
    const price = moment.entity.price ? ` (${moment.entity.price})` : "";
    if (moment.kind === "low_stock") {
      return [
        {
          step: "last-units",
          platform: "instagram",
          offsetHours: 0,
          brief:
            `Create a single urgency post: only ${moment.entity.remaining} of ` +
            `${product} left. Honest scarcity, no fake countdowns.${constraints}`,
        },
      ];
    }
    // The launch sequence (CM7 task 1): pre-populated, user edits.
    return [
      {
        step: "teaser",
        platform: "instagram",
        offsetHours: -24,
        brief: `Tease that something new is coming — mood only, do not name ${product} yet.${constraints}`,
      },
      {
        step: "reveal",
        platform: "instagram",
        offsetHours: 0,
        brief: `Reveal ${product}${price}: hero shot, name it, one-line hook.${constraints}`,
      },
      {
        step: "detail",
        platform: "instagram",
        offsetHours: 24,
        brief: `Show ${product} in detail: materials, close-ups, what makes it different.${constraints}`,
      },
      {
        step: "social-proof",
        platform: "instagram",
        offsetHours: 72,
        brief: `Social proof for ${product}: early reactions or styled in-use shots. No fabricated reviews.${constraints}`,
      },
      {
        step: "last-call",
        platform: "instagram",
        offsetHours: 120,
        brief: `Last call for the ${product} launch window — direct, single CTA.${constraints}`,
      },
    ];
  },
};
