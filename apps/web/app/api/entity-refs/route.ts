/**
 * The caller's own @entity refs, metadata only — feeds the composer's
 * "References" palette group. No asset URLs are minted here (C4): signing
 * happens at render time inside the creative lanes.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { listEntityRefs } from "@/lib/identity/entityRefs";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const refs = await listEntityRefs(serviceClient(), userId);
  return NextResponse.json({
    refs: refs.map((ref) => ({
      name: ref.name,
      kind: ref.kind,
      label: ref.label,
    })),
  });
}
