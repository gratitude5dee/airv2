/**
 * Owner-initiated mini-app link mint (M7.5). Only the authenticated owner
 * can cause a mint — tier-2 senders have no path here (C15).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { mintSignedLink } from "@/lib/miniapps/cards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const APPS = new Set(["kanban", "todo", "computer", "calendar"]);

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as { app?: string };
  const app = body.app ?? "";
  if (!APPS.has(app)) {
    return NextResponse.json({ error: "unknown app" }, { status: 400 });
  }
  return NextResponse.json({ url: mintSignedLink(userId, app, "default") });
}
