/**
 * The per-app action log (`.hermes/miniapps/<slug>/actions.json`) is a Box
 * file appended to by two routes — the MA3 Apps API and the Functions runtime
 * API — and the Box files API has no compare-and-swap. Appends serialize on a
 * short Postgres lease (migration 0101) taken around the read-modify-write:
 * the Box is woken first so the lease only covers one bounded `cat` and one
 * bounded PUT against that already-resolved Box (no wake/resume inside), the
 * holder renews it between the read and the write (and aborts instead of
 * writing when the renewal is refused), and a lease that outlives a crashed
 * writer expires on its own. A whole-document PUT of the same resource
 * through the generic state routes takes the same lease, so it can't land
 * between an append's read and write.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { readAppStateFrom, writeAppState, writeAppStateTo } from "./store";

export const ACTION_LOG_RESOURCE = "actions";
export const ACTION_LOG_MAX_ENTRIES = 200;

export { StateBusyError as ActionLogBusyError, LEASE_TTL_MS, LEASE_ATTEMPTS, LEASE_BACKOFF_MS } from "./stateLease";
export type { LeaseOptions } from "./stateLease";
import { withStateLease, type LeaseOptions } from "./stateLease";

export interface ActionLogEntry {
  action: string;
  payload: unknown;
  role: string;
  at: string;
  source?: "functions";
}

/**
 * Append one entry to the app's action log, keeping the newest
 * `ACTION_LOG_MAX_ENTRIES`. Throws `ActionLogBusyError` when the lease could
 * not be taken within the retry budget; the entry is then not written.
 */
export async function appendActionLogEntry(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  entry: ActionLogEntry,
  options: LeaseOptions = {}
): Promise<void> {
  await withStateLease(supabase, userId, app, ACTION_LOG_RESOURCE, options, async (boxId, renew) => {
    const existing = await readAppStateFrom(boxId, app, ACTION_LOG_RESOURCE);
    const entries: ActionLogEntry[] = Array.isArray(existing)
      ? (existing as ActionLogEntry[])
      : [];
    entries.push(entry);
    await renew();
    await writeAppStateTo(
      boxId,
      app,
      ACTION_LOG_RESOURCE,
      entries.slice(-ACTION_LOG_MAX_ENTRIES)
    );
  });
}

/**
 * Replace the action log wholesale (the generic `PUT state?resource=actions`
 * path) under the append lease: last writer wins, but never in the middle of
 * an append. Stored verbatim, like any other state document.
 */
export async function replaceActionLog(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  state: unknown,
  options: LeaseOptions = {}
): Promise<void> {
  await withStateLease(supabase, userId, app, ACTION_LOG_RESOURCE, options, async (boxId) => {
    await writeAppStateTo(boxId, app, ACTION_LOG_RESOURCE, state);
  });
}

/**
 * Whole-document state PUT for the generic state routes: the action log's is
 * leased, every other resource's is a plain write (no server-side
 * read-modify-write there to race).
 */
export async function putAppState(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resource: string,
  state: unknown
): Promise<void> {
  if (resource === ACTION_LOG_RESOURCE) {
    await replaceActionLog(supabase, userId, app, state);
    return;
  }
  await writeAppState(supabase, userId, app, resource, state);
}
