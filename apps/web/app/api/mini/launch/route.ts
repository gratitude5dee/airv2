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

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { slug?: string };
  const slug = body.slug ?? "";
  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, slug);
  if (!app || visibilityGate(app)) {
    return NextResponse.json({ error: "unknown app" }, { status: 404 });
  }
  // Password-gated apps challenge in the app view itself; x402 challenges
  // here so the store can settle before handing out a token.
  const payment = await x402Gate(request, app);
  if (payment) {
    await logGateEvent(supabase, app.id, userId, "gate_challenged", "x402");
    return payment;
  }
  await logGateEvent(supabase, app.id, userId, "app_opened", "launch");
  const token = mintToken(userId, slug, "default");
  return NextResponse.json({
    url: `${env.miniappOrigin()}/${slug}?t=${token}`,
  });
}
