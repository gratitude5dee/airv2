/**
 * CM7 proposal sweep entrypoint: Vercel cron, CRON_SECRET-authorized. Each
 * sweep asks every enabled source for new moments and lands them as proposed
 * slots plus a 'content_plan' decision — proposals only, the worker never
 * sees them until a human approves (CM7 task 4). Adding a source changes
 * lib/publish/sources/, never this handler (CM7 task 3).
 */
import { NextRequest, NextResponse } from "next/server";
import { cronAuthorized } from "@/lib/cron/auth";
import { serviceClient } from "@/lib/supabase";
import {
  candidateUsers,
  proposeForUser,
  type ProposeResult,
} from "@/lib/publish/propose";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!cronAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const userIds = await candidateUsers(supabase);

  const result: ProposeResult = {
    usersSwept: 0,
    momentsProposed: 0,
    slotsProposed: 0,
  };
  for (const userId of userIds) {
    try {
      const swept = await proposeForUser(supabase, userId);
      result.usersSwept += 1;
      result.momentsProposed += swept.momentsProposed;
      result.slotsProposed += swept.slotsProposed;
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "source sweep failed for user",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  return NextResponse.json({ ok: true, ...result });
}
