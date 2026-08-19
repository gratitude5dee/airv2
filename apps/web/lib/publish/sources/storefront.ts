/**
 * MA8 (f) marketing loop: the native storefront as a publish source. The
 * published storefront_products projection is the source of moments — a
 * newly published product expands into a promo sequence, low inventory into
 * one urgency post. Proposals only, like every source: the sweep files
 * content_plan decisions and nothing publishes without owner approval.
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

export const STOREFRONT_LOW_STOCK_THRESHOLD = 5;

interface ProductRow {
  product_key: string;
  name: string;
  price_cents: number;
  inventory: number | null;
  published_at: string;
}

function entityFor(product: ProductRow): Record<string, string> {
  return {
    product: product.name,
    handle: product.product_key,
    price: (product.price_cents / 100).toFixed(2),
  };
}

export const storefrontSource: CalendarSource = {
  id: "storefront",

  async candidates(deps: SourceDeps): Promise<string[]> {
    const { data } = await deps.supabase
      .from("merchants")
      .select("user_id")
      .eq("charges_enabled", true)
      .limit(500);
    return (data ?? []).map((row) => row.user_id as string);
  },

  async enabled(deps: SourceDeps, userId: string): Promise<boolean> {
    const { data } = await deps.supabase
      .from("merchants")
      .select("charges_enabled")
      .eq("user_id", userId)
      .eq("charges_enabled", true)
      .maybeSingle();
    return data !== null;
  },

  async moments(
    deps: SourceDeps,
    userId: string,
    window: DateRange
  ): Promise<Moment[]> {
    const { data } = await deps.supabase
      .from("storefront_products")
      .select("product_key, name, price_cents, inventory, published_at")
      .eq("user_id", userId)
      .eq("active", true)
      .limit(100);
    const moments: Moment[] = [];
    for (const product of (data ?? []) as ProductRow[]) {
      const at = new Date(product.published_at);
      if (at >= window.start && at <= window.end) {
        moments.push({
          key: `shop_launch:${product.product_key}`,
          kind: "launch",
          label: `Launch: ${product.name}`,
          occursAt: at,
          timezone: "UTC",
          entity: entityFor(product),
        });
      }
      if (
        product.inventory !== null &&
        product.inventory > 0 &&
        product.inventory <= STOREFRONT_LOW_STOCK_THRESHOLD
      ) {
        moments.push({
          key: `shop_low_stock:${product.product_key}`,
          kind: "low_stock",
          label: `Low stock (${product.inventory} left): ${product.name}`,
          occursAt: new Date(),
          timezone: "UTC",
          entity: {
            ...entityFor(product),
            remaining: String(product.inventory),
          },
        });
      }
    }
    return moments;
  },

  brief(moment: Moment, brand: BrandSource | null): BriefStep[] {
    const constraints = brandConstraints(brand);
    const product = moment.entity.product ?? "the product";
    if (moment.kind === "low_stock") {
      return [
        {
          step: "urgency",
          platform: "instagram",
          offsetHours: 0,
          brief: `Only ${moment.entity.remaining} left of ${product} — one urgent, honest post pointing at the shop. No fake scarcity beyond the real count.${constraints}`,
        },
      ];
    }
    return [
      {
        step: "teaser",
        platform: "instagram",
        offsetHours: -24,
        brief: `Tease the upcoming drop of ${product} without revealing everything. Use the product imagery.${constraints}`,
      },
      {
        step: "reveal",
        platform: "instagram",
        offsetHours: 0,
        brief: `Announce ${product} is live at $${moment.entity.price ?? ""} with a clear link to the shop.${constraints}`,
      },
      {
        step: "detail",
        platform: "tiktok",
        offsetHours: 24,
        brief: `Show ${product} in detail — what it is, why it matters, how to get it.${constraints}`,
      },
      {
        step: "last_call",
        platform: "x",
        offsetHours: 72,
        brief: `Last-call post for ${product} — direct, short, link to the shop.${constraints}`,
      },
    ];
  },
};
