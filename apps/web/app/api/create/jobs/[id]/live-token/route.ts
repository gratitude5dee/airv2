/**
 * V13 §5.3 `GET /api/create/jobs/:id/live-token` — mints the short-lived
 * HMAC the progress mini-app opens its WebSocket (or polling fallback)
 * with. Store session only, owner of the job only; the worker re-verifies
 * the token + Origin on the socket itself, so this route never reveals
 * more than the job id.
 */
import type { NextRequest } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { createConfig } from "@/lib/create/config";
import { getJob, JobError } from "@/lib/create/job";
import { mintLiveToken } from "@/lib/create/bridge";
import { env } from "@/lib/env";

export const dynamic = "force-dynamic";

export async function GET(
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
    const token = mintLiveToken(job.id, job.user_id, createConfig.liveTokenTtlS());
    return Response.json({
      url: `${env.createJobsOrigin().replace(/^http/, "ws")}/v1/jobs/${job.id}/live`,
      token,
      expires_in: createConfig.liveTokenTtlS(),
    });
  } catch (error) {
    if (error instanceof JobError) {
      return Response.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
