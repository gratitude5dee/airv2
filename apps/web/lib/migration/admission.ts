/**
 * Tenant-wide work admission (migration plan §3). Every path that wakes the
 * box, mutates files, or delivers an external effect either takes an
 * operation lease here or asserts admission before continuing; a migration's
 * close_admission RPC flips the per-user flag atomically against all of them.
 *
 * Leases are drain accounting, not the barrier — the hard barrier is the
 * box-side service mask installed at quiesce, which survives resumes and
 * platform restarts. A lease whose TTL expires mid-operation is reconciled
 * by that fence; `complete_operation` exists so clean finishes don't force
 * the drain to wait out the TTL.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { MigrationBusyError } from "./types";

/** Lease TTLs per operation kind — long enough to cover worst-case work. */
export const OP_TTL_SECONDS = {
  turn: 1200, // 420s generation budget + resume + slack
  flush: 1200,
  schedule_run: 1800,
  upload: 300,
  miniapp_write: 300,
  wake: 300,
  provision: 3600,
} as const;
export type OperationKind = keyof typeof OP_TTL_SECONDS;

export interface AdmittedOperation {
  operationId: string;
  routingGeneration: number;
}

/**
 * Take an operation lease, or throw MigrationBusyError when the tenant's
 * admission is closed. `holder` must uniquely name this operation instance
 * (a run id, a space id, a lease id) — it is how the op is completed later.
 */
export async function admitOperation(
  supabase: SupabaseClient,
  userId: string,
  kind: OperationKind,
  holder: string,
  detail: Record<string, unknown> = {}
): Promise<AdmittedOperation> {
  let data: unknown = null;
  let error: { message: string } | null = null;
  try {
    ({ data, error } = await supabase.rpc("admit_operation", {
      p_user_id: userId,
      p_kind: kind,
      p_holder: holder,
      p_ttl_seconds: OP_TTL_SECONDS[kind],
      p_detail: detail,
    }));
  } catch (rpcError) {
    error = { message: String(rpcError) };
  }
  if (error) {
    // Pre-deploy the RPC may not exist (and a stubbed client may not have
    // rpc at all): admit without a lease — migration is dark-shipped and
    // normal traffic must not break. An explicit `admitted: false` is the
    // only path that closes the gate.
    console.error(
      JSON.stringify({
        msg: "admit_operation failed open",
        user_id: userId,
        kind,
        error: error.message,
      })
    );
    return { operationId: `untracked:${holder}`, routingGeneration: 0 };
  }
  const result = data as {
    admitted?: boolean;
    operation_id?: string;
    routing_generation?: number;
  } | null;
  if (!result?.admitted || !result.operation_id) {
    throw new MigrationBusyError();
  }
  return {
    operationId: result.operation_id,
    routingGeneration: result.routing_generation ?? 0,
  };
}

/**
 * Best-effort lease release. `key` is either the operation id or the holder
 * the admit was taken under — both are unique per operation.
 */
export async function completeOperation(
  supabase: SupabaseClient,
  key: string
): Promise<void> {
  try {
    await supabase.rpc("complete_operation", { p_key: key });
  } catch {
    // Never fatal: the lease dies with its TTL and the box fence reconciles.
  }
}

/**
 * Check-only gate for mid-operation paths that never needed a lease of their
 * own (the wake funnel, event streams). Throws MigrationBusyError once the
 * tenant's admission is closed.
 */
export async function assertAdmissionOpen(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  let data: unknown = null;
  let error: { message: string } | null = null;
  try {
    ({ data, error } = await supabase.rpc("admission_open", {
      p_user_id: userId,
    }));
  } catch (rpcError) {
    error = { message: String(rpcError) };
  }
  // A missing control row or an RPC failure must not stop ordinary traffic:
  // admission fails open, and the fences that matter are box-side.
  if (error || data !== true) {
    if (data === false) throw new MigrationBusyError();
    if (error) {
      console.error(
        JSON.stringify({
          msg: "admission check failed open",
          user_id: userId,
          error: error.message,
        })
      );
    }
  }
}

/**
 * Route helper: translate a thrown MigrationBusyError into the plan's
 * "retryable response" (503 + Retry-After + a machine-readable marker so web
 * chat, uploads and the dashboard proxy can show the pause instead of an
 * error). Returns null for anything else.
 */
export function migrationBusyResponse(error: unknown): NextResponse | null {
  if (!(error instanceof MigrationBusyError)) return null;
  return NextResponse.json(
    { error: "migrating", retry_after: error.retryAfterSeconds },
    { status: 503, headers: { "Retry-After": String(error.retryAfterSeconds) } }
  );
}
