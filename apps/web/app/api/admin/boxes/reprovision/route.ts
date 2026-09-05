/**
 * Operator-only box replacement: fork a fresh box for an existing user from
 * the channel's current template, repoint the boxes row, and tear the old
 * instance down. For boxes too far behind for sync-box.sh to converge in
 * place. The user's account, line, and connectors are untouched; box-local
 * state (memory, sessions, user-installed skills) is lost, so callers opt in
 * per user.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { toComputeEnvironment } from "@/lib/compute/environments";
import { switchEnvironment } from "@/lib/provisioning/provision";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: unknown;
  };
  if (typeof body.user_id !== "string" || body.user_id.length === 0) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data: box, error } = await supabase
    .from("boxes")
    .select("provider_box_id, environment")
    .eq("user_id", body.user_id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!box) {
    return NextResponse.json({ error: "no box for user" }, { status: 404 });
  }
  const environment = toComputeEnvironment(
    (box as { environment: string | null }).environment,
  );
  try {
    const result = await switchEnvironment(supabase, body.user_id, environment);
    return NextResponse.json({
      user_id: result.userId,
      previous_box_id: (box as { provider_box_id: string }).provider_box_id,
      box_id: result.boxId,
      environment: result.environment,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
