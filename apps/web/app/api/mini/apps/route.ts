/**
 * /home Apps tab data (MA0, main origin): the first-party registry plus the
 * owner's install state. Metadata only — launching still goes through
 * /api/mini/link's owner-scoped token mint.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { listFirstPartyApps } from "@/lib/miniapps/registry";
import { publisherEarnings } from "@/lib/miniapps/publish";
import { spendCeilingCents } from "@/lib/ads/spend";
import { publicUrl } from "@/lib/storage/r2";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  // `?earnings=1` (App Store detail sheet) adds the owner's per-app x402
  // totals — same aggregation the publisher console exports.
  const wantEarnings = request.nextUrl.searchParams.get("earnings") === "1";
  const [apps, { data: installs }, earnings, adsCeiling, { data: userRow }] =
    await Promise.all([
      listFirstPartyApps(supabase),
      supabase.from("miniapp_installs").select("app_id").eq("user_id", userId),
      wantEarnings ? publisherEarnings(supabase, userId) : Promise.resolve([]),
      spendCeilingCents(supabase, userId),
      supabase
        .from("users")
        .select("miniapp_home_order")
        .eq("id", userId)
        .maybeSingle(),
    ]);
  const rawOrder = userRow?.miniapp_home_order;
  const homeOrder = Array.isArray(rawOrder)
    ? rawOrder.filter((s): s is string => typeof s === "string")
    : [];
  const installed = new Set((installs ?? []).map((row) => row.app_id));
  return NextResponse.json({
    apps: apps.map((app) => ({
      slug: app.slug,
      name: app.name,
      description: app.description,
      icon_key: app.icon_key,
      icon_url: app.icon_key ? publicUrl(app.icon_key) : null,
      status: app.status,
      installed: installed.has(app.id),
      publisher_username: app.publisher_username,
      access: app.access,
      password_gated: app.password_hash !== null,
      x402_enabled: app.x402_enabled,
      x402_price_usdc: app.x402_price_usdc,
    })),
    // Phase 3 tile badge: a zero ceiling means ad writes are blocked
    // server-side (approveAdWrite fails closed) — surface it on the tile.
    ads_writes_blocked: adsCeiling === 0,
    // The owner's press-and-hold arrangement — shared with the Home mini-app.
    home_order: homeOrder,
    ...(wantEarnings ? { earnings } : {}),
  });
}
