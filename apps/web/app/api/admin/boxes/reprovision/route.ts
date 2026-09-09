/**
 * Operator-only box replacement: fork a fresh box for an existing user from
 * the channel's current template, repoint the boxes row, and tear the old
 * instance down. For boxes too far behind for sync-box.sh to converge in
 * place. The user's account, line, and connectors are untouched; box-local
 * state (memory, sessions, user-installed skills) is lost, so callers opt in
 * per user.
 *
 * The caller names the box it means to replace (`box_id`); replaceBox leases
 * the row on that id (`boxes.replace_claimed_at`) before any compute is
 * built, so a retry after the row has moved on, or a second overlapping
 * replacement for the same user (another operator call, or the user's own
 * onboarding environment switch), is a 409 rather than a second fork that
 * would leave an instance orphaned. The new box keeps the old one's channel.
 *
 * A fork that fails before the row is repointed is a plain 500 with the
 * claim released; if the new box is already live and only its post-fork
 * setup failed, the 500 carries `committed: true` and the new `box_id`, since
 * that is now the user's box and the one a retry must name.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { providerOf, type BoxProvider } from "@/lib/box/client";
import { toComputeEnvironment } from "@/lib/compute/environments";
import {
  ReplaceInProgressError,
  SwitchSetupError,
  replaceBox,
} from "@/lib/provisioning/provision";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/**
 * Must stay under the replacement lease TTL (provision.REPLACE_CLAIM_TTL_MS)
 * or a live replace can be taken over.
 */
export const maxDuration = 300;

function isBoxProvider(value: unknown): value is BoxProvider {
  return value === "ascii" || value === "tenki";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: unknown;
    box_id?: unknown;
    provider?: unknown;
  };
  if (typeof body.user_id !== "string" || body.user_id.length === 0) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  if (typeof body.box_id !== "string" || body.box_id.length === 0) {
    return NextResponse.json({ error: "box_id required" }, { status: 400 });
  }
  if (body.provider !== undefined && !isBoxProvider(body.provider)) {
    return NextResponse.json(
      { error: "provider must be ascii or tenki" },
      { status: 400 },
    );
  }
  const userId = body.user_id;
  const boxId = body.box_id;

  const supabase = serviceClient();
  const { data: box, error } = await supabase
    .from("boxes")
    .select("provider, provider_box_id, environment")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!box) {
    return NextResponse.json({ error: "no box for user" }, { status: 404 });
  }
  const current = box as {
    provider: string | null;
    provider_box_id: string;
    environment: string | null;
  };
  if (current.provider_box_id !== boxId) {
    return NextResponse.json(
      { error: "box_id does not match the user's current box" },
      { status: 409 },
    );
  }

  const environment = toComputeEnvironment(current.environment);
  const provider = body.provider ??
    (isBoxProvider(current.provider)
      ? current.provider
      : providerOf(current.provider_box_id));
  if (provider === "tenki" && environment !== "ubuntu") {
    return NextResponse.json(
      { error: "tenki provider supports ubuntu only" },
      { status: 400 },
    );
  }
  try {
    const result = await replaceBox(
      supabase,
      userId,
      boxId,
      environment,
      provider,
    );
    return NextResponse.json({
      user_id: result.userId,
      previous_box_id: boxId,
      box_id: result.boxId,
      environment: result.environment,
      provider,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    if (err instanceof ReplaceInProgressError) {
      return NextResponse.json(
        { error: "box is already being replaced" },
        { status: 409 },
      );
    }
    if (err instanceof SwitchSetupError) {
      return NextResponse.json(
        {
          error: message,
          committed: true,
          previous_box_id: boxId,
          box_id: err.boxId,
        },
        { status: 500 },
      );
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
