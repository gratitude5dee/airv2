/**
 * MA10 discovery routes: index.json, llms.txt, sitemap.xml, robots.txt,
 * agent.md, and the store_search backing tool. Negative acceptance: nothing
 * draft, suspended, private, or unlisted ever appears on any surface, and
 * search requires a valid gateway token.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { makeApp } from "./loader-test-utils";
import type { RegistryApp } from "@/lib/miniapps/registry";

const db: { apps: RegistryApp[]; gatewayToken: string } = {
  apps: [],
  gatewayToken: "gw-token-1",
};

vi.mock("@/lib/supabase", () => ({
  serviceClient: () => ({
    from(table: string) {
      if (table !== "boxes") throw new Error(`unexpected table ${table}`);
      return {
        select() {
          return {
            eq(_col: string, value: string) {
              return {
                async maybeSingle() {
                  return {
                    data:
                      value === db.gatewayToken ? { user_id: "user-1" } : null,
                    error: null,
                  };
                },
              };
            },
          };
        },
      };
    },
  }),
}));

vi.mock("@/lib/miniapps/registry", () => ({
  listPublicApps: async () =>
    db.apps.filter(
      (app) => app.status === "published" && app.visibility === "public"
    ),
  getRegistryApp: async (_supabase: unknown, slug: string) =>
    db.apps.find((app) => app.slug === slug) ?? null,
}));

vi.mock("@/lib/miniapps/appsApi", () => ({
  bundleManifest: async () => ({ actions: ["do_thing"], guestActions: [] }),
}));

import { GET as indexGet } from "@/app/api/store/index.json/route";
import { GET as searchGet } from "@/app/api/store/search/route";
import { GET as llmsGet } from "./llms.txt/route";
import { GET as sitemapGet } from "./sitemap.xml/route";
import { GET as robotsGet } from "./robots.txt/route";
import { GET as agentMdGet } from "./(store)/store/[slug]/agent.md/route";

const seed = () => [
  makeApp({
    slug: "kanban",
    name: "Kanban",
    description: "Boards",
    visibility: "public",
    status: "published",
  }),
  makeApp({
    slug: "alice-notes",
    name: "Notes",
    description: "Paid notes",
    visibility: "public",
    status: "published",
    owner_user_id: "user-alice",
    publisher_username: "alice",
    publisher_wallet: "0xdeadbeef00000000000000000000000000000000",
    bundle_version: "v1",
    x402_enabled: true,
    x402_price_usdc: 2,
  }),
  makeApp({ slug: "bob-draft", visibility: "public", status: "draft" }),
  makeApp({ slug: "vault", visibility: "private", status: "published" }),
  makeApp({ slug: "carol-secret", visibility: "unlisted", status: "published" }),
  makeApp({ slug: "bob-gone", visibility: "public", status: "suspended" }),
];

beforeEach(() => {
  db.apps = seed();
});

const HIDDEN = ["bob-draft", "vault", "carol-secret", "bob-gone"];

function get(url: string, headers?: Record<string, string>): Request {
  return new Request(url, headers ? { headers } : {});
}

describe("GET /api/store/index.json", () => {
  it("returns public+published entries with MA7 fields and cache headers", async () => {
    const res = await indexGet(get("https://mini.wzrd.tech/api/store/index.json"));
    expect(res.status).toBe(200);
    expect(res.headers.get("etag")).toBeTruthy();
    expect(res.headers.get("cache-control")).toContain("public");
    const body = (await res.json()) as { slug: string }[];
    expect(body.map((e) => e.slug)).toEqual(["alice-notes", "kanban"]);
    const raw = JSON.stringify(body);
    for (const slug of HIDDEN) expect(raw).not.toContain(slug);
    expect(raw).not.toContain("0xdeadbeef");
  });

  it("answers 304 to a matching If-None-Match", async () => {
    const first = await indexGet(
      get("https://mini.wzrd.tech/api/store/index.json")
    );
    const etag = first.headers.get("etag") ?? "";
    const second = await indexGet(
      get("https://mini.wzrd.tech/api/store/index.json", {
        "if-none-match": etag,
      })
    );
    expect(second.status).toBe(304);
  });
});

describe("GET /llms.txt", () => {
  it("lists only public apps", async () => {
    const res = await llmsGet(get("https://mini.wzrd.tech/llms.txt"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("kanban");
    for (const slug of HIDDEN) expect(body).not.toContain(slug);
  });
});

describe("GET /sitemap.xml", () => {
  it("lists home + public detail pages only", async () => {
    const res = await sitemapGet(get("https://mini.wzrd.tech/sitemap.xml"));
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("/store/kanban");
    for (const slug of HIDDEN) expect(body).not.toContain(slug);
  });
});

describe("GET /robots.txt", () => {
  it("serves the crawl policy with the sitemap link", async () => {
    const res = await robotsGet();
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Sitemap:");
  });
});

describe("GET /store/<slug>/agent.md", () => {
  const params = (slug: string) => ({ params: Promise.resolve({ slug }) });

  it("serves a markdown card for a public app, with manifest actions", async () => {
    const res = await agentMdGet(
      get("https://mini.wzrd.tech/store/alice-notes/agent.md"),
      params("alice-notes")
    );
    expect(res.status).toBe(200);
    const body = await res.text();
    expect(body).toContain("# Notes");
    expect(body).toContain("- `do_thing`");
    expect(body).not.toContain("0xdeadbeef");
  });

  it("404s draft, private, unlisted, suspended, and unknown slugs", async () => {
    for (const slug of [...HIDDEN, "nope"]) {
      const res = await agentMdGet(
        get(`https://mini.wzrd.tech/store/${slug}/agent.md`),
        params(slug)
      );
      expect(res.status, slug).toBe(404);
    }
  });
});

describe("GET /api/store/search", () => {
  const req = (q: string, token?: string) =>
    new NextRequest(
      `https://air.example/api/store/search?q=${encodeURIComponent(q)}`,
      token ? { headers: { authorization: `Bearer ${token}` } } : undefined
    );

  it("401s without a valid gateway token", async () => {
    expect((await searchGet(req("kanban"))).status).toBe(401);
    expect((await searchGet(req("kanban", "wrong"))).status).toBe(401);
  });

  it("searches public apps only and returns open-ready links", async () => {
    const res = await searchGet(req("notes", "gw-token-1"));
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      results: { slug: string; detail_url: string; agent_md: string }[];
    };
    expect(body.results.map((r) => r.slug)).toEqual(["alice-notes"]);
    expect(body.results[0]!.detail_url).toBe(
      "https://app.wzrd.tech/mini/alice-notes"
    );
    expect(body.results[0]!.agent_md).toBe(
      "https://mini.wzrd.tech/store/alice-notes/agent.md"
    );
  });

  it("never surfaces draft/private/unlisted/suspended apps", async () => {
    for (const q of ["draft", "vault", "secret", "gone"]) {
      const res = await searchGet(req(q, "gw-token-1"));
      const body = (await res.json()) as { results: { slug: string }[] };
      expect(body.results, q).toEqual([]);
    }
  });
});
