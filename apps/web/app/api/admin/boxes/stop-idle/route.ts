/**
 * Operator bulk stop: arm an immediate idle stop for every running box on a
 * channel (default dev) instead of waiting for stop_after to elapse. The
 * rows go through the sweeper's own stop path (stopIdleBoxes), so each box
 * still has to grant its `ovctl stop-claim` lease and is never force-stopped
 * (C6): a box mid-turn or mid-index defers exactly as it would on the cron.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { isChannelName, type ChannelName } from "@/lib/fleet/channels";
import { stopIdleBoxes } from "@/lib/orchestrator/idleStop";
import type { SweepableBox } from "@/lib/orchestrator/sweep";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PAGE = 1000;
const RUNNING_STATES = ["ready", "idle"];

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { channel?: unknown } = {};
  const raw = await request.text();
  if (raw.trim()) {
    try {
      body = JSON.parse(raw) as { channel?: unknown };
    } catch {
      return NextResponse.json({ error: "invalid json" }, { status: 400 });
    }
  }
  let channel: ChannelName = "dev";
  if (body.channel !== undefined) {
    if (!isChannelName(body.channel)) {
      return NextResponse.json(
        { error: "channel must be dev or prod" },
        { status: 400 },
      );
    }
    channel = body.channel;
  }

  const supabase = serviceClient();
  const now = new Date();
  const nowIso = now.toISOString();
  const targets: SweepableBox[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from("boxes")
      .select("provider_box_id, user_id, last_active_at")
      .eq("channel", channel)
      .in("state", RUNNING_STATES)
      .order("provider_box_id", { ascending: true })
      .range(offset, offset + PAGE - 1);
    if (error) {
      return NextResponse.json(
        { error: `box list failed: ${error.message}` },
        { status: 500 },
      );
    }
    const rows = data ?? [];
    for (const row of rows) {
      // A deadline of "now" makes the box exactly zero overdue: the claim
      // path still decides, but the box is not held for its idle window.
      targets.push({
        provider_box_id: row.provider_box_id as string,
        user_id: row.user_id as string,
        stop_after: nowIso,
        last_active_at: (row.last_active_at as string | null) ?? null,
      });
    }
    if (rows.length < PAGE) break;
  }

  const report = await stopIdleBoxes(supabase, targets, now);
  return NextResponse.json({ channel, targeted: targets.length, ...report });
}
