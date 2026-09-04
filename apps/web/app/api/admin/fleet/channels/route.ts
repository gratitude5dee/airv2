/**
 * Fleet channels: GET lists dev/prod pointers; POST points a channel at a
 * release (deploy-to-dev, promote-to-prod, and rollback are all this call)
 * or sets the channel's template box for new forks. A release move may carry
 * `expected_release_id` (a release id, or null for "no release yet"): the
 * move then applies only while the channel still points there and answers
 * 409 otherwise.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import {
  isChannelName,
  listChannels,
  setChannelRelease,
  setChannelTemplateBox,
} from "@/lib/fleet/channels";
import { FleetError } from "@/lib/fleet/releases";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function errorResponse(error: unknown): NextResponse {
  if (error instanceof FleetError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  const message = error instanceof Error ? error.message : "internal error";
  return NextResponse.json({ error: message }, { status: 500 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const channels = await listChannels(serviceClient());
    return NextResponse.json({ channels });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    channel?: unknown;
    release_id?: unknown;
    expected_release_id?: unknown;
    template_box_id?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (!isChannelName(body.channel)) {
    return NextResponse.json(
      { error: "channel must be dev or prod" },
      { status: 400 }
    );
  }
  try {
    const supabase = serviceClient();
    if (typeof body.release_id === "string") {
      const expected = body.expected_release_id;
      if (
        expected !== undefined &&
        expected !== null &&
        (typeof expected !== "string" || !UUID_RE.test(expected))
      ) {
        return NextResponse.json(
          { error: "expected_release_id must be a release id or null" },
          { status: 400 }
        );
      }
      const release = await setChannelRelease(
        supabase,
        body.channel,
        body.release_id,
        expected
      );
      return NextResponse.json({ channel: body.channel, release });
    }
    if (typeof body.template_box_id === "string") {
      await setChannelTemplateBox(supabase, body.channel, body.template_box_id);
      return NextResponse.json({
        channel: body.channel,
        template_box_id: body.template_box_id,
      });
    }
    return NextResponse.json(
      { error: "release_id or template_box_id required" },
      { status: 400 }
    );
  } catch (error) {
    return errorResponse(error);
  }
}
