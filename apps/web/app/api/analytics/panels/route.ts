/**
 * Strictly read-only gateway-token access to the existing reconciled
 * analytics panel library. This route owns no aggregation logic of its own.
 */
import { NextRequest, NextResponse } from "next/server";
import { allPanels, windowStart } from "@/lib/miniapps/analytics";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireBox } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;


export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await requireBox(supabase, request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;

  const since = windowStart();
  try {
    const panels = await allPanels(supabase, userId, since);
    return NextResponse.json({ since, panels });
  } catch {
    return NextResponse.json(
      { error: "analytics unavailable" },
      { status: 502 }
    );
  }
}
