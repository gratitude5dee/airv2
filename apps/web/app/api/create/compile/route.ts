/**
 * V13 §8 `POST /api/create/compile` — `air-create compile` in the job lane:
 * the dry-run a code or fix turn may call up to `CREATE_COMPILE_MAX_PER_TURN`
 * (5) times. Pull → compile → findings; nothing is stored, staged or
 * deployed. The turn cap is counted on `create.compile` ops events against
 * the app's open `create:<slug>` run row — no schema change, and a Box
 * with no open run for that app cannot compile at all (a stale or
 * cross-project skill gets a 409, not a free check).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { boxUserId } from "@/lib/auth/box";
import {
  PublishError,
  publisherUsername,
  slugFor,
  validateAppName,
} from "@/lib/miniapps/publish";
import { createConfig } from "@/lib/create/config";
import { createRunLabel } from "@/lib/create/budget";
import {
  BuildError,
  compileWorkspace,
  pullWorkspace,
  workspacePath,
} from "@/lib/create/build";
import { ensureComputeAwake } from "@/lib/compute/awake";
import { isBoxEnvironment } from "@/lib/compute/environments";
import { readComputeFile } from "@/lib/compute/runtime";
import { armStopAfter } from "@/lib/orchestrator/boxes";
import { parseTestsSnapshot } from "@/lib/create/tests";
import { recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const SKILL_HEADER = "x-air-skill";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const userId = await boxUserId(supabase, request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as {
    appname?: unknown;
  } | null;

  const raw = request.headers.get(SKILL_HEADER);
  const skillVer = raw !== null ? Number.parseInt(raw, 10) : Number.NaN;
  if (!Number.isFinite(skillVer) || skillVer < createConfig.skillVersionMin()) {
    await recordOpsEvent(supabase, "create.skill_upgrade", userId).catch(() => undefined);
    return NextResponse.json(
      { error: "skill_update_queued", reply: "your Box needs an update; I've queued it" },
      { status: 426 }
    );
  }

  let appname: string;
  try {
    appname = validateAppName(typeof body?.appname === "string" ? body.appname : "");
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }

  try {
    const slug = slugFor(await publisherUsername(supabase, userId), appname);
    const runRow = await supabase
      .from("agent_runs")
      .select("id")
      .eq("user_id", userId)
      .eq("label", createRunLabel(slug))
      .is("ended_at", null)
      .maybeSingle();
    if (runRow.error) throw new PublishError("could not look up the Create run; try again", 503);
    if (!runRow.data) {
      return NextResponse.json(
        { error: "no_open_run", reply: "no build is running — compile only works inside one" },
        { status: 409 }
      );
    }
    const rowId = String((runRow.data as { id: unknown }).id);

    const { count, error: countError } = await supabase
      .from("ops_events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("kind", "create.compile")
      .eq("ref", rowId);
    if (countError) throw new PublishError("could not count compiles; try again", 503);
    const cap = createConfig.compileMaxPerTurn();
    if ((count ?? 0) >= cap) {
      return NextResponse.json(
        {
          error: "compile_cap",
          reply: `compile is capped at ${cap} per turn — finish with the findings you have`,
        },
        { status: 429 }
      );
    }
    await recordOpsEvent(supabase, "create.compile", userId, rowId).catch(() => undefined);

    const target = await ensureComputeAwake(supabase, userId);
    let files;
    let previousTests = null;
    try {
      files = await pullWorkspace(target, appname);
      previousTests = parseTestsSnapshot(
        await readComputeFile(target, `${workspacePath(appname)}/.build/last-tests.json`).catch(
          () => null
        )
      );
    } finally {
      if (isBoxEnvironment(target.environment)) {
        await armStopAfter(supabase, userId).catch(() => undefined);
      }
    }
    const output = await compileWorkspace(files, { previousTests });
    return NextResponse.json({
      ok: !output.findings.some((finding) => finding.severity === "hard"),
      findings: output.findings.map((finding) => ({
        rule: finding.rule,
        file: finding.file,
        severity: finding.severity,
        hint: finding.hint,
      })),
      sizes: output.sizes,
    });
  } catch (error) {
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BuildError) {
      return NextResponse.json(
        {
          error: error.message,
          findings: error.findings.map((finding) => ({
            rule: finding.rule,
            file: finding.file,
            severity: finding.severity,
          })),
        },
        { status: error.status }
      );
    }
    throw error;
  }
}
