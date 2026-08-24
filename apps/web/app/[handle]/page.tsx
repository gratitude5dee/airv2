/**
 * Public profile at /@<username> (goal.md M6 §3). Exposes ONLY user-published
 * identity metadata — name, contact, bio, links, social handles, storefront,
 * and the chosen avatar image via a short-TTL signed URL. Never box or
 * account internals.
 */
import { notFound } from "next/navigation";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { getPublicProfile } from "@/lib/identity/profile";
import { getAvatarAssetId, signedIdentityUrl } from "@/lib/identity/assets";
import { storefrontSlug } from "@/lib/commerce/merchants";
import type { CreativeAsset } from "@/lib/assets/pipeline";
import type { SupabaseClient } from "@supabase/supabase-js";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { DitherGradient } from "@/components/dither-kit/gradient";

export const dynamic = "force-dynamic";

/** Short-TTL signed URL for the user's chosen avatar image, if any. */
async function avatarUrl(
  supabase: SupabaseClient,
  userId: string
): Promise<string | null> {
  const assetId = await getAvatarAssetId(supabase, userId).catch(() => null);
  if (!assetId) return null;
  const { data: asset } = await supabase
    .from("creative_assets")
    .select("*")
    .eq("id", assetId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!asset) return null;
  return signedIdentityUrl(supabase, asset as CreativeAsset).catch(() => null);
}

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
  const userId = user.id as string;

  const [{ data: line }, { data: address }, profile, avatar, shopSlug] =
    await Promise.all([
      supabase
        .from("lines")
        .select("phone")
        .eq("assigned_user_id", userId)
        .maybeSingle(),
      supabase
        .from("agent_addresses")
        .select("address")
        .eq("user_id", userId)
        .eq("is_primary", true)
        .is("retired_at", null)
        .maybeSingle(),
      getPublicProfile(supabase, userId).catch(() => null),
      avatarUrl(supabase, userId),
      storefrontSlug(supabase, userId).catch(() => null),
    ]);

  const socials: Array<{ label: string; url: string }> = [];
  if (profile?.instagram) {
    socials.push({
      label: `Instagram · @${profile.instagram}`,
      url: `https://instagram.com/${profile.instagram}`,
    });
  }
  if (profile?.tiktok) {
    socials.push({
      label: `TikTok · @${profile.tiktok}`,
      url: `https://www.tiktok.com/@${profile.tiktok}`,
    });
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[40vh]">
        <DitherGradient from="purple" direction="up" opacity={0.3} />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[420px] flex-col justify-center px-6 py-10">
        <div className="panel rise-in text-center">
          <div className="mx-auto mb-4 h-[72px] w-[72px] overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
            {avatar ? (
              // eslint-disable-next-line @next/next/no-img-element -- short-TTL signed URL; next/image would cache/proxy it
              <img
                src={avatar}
                alt={`@${username} avatar`}
                width={72}
                height={72}
                className="h-full w-full object-cover"
              />
            ) : (
              <DitherAvatar name={username} size={72} />
            )}
          </div>
          <h1 className="mb-1 mt-0 text-[22px] font-semibold tracking-[-0.02em]">
            @{username}
          </h1>
          <p className="mt-0 text-[13px] text-muted">Personal agent</p>
          {profile?.bio ? (
            <p className="mt-3 text-[13px] leading-relaxed">{profile.bio}</p>
          ) : null}

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

        {socials.length > 0 ? (
          <div className="panel rise-in mt-4 grid gap-2 text-center">
            {socials.map((social) => (
              <a
                key={social.url}
                className="btn btn-ghost w-full"
                href={social.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {social.label}
              </a>
            ))}
          </div>
        ) : null}

        {profile && profile.links.length > 0 ? (
          <div className="panel rise-in mt-4 grid gap-2 text-center">
            {profile.links.map((link) => (
              <a
                key={link.url}
                className="btn btn-ghost w-full"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {link.label}
              </a>
            ))}
          </div>
        ) : null}

        {shopSlug ? (
          <div className="panel rise-in mt-4 text-center">
            <a
              className="btn w-full"
              href={`${env.miniappOrigin()}/${shopSlug}`}
            >
              Visit the shop
            </a>
          </div>
        ) : null}

        <p className="rise-in mt-6 text-center text-[11px] text-muted">
          Powered by air
        </p>
      </div>
    </main>
  );
}
