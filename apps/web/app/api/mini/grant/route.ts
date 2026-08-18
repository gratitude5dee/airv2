/**
 * MA4 guest grant mint (main origin, owner session). Creates a scoped grant
 * for exactly one (app, resource) and returns the share URL
 * mini.wzrd.tech/<slug>?g=<grant>. Grants are the only way a non-owner ever
 * reaches a mini-app; the guest session they redeem into cannot mint
 * anything broader.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { env } from "@/lib/env";
import { getRegistryApp } from "@/lib/miniapps/registry";
import { createGuestGrant } from "@/lib/miniapps/guests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    app?: string;
    resource?: string;
    max_uses?: number;
    ttl_hours?: number;
  };
  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, body.app ?? "");
  if (!app || app.status !== "published") {
    return NextResponse.json({ error: "unknown app" }, { status: 400 });
  }
  const resource = body.resource ?? "default";
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(resource)) {
    return NextResponse.json({ error: "invalid resource" }, { status: 400 });
  }
  const grant = await createGuestGrant(supabase, userId, app.id, resource, {
    maxUses: body.max_uses,
    ttlHours: body.ttl_hours,
  });
  return NextResponse.json({
    grant_id: grant.id,
    url: `${env.miniappOrigin()}/${app.slug}?g=${grant.id}`,
    expires_at: grant.expires_at,
    max_uses: grant.max_uses,
  });
}
