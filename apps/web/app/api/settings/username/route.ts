/**
 * Username (M3 step 6): case-insensitive unique (citext), reserved words,
 * 30-day cooldown enforced by the DB trigger — a violation surfaces the
 * eligible date from the trigger's detail.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { provisionEmail } from "@/lib/provisioning/email";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9_]{2,24}$/;
const RESERVED = new Set([
  "admin", "air", "api", "app", "billing", "help", "mail", "root",
  "security", "support", "system", "team", "wzrd", "www",
]);

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
  };
  const username = (body.username ?? "").toLowerCase().trim();
  if (!USERNAME_PATTERN.test(username) || RESERVED.has(username)) {
    return NextResponse.json({ error: "invalid username" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { error } = await supabase
    .from("users")
    .update({ username })
    .eq("id", userId);
  if (error) {
    if (error.message.includes("username_cooldown_active")) {
      return NextResponse.json(
        { error: "cooldown", eligible: error.details ?? null },
        { status: 409 }
      );
    }
    if (error.code === "23505") {
      return NextResponse.json({ error: "taken" }, { status: 409 });
    }
    return NextResponse.json({ error: "update failed" }, { status: 500 });
  }
  let address: string | null = null;
  try {
    const email = await provisionEmail(supabase, userId, username);
    address = email.address;
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "email provisioning failed",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
  return NextResponse.json({ ok: true, username, address });
}
