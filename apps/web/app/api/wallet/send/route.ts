/**
 * Wallet send composer (V8): validates the address + amount and creates a
 * run_approval decision. This route NEVER sends — execution lives in the
 * decision resolution path (/api/decisions) after the user approves.
 */
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { parseBody } from "@/lib/http/body";
import {
  createTransferRequest,
  WalletSendError,
  type WalletAsset,
} from "@/lib/wallet/send";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  to: z.string(),
  amount: z.string(),
  asset: z.enum(["usdc", "native"]).optional(),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const parsed = await parseBody(request, Body);
  if (!parsed.ok) return parsed.response;
  const body = parsed.data;
  const asset: WalletAsset = body.asset ?? "native";
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
