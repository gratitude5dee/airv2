/**
 * Bot Chat SSE proxy (V7): re-streams /p/<name>/v1/runs/{id}/events through
 * the control plane so the hosted token and the bot's api_server_key never
 * reach the browser (C3).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { SSE_HEADERS } from "@/lib/chat/relay";
import { botEventStream } from "@/lib/bots/chat";
import { getBot } from "@/lib/bots/store";
import { isValidBotName } from "@/lib/bots/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ name: string; runId: string }> }
): Promise<Response> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name, runId } = await context.params;
  if (!isValidBotName(name) || !/^[A-Za-z0-9_-]+$/.test(runId)) {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }
  const supabase = serviceClient();
  const bot = await getBot(supabase, userId, name);
  if (!bot) {
    return NextResponse.json({ error: "bot not found" }, { status: 404 });
  }
  try {
    const stream = await botEventStream(supabase, userId, bot, runId);
    return new Response(stream, { headers: SSE_HEADERS });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "bot events proxy failed", user_id: userId, bot: name, error: message })
    );
    return NextResponse.json({ error: "stream failed" }, { status: 500 });
  }
}
