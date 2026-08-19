/**
 * Username (M3 step 6): case-insensitive unique (citext), reserved words,
 * 30-day cooldown enforced by the DB trigger — a violation surfaces the
 * eligible date from the trigger's detail.
 */
import { NextRequest, NextResponse } from "next/server";
import { sessionUserId } from "@/lib/auth/user";
import { serviceClient } from "@/lib/supabase";
import { provisionEmail } from "@/lib/provisioning/email";
import { isReservedWord } from "@/lib/miniapps/reserved";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const USERNAME_PATTERN = /^[a-z0-9_]{2,24}$/;

export async function PUT(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    username?: string;
  };
  const username = (body.username ?? "").toLowerCase().trim();
  if (!USERNAME_PATTERN.test(username) || isReservedWord(username)) {
    return NextResponse.json({ error: "invalid username" }, { status: 400 });
  }
  const supabase = serviceClient();
  // MA3 both-directions collision check: a username may not claim a word
  // that is already a registry slug (bare first-party slugs are also in the
  // reserved list; this catches anything registered since).
  const { data: slugClash } = await supabase
    .from("mini_apps")
    .select("id")
    .eq("slug", username)
    .maybeSingle();
  if (slugClash) {
    return NextResponse.json({ error: "invalid username" }, { status: 400 });
  }
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
