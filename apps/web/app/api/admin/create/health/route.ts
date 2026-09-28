/**
 * V13 §12 `GET /api/admin/create/health` — the Create page's "is the lane
 * ready" card: Vercel-side env (bridge/live secrets, jobs origin), the
 * Worker's `/v1/health` probe, and the skill floor in force. A 200 body
 * names each check's verdict so the admin panel can point at the exact
 * missing piece; the row itself is `ok` only when everything is.
 */
import { NextRequest, NextResponse } from "next/server";
import { createLaneReady, resetReadyCaches } from "@/lib/create/ready";
import { createConfig } from "@/lib/create/config";
import { guardResponse, requireAdmin } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAdmin(request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  if (request.nextUrl.searchParams.get("bust") === "1") resetReadyCaches();
  const readiness = await createLaneReady();
  return NextResponse.json({
    ok: readiness.ok,
    checks: readiness.checks,
    reasons: readiness.reasons,
    skill_version_min: createConfig.skillVersionMin(),
    max_fix_rounds: createConfig.maxFixRounds(),
    compile_max_per_turn: createConfig.compileMaxPerTurn(),
    dev_origin_suffix: createConfig.devOriginSuffix(),
  });
}
