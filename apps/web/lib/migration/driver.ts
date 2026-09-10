/**
 * The durable drive loop. One worker at a time owns a migration (CAS on
 * worker_token / worker_lease_until); each iteration reloads the row and
 * dispatches the phase's step. Steps journal their receipts into
 * compute_migrations.steps so a driver killed mid-phase resumes from the
 * last durable boundary — Postgres is authoritative, any invocation can
 * continue the work.
 *
 * Failure matrix (plan §5C):
 *  - pre-commit failure  -> compensate (lift fence, reopen admission, delete
 *    candidate) then 'failed'.
 *  - post-commit failure -> 'recovery_required': admission stays closed,
 *    both boxes kept; an operator decides return vs. resolve.
 *  - drain/cutover deadline breach pre-commit -> compensate + 'failed';
 *    post-commit the commit is already durable, so activation must finish —
 *    the breach is recorded, never silently un-committed.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { replayHeldReceipts } from "./replay";
import {
  claimWorker,
  loadControl,
  loadMigration,
  loadTargets,
  newWorkerToken,
  setWake,
  transition,
} from "./store";
import {
  beginReturnLeg,
  runCancelCompensation,
  runSourceDelete,
  stepActivating,
  stepCleanupPending,
  stepFinalCopy,
  stepObserving,
  stepPrecopy,
  stepPreflight,
  stepPreparing,
  stepQuiescing,
  stepWaitingForIdle,
  type StepCtx,
  type StepOutcome,
} from "./steps";
import {
  MigrationPreflightError,
  MigrationStateError,
  TERMINAL_PHASES,
  type ComputeMigration,
  type MigrationPhase,
} from "./types";

/** Phases before the route commit — the leg where cancellation is possible. */
const PRE_COMMIT: readonly MigrationPhase[] = [
  "preflight",
  "preparing",
  "precopy",
  "waiting_for_idle",
  "quiescing",
  "final_copy",
];

/** Phases the pause deadline applies to (admission closed, pre-commit). */
const PAUSE_PHASES: readonly MigrationPhase[] = [
  "waiting_for_idle",
  "quiescing",
  "final_copy",
];

export interface DriveOptions {
  /** Stop driving cleanly when the machine reaches one of these phases. */
  stopBefore?: readonly MigrationPhase[] | undefined;
  /** Wall-clock budget for this drive invocation. */
  budgetMs?: number | undefined;
}

async function settle(
  supabase: SupabaseClient,
  migrationId: string,
  phase: MigrationPhase,
  reopen: boolean
): Promise<void> {
  const { error } = await supabase.rpc("settle_migration", {
    p_migration_id: migrationId,
    p_phase: phase,
    p_reopen: reopen,
  });
  if (error) {
    console.error(
      JSON.stringify({
        msg: "settle_migration failed",
        migration_id: migrationId,
        phase,
        error: error.message,
      })
    );
  }
}

async function compensateAndFail(
  ctx: StepCtx,
  code: string,
  detail: string
): Promise<"failed" | "cleanup_failed"> {
  try {
    await runCancelCompensation(ctx);
  } catch (error) {
    console.error(
      JSON.stringify({
        msg: "migration compensation failed",
        migration_id: ctx.migration.id,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    // Compensation itself failed — do not mark failed (that would release
    // the tenant hold with debris live); park in cleanup_failed.
    await settle(ctx.supabase, ctx.migration.id, "cleanup_failed", false);
    return "cleanup_failed";
  }
  await ctx.supabase
    .from("compute_migrations")
    .update({
      error_code: code,
      error_detail: detail.slice(0, 2000),
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.migration.id);
  // Reopen admission first — held replays would throw MigrationBusyError
  // while the tenant is still paused.
  await settle(ctx.supabase, ctx.migration.id, "failed", true);
  await replayHeldReceipts(ctx.supabase, ctx.migration.user_id).catch(
    (error) =>
      console.error(
        JSON.stringify({
          msg: "held replay after cancel failed",
          migration_id: ctx.migration.id,
          error: error instanceof Error ? error.message : String(error),
        })
      )
  );
  return "failed";
}

export async function driveMigration(
  supabase: SupabaseClient,
  migrationId: string,
  options: DriveOptions = {}
): Promise<ComputeMigration | null> {
  const worker = newWorkerToken();
  const budgetMs = options.budgetMs ?? 120_000;
  const deadline = Date.now() + budgetMs;
  if (!(await claimWorker(supabase, migrationId, worker))) {
    return loadMigration(supabase, migrationId);
  }

  let migration = await loadMigration(supabase, migrationId);
  if (!migration) return null;

  while (!TERMINAL_PHASES.includes(migration.phase)) {
    if (Date.now() > deadline) {
      await setWake(supabase, migration, worker, new Date(Date.now() + 5_000));
      break;
    }
    const control = await loadControl(supabase, migration.user_id);
    const targets = await loadTargets(supabase, migrationId);
    if (!control) {
      throw new MigrationStateError("no_control", "tenant_control row missing");
    }
    const ctx: StepCtx = { supabase, migration, worker, control, targets };

    // Operator-requested cancel: honored on the out leg before the commit.
    if (
      migration.cancel_requested_at &&
      migration.leg === "out" &&
      PRE_COMMIT.includes(migration.phase)
    ) {
      const settled = await compensateAndFail(ctx, "cancelled", "operator cancel");
      if (settled === "failed") {
        await settle(supabase, migrationId, "cancelled", true);
      }
      return loadMigration(supabase, migrationId);
    }

    if (migration.phase === "return_requested") {
      migration = await beginReturnLeg(ctx);
      continue;
    }

    if (options.stopBefore?.includes(migration.phase)) {
      await setWake(supabase, migration, worker, null);
      break;
    }

    // Pause deadline: while admission is closed pre-commit, overrun means
    // abort — reopen and fail rather than hold the account hostage.
    if (
      PAUSE_PHASES.includes(migration.phase) &&
      migration.work_paused_at &&
      Date.now() - Date.parse(migration.work_paused_at) >
        env.migrationCutoverDeadlineMs()
    ) {
      await compensateAndFail(
        ctx,
        "pause_deadline",
        `work pause exceeded ${env.migrationCutoverDeadlineMs()}ms`
      );
      return loadMigration(supabase, migrationId);
    }

    let outcome: StepOutcome;
    try {
      switch (migration.phase) {
        case "preflight":
          outcome = await stepPreflight(ctx);
          break;
        case "preparing":
          outcome = await stepPreparing(ctx);
          break;
        case "precopy":
          outcome = await stepPrecopy(ctx);
          break;
        case "waiting_for_idle":
          outcome = await stepWaitingForIdle(ctx);
          break;
        case "quiescing":
          outcome = await stepQuiescing(ctx);
          break;
        case "final_copy":
          outcome = await stepFinalCopy(ctx);
          break;
        case "route_committed":
          outcome = { kind: "advance", phase: "activating" };
          break;
        case "activating":
          outcome = await stepActivating(ctx);
          break;
        case "observing":
          outcome = await stepObserving(ctx);
          break;
        case "cleanup_pending":
          outcome = await stepCleanupPending(ctx);
          if (outcome.kind === "advance") {
            await runSourceDelete(ctx);
            await settle(
              supabase,
              migrationId,
              migration.leg === "back" ? "returned" : "completed",
              true
            );
            return loadMigration(supabase, migrationId);
          }
          break;
        case "recovery_required":
        case "cleanup_failed":
          return migration; // operator resolves
        default:
          return migration;
      }
    } catch (error) {
      const code =
        error instanceof MigrationPreflightError ||
        error instanceof MigrationStateError
          ? error.code
          : "step_error";
      const detail = error instanceof Error ? error.message : String(error);
      if (
        migration.leg === "out" &&
        PRE_COMMIT.includes(migration.phase)
      ) {
        await compensateAndFail(ctx, code, detail);
      } else {
        // Post-commit (or return leg): never silently flip anything back.
        await supabase
          .from("compute_migrations")
          .update({
            error_code: code,
            error_detail: detail.slice(0, 2000),
            updated_at: new Date().toISOString(),
          })
          .eq("id", migration.id);
        await settle(supabase, migrationId, "recovery_required", false);
      }
      return loadMigration(supabase, migrationId);
    }

    try {
      if (outcome.kind === "advance") {
        migration = await transition(
          supabase, migration, worker, [migration.phase],
          { phase: outcome.phase, ...outcome.patch }
        );
        continue;
      }
      if (outcome.kind === "wait") {
        migration = await setWake(supabase, migration, worker, outcome.wakeAt);
        break;
      }
      if (outcome.kind === "stay") {
        migration = await setWake(
          supabase, migration, worker, new Date(Date.now() + outcome.wakeInMs)
        );
        break;
      }
      break; // park
    } catch (error) {
      if (error instanceof MigrationStateError) {
        // Lost the CAS — another invocation may have the lease now; reload.
        migration = await loadMigration(supabase, migrationId);
        if (!migration) return null;
        continue;
      }
      throw error;
    }
  }
  return migration;
}
