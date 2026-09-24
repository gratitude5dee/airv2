/**
 * V13 §4.4 web parity `POST /api/create/jobs/:id/request` — "Describe a
 * fix" on the stuck screen: the owner's sentence goes into the workspace as
 * `intake/changes/<n>.md` (CF5 — the Box reads it there, never through
 * Cloudflare), and the reply names the file so the studio's next `go`
 * (kind=change) can cite it.
 *
 *   { text }
 *   → { change_file }
 *
 * Store session; the job must be the caller's own. The text is a file on
 * the owner's Box — it never lands on a job row or in logs.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { getJob } from "@/lib/create/job";
import { getRegistryAppById } from "@/lib/miniapps/registry";
import { ensureComputeAwake } from "@/lib/compute/awake";
import { writeComputeFile, runCommand } from "@/lib/compute/runtime";
import { workspacePath } from "@/lib/create/build";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TEXT_MAX = 2000;

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const { id } = await context.params;
  const userId = storeSessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as { text?: unknown } | null;
  const text = typeof body?.text === "string" ? body.text.trim() : "";
  if (text === "" || text.length > TEXT_MAX) {
    return NextResponse.json({ error: "text required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const job = await getJob(supabase, id);
  if (!job || job.user_id !== userId) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const app = await getRegistryAppById(supabase, job.app_id);
  if (!app || !app.appname) {
    return NextResponse.json({ error: "app not found" }, { status: 404 });
  }
  const target = await ensureComputeAwake(supabase, userId);
  const ws = workspacePath(app.appname);
  const count = await runCommand(
    target,
    `mkdir -p "${ws}/intake/changes" && ls "${ws}/intake/changes" | wc -l`,
    30
  ).catch(() => null);
  const next = count && count.exitCode === 0 ? Number.parseInt(count.stdout.trim(), 10) + 1 : 1;
  const file = `intake/changes/${Number.isFinite(next) && next > 0 ? next : 1}.md`;
  await writeComputeFile(target, `${ws}/${file}`, `${text}\n`);
  return NextResponse.json({ change_file: file });
}
