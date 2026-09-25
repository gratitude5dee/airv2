import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { museEnabled } from "@/lib/muse/auth";
import { revokeMuseKey } from "@/lib/muse/keys";
import { guardResponse, requireOwner } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!museEnabled()) return new NextResponse(null, { status: 404 });
  const auth = await requireOwner(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  const { id } = await context.params;
  const revoked = await revokeMuseKey(serviceClient(), userId, id);
  return revoked ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
