/**
 * Binding exchange the Buzz signer side calls (buzz.goal.md §MA-Z2):
 * outbound from Buzz Desktop or from the user's own Box, where the agent
 * holds `BUZZ_PRIVATE_KEY` as env and runs `buzz` itself. The signer
 * presents the owner-minted single-use code and its *public* identity
 * (npub) — never key material — and receives a revocable link token for the
 * intent lane (§MA-Z3). Every failure is the same 403.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { exchangeBuzzBindingCode } from "@/lib/miniapps/buzz/link";
import {
  pairAttemptSource,
  pairExchangeRateLimited,
} from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    code?: string;
    npub?: string;
    communityLabel?: string;
  };
  if (typeof body.code !== "string" || typeof body.npub !== "string") {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const supabase = serviceClient();
  const source = pairAttemptSource(request.headers.get("x-forwarded-for"));
  if (await pairExchangeRateLimited(supabase, source)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }
  const result = await exchangeBuzzBindingCode(supabase, {
    code: body.code,
    npub: body.npub,
    communityLabel:
      typeof body.communityLabel === "string" ? body.communityLabel : null,
  });
  if (!result.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ token: result.token, relayUrl: result.relayUrl });
}
