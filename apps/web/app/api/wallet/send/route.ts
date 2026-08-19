/**
 * Wallet send composer (V8): validates the address + amount and creates a
 * run_approval decision. This route NEVER sends — execution lives in the
 * decision resolution path (/api/decisions) after the user approves.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import {
  createTransferRequest,
  WalletSendError,
  type WalletAsset,
} from "@/lib/wallet/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    to?: string;
    amount?: string;
    asset?: string;
  };
  if (typeof body.to !== "string" || typeof body.amount !== "string") {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const asset: WalletAsset = body.asset === "usdc" ? "usdc" : "native";
  if (body.asset !== undefined && body.asset !== "usdc" && body.asset !== "native") {
    return NextResponse.json({ error: "invalid asset" }, { status: 400 });
  }
  try {
    const result = await createTransferRequest(
      serviceClient(),
      userId,
      body.to,
      body.amount,
      asset
    );
    return NextResponse.json(
      { ok: true, decision_id: result.decisionId },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    if (error instanceof WalletSendError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.status }
      );
    }
    console.error(
      JSON.stringify({
        msg: "wallet send request failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "send request failed" }, { status: 500 });
  }
}
