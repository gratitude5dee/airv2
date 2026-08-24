/**
 * Bound-signer heartbeat (buzz.goal.md §MA-Z2). The signer side checks in
 * with its bearer token; a revoked binding fails here, which is how
 * `Disconnect` takes effect on the next contact. The intent lane (§MA-Z3)
 * extends this endpoint.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { buzzHeartbeat } from "@/lib/miniapps/buzz/link";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = request.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (!token || !(await buzzHeartbeat(serviceClient(), token))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  return NextResponse.json({ ok: true });
}
