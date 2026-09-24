/**
 * V13 §9.1 `POST /api/create/jobs/:id/retry` — the mini-app's **Try
 * again** on a `stuck` or `failed` job, CF1-relayed to the Worker
 * (`instance.restart()` with `round` reset, §5.2). Only terminal states
 * retry — a live/cancelled/superseded job is a 409.
 */
import type { NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { BridgeError, bridgePost } from "@/lib/create/bridge";
import { getJob, JobError } from "@/lib/create/job";

export const dynamic = "force-dynamic";

const RETRYABLE = new Set(["stuck", "failed"]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const userId = storeSessionUserId(request);
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;

  try {
    const job = await getJob(serviceClient(), id);
    if (!job || job.user_id !== userId) {
      return Response.json({ error: "job not found" }, { status: 404 });
    }
    if (!RETRYABLE.has(job.state)) {
      return Response.json({ error: "job can't be retried" }, { status: 409 });
    }
    await bridgePost(`/v1/jobs/${job.id}/retry`, {});
    return Response.json({ ok: true });
  } catch (error) {
    if (error instanceof JobError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BridgeError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
