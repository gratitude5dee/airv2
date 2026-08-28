/**
 * Owner-initiated mini-app link mint (M7.5, registry-driven since MA1).
 * Only the authenticated owner can cause a mint — tier-2 senders have no
 * path here (C15). Also mints the MA0 store handoff:
 * {target:"store"} → a single-use /api/mini/session?t=… URL on the mini
 * origin that logs the owner into the store.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import { env } from "@/lib/env";
import { mintSignedLink } from "@/lib/miniapps/cards";
import { getRegistryApp } from "@/lib/miniapps/registry";
import { mintStoreHandoffToken } from "@/lib/miniapps/storeSession";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    app?: string;
    target?: string;
  };
  if (body.target === "store") {
    return NextResponse.json({
      url: `${env.miniappOrigin()}/api/mini/session?t=${mintStoreHandoffToken(userId)}`,
    });
  }
  const slug = body.app ?? "";
  const app = await getRegistryApp(serviceClient(), slug);
  if (!app || app.status !== "published") {
    return NextResponse.json({ error: "unknown app" }, { status: 400 });
  }
  // /home launches into a real browser window, so the session is not a
  // Messages card and apps render their full (non-lite) experience.
  return NextResponse.json({ url: mintSignedLink(userId, slug, "default") });
}
