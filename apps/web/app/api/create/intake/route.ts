/**
 * V12 §14.1 `GET|POST /api/create/intake` — open or advance a `/create`
 * intake, or read where it stands. Owner-only: a store session or the Box's
 * gateway token resolves the owner, and every lookup is scoped to that user
 * (another owner's app is a 404, same as a missing one). The body carries
 * state only — an event, a template id, counters, hashes; the prompt and
 * URL only seed the provisional appname and are never stored (CR21).
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { storeSessionUserId } from "@/lib/miniapps/storeSession";
import { boxUserId } from "@/lib/auth/box";
import {
  IllegalTransitionError,
  IntakeError,
  advanceIntake,
  getIntake,
  intakeStatus,
  isIntakeEvent,
  isIntakeSource,
  isIntakeTemplate,
  openIntake,
  type IntakePatch,
} from "@/lib/create/intake";
import { overLimit, recordOpsEvent } from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Intake opens + advances per owner per hour. */
export const INTAKE_CALLS_PER_HOUR = 120;
const HOUR_MS = 3_600_000;

async function ownerId(request: NextRequest): Promise<string | null> {
  const supabase = serviceClient();
  return storeSessionUserId(request) ?? (await boxUserId(supabase, request)) ?? null;
}

function failure(error: unknown): NextResponse {
  if (error instanceof IllegalTransitionError) {
    return NextResponse.json(
      { error: "illegal_transition", from: error.from, event: error.event },
      { status: 409 }
    );
  }
  if (error instanceof IntakeError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }
  throw error;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = await ownerId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const app = request.nextUrl.searchParams.get("app") ?? "";
  try {
    const row = await getIntake(serviceClient(), userId, app);
    if (!row) return NextResponse.json({ error: "intake not found" }, { status: 404 });
    return NextResponse.json(intakeStatus(row));
  } catch (error) {
    return failure(error);
  }
}

interface Body {
  appname?: unknown;
  prompt?: unknown;
  url?: unknown;
  event?: unknown;
  template?: unknown;
  source?: unknown;
  questions_asked?: unknown;
  plan_sha256?: unknown;
  goal_sha256?: unknown;
  app_id?: unknown;
  mirror_error?: unknown;
  rename?: unknown;
}

const nullableString = (value: unknown): string | null | undefined =>
  value === undefined ? undefined : value === null ? null : typeof value === "string" ? value : undefined;

/** Body fields that ride along an event as metadata; unknown shapes are dropped. */
function patchFrom(body: Body): IntakePatch {
  const patch: IntakePatch = {};
  if (body.template === null || isIntakeTemplate(body.template)) patch.template = body.template;
  if (typeof body.questions_asked === "number") patch.questions_asked = body.questions_asked;
  const plan = nullableString(body.plan_sha256);
  if (plan !== undefined) patch.plan_sha256 = plan;
  const goal = nullableString(body.goal_sha256);
  if (goal !== undefined) patch.goal_sha256 = goal;
  const appId = nullableString(body.app_id);
  if (appId !== undefined) patch.app_id = appId;
  const mirror = nullableString(body.mirror_error);
  if (mirror !== undefined) patch.mirror_error = mirror;
  if (typeof body.rename === "string") patch.appname = body.rename;
  return patch;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const userId = await ownerId(request);
  if (!userId) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = ((await request.json().catch(() => null)) ?? {}) as Body;
  const supabase = serviceClient();
  if (await overLimit(supabase, "intake", userId, INTAKE_CALLS_PER_HOUR, HOUR_MS)) {
    await recordOpsEvent(supabase, "rate_limited", userId, "intake");
    return NextResponse.json({ error: "too many intake calls" }, { status: 429 });
  }
  const appname = typeof body.appname === "string" ? body.appname : null;
  try {
    if (body.event === undefined || body.event === null) {
      if (!isIntakeSource(body.source)) {
        return NextResponse.json({ error: "source must be imessage or web" }, { status: 400 });
      }
      if (body.template !== undefined && body.template !== null && !isIntakeTemplate(body.template)) {
        return NextResponse.json({ error: "unknown template" }, { status: 400 });
      }
      const row = await openIntake(supabase, userId, {
        source: body.source,
        appname,
        prompt: typeof body.prompt === "string" ? body.prompt : null,
        url: typeof body.url === "string" ? body.url : null,
        template: isIntakeTemplate(body.template) ? body.template : null,
      });
      await recordOpsEvent(supabase, "intake", userId, "open");
      return NextResponse.json(intakeStatus(row), { status: 201 });
    }
    if (!isIntakeEvent(body.event)) {
      return NextResponse.json({ error: "unknown event" }, { status: 400 });
    }
    if (!appname) return NextResponse.json({ error: "appname required" }, { status: 400 });
    const row = await advanceIntake(supabase, userId, appname, body.event, patchFrom(body));
    await recordOpsEvent(supabase, "intake", userId, body.event);
    return NextResponse.json(intakeStatus(row));
  } catch (error) {
    return failure(error);
  }
}
