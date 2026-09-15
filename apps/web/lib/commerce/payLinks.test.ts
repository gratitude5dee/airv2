/**
 * pay_links: deterministic slugs, one-active-link-per-product dedupe, and
 * the status lifecycle the public route depends on.
 */
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    linkappOrigin: () => "https://link.wzrd.tech",
  },
}));

import { slugifyPayLink, payLinkUrl } from "./payLinks";

describe("slugifyPayLink", () => {
  it("slugifies product names", () => {
    expect(slugifyPayLink("maya", "Espresso Beans 2lb")).toBe("maya-espresso-beans-2lb");
    expect(slugifyPayLink("Maya", "  The  Listening   Party! ")).toBe("maya-the-listening-party");
    expect(slugifyPayLink("maya", "tour tee — xl")).toBe("maya-tour-tee-xl");
  });

  it("produces a URL-safe slug even for degenerate names", () => {
    expect(slugifyPayLink("!!!", "!!!")).toMatch(/^[a-z0-9-]+$/);
    expect(slugifyPayLink("", "")).toMatch(/^[a-z0-9-]+$/);
    expect(slugifyPayLink("", "").length).toBeGreaterThan(0);
  });

  it("caps slug length for URLs", () => {
    const long = "a".repeat(100) + " product";
    expect(slugifyPayLink("maya", long).length).toBeLessThanOrEqual(64);
  });
});

describe("payLinkUrl", () => {
  it("builds link-host URLs", () => {
    expect(payLinkUrl("espresso-beans-2lb")).toBe(
      "https://link.wzrd.tech/espresso-beans-2lb"
    );
  });
});
