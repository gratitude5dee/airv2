/**
 * Bot Chat (V7): one persistent canonical session per bot ("Bot Chat" — the
 * bot-mode probe contract). POST runs a turn (or `/compress` for the
 * "Compact context" control — Hermes' in-session compaction command; there
 * is no /new for bot chats). GET returns the canonical session history.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { startBotChatRun, botChatMessages } from "@/lib/bots/chat";
import { getBot } from "@/lib/bots/store";
import { isValidBotName } from "@/lib/bots/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name } = await context.params;
  if (!isValidBotName(name)) {
    return NextResponse.json({ error: "bad bot name" }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    input?: string;
    action?: string;
  };
  const input =
    body.action === "compact" ? "/compress" : (body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "empty input" }, { status: 400 });
  }
  const supabase = serviceClient();
  const bot = await getBot(supabase, userId, name);
  if (!bot || bot.status !== "ready") {
    return NextResponse.json({ error: "bot not found" }, { status: 404 });
  }
  try {
    const runId = await startBotChatRun(supabase, userId, bot, input, "web");
    return NextResponse.json({ run_id: runId });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "box is rate limited" }, { status: 429 });
    }
    const message = error instanceof Error ? error.message : "unknown error";
    console.error(
      JSON.stringify({ msg: "bot chat run failed", user_id: userId, bot: name, error: message })
    );
    return NextResponse.json({ error: "run failed" }, { status: 502 });
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name } = await context.params;
  if (!isValidBotName(name)) {
    return NextResponse.json({ error: "bad bot name" }, { status: 400 });
  }
  const supabase = serviceClient();
  const bot = await getBot(supabase, userId, name);
  if (!bot) {
    return NextResponse.json({ error: "bot not found" }, { status: 404 });
  }
  try {
    const messages = await botChatMessages(supabase, userId, bot);
    return NextResponse.json({
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
    });
  } catch (error) {
    if (error instanceof StartLimitError) {
      return NextResponse.json({ messages: [], box_asleep: true });
    }
    return NextResponse.json({ messages: [] });
  }
}
