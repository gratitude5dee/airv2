/**
 * V13 §9.1 `POST /api/create/jobs/:id/cancel` — the mini-app's Cancel
 * button, CF1-relayed to the Worker (`instance.terminate()`). The job row's
 * `cancelled` fact lands through the job's own mirror (CF2): a relay that
 * never reaches Cloudflare leaves the row open, matching reality.
 */
import type { NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { BridgeError } from "@/lib/create/bridge";
import {
  getJob,
  JobError,
  OPEN_JOB_STATES,
  terminateJobWorkflow,
} from "@/lib/create/job";

export const dynamic = "force-dynamic";

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
    if (!OPEN_JOB_STATES.has(job.state)) {
      return Response.json({ error: "job already finished" }, { status: 409 });
    }
    await terminateJobWorkflow(job.id);
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
