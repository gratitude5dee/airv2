import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { hasMuseWorkerToken, museEnabled } from "@/lib/muse/auth";
import { recordMuseEvent } from "@/lib/muse/events";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({ user_id: z.string().uuid() });

/** Metadata-only audit of a relay poll. Command text stays inside the Worker DO. */
export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled() || !hasMuseWorkerToken(request)) return new NextResponse(null, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  await recordMuseEvent(serviceClient(), { userId: parsed.data.user_id, kind: "pull", status: "polled" });
  return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
