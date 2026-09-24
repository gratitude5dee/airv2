/**
 * V13 §9.1 `POST /api/internal/create/tests` — the job's snapshot-tests
 * step: what `air.json.tests` declares right now, so the job can lock the
 * Planner's ids before any Builder turn runs. Body (CF1-signed):
 *
 *   { job_id }
 *
 * Response: `{ ids, locked, tests }` — ids plus the DSL bodies (selectors,
 * wait budgets, assertion text) the check step executes; ids and test
 * shapes are metadata the CF worker needs, never prompt or source text
 * (CF5).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { adapterErrorResponse, adapterJob } from "@/lib/create/adapter";
import { getRegistryAppById } from "@/lib/miniapps/registry";
import { ensureComputeAwake } from "@/lib/compute/awake";
import { readComputeFile } from "@/lib/compute/runtime";
import { parseAirJson, workspacePath } from "@/lib/create/build";
import { lockedIds } from "@/lib/create/tests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  try {
    const { job } = await adapterJob<{ job_id?: unknown }>(supabase, request);
    const app = await getRegistryAppById(supabase, job.app_id);
    if (!app || !app.appname) {
      return NextResponse.json({ error: "app not found" }, { status: 404 });
    }
    const target = await ensureComputeAwake(supabase, job.user_id);
    const text = await readComputeFile(target, `${workspacePath(app.appname)}/air.json`).catch(
      () => null
    );
    const parsed = text === null ? null : parseAirJson(text);
    const tests = parsed?.air?.tests ?? [];
    return NextResponse.json({
      ids: tests.map((test) => test.id),
      locked: lockedIds(tests),
      tests,
    });
  } catch (error) {
    const response = adapterErrorResponse(error);
    if (response) return response as NextResponse;
    throw error;
  }
}
