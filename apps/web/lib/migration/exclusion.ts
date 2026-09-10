/**
 * Lifecycle exclusion (plan §3): while a migration is live for a user, no
 * other lifecycle operation may touch the box — stop, replace, environment
 * switch, fleet sync, and delete all check here. The reverse direction holds
 * too: `begin_migration` refuses while a replacement claim is fresh.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  MigrationConflictError,
  TERMINAL_PHASES,
  type ComputeMigration,
} from "./types";

/**
 * The user's live migration row, if any. `null` also when the table does not
 * exist yet (migration 0106 unapplied) — exclusion must fail open pre-deploy
 * so the dark-shipped callers don't break.
 */
export async function activeMigrationFor(
  supabase: SupabaseClient,
  userId: string
): Promise<ComputeMigration | null> {
  let data: unknown = null;
  let error: { code?: string; message: string } | null = null;
  try {
    ({ data, error } = await supabase
      .from("compute_migrations")
      .select("id, phase")
      .eq("user_id", userId)
      .not("phase", "in", `(${TERMINAL_PHASES.join(",")})`)
      .limit(1)
      .maybeSingle());
  } catch (queryError) {
    error = { message: String(queryError) };
  }
  if (error) {
    if (error.code === "42P01" || error.message.includes("compute_migrations")) {
      return null;
    }
    console.error(
      JSON.stringify({
        msg: "migration exclusion check failed open",
        user_id: userId,
        error: error.message,
      })
    );
    return null;
  }
  return (data as ComputeMigration | null) ?? null;
}

/** Throw MigrationConflictError while a live migration owns the tenant. */
export async function assertNoLiveMigration(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const live = await activeMigrationFor(supabase, userId);
  if (live) {
    throw new MigrationConflictError(live.id);
  }
}
