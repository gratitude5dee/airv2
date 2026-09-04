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
import { nestedPathFor } from "@/lib/miniapps/nested";
import { createGuestGrant } from "@/lib/miniapps/guests";
import { grantRateLimited, recordOpsEvent } from "@/lib/security/limits";

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
  if (await grantRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many grants" }, { status: 429 });
  }
  const app = await getRegistryApp(supabase, body.app ?? "");
  if (!app || app.status !== "published") {
    return NextResponse.json({ error: "unknown app" }, { status: 400 });
  }
  if (app.access !== "multiplayer") {
    return NextResponse.json(
      { error: "app is not shareable" },
      { status: 400 }
    );
  }
  const resource = body.resource ?? "default";
  if (!/^[A-Za-z0-9._-]{1,64}$/.test(resource)) {
    return NextResponse.json({ error: "invalid resource" }, { status: 400 });
  }
  const maxUses = Number(body.max_uses ?? 25);
  const ttlHours = Number(body.ttl_hours ?? 72);
  if (
    !Number.isInteger(maxUses) ||
    maxUses < 1 ||
    maxUses > 500 ||
    !Number.isFinite(ttlHours) ||
    ttlHours <= 0 ||
    ttlHours > 24 * 30
  ) {
    return NextResponse.json(
      { error: "invalid grant options" },
      { status: 400 }
    );
  }
  const grant = await createGuestGrant(supabase, userId, app.id, resource, {
    maxUses,
    ttlHours,
  });
  await recordOpsEvent(supabase, "grant", userId, app.slug);
  return NextResponse.json({
    grant_id: grant.id,
    url: `${env.miniappOrigin()}${nestedPathFor(app.slug)}?g=${grant.id}`,
    expires_at: grant.expires_at,
    max_uses: grant.max_uses,
  });
}
