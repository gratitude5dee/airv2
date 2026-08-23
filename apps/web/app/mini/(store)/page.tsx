/**
 * MA0 store home at mini.wzrd.tech (middleware rewrites / → /mini). Public
 * SSR: renders logged-out; only public + published registry metadata appears
 * here (MA7). Launching an app requires a store session via /api/mini/launch.
 */
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Orb } from "@/components/orb/Orb";
import { serviceClient } from "@/lib/supabase";
import { listPublicApps, type RegistryApp } from "@/lib/miniapps/registry";
import { publicUrl } from "@/lib/storage/r2";
import { recordStoreOpen } from "@/lib/security/limits";
import {
  canonicalStoreHome,
  storePaths,
  type StorePaths,
} from "@/lib/miniapps/storePaths";
import { tintHue } from "@/lib/miniapps/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STORE_DESCRIPTION =
  "The Air mini-app store: apps for your agent. Every app is a view over your own agent — open one and it's already yours.";

export function generateMetadata(): Metadata {
  const canonical = canonicalStoreHome();
  const title = "Air Mini-Apps";
  return {
    title,
    description: STORE_DESCRIPTION,
    alternates: { canonical },
    openGraph: {
      title,
      description: STORE_DESCRIPTION,
      url: canonical,
      type: "website",
    },
    twitter: { card: "summary", title, description: STORE_DESCRIPTION },
  };
}

const CATEGORIES: [string, string[]][] = [
  ["Agent", ["computer", "browser", "connect", "onboarding", "settings"]],
  // kanban/todo are private single-user apps (migration 0034) — they never
  // pass the listPublicApps visibility filter, so they don't belong here.
  ["Work", ["calendar", "inbox", "crm", "analytics"]],
  ["Create", ["video", "image", "shop"]],
  ["Money", ["pay", "vault"]],
];

function priceChip(app: RegistryApp): string | null {
  if (!app.x402_enabled) return null;
  return app.x402_price_usdc ? `$${app.x402_price_usdc} USDC` : "x402";
}

function tintStyle(slug: string, angle = 145): CSSProperties {
  const hue = tintHue(slug);
  return {
    background: `linear-gradient(${angle}deg, hsl(${hue} 42% 62%), hsl(${hue} 55% 38%))`,
  };
}

/** Circular app icon (Photon drawer style): image or tinted initial. */
function AppCircle({ app, size }: { app: RegistryApp; size: number }) {
  if (app.icon_key) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={publicUrl(app.icon_key)}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full border border-[var(--ring)] object-cover"
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      style={{ ...tintStyle(app.slug), width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full border border-[var(--ring)] font-semibold uppercase text-white"
    >
      {(app.name || app.slug).slice(0, 1)}
    </span>
  );
}

/** "Recents"-style launcher entry: big circle over an ellipsized label. */
function AppIconLink({ app, paths }: { app: RegistryApp; paths: StorePaths }) {
  return (
    <Link
      href={paths.detail(app.slug)}
      className="flex min-w-0 flex-col items-center gap-2 text-inherit no-underline"
    >
      <AppCircle app={app} size={60} />
      <span className="max-w-full truncate text-[12px]">
        {app.name || app.slug}
      </span>
    </Link>
  );
}

/** Explore feed row: circular icon, title, muted one-line description. */
function AppRow({ app, paths }: { app: RegistryApp; paths: StorePaths }) {
  const chip = priceChip(app);
  return (
    <Link
      href={paths.detail(app.slug)}
      className="flex items-center gap-3 text-inherit no-underline"
    >
      <AppCircle app={app} size={44} />
      <div className="min-w-0 flex-1">
        <h3 className="m-0 truncate text-[17px] font-semibold tracking-[-0.02em]">
          {app.name || app.slug}
        </h3>
        <p className="m-0 truncate text-[13px] text-muted">
          {app.description}
        </p>
      </div>
      {chip ? (
        <span className="ml-auto shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] text-muted">
          {chip}
        </span>
      ) : null}
    </Link>
  );
}

/** Big rounded promo card under a featured Explore row. */
function AppHero({ app, paths }: { app: RegistryApp; paths: StorePaths }) {
  return (
    <Link
      href={paths.detail(app.slug)}
      aria-label={`Open ${app.name || app.slug}`}
      style={tintStyle(app.slug, 160)}
      className="mt-3 flex aspect-video w-full items-center justify-center rounded-[20px] border border-[var(--ring)] no-underline"
    >
      <AppCircle app={app} size={72} />
    </Link>
  );
}

export default async function StoreHome({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const paths = await storePaths();
  const query = (q ?? "").trim().toLowerCase();
  const supabase = serviceClient();
  // Anonymous store-home traffic feeds the store_opens_24h ops counter;
  // the recorder throttles writes so unauthenticated hits can't spam inserts.
  await recordStoreOpen(supabase);
  const apps = await listPublicApps(supabase);
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
            <Link className="btn-ghost ml-auto text-[12px]" href={paths.publish}>
              Publish
            </Link>
            <Link className="btn-ghost text-[12px]" href={paths.login}>
              Sign in
            </Link>
          </div>
          <p className="m-0 max-w-[440px] text-[14px] leading-relaxed text-muted-2">
            Apps for your agent. Every app here is a view over your own agent
            — open one and it&apos;s already yours.
          </p>
          <form method="get" action={paths.home} className="flex w-full gap-2">
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

        {filtered.length > 0 ? (
          <section className="rise-in mt-10">
            <h2 className="m-0 mb-4 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              Apps
            </h2>
            <div className="grid grid-cols-4 gap-x-2 gap-y-5">
              {filtered.map((app) => (
                <AppIconLink key={app.slug} app={app} paths={paths} />
              ))}
            </div>
          </section>
        ) : null}

        {filtered.length > 0 ? (
          <h2 className="rise-in mb-0 mt-12 text-[26px] font-semibold tracking-[-0.03em]">
            Explore
          </h2>
        ) : null}

        {CATEGORIES.map(([label, slugs]) => {
          const row = slugs
            .map((slug) => bySlug.get(slug))
            .filter((app): app is RegistryApp => Boolean(app));
          const [featured, ...others] = row;
          if (!featured) return null;
          return (
            <section key={label} className="rise-in mt-8">
              <h3 className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
                {label}
              </h3>
              <AppRow app={featured} paths={paths} />
              <AppHero app={featured} paths={paths} />
              {others.length > 0 ? (
                <div className="mt-4 grid gap-4">
                  {others.map((app) => (
                    <AppRow key={app.slug} app={app} paths={paths} />
                  ))}
                </div>
              ) : null}
            </section>
          );
        })}

        {rest.length > 0 ? (
          <section className="rise-in mt-8">
            <h3 className="m-0 mb-3 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted">
              Community
            </h3>
            <div className="grid gap-4">
              {rest.map((app) => (
                <AppRow key={app.slug} app={app} paths={paths} />
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
