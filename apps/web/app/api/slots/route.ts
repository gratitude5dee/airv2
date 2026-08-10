/**
 * CM4 calendar surface: a queue with consequences visible. GET returns the
 * user's slots plus per-lane cap headroom (what fires, what defers, what is
 * blocked on a decision); POST schedules a slot — refs and an instant plus
 * its authoring timezone, never content (CC2).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { requestSession } from "@/lib/auth/surface";
import { adapterFor } from "@/lib/publish/registry";
import {
  capHeadroom,
  isValidTimeZone,
  SLOT_PLATFORMS,
  zonedTimeToInstant,
  type CapHeadroom,
} from "@/lib/publish/slots";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SLOT_LIST_COLUMNS =
  "id, platform, account_ref, package_ref, scheduled_at, timezone, status, " +
  "attempt, external_id, permalink, last_verdict, error_message, published_at, created_at";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const { data, error } = await supabase
    .from("content_slots")
    .select(SLOT_LIST_COLUMNS)
    .eq("user_id", session.userId)
    .order("scheduled_at", { ascending: true })
    .limit(200);
  if (error) {
    return NextResponse.json({ error: "list failed" }, { status: 502 });
  }
  const slots = data ?? [];

  // Cap headroom per lane actually in use, so the calendar can say
  // "3 posts queued behind today's limit, next window 07:40".
  const lanes = new Map<string, { platform: string; account_ref: string }>();
  for (const slot of slots as unknown as Array<{
    platform: string;
    account_ref: string;
  }>) {
    lanes.set(`${slot.platform}\u0000${slot.account_ref}`, {
      platform: slot.platform,
      account_ref: slot.account_ref,
    });
  }
  const headroom: Array<
    { platform: string; account_ref: string } & CapHeadroom
  > = [];
  for (const lane of lanes.values()) {
    const adapter = adapterFor(lane.platform);
    if (!adapter) continue;
    headroom.push({
      ...lane,
      ...(await capHeadroom(
        supabase,
        session.userId,
        lane.platform,
        lane.account_ref,
        adapter.limits.dailyCap
      )),
    });
  }
  return NextResponse.json({ slots, headroom });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const session = await requestSession(supabase, request);
  if (!session) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    platform?: string;
    account_ref?: string;
    package_ref?: string;
    scheduled_at?: string;
    local_time?: string;
    timezone?: string;
  };
  const platform = body.platform ?? "";
  if (!(SLOT_PLATFORMS as readonly string[]).includes(platform)) {
    return NextResponse.json({ error: "invalid platform" }, { status: 400 });
  }
  if (!adapterFor(platform)) {
    return NextResponse.json(
      { error: "platform unavailable" },
      { status: 400 }
    );
  }
  if (!body.account_ref || !body.package_ref) {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }
  const timezone = body.timezone ?? "";
  if (!isValidTimeZone(timezone)) {
    return NextResponse.json({ error: "invalid timezone" }, { status: 400 });
  }
  let scheduledAt: Date;
  if (body.local_time) {
    try {
      scheduledAt = zonedTimeToInstant(body.local_time, timezone);
    } catch {
      return NextResponse.json({ error: "invalid local_time" }, { status: 400 });
    }
  } else if (body.scheduled_at) {
    scheduledAt = new Date(body.scheduled_at);
    if (Number.isNaN(scheduledAt.getTime())) {
      return NextResponse.json({ error: "invalid scheduled_at" }, { status: 400 });
    }
  } else {
    return NextResponse.json({ error: "invalid request" }, { status: 400 });
  }

  const inserted = await supabase
    .from("content_slots")
    .insert({
      user_id: session.userId,
      platform,
      account_ref: body.account_ref,
      package_ref: body.package_ref,
      scheduled_at: scheduledAt.toISOString(),
      timezone,
    })
    .select(SLOT_LIST_COLUMNS)
    .single();
  if (inserted.error) {
    return NextResponse.json({ error: "create failed" }, { status: 502 });
  }
  return NextResponse.json({ slot: inserted.data }, { status: 201 });
}
