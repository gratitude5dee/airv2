/**
 * MA2.4 device-code sign-in, step 1. A plugin (Codex / Claude Code) POSTs
 * {tool} and gets {device_code, user_code, verification_uri}. No side effect
 * beyond the pending row — the owner still has to approve in Settings.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { normalizeTool, startDeviceAuth } from "@/lib/plugin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as { tool?: string };
  const tool = normalizeTool(body.tool ?? "");
  if (!tool) {
    return NextResponse.json({ error: "unknown tool" }, { status: 400 });
  }
  const supabase = serviceClient();
  const started = await startDeviceAuth(
    supabase,
    tool,
    `${env.appOrigin()}/home`
  );
  return NextResponse.json(started, {
    headers: { "Cache-Control": "no-store" },
  });
}
