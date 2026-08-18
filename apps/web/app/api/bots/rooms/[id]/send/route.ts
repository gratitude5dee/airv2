/**
 * Room send (V7): one user message → up to 3 serial rounds of sequential
 * member turns, hard-capped and budget-guarded in lib/bots/rooms. The
 * labelled transcript accumulates in each member's "Group: <name>" session
 * on the box; this route returns only the turn's attributed messages.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { listBots, type BotRow } from "@/lib/bots/store";
import { orchestrateRoomTurn, type RoomRow } from "@/lib/bots/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "bad room id" }, { status: 400 });
  }
  const body = (await request.json().catch(() => ({}))) as { input?: string };
  const input = (body.input ?? "").trim();
  if (!input) {
    return NextResponse.json({ error: "input required" }, { status: 400 });
  }

  const supabase = serviceClient();
  const { data: room } = await supabase
    .from("rooms")
    .select("id, user_id, name, created_at")
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (!room) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const { data: memberRows } = await supabase
    .from("room_members")
    .select("bot_id")
    .eq("room_id", id);
  const memberIds = new Set((memberRows ?? []).map((row) => row.bot_id as string));
  const roster = await listBots(supabase, userId);
  const members = roster.filter(
    (bot): bot is BotRow => memberIds.has(bot.id) && bot.status === "ready"
  );
  if (members.length === 0) {
    return NextResponse.json({ error: "no ready members" }, { status: 409 });
  }

  try {
    const result = await orchestrateRoomTurn(
      supabase,
      userId,
      room as RoomRow,
      members,
      input
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "room turn failed",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return NextResponse.json({ error: "room turn failed" }, { status: 502 });
  }
}
