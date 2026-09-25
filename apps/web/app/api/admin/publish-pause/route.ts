/**
 * CM8 task 5: per-user publish kill switch. Flips users.publish_paused —
 * the publish sweep skips paused users without modifying their slots, so
 * unpausing resumes the calendar exactly where it stood. The global switch
 * is the PUBLISH_KILL_SWITCH env var checked at the top of the sweep.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    paused?: boolean;
  };
  if (!body.user_id || typeof body.paused !== "boolean") {
    return NextResponse.json(
      { error: "user_id and paused required" },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("users")
    .update({ publish_paused: body.paused })
    .eq("id", body.user_id)
    .select("id, publish_paused")
    .maybeSingle();
  if (error || !data) {
    return NextResponse.json({ error: "user not found" }, { status: 404 });
  }
  return NextResponse.json({
    user_id: data.id,
    publish_paused: data.publish_paused,
  });
}
