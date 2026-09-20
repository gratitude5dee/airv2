import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { hasMuseWorkerToken, museEnabled } from "@/lib/muse/auth";
import { sendMuseUpdate } from "@/lib/muse/notify";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const Agent = z.string().trim().regex(/^[a-z0-9][a-z0-9 _-]{0,31}$/i);
const Body = z.object({
  user_id: z.string().uuid(),
  agent: Agent,
  text: z.string().min(1).max(900),
  kind: z.enum(["info", "question", "done", "alert"]).default("info"),
});

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled() || !hasMuseWorkerToken(request)) return new NextResponse(null, { status: 404 });
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const result = await sendMuseUpdate(serviceClient(), {
    userId: parsed.data.user_id,
    agent: parsed.data.agent,
    text: parsed.data.text,
    kind: parsed.data.kind,
  });
  const status = result.reason === "daily_cap" ? 429 : result.deferred ? 202 : 200;
  return NextResponse.json(result, { status, headers: { "Cache-Control": "no-store" } });
}
