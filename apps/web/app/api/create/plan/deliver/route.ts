/**
 * V12 §14.1 `POST /api/create/plan/deliver` — the Box asks the control
 * plane to attach `plan.md` to the owner's iMessage thread. Gateway token
 * only (the Planner runs in the Box). The file is read from the Box through
 * `readComputeFile` for this one send (≤ 64 KiB) and never retained or
 * logged (CR21); on an attachment failure the owner gets the first 12 lines
 * plus the Create-surface card. Returns the send receipt only.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { boxUserId } from "@/lib/auth/box";
import { PublishError, validateAppName } from "@/lib/miniapps/publish";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { BoxApiError } from "@/lib/box/client";
import { createSpectrumSender } from "@/lib/spectrum/sender";
import { PLAN_DELIVERIES_PER_HOUR, PlanError, deliverPlan } from "@/lib/create/plan";
import { overLimit, recordOpsEvent } from "@/lib/security/limits";
import { log } from "@/lib/log";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const HOUR_MS = 3_600_000;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await request.json().catch(() => null)) as {
    appname?: unknown;
    path?: unknown;
  } | null;
  if (typeof body?.appname !== "string" || typeof body?.path !== "string") {
    return NextResponse.json({ error: "appname and path required" }, { status: 400 });
  }
  try {
    const appname = validateAppName(body.appname);
    if (await overLimit(supabase, "plan", userId, PLAN_DELIVERIES_PER_HOUR, HOUR_MS)) {
      await recordOpsEvent(supabase, "rate_limited", userId, "plan");
      return NextResponse.json({ error: "too many plan deliveries" }, { status: 429 });
    }
    const sender = await createSpectrumSender();
    let receipt;
    try {
      receipt = await deliverPlan(supabase, sender, userId, { appname, path: body.path });
    } finally {
      await sender.close().catch(() => undefined);
    }
    await recordOpsEvent(supabase, "plan", userId, appname, receipt.bytes);
    log.info("plan delivered", {user_id: userId,
        appname,
        delivered: receipt.delivered,
        bytes: receipt.bytes,});
    return NextResponse.json(receipt);
  } catch (error) {
    if (error instanceof PlanError || error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BoxApiError && error.status === 404) {
      return NextResponse.json({ error: "plan file not found" }, { status: 404 });
    }
    if (error instanceof StartLimitError) {
      return NextResponse.json({ error: "busy" }, { status: 429 });
    }
    throw error;
  }
}
