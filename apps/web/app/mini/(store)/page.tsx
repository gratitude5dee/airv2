/**
 * MA0 store home at mini.wzrd.tech (middleware rewrites / → /mini). Public
 * SSR: renders logged-out; only public + published registry metadata appears
 * here (MA7). Launching an app requires a store session via /api/mini/launch.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Orb } from "@/components/orb/Orb";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { listPublicApps, type RegistryApp } from "@/lib/miniapps/registry";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORE_DESCRIPTION =
  "The Air mini-app store: apps for your agent. Every app is a view over your own agent — open one and it's already yours.";

export function generateMetadata(): Metadata {
  const origin = env.miniappOrigin().replace(/\/$/, "");
  const title = "Air Mini-Apps";
  return {
    title,
    description: STORE_DESCRIPTION,
    alternates: { canonical: `${origin}/` },
    openGraph: {
      title,
      description: STORE_DESCRIPTION,
      url: `${origin}/`,
      type: "website",
    },
    twitter: { card: "summary", title, description: STORE_DESCRIPTION },
  };
}

const CATEGORIES: [string, string[]][] = [
  ["Agent", ["computer", "browser", "connect", "onboarding", "settings"]],
  ["Work", ["calendar", "inbox", "crm", "kanban", "todo", "analytics"]],
  ["Create", ["video", "image", "shop"]],
  ["Money", ["pay", "vault"]],
];

function priceChip(app: RegistryApp): string | null {
  if (!app.x402_enabled) return null;
  return app.x402_price_usdc ? `$${app.x402_price_usdc} USDC` : "x402";
}

function AppCard({ app }: { app: RegistryApp }) {
  const chip = priceChip(app);
  return (
    <Link
      href={`/store/${app.slug}`}
      className="panel !p-4 block text-left no-underline"
    >
      <div className="flex items-center gap-3">
        <Orb size={22} label={app.name || app.slug} />
        <div className="min-w-0">
          <h3 className="m-0 truncate text-[13px] font-semibold">
            {app.name || app.slug}
          </h3>
          <p className="m-0 truncate text-[11px] text-muted">
            {app.publisher_username ? `@${app.publisher_username}` : "air"}
          </p>
        </div>
        {chip ? (
          <span className="ml-auto shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] text-muted">
            {chip}
          </span>
        ) : null}
      </div>
      <p className="mb-0 mt-2 line-clamp-2 text-[12px] leading-relaxed text-muted">
        {app.description}
      </p>
    </Link>
  );
}

export default async function StoreHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q ?? "").trim().toLowerCase();
  const apps = await listPublicApps(serviceClient());
  const filtered = query
    ? apps.filter(
        (app) =>
          app.slug.includes(query) ||
          app.name.toLowerCase().includes(query) ||
          app.description.toLowerCase().includes(query)
      )
    : apps;
  const bySlug = new Map(filtered.map((app) => [app.slug, app]));
  const categorized = new Set(CATEGORIES.flatMap(([, slugs]) => slugs));
  const rest = filtered.filter((app) => !categorized.has(app.slug));

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30vh]">
        <DitherGradient from="blue" direction="down" opacity={0.25} />
      </div>

      <div className="relative mx-auto w-full max-w-[720px] px-6 pb-16 pt-14">
        <header className="rise-in flex flex-col items-start gap-4">
          <div className="flex w-full items-center gap-3">
            <Orb size={28} label="air" />
            <h1 className="m-0 text-[28px] font-semibold tracking-[-0.03em]">
              mini
            </h1>
            <Link className="btn-ghost ml-auto text-[12px]" href="/publish">
              Publish
            </Link>
            <Link className="btn-ghost text-[12px]" href="/login">
              Sign in
            </Link>
          </div>
          <p className="m-0 max-w-[440px] text-[14px] leading-relaxed text-muted-2">
            Apps for your agent. Every app here is a view over your own agent
            — open one and it&apos;s already yours.
          </p>
          <form method="get" action="/" className="flex w-full gap-2">
            <input
              type="text"
              name="q"
              defaultValue={q ?? ""}
              placeholder="Search apps…"
              className="input flex-1"
            />
            <button className="btn" type="submit">
              Search
            </button>
          </form>
        </header>

        {CATEGORIES.map(([label, slugs]) => {
          const row = slugs
            .map((slug) => bySlug.get(slug))
            .filter((app): app is RegistryApp => Boolean(app));
          if (row.length === 0) return null;
          return (
            <section key={label} className="rise-in mt-10">
              <h2 className="m-0 mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
                {label}
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {row.map((app) => (
                  <AppCard key={app.slug} app={app} />
                ))}
              </div>
            </section>
          );
        })}

        {rest.length > 0 ? (
          <section className="rise-in mt-10">
            <h2 className="m-0 mb-3 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              Community
            </h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rest.map((app) => (
                <AppCard key={app.slug} app={app} />
              ))}
            </div>
          </section>
        ) : null}

        {filtered.length === 0 ? (
          <p className="mt-10 text-[13px] text-muted">
            Nothing matches “{q}”.
          </p>
        ) : null}
      </div>
    </main>
  );
}
