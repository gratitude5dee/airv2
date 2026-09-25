import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { verifyMuseKey } from "@/lib/muse/keys";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireWorker } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ token: z.string().min(16).max(512) });

/**
 * Worker-only hash lookup for REST API keys. The raw bearer is in flight only;
 * it is neither logged nor returned, and database rows retain its HMAC hash.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireWorker(request, "muse").catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const principal = await verifyMuseKey(serviceClient(), parsed.data.token);
  if (!principal) return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  return NextResponse.json({
    user_id: principal.userId,
    token_id: principal.tokenId,
    scopes: principal.scopes,
  }, { headers: { "Cache-Control": "no-store" } });
}
