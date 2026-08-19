/**
 * MA10 discovery: one module builds every public discovery surface —
 * index.json, llms.txt, per-app agent.md, sitemap.xml, robots.txt, and the
 * JSON-LD on the store pages — from the same MA7-safe projection of the
 * registry. Only visibility='public' + status='published' rows ever reach a
 * builder here, and the projection carries only public metadata: no wallets
 * (payTo lives in the 402 challenge, not the listing), no emails, no install
 * counts, no resource ids.
 */
import { createHash } from "node:crypto";
import { env } from "../env";
import type { RegistryApp } from "./registry";

export interface IndexEntry {
  name: string;
  description: string;
  slug: string;
  url: string;
  publisher: { username: string | null; agent_identity: string | null };
  gates: {
    password: boolean;
    x402: { price_usdc: number } | null;
    plugin_signin: boolean;
  };
  access: "single" | "multiplayer";
  updated_at: string;
}

function origin(): string {
  return env.miniappOrigin().replace(/\/$/, "");
}

/** True only for rows allowed on any discovery surface (MA7). */
export function discoverable(app: RegistryApp): boolean {
  return app.status === "published" && app.visibility === "public";
}

export function indexEntry(app: RegistryApp): IndexEntry {
  return {
    name: app.name || app.slug,
    description: app.description,
    slug: app.slug,
    url: `${origin()}/${app.slug}`,
    publisher: {
      username: app.publisher_username,
      agent_identity: app.agent_identity,
    },
    gates: {
      password: Boolean(app.password_hash),
      x402:
        app.x402_enabled && app.x402_price_usdc != null
          ? { price_usdc: Number(app.x402_price_usdc) }
          : null,
      plugin_signin: app.plugin_signin_enabled,
    },
    access: app.access,
    updated_at: app.updated_at,
  };
}

export function buildIndex(apps: RegistryApp[]): IndexEntry[] {
  return apps
    .filter(discoverable)
    .sort((a, b) => a.slug.localeCompare(b.slug))
    .map(indexEntry);
}

/** Strong ETag over the serialized body — stable across identical builds. */
export function etagFor(body: string): string {
  return `"${createHash("sha256").update(body).digest("hex").slice(0, 32)}"`;
}

/** Case-insensitive substring search over public metadata only. */
export function searchIndex(apps: RegistryApp[], query: string): IndexEntry[] {
  const q = query.trim().toLowerCase();
  const entries = buildIndex(apps);
  if (!q) return entries;
  return entries.filter(
    (entry) =>
      entry.slug.includes(q) ||
      entry.name.toLowerCase().includes(q) ||
      entry.description.toLowerCase().includes(q) ||
      (entry.publisher.username ?? "").toLowerCase().includes(q)
  );
}

function gateLines(entry: IndexEntry): string[] {
  const lines: string[] = [];
  if (entry.gates.password) {
    lines.push(
      "- Password protected: the loader serves a password challenge before any session is minted."
    );
  }
  if (entry.gates.x402) {
    lines.push(
      `- Paid (x402): $${entry.gates.x402.price_usdc} USDC on Base. An unauthenticated GET returns 402 with an \`accepts\` payload (scheme \`exact\`, asset USDC); retry with a valid \`X-PAYMENT\` header to settle and receive a session.`
    );
  }
  if (entry.gates.plugin_signin) {
    lines.push(
      "- Plugin sign-in: tools may authenticate via the device-code flow published at /.well-known/wzrd-plugin.json and open this app headlessly."
    );
  }
  if (lines.length === 0) {
    lines.push("- Free: sign in on the store to open it.");
  }
  return lines;
}

/** Plain-markdown app card at /store/<slug>/agent.md (AEO). */
export function agentMd(app: RegistryApp, actions: string[]): string {
  const entry = indexEntry(app);
  const base = origin();
  const publisher = entry.publisher.username ?? "air";
  const lines = [
    `# ${entry.name}`,
    "",
    entry.description || "(no description)",
    "",
    `- URL: ${entry.url}`,
    `- Detail page: ${base}/store/${entry.slug}`,
    `- Publisher: @${publisher}`,
    ...(entry.publisher.agent_identity
      ? [`- Publisher agent identity: ${entry.publisher.agent_identity}`]
      : []),
    `- Access: ${entry.access}`,
    `- Updated: ${entry.updated_at}`,
    "",
    "## Gates",
    "",
    ...gateLines(entry),
    "",
    "## How an agent opens it",
    "",
    `1. GET ${entry.url} — gates run server-side in order: visibility, password, x402, session.`,
    "2. Satisfy each challenge the response describes (password form, x402 402 payload, store sign-in).",
    "3. A minted link (single-use token in `?t=`) exchanges for a short-lived path-scoped session cookie.",
  ];
  if (actions.length > 0) {
    lines.push(
      "",
      "## Apps API actions",
      "",
      "Typed actions this app accepts via POST /api/apps/v1/action (session-scoped):",
      "",
      ...actions.map((action) => `- \`${action}\``)
    );
  }
  lines.push("");
  return lines.join("\n");
}

/** llms.txt at the mini-origin root (AEO). */
export function llmsTxt(apps: RegistryApp[]): string {
  const base = origin();
  const entries = buildIndex(apps);
  const lines = [
    "# Air Mini-App Store",
    "",
    `> ${base} is the Air mini-app store: a public directory of apps, each a view over its owner's personal agent. Every listing below is public; opening an app may require sign-in, a password, or an x402 USDC payment as disclosed per app.`,
    "",
    "## How to use this origin",
    "",
    `- Store home (HTML): ${base}/`,
    `- Machine-readable index: ${base}/api/store/index.json (ETag + cache headers)`,
    `- Per-app agent card: ${base}/store/<slug>/agent.md`,
    `- App detail (HTML + JSON-LD): ${base}/store/<slug>`,
    `- Open an app: GET ${base}/<slug> — server-side gates: visibility, password, x402 (HTTP 402 with an accepts payload; retry with X-PAYMENT), then session.`,
    `- Publish an app: sign in at ${base}/publish — static bundle upload, platform Apps API for dynamic behavior.`,
    "",
    "## Apps",
    "",
    ...entries.map((entry) => {
      const price = entry.gates.x402
        ? ` ($${entry.gates.x402.price_usdc} USDC)`
        : "";
      return `- [${entry.name}](${base}/store/${entry.slug}/agent.md): ${
        entry.description || "no description"
      }${price}`;
    }),
    "",
  ];
  return lines.join("\n");
}

/** sitemap.xml: home, public app detail pages (storefronts are store apps). */
export function sitemapXml(apps: RegistryApp[]): string {
  const base = origin();
  const urls = [
    { loc: `${base}/`, lastmod: null as string | null },
    ...buildIndex(apps).map((entry) => ({
      loc: `${base}/store/${entry.slug}`,
      lastmod: entry.updated_at,
    })),
  ];
  const body = urls
    .map((u) => {
      const lastmod = u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : "";
      return `  <url><loc>${u.loc}</loc>${lastmod}</url>`;
    })
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

export function robotsTxt(): string {
  const base = origin();
  return [
    "User-agent: *",
    "Allow: /$",
    "Allow: /store/",
    "Allow: /llms.txt",
    "Allow: /api/store/index.json",
    // App views themselves are gated, tokened surfaces — not for crawlers.
    "Disallow: /",
    "",
    `Sitemap: ${base}/sitemap.xml`,
    "",
  ].join("\n");
}

/** JSON-LD SoftwareApplication (+ Offer for x402 apps) for a detail page. */
export function jsonLd(app: RegistryApp): Record<string, unknown> {
  const entry = indexEntry(app);
  const base = origin();
  const offer = entry.gates.x402
    ? {
        "@type": "Offer",
        price: String(entry.gates.x402.price_usdc),
        priceCurrency: "USDC",
      }
    : { "@type": "Offer", price: "0", priceCurrency: "USD" };
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: entry.name,
    description: entry.description,
    url: `${base}/store/${entry.slug}`,
    applicationCategory: "WebApplication",
    operatingSystem: "Web",
    offers: offer,
    author: {
      "@type": entry.publisher.username ? "Person" : "Organization",
      name: entry.publisher.username ?? "Air",
      ...(entry.publisher.agent_identity
        ? { identifier: entry.publisher.agent_identity }
        : {}),
    },
  };
}
