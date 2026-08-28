/**
 * Express Checkout Element server half for the hosted approval page: mint
 * a direct-charge PaymentIntent on the payee merchant's connected account
 * for a still-pending payment_request. Only the client secret (public by
 * design) leaves the server — the Stripe secret key never does (C2). The
 * wallet confirmation is the approval tap; payment_intent.succeeded flips
 * the request to paid and resolves the decision.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { verifyApprovalToken } from "@/lib/approvals/token";
import { createExpressPaymentIntent } from "@/lib/commerce/paymentRequests";
import { CommerceError } from "@/lib/commerce/merchants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await params;
  const body = (await request.json().catch(() => ({}))) as { k?: string };
  let userId: string | null = null;
  if (typeof body.k === "string") {
    userId = verifyApprovalToken(body.k, id)?.userId ?? null;
  }
  userId = userId ?? sessionUserId(request) ?? null;
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data: decision } = await supabase
    .from("decisions")
    .select("id, kind, ref, status")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!decision || decision.kind !== "payment_request" || !decision.ref) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (decision.status !== "pending") {
    return NextResponse.json({ error: "already resolved" }, { status: 409 });
  }
  try {
    const intent = await createExpressPaymentIntent(
      supabase,
      userId,
      decision.ref as string
    );
    return NextResponse.json({
      client_secret: intent.clientSecret,
      stripe_account: intent.stripeAccount,
      amount_cents: intent.amountCents,
    });
  } catch (error) {
    if (error instanceof CommerceError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    throw error;
  }
}
