/**
 * Public contact card at /@<username> (goal.md M6 §3). Exposes ONLY name,
 * number, and email — never box or account internals.
 */
import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase";

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
    <main style={{ maxWidth: 420, margin: "18vh auto", padding: 16 }}>
      <div className="panel" style={{ textAlign: "center" }}>
        <div
          style={{
            width: 72,
            height: 72,
            borderRadius: "50%",
            background: "var(--accent)",
            color: "#0b0b0f",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 30,
            fontWeight: 700,
            margin: "0 auto 12px",
          }}
        >
          {username[0]?.toUpperCase()}
        </div>
        <h1 style={{ margin: "0 0 4px", fontSize: 22 }}>@{username}</h1>
        <p className="muted" style={{ marginTop: 0 }}>
          Personal agent
        </p>
        {line?.phone ? (
          <p>
            <a href={`sms:${line.phone as string}`}>{line.phone as string}</a>
          </p>
        ) : null}
        {address?.address ? (
          <p>
            <a href={`mailto:${address.address as string}`}>
              {address.address as string}
            </a>
          </p>
        ) : null}
      </div>
    </main>
  );
}
