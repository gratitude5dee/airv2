/**
 * V13 §4.1 + §9.1 `POST /api/create/go` — the one owner-facing entry into
 * the job lane. `air-create go` (Box bearer) and the studio's **Build
 * this** / **Make this change** (store session) both land here.
 *
 *   { appname, kind: "initial" | "change" }
 *
 * initial — the intake must sit at `plan_sent` or `revising` (the owner
 *   just answered "yes"); `confirm` moves it to `confirmed` and the job's
 *   brief step turns plan.md into goal.md.
 * change — the app must already exist; the change request itself lives in
 *   the workspace as `intake/changes/<n>.md` (CF5 — never through
 *   Cloudflare), written by the Box turn that came before `go`.
 *
 * The response is the two artifacts the Box/Studio needs to show the owner:
 * `reply` (the one line under the card) and `card` (the never-edited
 * `[card: create <slug> job=<id>]` marker, §5.1). The turn ends here — the
 * job drives everything after.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import { PublishError, validateAppName } from "@/lib/miniapps/publish";
import { createConfig } from "@/lib/create/config";
import { advanceIntake, getIntake, IntakeError } from "@/lib/create/intake";
import { resolveOrCreateDropApp } from "@/lib/create/drop";
import {
  insertJob,
  isJobKind,
  JobError,
  startJobWorkflow,
  type JobKind,
} from "@/lib/create/job";
import { createLaneReady } from "@/lib/create/ready";
import { recordOpsEvent } from "@/lib/security/limits";
import { BridgeError } from "@/lib/create/bridge";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SKILL_HEADER = "x-air-skill";

interface GoBody {
  appname?: unknown;
  kind?: unknown;
  change_file?: unknown;
}

function replyFor(kind: JobKind, name: string): string {
  return kind === "initial"
    ? `On it — building ${name} now. Tap to watch.`
    : `On it — updating ${name}. Tap to watch.`;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const storeUser = storeSessionUserId(request);
  const userId = storeUser ?? (await boxUserId(supabase, request));
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => null)) as GoBody | null;

  // F10 (V13 §8): the Box's skill carries `x-air-skill` on every call; a
  // caller below the floor (or a Box with no header at all — the V12 skill
  // sends none) is refused and an upgrade is queued for the fleet.
  let skillVer: number | null = null;
  if (!storeUser) {
    const raw = request.headers.get(SKILL_HEADER);
    const parsed = raw !== null ? Number.parseInt(raw, 10) : Number.NaN;
    skillVer = Number.isFinite(parsed) ? parsed : null;
    if (skillVer === null || skillVer < createConfig.skillVersionMin()) {
      await recordOpsEvent(supabase, "create.skill_upgrade", userId).catch(() => undefined);
      return NextResponse.json(
        {
          error: "skill_update_queued",
          reply: "your Box needs an update; I've queued it",
        },
        { status: 426 }
      );
    }
  }

  // §13 — flag off, or an owner outside the rollout list, keeps the V12
  // lane: `go` is a V13 verb and the Box falls back to its old verbs.
  if (!createConfig.v13ForUser(userId)) {
    return NextResponse.json(
      { error: "v13_disabled", reply: "create jobs aren't on yet — tell me to build it" },
      { status: 409 }
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
  const kind = isJobKind(body?.kind) ? (body.kind as JobKind) : null;
  if (!kind) {
    return NextResponse.json({ error: "kind must be initial or change" }, { status: 400 });
  }
  // Change jobs name the workspace file the code turn applies; the Box
  // writes it itself, the web route writes it via /jobs/:id/request (CF5).
  const changeFile =
    typeof body?.change_file === "string" &&
    /^intake\/changes\/[a-z0-9._/-]{1,80}$/.test(body.change_file)
      ? body.change_file
      : null;

  try {
    // §11.3 / CF8 — both halves of the lane green (60 s cache), else the
    // owner gets a plain sentence, not a job that dies at step 1.
    const ready = await createLaneReady();
    if (!ready.ok) {
      return NextResponse.json(
        { error: "not_ready", reasons: ready.reasons },
        { status: 503 }
      );
    }

    // F6 fix: the registry row exists before the job starts, so every later
    // write (version, dev pointer, build) has somewhere to land.
    const { app } = await resolveOrCreateDropApp(supabase, userId, { appname });

    const intake = await getIntake(supabase, userId, appname);
    let intakeId: string | null = null;
    if (kind === "initial") {
      if (!intake || (intake.stage !== "plan_sent" && intake.stage !== "revising")) {
        return NextResponse.json(
          { error: "not_ready", reason: intake ? `stage:${intake.stage}` : "no_intake" },
          { status: 409 }
        );
      }
      const confirmed = await advanceIntake(supabase, userId, appname, "confirm", {
        app_id: app.id,
      });
      intakeId = confirmed.id;
    } else {
      intakeId = intake?.id ?? null;
      if (app.draft_version === null && app.bundle_version === null) {
        return NextResponse.json(
          { error: "not_ready", reason: "no_prior_build" },
          { status: 409 }
        );
      }
    }

    const job = await insertJob(supabase, {
      userId,
      appId: app.id,
      intakeId,
      kind,
      skillVer,
    });
    await startJobWorkflow({
      job_id: job.id,
      user_id: userId,
      app_id: app.id,
      slug: app.slug,
      appname,
      kind,
      ...(changeFile ? { change_file: changeFile } : {}),
    });
    await recordOpsEvent(supabase, "create.job", userId, `${app.slug}:${kind}`).catch(() => undefined);

    const name = app.name?.trim() || appname;
    return NextResponse.json({
      job_id: job.id,
      slug: app.slug,
      reply: replyFor(kind, name),
      card: `[card: create ${app.slug} job=${job.id}]`,
    });
  } catch (error) {
    if (error instanceof PublishError || error instanceof IntakeError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof JobError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    if (error instanceof BridgeError) {
      return NextResponse.json({ error: "not_ready", reasons: ["jobs_origin"] }, { status: 503 });
    }
    throw error;
  }
}
