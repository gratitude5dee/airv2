import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { sendMuseReply } from "@/lib/muse/notify";
import { guardResponse, requireWorker } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 15;

const Agent = z.string().trim().regex(/^[a-z0-9][a-z0-9 _-]{0,31}$/i);
const Body = z.object({ user_id: z.string().uuid(), command_id: z.string().uuid(), agent: Agent, text: z.string().min(1).max(900) });

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireWorker(request, "muse").catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const delivered = await sendMuseReply(serviceClient(), {
    userId: parsed.data.user_id,
    agent: parsed.data.agent,
    text: parsed.data.text,
  });
  return NextResponse.json({ delivered }, { headers: { "Cache-Control": "no-store" } });
}
