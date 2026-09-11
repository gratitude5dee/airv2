/**
 * The public migration surface (plan §3): prepare, cutover, cancel,
 * returnToProvider, cleanup, status. Everything else — provider adapters,
 * transfer, credentials, verification, leases, compensation — is internal
 * to the module.
 *
 * prepare  -> drives preflight→precopy; parks before waiting_for_idle.
 *             No routing change; the account keeps running on the source.
 * cutover  -> drives the pause sequence through activation; parks in
 *             observing (source warm, fenced, and retained).
 * cancel   -> pre-commit only; lifts any fence, reopens admission, deletes
 *             the candidate, settles 'cancelled'.
 * returnToProvider -> post-commit reverse move back to the retained source
 *             (leg='back' through the same phase graph).
 * cleanup  -> sets the operator-approval stamp; the retained side is deleted
 *             once retention has also elapsed.
 * status   -> read model for the admin surface.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { REPLACE_CLAIM_TTL_MS } from "../provisioning/provision";
import { driveMigration } from "./driver";
import { loadMigrationForUser, loadTargets } from "./store";
import {
  MigrationConflictError,
  MigrationPreflightError,
  POST_COMMIT_PHASES,
  type ComputeMigration,
  type MigrationDirection,
  type MigrationTarget,
} from "./types";

export interface MigrationStatus {
  migration: ComputeMigration | null;
  targets: MigrationTarget[];
  liveOperations: number;
  control: {
    admission: string;
    routing_generation: number;
    active_migration_id: string | null;
    fence_epoch: number;
  } | null;
}

function directionProviders(direction: MigrationDirection): {
  source: string;
  target: string;
} {
  return direction === "box_to_tenki"
    ? { source: "ascii", target: "tenki" }
    : { source: "tenki", target: "ascii" };
}

/**
 * Open a migration attempt and drive it through prepare. Idempotent on
 * request_key. Throws MigrationPreflightError for eligibility failures and
 * MigrationConflictError when a migration (or replacement) is live.
 */
export async function prepare(
  supabase: SupabaseClient,
  userId: string,
  direction: MigrationDirection,
  options: { requestKey?: string; driveBudgetMs?: number } = {}
): Promise<ComputeMigration> {
  if (!env.migrationEnabled()) {
    throw new MigrationPreflightError("disabled", "MIGRATION_ENABLED is not set");
  }
  const { data: box, error: boxError } = await supabase
    .from("boxes")
    .select("provider_box_id, provider")
    .eq("user_id", userId)
    .maybeSingle();
  if (boxError) throw new Error(`box lookup failed: ${boxError.message}`);
  if (!box) throw new MigrationPreflightError("no_box", "user has no box");

  const providers = directionProviders(direction);
  const staleBefore = new Date(
    Date.now() - REPLACE_CLAIM_TTL_MS
  ).toISOString();
  const { data, error } = await supabase.rpc("begin_migration", {
    p_user_id: userId,
    p_direction: direction,
    p_request_key: options.requestKey ?? null,
    p_source_provider: providers.source,
    p_target_provider: providers.target,
    p_source_box_id: box.provider_box_id,
    p_replace_stale_before: staleBefore,
  });
  const result = data as {
    ok?: boolean;
    reason?: string;
    migration?: ComputeMigration;
    current_box_id?: string;
    migration_id?: string;
  } | null;
  if (error) throw new Error(`begin_migration failed: ${error.message}`);
  if (!result?.ok) {
    if (result?.reason === "migration_active" || result?.reason === "replace_in_flight") {
      throw new MigrationConflictError(result.migration_id ?? "", result.reason);
    }
    throw new MigrationPreflightError(
      result?.reason ?? "begin_refused",
      `begin_migration refused: ${result?.reason}`
    );
  }
  const migration = result.migration as ComputeMigration;
  const driven = await driveMigration(supabase, migration.id, {
    stopBefore: ["waiting_for_idle"],
    budgetMs: options.driveBudgetMs,
  });
  return driven ?? migration;
}

/** Drive the pause sequence through activation; parks in observing. */
export async function cutover(
  supabase: SupabaseClient,
  userId: string,
  options: { driveBudgetMs?: number } = {}
): Promise<ComputeMigration> {
  const migration = await loadMigrationForUser(supabase, userId);
  if (!migration) {
    throw new MigrationConflictError("", "no live migration");
  }
  if (!["precopy", "waiting_for_idle"].includes(migration.phase)) {
    throw new MigrationPreflightError(
      "wrong_phase",
      `cutover needs phase precopy/waiting_for_idle, got ${migration.phase}`
    );
  }
  return (
    (await driveMigration(supabase, migration.id, {
      stopBefore: ["observing"],
      budgetMs: options.driveBudgetMs,
    })) ?? migration
  );
}

/** Pre-commit cancel: compensate + settle. Post-commit: refuse. */
export async function cancel(
  supabase: SupabaseClient,
  userId: string
): Promise<ComputeMigration> {
  const migration = await loadMigrationForUser(supabase, userId);
  if (!migration) throw new MigrationConflictError("", "no live migration");
  if (POST_COMMIT_PHASES.includes(migration.phase) || migration.leg === "back") {
    throw new MigrationPreflightError(
      "committed",
      "route already committed — use returnToProvider"
    );
  }
  await supabase
    .from("compute_migrations")
    .update({
      cancel_requested_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      // wake a parked prepare immediately
      wake_at: new Date().toISOString(),
    })
    .eq("id", migration.id);
  return (await driveMigration(supabase, migration.id, {})) ?? migration;
}

/** Post-commit return: run the graph in reverse (leg='back'). */
export async function returnToProvider(
  supabase: SupabaseClient,
  userId: string
): Promise<ComputeMigration> {
  const migration = await loadMigrationForUser(supabase, userId);
  if (!migration) throw new MigrationConflictError("", "no live migration");
  const returnable: readonly string[] = [
    "route_committed",
    "activating",
    "observing",
    "cleanup_pending",
    "recovery_required",
  ];
  if (!returnable.includes(migration.phase) || migration.leg === "back") {
    throw new MigrationPreflightError(
      "not_returnable",
      `cannot return from phase ${migration.phase} leg ${migration.leg}`
    );
  }
  await supabase
    .from("compute_migrations")
    .update({
      phase: "return_requested",
      error_code: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", migration.id);
  return (
    (await driveMigration(supabase, migration.id, {
      stopBefore: ["observing"],
    })) ?? migration
  );
}

/** Operator acceptance for retained-source deletion (plan §7). */
export async function approveCleanup(
  supabase: SupabaseClient,
  userId: string
): Promise<ComputeMigration> {
  const migration = await loadMigrationForUser(supabase, userId);
  if (!migration) throw new MigrationConflictError("", "no live migration");
  await supabase
    .from("compute_migrations")
    .update({
      cleanup_approved_at: new Date().toISOString(),
      wake_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", migration.id)
    .eq("phase", "cleanup_pending");
  return (await driveMigration(supabase, migration.id, {})) ?? migration;
}

export async function status(
  supabase: SupabaseClient,
  userId: string
): Promise<MigrationStatus> {
  const migration = await loadMigrationForUser(supabase, userId);
  const { data: control } = await supabase
    .from("tenant_control")
    .select("admission, routing_generation, active_migration_id, fence_epoch")
    .eq("user_id", userId)
    .maybeSingle();
  const { data: live } = await supabase
    .from("tenant_operations")
    .select("id")
    .eq("user_id", userId)
    .is("finished_at", null)
    .gt("expires_at", new Date().toISOString());
  return {
    migration,
    targets: migration ? await loadTargets(supabase, migration.id) : [],
    liveOperations: live?.length ?? 0,
    control:
      (control as MigrationStatus["control"]) ?? null,
  };
}
