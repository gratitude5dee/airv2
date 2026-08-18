/**
 * Session-authenticated wallet activity (goal.md M15): last transactions via
 * Insight, projected server-side with explorer URLs. Address comes from
 * users.wallet_address — never from client input.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { readWalletActivity } from "@/lib/wallet/read";
import { listTransfers } from "@/lib/wallet/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The response carries the mutable transfer-intent ledger — a send/approve/
// deny must show up on the very next load, so this must never be cached.
const CACHE_HEADERS = { "Cache-Control": "no-store" };

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
    return NextResponse.json(
      { address: null, transactions: [], transfers: [] },
      { headers: CACHE_HEADERS }
    );
  }
  // V8: send intents ride alongside Insight history — with Insight degraded
  // (native-only), the intent ledger is the only activity trail for sends.
  const [activity, transfers] = await Promise.all([
    readWalletActivity(user.wallet_address),
    listTransfers(serviceClient(), userId),
  ]);
  return NextResponse.json(
    { ...activity, transfers },
    { headers: CACHE_HEADERS }
  );
}
