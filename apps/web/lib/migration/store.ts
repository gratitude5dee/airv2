/**
 * Persistence for the migration state machine. Every write that moves the
 * machine is a compare-and-swap on (id, worker_token[, phase]) so the only
 * writer is the current drive-lease holder. Cross-table invariants live in
 * the RPCs (0106); this file is the row access around them.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { env } from "../env";
import {
  MigrationStateError,
  TERMINAL_PHASES,
  type ComputeMigration,
  type MigrationPhase,
  type MigrationTarget,
  type StepReceipt,
  type TargetRole,
  type TenantControl,
} from "./types";

const MIGRATION_COLUMNS = "*";

export async function loadMigration(
  supabase: SupabaseClient,
  migrationId: string
): Promise<ComputeMigration | null> {
  const { data, error } = await supabase
    .from("compute_migrations")
    .select(MIGRATION_COLUMNS)
    .eq("id", migrationId)
    .maybeSingle();
  if (error) throw new Error(`migration load failed: ${error.message}`);
  return (data as ComputeMigration | null) ?? null;
}

export async function loadMigrationForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<ComputeMigration | null> {
  const { data, error } = await supabase
    .from("compute_migrations")
    .select(MIGRATION_COLUMNS)
    .eq("user_id", userId)
    .not("phase", "in", `(${TERMINAL_PHASES.join(",")})`)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`migration lookup failed: ${error.message}`);
  return (data as ComputeMigration | null) ?? null;
}

export async function loadTargets(
  supabase: SupabaseClient,
  migrationId: string
): Promise<MigrationTarget[]> {
  const { data, error } = await supabase
    .from("migration_targets")
    .select("*")
    .eq("migration_id", migrationId);
  if (error) throw new Error(`targets load failed: ${error.message}`);
  return (data as MigrationTarget[]) ?? [];
}

/**
 * The two boxes for a copy pass in the current leg: `from` produces the data,
 * `to` receives it. Roles move as commits land, so resolve by the role that
 * still describes each side for this leg's copy phase — pre-commit the out
 * leg is source→candidate, and the return leg is active→retained (roles flip
 * at commit: out's source becomes retained, its candidate becomes active).
 */
export function copySides(
  migration: ComputeMigration,
  targets: MigrationTarget[]
): { from: MigrationTarget; to: MigrationTarget } {
  const wantFrom: TargetRole = migration.leg === "out" ? "source" : "active";
  const wantTo: TargetRole = migration.leg === "out" ? "candidate" : "retained";
  const from = targets.find((t) => t.role === wantFrom);
  const to = targets.find((t) => t.role === wantTo);
  if (!from || !to) {
    throw new MigrationStateError(
      "targets_missing",
      `leg ${migration.leg}: roles ${wantFrom}/${wantTo} not present`
    );
  }
  return { from, to };
}

/** The side the boxes row currently points at (post-commit). */
export function activeTarget(targets: MigrationTarget[]): MigrationTarget | null {
  return targets.find((t) => t.role === "active") ?? null;
}

/** The fenced, out-of-traffic side kept for return + cleanup. */
export function retainedTarget(
  targets: MigrationTarget[]
): MigrationTarget | null {
  return targets.find((t) => t.role === "retained") ?? null;
}

export async function loadControl(
  supabase: SupabaseClient,
  userId: string
): Promise<TenantControl | null> {
  const { data, error } = await supabase
    .from("tenant_control")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`tenant_control load failed: ${error.message}`);
  return (data as TenantControl | null) ?? null;
}

/** Take or renew the drive lease. False when another worker holds it. */
export async function claimWorker(
  supabase: SupabaseClient,
  migrationId: string,
  workerToken: string,
  leaseSeconds = env.migrationDriveLeaseSeconds()
): Promise<boolean> {
  const until = new Date(Date.now() + leaseSeconds * 1000).toISOString();
  const { data, error } = await supabase
    .from("compute_migrations")
    .update({ worker_token: workerToken, worker_lease_until: until })
    .eq("id", migrationId)
    .not("phase", "in", `(${TERMINAL_PHASES.join(",")})`)
    .or(
      `worker_lease_until.is.null,worker_lease_until.lt.${new Date().toISOString()},worker_token.eq.${workerToken}`
    )
    .select("id");
  if (error) throw new Error(`worker claim failed: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

export function newWorkerToken(): string {
  return randomBytes(12).toString("hex");
}

/**
 * Move the machine: a CAS on (id, worker_token, phase ∈ from). Carries any
 * column patch plus a step receipt merged into the steps journal. Throws
 * MigrationStateError when the row moved under us — the caller's driver
 * reloads and re-dispatches rather than write over stale state.
 */
export async function transition(
  supabase: SupabaseClient,
  migration: ComputeMigration,
  worker: string,
  from: readonly MigrationPhase[],
  patch: Record<string, unknown> & { phase: MigrationPhase },
  step?: { name: string; receipt: StepReceipt }
): Promise<ComputeMigration> {
  const steps = step
    ? { ...(migration.steps ?? {}), [step.name]: step.receipt }
    : (migration.steps ?? {});
  const { data, error } = await supabase
    .from("compute_migrations")
    .update({ ...patch, steps, updated_at: new Date().toISOString() })
    .eq("id", migration.id)
    .eq("worker_token", worker)
    .in("phase", from as string[])
    .select(MIGRATION_COLUMNS);
  if (error) throw new Error(`transition failed: ${error.message}`);
  if (!data || data.length === 0) {
    throw new MigrationStateError(
      "transition_lost",
      `phase moved off ${from.join("/")} or worker lease lost`
    );
  }
  return data[0] as ComputeMigration;
}

/** Merge a step receipt without changing phase. Same CAS discipline. */
export async function recordStep(
  supabase: SupabaseClient,
  migration: ComputeMigration,
  worker: string,
  name: string,
  receipt: StepReceipt,
  patch: Record<string, unknown> = {}
): Promise<ComputeMigration> {
  return transition(supabase, migration, worker, [migration.phase], {
    ...patch,
    phase: migration.phase,
  }, { name, receipt });
}

/** Persist a wake time (or clear it) under the worker claim. */
export async function setWake(
  supabase: SupabaseClient,
  migration: ComputeMigration,
  worker: string,
  wakeAt: Date | null
): Promise<ComputeMigration> {
  return transition(supabase, migration, worker, [migration.phase], {
    phase: migration.phase,
    wake_at: wakeAt?.toISOString() ?? null,
  });
}

export async function upsertTarget(
  supabase: SupabaseClient,
  target: Pick<MigrationTarget, "migration_id" | "role"> &
    Partial<MigrationTarget>
): Promise<void> {
  const { error } = await supabase.from("migration_targets").upsert(
    {
      ...target,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "migration_id,role" }
  );
  if (error) throw new Error(`target upsert failed: ${error.message}`);
}

export async function updateTarget(
  supabase: SupabaseClient,
  migrationId: string,
  role: TargetRole,
  patch: Partial<MigrationTarget>
): Promise<void> {
  const { error } = await supabase
    .from("migration_targets")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("migration_id", migrationId)
    .eq("role", role);
  if (error) throw new Error(`target update failed: ${error.message}`);
}
