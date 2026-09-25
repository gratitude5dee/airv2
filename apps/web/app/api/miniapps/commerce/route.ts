/**
 * MA8 commerce backing tool (gateway-token auth, same pattern as
 * /api/miniapps/publish). The agent can only STAGE:
 *  - publish_catalog: file a shop_publish decision (an optional `note` says
 *    why, and is shown to the owner) — the projection into
 *    storefront_products happens only on owner approval;
 *  - payment_request: file a payment_request + its decision — nothing moves
 *    until the owner approves (fiat → Stripe Checkout on the payee's
 *    connected account; USDC → the wallet transfer approval lane).
 * There is no path here that publishes, charges, or sends.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestCatalogPublish } from "@/lib/commerce/catalog";
import { CommerceError } from "@/lib/commerce/merchants";
import { createPaymentRequest } from "@/lib/commerce/paymentRequests";
import { WalletSendError } from "@/lib/wallet/send";
import { guardResponse, requireBox } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;


export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await requireBox(supabase, request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  const body = (await request.json().catch(() => null)) as {
    action?: unknown;
    currency?: unknown;
    amount?: unknown;
    payee?: unknown;
    memo?: unknown;
    note?: unknown;
  } | null;
  try {
    if (body?.action === "publish_catalog") {
      const result = await requestCatalogPublish(supabase, userId, {
        note: body.note,
      });
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
