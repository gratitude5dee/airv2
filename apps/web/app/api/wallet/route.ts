/**
 * Session-authenticated wallet projection (goal.md M15). The address comes
 * from users.wallet_address — never from client input. Insight failures
 * degrade to a native-only response instead of a 500.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { readWalletSummary } from "@/lib/wallet/read";
import { addressQrDataUrl } from "@/lib/wallet/qr";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CACHE_HEADERS = { "Cache-Control": "private, max-age=60" };

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data: user } = await serviceClient()
    .from("users")
    .select("wallet_address")
    .eq("id", userId)
    .maybeSingle();
  if (!user) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (!user.wallet_address) {
    return NextResponse.json({ address: null }, { headers: CACHE_HEADERS });
  }
  const [summary, receiveQr] = await Promise.all([
    readWalletSummary(user.wallet_address),
    addressQrDataUrl(user.wallet_address),
  ]);
  return NextResponse.json(
    { ...summary, receive_qr: receiveQr },
    { headers: CACHE_HEADERS }
  );
}
