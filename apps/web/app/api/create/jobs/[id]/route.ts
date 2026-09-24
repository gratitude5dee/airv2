/**
 * V13 §5.2 `GET /api/create/jobs/:id` — the mini-app's same-origin poll
 * fallback: the job view the progress screen renders. The primary channel
 * is the OwnerRoom WebSocket (§5.3); this keeps the screen truthful on
 * networks that drop WS, and in local dev where the worker isn't up.
 *
 * Store session; the job is only ever the caller's own (RLS `own_jobs`).
 */
import { NextRequest, NextResponse } from "next/server";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { serviceClient } from "@/lib/supabase";
import { getJob, jobView } from "@/lib/create/job";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const job = await getJob(serviceClient(), id);
  if (!job || job.user_id !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ job: jobView(job) });
}
