/**
 * MA10 acceptance: every discovery builder is limited to public + published
 * apps and to MA7-safe public metadata. The negative cases — drafts,
 * suspended, private, unlisted rows, and non-public fields — are the point.
 */
import { describe, expect, it } from "vitest";
import { makeApp } from "@/app/mini/loader-test-utils";
import {
  agentMd,
  buildIndex,
  discoverable,
  etagFor,
  jsonLd,
  llmsTxt,
  robotsTxt,
  searchIndex,
  sitemapXml,
} from "./discovery";

const publicApp = makeApp({
  slug: "kanban",
  name: "Kanban",
  description: "Boards for your agent",
  visibility: "public",
  status: "published",
  publisher_username: null,
  updated_at: "2026-02-01T00:00:00.000Z",
});

const paidApp = makeApp({
  slug: "alice-notes",
  name: "Notes",
  description: "Paid notes",
  visibility: "public",
  status: "published",
  owner_user_id: "user-alice",
  publisher_username: "alice",
  publisher_wallet: "0xdeadbeef00000000000000000000000000000000",
  x402_enabled: true,
  x402_price_usdc: 1.5,
  password_hash: null,
  updated_at: "2026-03-01T00:00:00.000Z",
});

const draftApp = makeApp({ slug: "bob-draft", visibility: "public", status: "draft" });
const suspendedApp = makeApp({
  slug: "bob-gone",
  visibility: "public",
  status: "suspended",
});
const privateApp = makeApp({ slug: "vault", visibility: "private" });
const unlistedApp = makeApp({
  slug: "carol-secret",
  visibility: "unlisted",
  status: "published",
});

const all = [publicApp, paidApp, draftApp, suspendedApp, privateApp, unlistedApp];

describe("discoverable", () => {
  it("admits only public + published rows", () => {
    expect(discoverable(publicApp)).toBe(true);
    expect(discoverable(paidApp)).toBe(true);
    for (const app of [draftApp, suspendedApp, privateApp, unlistedApp]) {
      expect(discoverable(app)).toBe(false);
    }
  });
});

describe("buildIndex", () => {
  it("carries MA7 fields only — no wallet, hash, icon, or resource ids", () => {
    const entries = buildIndex(all);
    expect(entries.map((e) => e.slug)).toEqual(["alice-notes", "kanban"]);
    const paid = entries[0]!;
    expect(Object.keys(paid).sort()).toEqual([
      "access",
      "description",
      "gates",
      "name",
      "publisher",
      "slug",
      "updated_at",
      "url",
    ]);
    expect(paid.publisher).toEqual({ username: "alice", agent_identity: null });
    expect(paid.gates).toEqual({
      password: false,
      x402: { price_usdc: 1.5 },
      plugin_signin: false,
    });
    const serialized = JSON.stringify(entries);
    expect(serialized).not.toContain("0xdeadbeef");
    expect(serialized).not.toContain("password_hash");
    expect(serialized).not.toContain("owner_user_id");
    expect(serialized).not.toContain("user-alice");
  });

  it("never includes draft, suspended, private, or unlisted apps", () => {
    const serialized = JSON.stringify(buildIndex(all));
    for (const slug of ["bob-draft", "bob-gone", "vault", "carol-secret"]) {
      expect(serialized).not.toContain(slug);
    }
  });
});

describe("etagFor", () => {
  it("is stable for identical bodies and quoted", () => {
    expect(etagFor("abc")).toBe(etagFor("abc"));
    expect(etagFor("abc")).not.toBe(etagFor("abd"));
    expect(etagFor("abc")).toMatch(/^".+"$/);
  });
});

describe("searchIndex", () => {
  it("matches on name/description/slug/publisher, public rows only", () => {
    expect(searchIndex(all, "boards").map((e) => e.slug)).toEqual(["kanban"]);
    expect(searchIndex(all, "ALICE").map((e) => e.slug)).toEqual([
      "alice-notes",
    ]);
    expect(searchIndex(all, "").map((e) => e.slug)).toEqual([
      "alice-notes",
      "kanban",
    ]);
    expect(searchIndex(all, "secret")).toEqual([]);
    expect(searchIndex(all, "draft")).toEqual([]);
    expect(searchIndex(all, "vault")).toEqual([]);
  });
});

describe("llmsTxt", () => {
  it("lists public apps with agent.md links and prices, nothing else", () => {
    const body = llmsTxt(all);
    expect(body).toContain("/store/kanban/agent.md");
    expect(body).toContain("($1.5 USDC)");
    expect(body).toContain("/api/store/index.json");
    for (const slug of ["bob-draft", "bob-gone", "vault", "carol-secret"]) {
      expect(body).not.toContain(slug);
    }
    expect(body).not.toContain("0xdeadbeef");
  });
});

describe("sitemapXml", () => {
  it("holds home + public detail pages only, with lastmod", () => {
    const xml = sitemapXml(all);
    expect(xml).toContain("<loc>https://mini.wzrd.tech/</loc>");
    expect(xml).toContain("<loc>https://mini.wzrd.tech/store/kanban</loc>");
    expect(xml).toContain("<lastmod>2026-02-01T00:00:00.000Z</lastmod>");
    for (const slug of ["bob-draft", "bob-gone", "vault", "carol-secret"]) {
      expect(xml).not.toContain(slug);
    }
  });
});

describe("robotsTxt", () => {
  it("allows store surfaces, disallows app views, links the sitemap", () => {
    const body = robotsTxt();
    expect(body).toContain("Allow: /store/");
    expect(body).toContain("Allow: /llms.txt");
    expect(body).toContain("Disallow: /");
    expect(body).toContain("Sitemap: https://mini.wzrd.tech/sitemap.xml");
  });
});

describe("agentMd", () => {
  it("describes gates, the open flow, and declared actions", () => {
    const md = agentMd(paidApp, ["add_note", "list_notes"]);
    expect(md).toContain("# Notes");
    expect(md).toContain("$1.5 USDC");
    expect(md).toContain("X-PAYMENT");
    expect(md).toContain("https://mini.wzrd.tech/alice-notes");
    expect(md).toContain("- `add_note`");
    expect(md).not.toContain("0xdeadbeef");
  });

  it("marks ungated apps as free", () => {
    expect(agentMd(publicApp, [])).toContain("Free: sign in");
  });
});

describe("jsonLd", () => {
  it("emits SoftwareApplication with a USDC Offer for x402 apps", () => {
    const ld = jsonLd(paidApp) as {
      "@type": string;
      offers: { price: string; priceCurrency: string };
      author: { name: string };
    };
    expect(ld["@type"]).toBe("SoftwareApplication");
    expect(ld.offers).toMatchObject({ price: "1.5", priceCurrency: "USDC" });
    expect(ld.author.name).toBe("alice");
    expect(JSON.stringify(ld)).not.toContain("0xdeadbeef");
  });

  it("emits a zero-price Offer for free apps", () => {
    const ld = jsonLd(publicApp) as { offers: { price: string } };
    expect(ld.offers.price).toBe("0");
  });
});
