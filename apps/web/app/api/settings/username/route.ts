/**
 * Username (M3 step 6): case-insensitive unique (citext), reserved words,
 * 30-day cooldown enforced by the DB trigger — a violation surfaces the
 * eligible date from the trigger's detail. The write itself is shared with
 * the MA5 settings/onboarding mini-apps (lib/settings/account.ts).
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { setUsername } from "@/lib/settings/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
  };
  const result = await setUsername(serviceClient(), userId, body.username ?? "");
  if (!result.ok) {
    if (result.error === "invalid") {
      return NextResponse.json({ error: "invalid username" }, { status: 400 });
    }
    if (result.error === "cooldown") {
      return NextResponse.json(
        { error: "cooldown", eligible: result.eligible },
        { status: 409 }
      );
    }
    if (result.error === "taken") {
      return NextResponse.json({ error: "taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  return NextResponse.json({
    ok: true,
    username: result.username,
    address: result.address,
  });
}
