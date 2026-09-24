/**
 * Operator delivery log: GET /api/admin/deliveries?user_id=&days=&limit=
 *
 * Reads the schedule_deliveries ledger — what each claimed schedule tick
 * sent or suppressed — joined to the schedule's name so the admin answer
 * to "why did I get this text" is one query away. Metadata only (C4): the
 * excerpt column is the bounded snippet the sweep already truncates.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_DAYS = 90;
const MAX_LIMIT = 500;

export async function GET(request: NextRequest): Promise<Response> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const params = request.nextUrl.searchParams;
  const userId = params.get("user_id");
  if (userId && !UUID.test(userId)) {
    return NextResponse.json(
      { error: "user_id must be a uuid" },
      { status: 400 }
    );
  }
  const daysParam = params.get("days");
  const days = daysParam ? Number(daysParam) : 7;
  if (!Number.isInteger(days) || days < 1 || days > MAX_DAYS) {
    return NextResponse.json(
      { error: `days must be an integer 1-${MAX_DAYS}` },
      { status: 400 }
    );
  }
  const limitParam = params.get("limit");
  const limit = limitParam ? Number(limitParam) : 200;
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) {
    return NextResponse.json(
      { error: `limit must be an integer 1-${MAX_LIMIT}` },
      { status: 400 }
    );
  }

  const supabase = serviceClient();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();
  let query = supabase
    .from("schedule_deliveries")
    .select(
      "id, user_id, schedule_id, channel, disposition, content_hash, excerpt, created_at, agent_schedules(name, cron, timezone, deliver, status)"
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: "query failed" }, { status: 500 });
  }
  const rows = (data ?? []).map((row) => {
    const schedule = Array.isArray(row.agent_schedules)
      ? row.agent_schedules[0]
      : row.agent_schedules;
    return {
      id: row.id,
      user_id: row.user_id,
      schedule_id: row.schedule_id,
      schedule_name:
        (schedule as { name?: string } | null)?.name ?? null,
      channel: row.channel,
      disposition: row.disposition,
      content_hash: row.content_hash,
      excerpt: row.excerpt,
      created_at: row.created_at,
    };
  });
  return NextResponse.json({ deliveries: rows, days });
}
