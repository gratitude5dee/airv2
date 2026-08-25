/**
 * Fleet sync jobs: POST starts a job converging a channel's boxes to its
 * current release (canary-first when canary_box_ids given); GET reports the
 * active/latest job with per-box states; PATCH pauses/resumes/aborts. The
 * actual box work happens on the cron sweep (runSyncJobs), a wave per tick.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import { isChannelName } from "@/lib/fleet/channels";
import { FleetError } from "@/lib/fleet/releases";
import { resumeJob, setJobState, startSyncJob } from "@/lib/fleet/sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
  const supabase = serviceClient();
  const { data: jobs } = await supabase
    .from("sync_jobs")
    .select()
    .order("created_at", { ascending: false })
    .limit(5);
  const latest = (jobs ?? [])[0] as { id: string } | undefined;
  let boxes: unknown[] = [];
  if (latest) {
    const { data } = await supabase
      .from("sync_job_boxes")
      .select()
      .eq("job_id", latest.id)
      .order("provider_box_id", { ascending: true });
    boxes = data ?? [];
  }
  return NextResponse.json({ jobs: jobs ?? [], latest_job_boxes: boxes });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: {
    channel?: unknown;
    canary_box_ids?: unknown;
    wave_size?: unknown;
    include_hermes?: unknown;
    failure_threshold?: unknown;
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
  const canaryBoxIds = Array.isArray(body.canary_box_ids)
    ? body.canary_box_ids.filter(
        (id): id is string => typeof id === "string"
      )
    : undefined;
  try {
    const job = await startSyncJob(serviceClient(), {
      channel: body.channel,
      canaryBoxIds,
      waveSize:
        typeof body.wave_size === "number" &&
        Number.isInteger(body.wave_size) &&
        body.wave_size >= 1 &&
        body.wave_size <= 10
          ? body.wave_size
          : undefined,
      includeHermes: body.include_hermes === true,
      failureThreshold:
        typeof body.failure_threshold === "number" &&
        Number.isInteger(body.failure_threshold) &&
        body.failure_threshold >= 1
          ? body.failure_threshold
          : undefined,
    });
    return NextResponse.json({ job }, { status: 201 });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { job_id?: unknown; action?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  if (typeof body.job_id !== "string") {
    return NextResponse.json({ error: "job_id required" }, { status: 400 });
  }
  const action = body.action;
  if (action !== "pause" && action !== "resume" && action !== "abort") {
    return NextResponse.json(
      { error: "action must be pause, resume, or abort" },
      { status: 400 }
    );
  }
  try {
    const supabase = serviceClient();
    if (action === "resume") {
      await resumeJob(supabase, body.job_id);
      return NextResponse.json({ job_id: body.job_id, state: "resumed" });
    }
    const state = action === "pause" ? "paused" : "aborted";
    await setJobState(supabase, body.job_id, state);
    return NextResponse.json({ job_id: body.job_id, state });
  } catch (error) {
    return errorResponse(error);
  }
}
