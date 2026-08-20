/**
 * Session-authenticated preview of the payment_requests queue for the BANK
 * wallet tile (Phase 3). Read-only projection — approving/dismissing lives
 * in the pay mini-app, which the tile deep-links into.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { listPaymentRequests } from "@/lib/commerce/paymentRequests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const requests = await listPaymentRequests(serviceClient(), userId);
  const pending = requests
    .filter((r) => r.status === "pending")
    .slice(0, 5)
    .map((r) => ({
      id: r.id,
      amount_display: r.amount_display,
      currency: r.currency,
      payee: r.payee,
      memo: r.memo,
      created_at: r.created_at,
    }));
  return NextResponse.json(
    { pending, pending_count: requests.filter((r) => r.status === "pending").length },
    { headers: { "Cache-Control": "no-store" } }
  );
}
