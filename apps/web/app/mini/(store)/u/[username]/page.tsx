/**
 * Publisher page at mini.wzrd.tech/<username> (V11 §6; middleware rewrites
 * it to /mini/u/<username>). Public SSR over public + published registry
 * metadata only (MA7): the publisher's handle, their agent identity if they
 * chose to disclose one, and a launcher list linking each app's nested
 * /<username>/<appname> URL and its /store detail alias.
 */
import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Orb } from "@/components/orb/Orb";
import { serviceClient } from "@/lib/supabase";
import { listPublisherApps, type RegistryApp } from "@/lib/miniapps/registry";
import { USERNAME_RE, nestedPathFor } from "@/lib/miniapps/nested";
import { isReservedWord } from "@/lib/miniapps/reserved";
import { publicUrl } from "@/lib/storage/r2";
import { env } from "@/lib/env";
import { storePaths } from "@/lib/miniapps/storePaths";
import { tintHue } from "@/lib/miniapps/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function validUsername(username: string): boolean {
  return USERNAME_RE.test(username) && !isReservedWord(username);
}

function publisherCanonical(username: string): string {
  return `${env.miniappOrigin().replace(/\/$/, "")}/${username}`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ username: string }>;
}): Promise<Metadata> {
  const { username } = await params;
  if (!validUsername(username)) {
    return { title: "Not found", robots: { index: false } };
  }
  const apps = await listPublisherApps(serviceClient(), username);
  if (apps.length === 0) {
    return { title: "Not found", robots: { index: false } };
  }
  const title = `@${username} — Air Mini-Apps`;
  const description = `${apps.length} app${apps.length === 1 ? "" : "s"} published by @${username} on the Air mini-app store.`;
  const canonical = publisherCanonical(username);
  return {
    title,
    description,
    alternates: { canonical },
    openGraph: { title, description, url: canonical, type: "profile" },
    twitter: { card: "summary", title, description },
  };
}

function tintStyle(slug: string): CSSProperties {
  const hue = tintHue(slug);
  return {
    background: `linear-gradient(145deg, hsl(${hue} 42% 62%), hsl(${hue} 55% 38%))`,
  };
}

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

function priceChip(app: RegistryApp): string | null {
  if (!app.x402_enabled) return null;
  return app.x402_price_usdc ? `$${app.x402_price_usdc} USDC` : "x402";
}

export default async function PublisherPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  if (!validUsername(username)) notFound();
  const supabase = serviceClient();
  const apps = await listPublisherApps(supabase, username);
  if (apps.length === 0) notFound();
  const paths = await storePaths();
  const onMini = paths.home === "/";
  const agentIdentity =
    apps.find((app) => app.agent_identity)?.agent_identity ?? null;

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30vh]">
        <DitherGradient from="blue" direction="down" opacity={0.25} />
      </div>

      <div className="relative mx-auto w-full max-w-[720px] px-6 pb-16 pt-14">
        <header className="rise-in flex flex-col items-start gap-4">
          <div className="flex w-full items-center gap-3">
            <Link
              href={paths.home}
              className="flex items-center gap-3 text-inherit no-underline"
            >
              <Orb size={28} label="air" />
              <span className="text-[14px] text-muted">mini</span>
            </Link>
          </div>
          <h1 className="m-0 text-[28px] font-semibold tracking-[-0.03em]">
            @{username}
          </h1>
          <p className="m-0 max-w-[440px] text-[14px] leading-relaxed text-muted-2">
            {apps.length} app{apps.length === 1 ? "" : "s"} on the Air
            mini-app store.
            {agentIdentity ? (
              <>
                {" "}
                Agent identity:{" "}
                <span className="font-mono text-[13px]">{agentIdentity}</span>
              </>
            ) : null}
          </p>
        </header>

        <section className="mt-10 flex flex-col gap-5">
          {apps.map((app) => {
            const chip = priceChip(app);
            const appPath = nestedPathFor(app.slug);
            const openHref = onMini
              ? appPath
              : `${env.miniappOrigin().replace(/\/$/, "")}${appPath}`;
            return (
              <article key={app.slug} className="flex items-center gap-3">
                <Link
                  href={paths.detail(app.slug)}
                  className="flex min-w-0 flex-1 items-center gap-3 text-inherit no-underline"
                >
                  <AppCircle app={app} size={44} />
                  <div className="min-w-0 flex-1">
                    <h2 className="m-0 truncate text-[17px] font-semibold tracking-[-0.02em]">
                      {app.name || app.slug}
                    </h2>
                    <p className="m-0 truncate text-[13px] text-muted">
                      {app.description || appPath}
                    </p>
                  </div>
                </Link>
                {chip ? (
                  <span className="shrink-0 rounded-full border border-current px-2 py-0.5 text-[10px] text-muted">
                    {chip}
                  </span>
                ) : null}
                <a
                  href={openHref}
                  className="btn-ghost shrink-0 text-[12px]"
                  aria-label={`Open ${app.name || app.slug}`}
                >
                  Open
                </a>
              </article>
            );
          })}
        </section>
      </div>
    </main>
  );
}
