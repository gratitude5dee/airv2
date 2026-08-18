/**
 * MA0 app detail page at mini.wzrd.tech/store/<slug>. Public SSR over
 * public + published registry metadata only (MA7): name, description,
 * publisher block, agent identity link, gate disclosure, and the
 * Open/Install CTA (which goes through /api/mini/launch → gate chain).
 */
import Link from "next/link";
import { notFound } from "next/navigation";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Orb } from "@/components/orb/Orb";
import { serviceClient } from "@/lib/supabase";
import { getRegistryApp } from "@/lib/miniapps/registry";
import { LaunchButton } from "@/components/miniapp/LaunchButton";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export default async function StoreDetail({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[30vh]">
        <DitherGradient from="blue" direction="down" opacity={0.25} />
      </div>

      <div className="relative mx-auto w-full max-w-[560px] px-6 pb-16 pt-14">
        <Link href="/" className="text-[12px] text-muted no-underline">
          ← Store
        </Link>

        <header className="rise-in mt-6 flex items-center gap-4">
          <Orb size={40} label={app.name || app.slug} />
          <div className="min-w-0">
            <h1 className="m-0 text-[24px] font-semibold tracking-[-0.02em]">
              {app.name || app.slug}
            </h1>
            <p className="m-0 text-[12px] text-muted">@{publisher}</p>
          </div>
        </header>

        <p className="rise-in mt-4 text-[14px] leading-relaxed text-muted-2">
          {app.description}
        </p>

        <div className="rise-in mt-6 flex items-center gap-3">
          <LaunchButton slug={app.slug} />
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
              <Link
                href={`/store/${app.slug}#agent`}
                className="underline"
                id="agent"
              >
                {agentIdentity}
              </Link>
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
