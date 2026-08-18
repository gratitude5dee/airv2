/**
 * Rooms CRUD (V7): membership metadata only; the transcript lives in each
 * member's own "Group: <name>" Hermes session on the box (C4).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { listBots } from "@/lib/bots/store";
import { ROOM_MAX_MEMBERS, ROOM_MIN_MEMBERS } from "@/lib/bots/rooms";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, created_at, room_members(bot_id, bots(name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: true });
  return NextResponse.json({
    rooms: (rooms ?? []).map((room) => ({
      id: room.id as string,
      name: room.name as string,
      // Supabase types a to-one embed loosely; normalize object-or-array.
      members: ((room.room_members ?? []) as unknown as Array<{
        bots: { name: string } | { name: string }[] | null;
      }>)
        .flatMap((member) =>
          Array.isArray(member.bots) ? member.bots : member.bots ? [member.bots] : []
        )
        .map((bot) => bot.name)
        .filter((name): name is string => Boolean(name)),
    })),
  });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    name?: string;
    members?: string[];
  };
  const name = (body.name ?? "").trim().slice(0, 60);
  const memberNames = Array.isArray(body.members) ? body.members : [];
  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  if (
    memberNames.length < ROOM_MIN_MEMBERS ||
    memberNames.length > ROOM_MAX_MEMBERS
  ) {
    return NextResponse.json(
      { error: `rooms take ${ROOM_MIN_MEMBERS}-${ROOM_MAX_MEMBERS} members` },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  const roster = await listBots(supabase, userId);
  const members = memberNames.map((memberName) =>
    roster.find((bot) => bot.name === memberName && bot.status === "ready")
  );
  if (members.some((bot) => !bot)) {
    return NextResponse.json({ error: "unknown member" }, { status: 400 });
  }
  const { data: room, error } = await supabase
    .from("rooms")
    .insert({ user_id: userId, name })
    .select("id, name")
    .single();
  if (error || !room) {
    const status = error?.code === "23505" ? 409 : 500;
    return NextResponse.json({ error: "room create failed" }, { status });
  }
  const { error: memberError } = await supabase.from("room_members").insert(
    members.map((bot) => ({ room_id: room.id, bot_id: bot!.id }))
  );
  if (memberError) {
    await supabase.from("rooms").delete().eq("id", room.id);
    return NextResponse.json({ error: "room create failed" }, { status: 500 });
  }
  return NextResponse.json(
    { room: { id: room.id, name: room.name, members: memberNames } },
    { status: 201 }
  );
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { id?: string };
  const id = body.id ?? "";
  if (!/^[0-9a-f-]{36}$/.test(id)) {
    return NextResponse.json({ error: "bad room id" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { error } = await supabase
    .from("rooms")
    .delete()
    .eq("id", id)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: "delete failed" }, { status: 500 });
  }
  return NextResponse.json({ deleted: id });
}
