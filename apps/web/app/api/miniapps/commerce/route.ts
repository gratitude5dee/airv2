/**
 * MA8 commerce backing tool (gateway-token auth, same pattern as
 * /api/miniapps/publish). The agent can only STAGE:
 *  - publish_catalog: file a shop_publish decision — the projection into
 *    storefront_products happens only on owner approval;
 *  - payment_request: file a payment_request + its decision — nothing moves
 *    until the owner approves (fiat → Stripe Checkout on the payee's
 *    connected account; USDC → the wallet transfer approval lane).
 * There is no path here that publishes, charges, or sends.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { serviceClient } from "@/lib/supabase";
import { requestCatalogPublish } from "@/lib/commerce/catalog";
import { CommerceError } from "@/lib/commerce/merchants";
import { createPaymentRequest } from "@/lib/commerce/paymentRequests";
import { WalletSendError } from "@/lib/wallet/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

async function boxUserId(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  return box ? (box.user_id as string) : null;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    currency?: unknown;
    amount?: unknown;
    payee?: unknown;
    memo?: unknown;
  } | null;
  try {
    if (body?.action === "publish_catalog") {
      const result = await requestCatalogPublish(supabase, userId);
      return NextResponse.json({ ok: true, ...result });
    }
    if (body?.action === "payment_request") {
      const result = await createPaymentRequest(supabase, userId, {
        currency: typeof body.currency === "string" ? body.currency : "usd",
        amount: body.amount,
        payee: body.payee,
        memo: body.memo,
      });
      return NextResponse.json({ ok: true, ...result });
    }
  } catch (error) {
    if (error instanceof CommerceError || error instanceof WalletSendError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
