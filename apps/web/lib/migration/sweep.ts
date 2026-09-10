/**
 * Cron-side reconciler: picks up migrations whose wake_at has passed (deferred
 * drains, observe windows, retention timers) and migrations whose driver died
 * mid-phase (worker lease expired with no wake scheduled), and drives each
 * under a fresh worker claim. The state machine is authoritative — a sweep is
 * never the only way forward, it only re-arms what a dead invocation dropped.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";
import { driveMigration } from "./driver";
import { NONTERMINAL_PHASES } from "./types";

const SWEEP_BATCH = 5;

export async function reconcileMigrations(
  supabase: SupabaseClient,
  now: Date
): Promise<{ driven: number; errors: number }> {
  if (!env.migrationEnabled()) return { driven: 0, errors: 0 };
  const nowIso = now.toISOString();
  const { data: due, error } = await supabase
    .from("compute_migrations")
    .select("id")
    .in("phase", [...NONTERMINAL_PHASES])
    .or(
      `wake_at.lte.${nowIso},` +
        `and(wake_at.is.null,worker_lease_until.lt.${nowIso})`
    )
    .order("wake_at", { ascending: true, nullsFirst: true })
    .limit(SWEEP_BATCH);
  if (error) {
    console.error(
      JSON.stringify({ msg: "migration sweep query failed", error: error.message })
    );
    return { driven: 0, errors: 1 };
  }
  let driven = 0;
  let errors = 0;
  for (const row of (due ?? []) as { id: string }[]) {
    try {
      const result = await driveMigration(supabase, row.id, {
        budgetMs: 60_000,
      });
      if (result) driven += 1;
    } catch (error) {
      errors += 1;
      console.error(
        JSON.stringify({
          msg: "migration sweep drive failed",
          migration_id: row.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
  return { driven, errors };
}
