/**
 * Server-fetched screenshot thumbnail (V8 Computer ▸ Screen): a real capture
 * taken inside the box via the Box command API — NOT a frame lifted from the
 * desktop stream. Never wakes a sleeping box, and the secret-bearing desktop
 * URL stays server-side (C3); the browser only ever receives PNG bytes.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { command } from "@/lib/box/client";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Fixed script, no interpolation. Resolves the X display from the socket
// dir, prefers scrot, falls back to ImageMagick / gnome-screenshot, and
// emits the PNG as base64 on stdout. Exit 3 = no capture tool on this box.
const CAPTURE_SCRIPT = `set -e
d=$(ls /tmp/.X11-unix 2>/dev/null | head -1 | sed 's/^X/:/')
export DISPLAY=\${d:-:0}
f=/tmp/.air-screenshot.png
rm -f "$f"
if command -v scrot >/dev/null 2>&1; then scrot -o "$f"
elif command -v import >/dev/null 2>&1; then import -window root "$f"
elif command -v gnome-screenshot >/dev/null 2>&1; then gnome-screenshot -f "$f"
else echo "no screenshot tool" >&2; exit 3
fi
base64 -w0 "$f"`;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const { data } = await supabase
    .from("boxes")
    .select("provider_box_id, state")
    .eq("user_id", userId)
    .maybeSingle();
  const box = data as { provider_box_id: string; state: string } | null;
  if (!box) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  if (box.state !== "ready" && box.state !== "idle") {
    // A thumbnail must never wake the box.
    return NextResponse.json({ error: "asleep" }, { status: 409 });
  }
  try {
    const result = await command(box.provider_box_id, CAPTURE_SCRIPT, 45);
    if (result.exitCode === 3) {
      return NextResponse.json(
        { error: "no screenshot tool on this box" },
        { status: 501 }
      );
    }
    if (result.exitCode !== 0 || !result.stdout.trim()) {
      return NextResponse.json({ error: "capture failed" }, { status: 502 });
    }
    const png = Buffer.from(result.stdout.trim(), "base64");
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "screenshot capture failed",
        user_id: userId,
        error: error instanceof Error ? error.message : "unknown",
      })
    );
    return NextResponse.json({ error: "capture failed" }, { status: 502 });
  }
}
