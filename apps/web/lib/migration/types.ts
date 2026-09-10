/**
 * Compute-migration types (Box <-> Tenki). Metadata only — migration records
 * carry provider ids, phases, hashes and timestamps, never file content or
 * box credentials in plaintext (I2/C18).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export const MIGRATION_PHASES = [
  "preflight",
  "preparing",
  "precopy",
  "waiting_for_idle",
  "quiescing",
  "final_copy",
  "route_committed",
  "activating",
  "observing",
  "cleanup_pending",
  "completed",
  "cancelled",
  "failed",
  "recovery_required",
  "return_requested",
  "cleanup_failed",
  "returned",
] as const;
export type MigrationPhase = (typeof MIGRATION_PHASES)[number];

/** Phases where the unique index no longer blocks a new migration. */
export const TERMINAL_PHASES: readonly MigrationPhase[] = [
  "completed",
  "cancelled",
  "failed",
  "returned",
];

/** The point of no return: the boxes row already points at the candidate. */
export const POST_COMMIT_PHASES: readonly MigrationPhase[] = [
  "route_committed",
  "activating",
  "observing",
  "cleanup_pending",
];

/** Phases where a driver may still have work to do. */
export const NONTERMINAL_PHASES: readonly MigrationPhase[] =
  MIGRATION_PHASES.filter((p) => !TERMINAL_PHASES.includes(p));

export type MigrationDirection = "box_to_tenki" | "tenki_to_box";

export interface ComputeMigration {
  id: string;
  user_id: string;
  direction: MigrationDirection;
  phase: MigrationPhase;
  leg: "out" | "back";
  request_key: string | null;
  source_provider: string;
  target_provider: string;
  source_box_id: string;
  candidate_box_id: string | null;
  expected_generation: number;
  worker_token: string | null;
  worker_lease_until: string | null;
  wake_at: string | null;
  steps: Record<string, StepReceipt>;
  manifest: MigrationManifest | null;
  stats: Record<string, unknown> | null;
  verification: Record<string, unknown> | null;
  options: Record<string, unknown>;
  error_code: string | null;
  error_detail: string | null;
  cancel_requested_at: string | null;
  cleanup_approved_at: string | null;
  work_paused_at: string | null;
  work_resumed_at: string | null;
  route_committed_at: string | null;
  activated_at: string | null;
  retention_until: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

/** A step's durable receipt inside compute_migrations.steps. */
export interface StepReceipt {
  finished_at: string;
  /** Step-specific proof data (hashes, provider ids, counts). */
  [key: string]: unknown;
}

export type TargetRole = "source" | "candidate" | "retained" | "active";

export interface MigrationTarget {
  migration_id: string;
  role: TargetRole;
  provider: string;
  provider_box_id: string;
  hosted_url: string | null;
  credentials_sealed: string | null;
  manifest: unknown;
  integrity: unknown;
  created_at: string;
  updated_at: string;
}

export interface TenantControl {
  user_id: string;
  routing_generation: number;
  admission: "open" | "closed";
  admission_holder: string | null;
  active_migration_id: string | null;
  fence_epoch: number;
  created_at: string;
  updated_at: string;
}

export interface TenantOperation {
  id: string;
  user_id: string;
  kind: string;
  routing_generation: number;
  holder: string;
  detail: Record<string, unknown>;
  started_at: string;
  expires_at: string;
  finished_at: string | null;
}

// ─── inventory classification (plan §4) ─────────────────────────────────────

export type InventoryClass = "transfer" | "regenerate" | "reconnect" | "exclude";

export interface ManifestEntry {
  path: string; // box-relative, e.g. ".hermes/state/hermes_state.db"
  kind: "file" | "symlink" | "sqlite" | "dir";
  bytes: number;
  sha256: string;
  mtime: number;
  classification: InventoryClass;
  /** Why: 'vault', 'env-scoped', 'cache', ... */
  reason?: string;
}

export interface MigrationManifest {
  version: 1;
  scanned_at: string;
  source_box_id: string;
  entries: ManifestEntry[];
  totals: { transfer: number; regenerate: number; reconnect: number; exclude: number };
  /** Nonempty => preflight must fail until each is resolved. */
  blockers: string[];
}

// ─── errors ─────────────────────────────────────────────────────────────────

/** Admission is closed for a migration — callers map this to 503 + Retry-After. */
export class MigrationBusyError extends Error {
  constructor(
    message = "account migration in progress",
    readonly retryAfterSeconds = 30
  ) {
    super(message);
    this.name = "MigrationBusyError";
  }
}

/** A lifecycle operation conflicts with a live migration (stop/replace/etc.). */
export class MigrationConflictError extends Error {
  constructor(
    readonly migrationId: string,
    message = "compute migration in progress"
  ) {
    super(message);
    this.name = "MigrationConflictError";
  }
}

/** A migration precondition failed (bears a stable code for the admin UI). */
export class MigrationPreflightError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "MigrationPreflightError";
  }
}

/** The route commit or a guarded transition refused — state moved under us. */
export class MigrationStateError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message);
    this.name = "MigrationStateError";
  }
}

export type ServiceSupabase = SupabaseClient;
