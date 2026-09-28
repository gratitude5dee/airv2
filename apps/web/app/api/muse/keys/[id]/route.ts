import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { museEnabled } from "@/lib/muse/auth";
import { revokeMuseKey } from "@/lib/muse/keys";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  if (!museEnabled()) return new NextResponse(null, { status: 404 });
  const userId = await sessionUserId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await context.params;
  const revoked = await revokeMuseKey(serviceClient(), userId, id);
  return revoked ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "not_found" }, { status: 404 });
}
