/**
 * Paired-device heartbeat (berd.goal.md §MA-B2). Berd checks in with its
 * bearer token; a revoked link fails here, which is how `Disconnect` takes
 * effect on the device's next contact. The envelope pull/push lane (§MA-B3)
 * extends this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { berdHeartbeat } from "@/lib/miniapps/berd/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !(await berdHeartbeat(serviceClient(), token))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
