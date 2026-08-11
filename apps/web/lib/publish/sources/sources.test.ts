import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ecommerceSource } from "./ecommerce";
import { touringSource } from "./touring";
import { allSources, sourceFor } from "./index";
import type { Moment, SourceDeps } from "./source";
import type { BrandSource } from "@/lib/brand/types";

const BRAND: BrandSource = {
  name: "acme",
  label: "Acme",
  palette: { background: "#000", midground: "#111", foreground: "#fff" },
  voice: { register: "casual", banned: ["synergy"] },
  claims: { forbidden: ["cures anxiety"] },
};

function depsWithProducts(products: unknown[]): SourceDeps {
  return {
    supabase: {} as SupabaseClient,
    executeTool: async () => ({ data: { products } }),
  };
}

describe("source registry", () => {
  it("exposes both sources and rejects prototype keys", () => {
    expect(allSources().map((s) => s.id).sort()).toEqual([
      "ecommerce",
      "touring",
    ]);
    expect(sourceFor("ecommerce")?.id).toBe("ecommerce");
    expect(sourceFor("toString")).toBeNull();
    expect(sourceFor("constructor")).toBeNull();
  });
});

describe("ecommerce source", () => {
  const window = {
    start: new Date("2026-08-01T00:00:00Z"),
    end: new Date("2026-08-20T00:00:00Z"),
  };

  it("turns a newly published product into a launch moment", async () => {
    const deps = depsWithProducts([
      {
        id: 111,
        title: "Solar Jacket",
        handle: "solar-jacket",
        published_at: "2026-08-09T12:00:00Z",
        variants: [{ price: "180.00", inventory_quantity: 40 }],
      },
    ]);
    const moments = await ecommerceSource.moments(deps, "u1", window);
    expect(moments).toHaveLength(1);
    expect(moments[0]!.kind).toBe("launch");
    expect(moments[0]!.key).toBe("launch:111");
    expect(moments[0]!.entity.product).toBe("Solar Jacket");
  });

  it("emits a low-stock moment at or below the threshold", async () => {
    const deps = depsWithProducts([
      {
        id: 7,
        title: "Cap",
        published_at: "2026-01-01T00:00:00Z", // outside window: no launch
        variants: [{ inventory_quantity: 3 }],
      },
    ]);
    const moments = await ecommerceSource.moments(deps, "u1", window);
    expect(moments).toHaveLength(1);
    expect(moments[0]!.kind).toBe("low_stock");
    expect(moments[0]!.entity.remaining).toBe("3");
  });

  it("ignores malformed tool output", async () => {
    const deps: SourceDeps = {
      supabase: {} as SupabaseClient,
      executeTool: async () => "not an object",
    };
    expect(await ecommerceSource.moments(deps, "u1", window)).toEqual([]);
  });

  it("expands a launch into the five-step sequence with brand constraints", () => {
    const moment: Moment = {
      key: "launch:111",
      kind: "launch",
      label: "Launch: Solar Jacket",
      occursAt: new Date("2026-08-09T12:00:00Z"),
      timezone: "UTC",
      entity: { product: "Solar Jacket", price: "180.00" },
    };
    const steps = ecommerceSource.brief(moment, BRAND);
    expect(steps.map((s) => s.step)).toEqual([
      "teaser",
      "reveal",
      "detail",
      "social-proof",
      "last-call",
    ]);
    expect(steps[0]!.offsetHours).toBeLessThan(0); // teaser precedes the drop
    for (const step of steps) {
      expect(step.brief).toContain('"synergy"');
    }
  });
});

describe("touring source", () => {
  it("makes every brief city-scoped, naming the venue and metro", () => {
    const moment: Moment = {
      key: "day_of:t1",
      kind: "day_of",
      label: "day of: Nova at The Wiltern, Los Angeles",
      occursAt: new Date("2026-09-01T03:00:00Z"),
      timezone: "America/Los_Angeles",
      entity: {
        artist: "Nova",
        venue: "The Wiltern",
        city: "Los Angeles",
        metro: "Los Angeles DMA",
      },
    };
    for (const kind of ["announce", "on_sale", "week_of", "day_of", "post_show"]) {
      const steps = touringSource.brief({ ...moment, kind }, null);
      expect(steps).toHaveLength(1);
      expect(steps[0]!.brief).toContain("The Wiltern");
      expect(steps[0]!.brief).toContain("Los Angeles DMA");
    }
  });
});
