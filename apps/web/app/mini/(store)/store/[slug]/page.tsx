/**
 * MA0 app detail page at mini.wzrd.tech/store/<slug>. Public SSR over
 * public + published registry metadata only (MA7): name, description,
 * publisher block, agent identity link, gate disclosure, and the
 * Open/Install CTA (which goes through /api/mini/launch → gate chain).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Orb } from "@/components/orb/Orb";
import { serviceClient } from "@/lib/supabase";
import { getRegistryApp, type RegistryApp } from "@/lib/miniapps/registry";
import { discoverable, jsonLd } from "@/lib/miniapps/discovery";
import { JsonLd } from "@/lib/miniapps/JsonLd";
import { publicUrl } from "@/lib/storage/r2";
import { env } from "@/lib/env";
import { LaunchButton } from "@/components/miniapp/LaunchButton";
import {
  canonicalDetailUrl,
  storePaths,
} from "@/lib/miniapps/storePaths";
import { tintHue } from "@/lib/miniapps/shell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function ogImage(app: RegistryApp): string | null {
  return app.icon_key ? publicUrl(app.icon_key) : null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const app = await getRegistryApp(serviceClient(), slug);
  if (!app || app.status !== "published" || app.visibility === "private") {
    return { title: "Not found", robots: { index: false } };
  }
  const title = `${app.name || app.slug} — Air Mini-Apps`;
  const description = app.description || "An app on the Air mini-app store.";
  const image = ogImage(app);
  return {
    title,
    description,
    alternates: { canonical: canonicalDetailUrl(app.slug) },
    // Unlisted apps resolve by URL but never enter discovery (MA7).
    robots: app.visibility === "public" ? undefined : { index: false },
    openGraph: {
      title,
      description,
      url: canonicalDetailUrl(app.slug),
      type: "website",
      ...(image ? { images: [{ url: image }] } : {}),
    },
    twitter: {
      card: image ? "summary_large_image" : "summary",
      title,
      description,
      ...(image ? { images: [image] } : {}),
    },
  };
}

export default async function StoreDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const paths = await storePaths();
  const app = await getRegistryApp(serviceClient(), slug);
  if (!app || app.status !== "published" || app.visibility === "private") {
    notFound();
  }

  const gates: string[] = [];
  if (app.password_hash) gates.push("Password protected");
  if (app.x402_enabled) {
    gates.push(
      app.x402_price_usdc
        ? `Paid — $${app.x402_price_usdc} USDC (x402)`
        : "Paid — x402"
    );
  }
  if (gates.length === 0) gates.push("Free — sign in to open");

  const publisher = app.publisher_username ?? "air";
  const agentIdentity =
    app.agent_identity ?? `${publisher}'s agent`;

  return (
    <main className="relative min-h-screen overflow-hidden">
      {discoverable(app) ? <JsonLd data={jsonLd(app)} /> : null}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30vh]">
        <DitherGradient from="blue" direction="down" opacity={0.25} />
      </div>

      <div className="relative mx-auto w-full max-w-[560px] px-6 pb-16 pt-14">
        <Link href={paths.home} className="text-[12px] text-muted no-underline">
          ← Store
        </Link>

        <header className="rise-in mt-6 flex items-center gap-4">
          {app.icon_key ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicUrl(app.icon_key)}
              alt=""
              width={44}
              height={44}
              className="shrink-0 rounded-full border border-[var(--ring)] object-cover"
            />
          ) : (
            <Orb size={44} label={app.name || app.slug} />
          )}
          <div className="min-w-0">
            <h1 className="m-0 text-[24px] font-semibold tracking-[-0.02em]">
              {app.name || app.slug}
            </h1>
            <p className="m-0 text-[12px] text-muted">@{publisher}</p>
          </div>
        </header>

        <div
          aria-hidden="true"
          style={{
            background: `linear-gradient(160deg, hsl(${tintHue(app.slug)} 48% 66%), hsl(${tintHue(app.slug)} 60% 34%))`,
          }}
          className="rise-in mt-5 flex aspect-video w-full items-center justify-center rounded-[20px] border border-[var(--ring)]"
        >
          {app.icon_key ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={publicUrl(app.icon_key)}
              alt=""
              width={72}
              height={72}
              className="rounded-full border border-white/40 object-cover"
            />
          ) : (
            <Orb size={72} label={app.name || app.slug} />
          )}
        </div>

        <p className="rise-in mt-4 text-[14px] leading-relaxed text-muted-2">
          {app.description}
        </p>

        <div className="rise-in mt-6 flex items-center gap-3">
          <LaunchButton
            slug={app.slug}
            signInUrl={paths.login}
            payUrl={`${env.miniappOrigin().replace(/\/$/, "")}/${app.slug}`}
          />
        </div>

        <section className="rise-in mt-10 grid gap-3">
          <div className="panel !p-4">
            <h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              Publisher
            </h2>
            <p className="mb-0 mt-2 text-[13px]">@{publisher}</p>
            {app.publisher_wallet ? (
              <p className="mb-0 mt-1 break-all text-[11px] text-muted">
                {app.publisher_wallet}
              </p>
            ) : null}
          </div>

          <div className="panel !p-4">
            <h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              Agent
            </h2>
            <p className="mb-0 mt-2 text-[13px]">
              Served by{" "}
              {app.agent_identity?.startsWith("https://") ? (
                // MA3 agent identity link-out: agent-card URL or ERC-8004
                // registration URI the publisher declared on the row.
                <a
                  href={app.agent_identity}
                  className="underline"
                  target="_blank"
                  rel="noopener noreferrer"
                  id="agent"
                >
                  {agentIdentity}
                </a>
              ) : (
                <Link
                  href={`${paths.detail(app.slug)}#agent`}
                  className="underline"
                  id="agent"
                >
                  {agentIdentity}
                </Link>
              )}
            </p>
          </div>

          <div className="panel !p-4">
            <h2 className="m-0 text-[12px] font-semibold uppercase tracking-[0.08em] text-muted">
              Access
            </h2>
            <ul className="mb-0 mt-2 list-none p-0 text-[13px]">
              {gates.map((gate) => (
                <li key={gate} className="mt-1">
                  {gate}
                </li>
              ))}
            </ul>
          </div>
        </section>
      </div>
    </main>
  );
}
