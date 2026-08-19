/**
 * MA2.4 Settings surface for plugin sign-in. Owner session only (the web
 * session cookie — never a plugin token, never anything a tier-2 sender can
 * reach): list tokens, approve/deny a pending user code (shows the
 * requesting tool), revoke a token with immediate effect.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import {
  approveDeviceCode,
  listPluginTokens,
  revokePluginToken,
} from "@/lib/plugin/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const tokens = await listPluginTokens(supabase, userId);
  return NextResponse.json({ tokens });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    action?: string;
    user_code?: string;
    token_id?: string;
  };
  const supabase = serviceClient();

  if (body.action === "approve" || body.action === "deny") {
    if (!body.user_code) {
      return NextResponse.json({ error: "missing user_code" }, { status: 400 });
    }
    const tool = await approveDeviceCode(
      supabase,
      body.user_code,
      userId,
      body.action === "approve" ? "approved" : "denied"
    );
    if (!tool) {
      return NextResponse.json(
        { error: "code not found or expired" },
        { status: 404 }
      );
    }
    return NextResponse.json({ ok: true, tool });
  }

  if (body.action === "revoke") {
    if (!body.token_id) {
      return NextResponse.json({ error: "missing token_id" }, { status: 400 });
    }
    const revoked = await revokePluginToken(supabase, userId, body.token_id);
    if (!revoked) {
      return NextResponse.json({ error: "token not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
