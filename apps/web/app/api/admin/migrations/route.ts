/**
 * Operator compute-migration surface (plan §8): status plus the five public
 * operations — prepare, cutover, cancel, returnToProvider, cleanup. All state
 * lives in compute_migrations / migration_targets / tenant_control; this route
 * is a thin shell over lib/migration/operations. Every op is refused while
 * MIGRATION_ENABLED is unset (phase-1 dark ship).
 *
 * GET    /api/admin/migrations?user_id=…           -> status
 * POST   { op: "prepare", user_id, direction?, request_key? }
 * POST   { op: "cutover"|"cancel"|"return"|"cleanup", user_id }
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import {
  approveCleanup,
  cancel,
  cutover,
  prepare,
  returnToProvider,
  status,
} from "@/lib/migration/operations";
import {
  MigrationBusyError,
  MigrationConflictError,
  MigrationPreflightError,
  MigrationStateError,
  type MigrationDirection,
} from "@/lib/migration/types";
import { driveMigration } from "@/lib/migration/driver";
import { loadMigrationForUser } from "@/lib/migration/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 800;

function errorResponse(error: unknown): NextResponse {
  if (error instanceof MigrationBusyError) {
    return NextResponse.json(
      { error: "busy", retry_after_seconds: error.retryAfterSeconds },
      { status: 503, headers: { "Retry-After": String(error.retryAfterSeconds) } }
    );
  }
  if (error instanceof MigrationConflictError) {
    return NextResponse.json(
      { error: "conflict", detail: error.message },
      { status: 409 }
    );
  }
  if (
    error instanceof MigrationPreflightError ||
    error instanceof MigrationStateError
  ) {
    return NextResponse.json(
      { error: error.code, detail: error.message },
      { status: 422 }
    );
  }
  // Unknown errors: log server-side only — the message can carry provider
  // or driver internals that don't belong in an operator-facing response.
  console.error(
    JSON.stringify({
      msg: "admin migrations op failed",
      error: error instanceof Error ? error.message : String(error),
    })
  );
  return NextResponse.json({ error: "internal" }, { status: 500 });
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const userId = request.nextUrl.searchParams.get("user_id");
  const supabase = serviceClient();
  if (userId) {
    return NextResponse.json(await status(supabase, userId));
  }
  // Fleet-wide view: everything non-terminal plus recent terminals.
  const { data: live, error } = await supabase
    .from("compute_migrations")
    .select(
      "id, user_id, direction, leg, phase, wake_at, error_code, work_paused_at, work_resumed_at, created_at, updated_at"
    )
    .order("updated_at", { ascending: false })
    .limit(100);
  if (error) {
    return NextResponse.json(
      { error: "internal", detail: error.message },
      { status: 500 }
    );
  }
  return NextResponse.json({ migrations: live ?? [] });
}

interface PostBody {
  op?: string;
  user_id?: string;
  direction?: MigrationDirection;
  request_key?: string;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: PostBody;
  try {
    body = (await request.json()) as PostBody;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const userId = body.user_id;
  if (!userId || !body.op) {
    return NextResponse.json(
      { error: "user_id and op are required" },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  try {
    switch (body.op) {
      case "prepare":
        return NextResponse.json({
          migration: await prepare(
            supabase,
            userId,
            body.direction ?? "box_to_tenki",
            body.request_key ? { requestKey: body.request_key } : {}
          ),
        });
      case "cutover":
        return NextResponse.json({
          migration: await cutover(supabase, userId),
        });
      case "cancel":
        return NextResponse.json({ migration: await cancel(supabase, userId) });
      case "return":
        return NextResponse.json({
          migration: await returnToProvider(supabase, userId),
        });
      case "cleanup":
        return NextResponse.json({
          migration: await approveCleanup(supabase, userId),
        });
      case "drive": {
        // Operator re-arm of a parked migration (e.g. after a recovered fault).
        const migration = await loadMigrationForUser(supabase, userId);
        if (!migration) {
          return NextResponse.json({ error: "no live migration" }, { status: 409 });
        }
        return NextResponse.json({
          migration: await driveMigration(supabase, migration.id, {}),
        });
      }
      default:
        return NextResponse.json({ error: "unknown op" }, { status: 400 });
    }
  } catch (error) {
    return errorResponse(error);
  }
}
