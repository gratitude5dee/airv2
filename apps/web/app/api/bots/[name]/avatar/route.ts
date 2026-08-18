/**
 * Uploaded bot avatars (V7): the image lives in the bot's profile dir on the
 * box (~/.hermes/profiles/<name>/avatar.png) and is served through THIS
 * proxied read — the browser never sees a box URL (C3). Upload rewrites the
 * file and flips the row to avatar_kind='image'.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { command } from "@/lib/box/client";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import { BOT_NAME_PATTERN } from "@/lib/bots/client";
import { getBot } from "@/lib/bots/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const MAX_AVATAR_BYTES = 512 * 1024;

function avatarPath(name: string): string {
  return `/home/user/.hermes/profiles/${name}/avatar.png`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name } = await params;
  if (!BOT_NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "bad name" }, { status: 400 });
  }
  const supabase = serviceClient();
  const bot = await getBot(supabase, userId, name);
  if (!bot || bot.avatar_kind !== "image") {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const result = await command(box.boxId, `base64 -w0 ${avatarPath(name)}`, 60);
    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return NextResponse.json({ error: "not found" }, { status: 404 });
    }
    return new NextResponse(Buffer.from(result.stdout.trim(), "base64"), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "private, max-age=300",
      },
    });
  } catch {
    return NextResponse.json({ error: "box unavailable" }, { status: 503 });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ name: string }> }
): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { name } = await params;
  if (!BOT_NAME_PATTERN.test(name)) {
    return NextResponse.json({ error: "bad name" }, { status: 400 });
  }
  const supabase = serviceClient();
  const bot = await getBot(supabase, userId, name);
  if (!bot) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const bytes = Buffer.from(await request.arrayBuffer());
  // PNG magic — this proxy only ever serves image/png back out.
  if (
    bytes.length === 0 ||
    bytes.length > MAX_AVATAR_BYTES ||
    !bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))
  ) {
    return NextResponse.json(
      { error: "expected a PNG up to 512KB" },
      { status: 400 }
    );
  }
  try {
    const box = await ensureBoxAwake(supabase, userId);
    const b64 = bytes.toString("base64");
    const result = await command(
      box.boxId,
      `echo '${b64}' | base64 -d > ${avatarPath(name)}`,
      60
    );
    if (result.exitCode !== 0) {
      return NextResponse.json({ error: "write failed" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "box unavailable" }, { status: 503 });
  } finally {
    await armStopAfter(supabase, userId).catch(() => undefined);
  }
  // A version-bearing ref so the (cacheable) avatar URL changes on upload.
  const avatarRef = `v${Date.now()}`;
  await supabase
    .from("bots")
    .update({ avatar_kind: "image", avatar_ref: avatarRef })
    .eq("id", bot.id);
  return NextResponse.json({ avatar_kind: "image", avatar_ref: avatarRef });
}
