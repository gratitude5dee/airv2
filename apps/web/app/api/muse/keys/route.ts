import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { museEnabled } from "@/lib/muse/auth";
import { listMuseKeys, mintMuseKey } from "@/lib/muse/keys";
import { guardResponse, requireOwner } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ scopes: z.array(z.string()).min(1).max(12) });

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled()) return new NextResponse(null, { status: 404 });
  const auth = await requireOwner(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  return NextResponse.json({ keys: await listMuseKeys(serviceClient(), userId) }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled()) return new NextResponse(null, { status: 404 });
  const auth = await requireOwner(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  try {
    const result = await mintMuseKey(serviceClient(), userId, parsed.data.scopes);
    return NextResponse.json({ key: result.token, token: result.summary }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "key_unavailable" }, { status: 400 });
  }
}
