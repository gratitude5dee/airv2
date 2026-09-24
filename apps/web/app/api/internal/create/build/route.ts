/**
 * V13 §9.1 `POST /api/internal/create/build` — the job's build step: pull
 * the workspace, compile, and stage a draft version. Body (CF1-signed):
 *
 *   { job_id, dry? }
 *
 * `dry` is `air-create compile` in job form — the same `buildApp` minus the
 * store/deploy, so a code turn can check its work without staging.
 *
 * The route writes the V12 intake events the §9.1 contract names
 * (`build_started` before, `build_ok` or `fail` after) and returns the
 * content-free result — version, finding rule ids, sizes — never source or
 * log text (CF5).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { adapterErrorResponse, adapterJob } from "@/lib/create/adapter";
import { getRegistryAppById } from "@/lib/miniapps/registry";
import { BuildError, buildApp, openBuild, closeBuild } from "@/lib/create/build";
import { advanceIntake } from "@/lib/create/intake";
import { PublishError } from "@/lib/miniapps/publish";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// A build takes seconds (p50 4.8 s); pull + compile cap well under this.
export const maxDuration = 300;

interface BuildBody {
  job_id?: unknown;
  dry?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  try {
    const { job, body } = await adapterJob<BuildBody>(supabase, request);
    const app = await getRegistryAppById(supabase, job.app_id);
    if (!app || !app.appname) {
      return NextResponse.json({ error: "app not found" }, { status: 404 });
    }
    const appname = app.appname;
    const dry = body.dry === true;

    // Intake bookkeeping is advisory here — a change job can run with no
    // open intake, and the job itself is the state of record (CF2).
    await advanceIntake(supabase, job.user_id, appname, "build_started", {
      app_id: app.id,
    }).catch(() => undefined);

    const buildId = dry ? null : await openBuild(supabase, app, job.user_id);
    const log: string[] = [];
    try {
      const result = await buildApp(supabase, job.user_id, {
        appname,
        app,
        onLog: (line) => log.push(line),
      });
      if (buildId) await closeBuild(supabase, buildId, { result });
      await advanceIntake(supabase, job.user_id, appname, "build_ok", {}).catch(() => undefined);
      return NextResponse.json({
        version: result.version,
        findings: result.findings.map((finding) => finding.rule),
        sizes: result.sizes,
      });
    } catch (error) {
      if (buildId) {
        const findings = error instanceof BuildError ? error.findings : [];
        await closeBuild(supabase, buildId, {
          error: "build failed",
          findings,
          log,
        }).catch(() => undefined);
      }
      await advanceIntake(supabase, job.user_id, appname, "fail", {}).catch(() => undefined);
      if (error instanceof BuildError) {
        return NextResponse.json(
          {
            error: "build_failed",
            version: null,
            findings: error.findings.map((finding) => finding.rule),
          },
          { status: 422 }
        );
      }
      throw error;
    }
  } catch (error) {
    const response = adapterErrorResponse(error);
    if (response) return response as NextResponse;
    if (error instanceof PublishError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    throw error;
  }
}
