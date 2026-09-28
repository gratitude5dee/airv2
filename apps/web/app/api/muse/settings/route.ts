import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { serviceClient } from "@/lib/supabase";
import { museEnabled } from "@/lib/muse/auth";
import { getMuseSettings, saveMuseSettings } from "@/lib/muse/settings";
import { guardResponse, requireOwner } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  updates_enabled: z.boolean().optional(),
  quiet_hours: z.object({ start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/), end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/) }).optional(),
  daily_cap: z.number().int().min(0).max(120).optional(),
  mode_default: z.enum(["off", "30m", "until_off"]).optional(),
  wake_email: z.boolean().optional(),
});

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled()) return new NextResponse(null, { status: 404 });
  const auth = await requireOwner(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  return NextResponse.json({ settings: await getMuseSettings(serviceClient(), userId) });
}

export async function PUT(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled()) return new NextResponse(null, { status: 404 });
  const auth = await requireOwner(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const userId = auth.userId;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  return NextResponse.json({ settings: await saveMuseSettings(serviceClient(), userId, parsed.data) });
}
