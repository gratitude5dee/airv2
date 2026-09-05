/**
 * Operator-only box replacement: fork a fresh box for an existing user from
 * the channel's current template, repoint the boxes row, and tear the old
 * instance down. For boxes too far behind for sync-box.sh to converge in
 * place. The user's account, line, and connectors are untouched; box-local
 * state (memory, sessions, user-installed skills) is lost, so callers opt in
 * per user.
 *
 * The caller names the box it means to replace (`box_id`) and the row is
 * claimed with a conditional update before any compute is built, so a retry
 * after the row has moved on, or a second overlapping call for the same
 * user, is a 409 rather than a second fork that would leave an instance
 * orphaned.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { toComputeEnvironment } from "@/lib/compute/environments";
import { switchEnvironment } from "@/lib/provisioning/provision";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CLAIM_STATE = "provisioning";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: unknown;
    box_id?: unknown;
  };
  if (typeof body.user_id !== "string" || body.user_id.length === 0) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  if (typeof body.box_id !== "string" || body.box_id.length === 0) {
    return NextResponse.json({ error: "box_id required" }, { status: 400 });
  }
  const userId = body.user_id;
  const boxId = body.box_id;

  const supabase = serviceClient();
  const { data: box, error } = await supabase
    .from("boxes")
    .select("provider_box_id, environment, state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!box) {
    return NextResponse.json({ error: "no box for user" }, { status: 404 });
  }
  const current = box as {
    provider_box_id: string;
    environment: string | null;
    state: string;
  };
  if (current.provider_box_id !== boxId) {
    return NextResponse.json(
      { error: "box_id does not match the user's current box" },
      { status: 409 },
    );
  }

  const { data: claimed, error: claimError } = await supabase
    .from("boxes")
    .update({ state: CLAIM_STATE })
    .eq("user_id", userId)
    .eq("provider_box_id", boxId)
    .neq("state", CLAIM_STATE)
    .select("provider_box_id");
  if (claimError) {
    return NextResponse.json({ error: claimError.message }, { status: 500 });
  }
  if (!claimed || claimed.length === 0) {
    return NextResponse.json(
      { error: "box is already being replaced" },
      { status: 409 },
    );
  }

  const environment = toComputeEnvironment(current.environment);
  try {
    const result = await switchEnvironment(supabase, userId, environment);
    return NextResponse.json({
      user_id: result.userId,
      previous_box_id: boxId,
      box_id: result.boxId,
      environment: result.environment,
    });
  } catch (err) {
    await supabase
      .from("boxes")
      .update({ state: current.state })
      .eq("user_id", userId)
      .eq("provider_box_id", boxId)
      .eq("state", CLAIM_STATE);
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
