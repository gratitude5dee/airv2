/**
 * Server-fetched screenshot thumbnail (V8 Computer ▸ Screen): a real capture
 * taken inside the box via the Box command API — NOT a frame lifted from the
 * desktop stream. Never wakes a sleeping box, and the secret-bearing desktop
 * URL stays server-side (C3); the browser only ever receives PNG bytes.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import {
  captureScreenshotPng,
  ScreenshotError,
} from "@/lib/box/screenshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    const png = await captureScreenshotPng(box.provider_box_id);
    return new NextResponse(new Uint8Array(png), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    if (error instanceof ScreenshotError && error.code === "no_tool") {
      return NextResponse.json(
        { error: "no screenshot tool on this box" },
        { status: 501 }
      );
    }
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
