/**
 * MA0 launch API (mini origin). POST {slug} with a store session: resolves
 * the slug against the registry, runs the pre-session gates (visibility →
 * password → x402 — the session gate is what the returned token creates),
 * and returns a single-use tokened app URL.
 *
 * Response shape (stable for sessions B–I):
 *   200 { url: string }
 *   401 { error } — no store session
 *   402 { error, x402 } — payment required (session B settles then retries)
 *   404 { error } — unknown/unpublished slug
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { mintToken } from "@/lib/miniapps/tokens";
import { getRegistryApp } from "@/lib/miniapps/registry";
import { logGateEvent, visibilityGate, x402Gate } from "@/lib/miniapps/gates";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { verifyPluginToken } from "@/lib/plugin/auth";
import { launchRateLimited, recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  let userId = storeSessionUserId(request);
  // MA2.4 headless launch: a plugin bearer stands in for the store session,
  // but only opens apps that opted into plugin sign-in (checked below).
  let viaPlugin = false;
  if (!userId) {
    const auth = request.headers.get("authorization") ?? "";
    if (auth.startsWith("Bearer ")) {
      const principal = await verifyPluginToken(supabase, auth.slice(7));
      if (principal) {
        userId = principal.userId;
        viaPlugin = true;
      }
    }
  }
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (await launchRateLimited(supabase, userId)) {
    return NextResponse.json({ error: "too many launches" }, { status: 429 });
  }
  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  const slug = body.slug ?? "";
  const app = await getRegistryApp(supabase, slug);
  if (!app || visibilityGate(app)) {
    return NextResponse.json({ error: "unknown app" }, { status: 404 });
  }
  if (viaPlugin && !app.plugin_signin_enabled) {
    return NextResponse.json(
      { error: "plugin sign-in not enabled for this app" },
      { status: 403 }
    );
  }
  // Password-gated apps challenge in the app view itself; x402 challenges
  // here so the store can settle before handing out a token.
  const payment = await x402Gate(request, app);
  if (payment) {
    await logGateEvent(supabase, app.id, userId, "gate_challenged", "x402");
    return payment;
  }
  await logGateEvent(supabase, app.id, userId, "app_opened", "launch");
  await recordOpsEvent(supabase, "launch", userId, slug);
  const token = mintToken(userId, slug, "default");
  return NextResponse.json({
    url: `${env.miniappOrigin()}/${slug}?t=${token}`,
  });
}
