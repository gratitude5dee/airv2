/**
 * Public contact card at /@<username> (goal.md M6 §3). Exposes ONLY name,
 * number, and email — never box or account internals.
 */
import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { DitherGradient } from "@/components/dither-kit/gradient";

export const dynamic = "force-dynamic";

export default async function ContactCard({
  params,
}: {
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const decoded = decodeURIComponent(handle);
  if (!decoded.startsWith("@")) notFound();
  const username = decoded.slice(1).toLowerCase();
  if (!/^[a-z0-9_]{2,24}$/.test(username)) notFound();

  const supabase = serviceClient();
  const { data: user } = await supabase
    .from("users")
    .select("id, username")
    .eq("username", username)
    .eq("status", "active")
    .maybeSingle();
  if (!user) notFound();

  const [{ data: line }, { data: address }] = await Promise.all([
    supabase
      .from("lines")
      .select("phone")
      .eq("assigned_user_id", user.id as string)
      .maybeSingle(),
    supabase
      .from("agent_addresses")
      .select("address")
      .eq("user_id", user.id as string)
      .eq("is_primary", true)
      .is("retired_at", null)
      .maybeSingle(),
  ]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40vh]">
        <DitherGradient from="purple" direction="up" opacity={0.3} />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6">
        <div className="panel rise-in text-center">
          <div className="mx-auto mb-4 h-[72px] w-[72px] overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
            <DitherAvatar name={username} size={72} />
          </div>
          <h1 className="mb-1 mt-0 text-[22px] font-semibold tracking-[-0.02em]">
            @{username}
          </h1>
          <p className="mt-0 text-[13px] text-muted">Personal agent</p>

          <div className="mt-5 grid gap-2">
            {line?.phone ? (
              <a
                className="btn w-full"
                href={`sms:${line.phone as string}`}
              >
                {line.phone as string}
              </a>
            ) : null}
            {address?.address ? (
              <a
                className="btn btn-ghost w-full"
                href={`mailto:${address.address as string}`}
              >
                {address.address as string}
              </a>
            ) : null}
          </div>
        </div>

        <p className="rise-in mt-6 text-center text-[11px] text-muted">
          Powered by air
        </p>
      </div>
    </main>
  );
}
