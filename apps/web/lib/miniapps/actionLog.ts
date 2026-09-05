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
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { readAppStateFrom, writeAppState, writeAppStateTo } from "./store";

export const ACTION_LOG_RESOURCE = "actions";
export const ACTION_LOG_MAX_ENTRIES = 200;

/**
 * Longer than a Box files PUT can take (`BOX_REQUEST_TIMEOUT_MS`, 60s). A
 * `cat` runs through the command endpoint with a longer budget, which is why
 * the holder renews after the read and aborts when refused.
 */
export const LEASE_TTL_MS = 90_000;
export const LEASE_ATTEMPTS = 6;
export const LEASE_BACKOFF_MS = 50;

export interface ActionLogEntry {
  action: string;
  payload: unknown;
  role: string;
  at: string;
  source?: "functions";
}

/** Another writer held the lease for the whole retry budget; retry later. */
export class ActionLogBusyError extends Error {
  readonly code = "state_busy";
  constructor() {
    super("action log busy");
  }
}

export interface LeaseOptions {
  attempts?: number;
  backoffMs?: number;
  ttlMs?: number;
}

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function tryLease(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resource: string,
  holder: string,
  ttlMs: number
): Promise<boolean> {
  const { data, error } = await supabase.rpc("miniapp_state_lease", {
    p_user_id: userId,
    p_app: app,
    p_resource: resource,
    p_holder: holder,
    p_ttl_ms: ttlMs,
  });
  if (error) throw new Error(`state lease failed: ${error.message}`);
  return data === true;
}

async function acquireLease(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resource: string,
  holder: string,
  options: LeaseOptions
): Promise<void> {
  const attempts = options.attempts ?? LEASE_ATTEMPTS;
  const backoffMs = options.backoffMs ?? LEASE_BACKOFF_MS;
  const ttlMs = options.ttlMs ?? LEASE_TTL_MS;
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs * 2 ** (attempt - 1) * (1 + Math.random() / 2));
    }
    if (await tryLease(supabase, userId, app, resource, holder, ttlMs)) return;
  }
  throw new ActionLogBusyError();
}

async function releaseLease(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resource: string,
  holder: string
): Promise<void> {
  const { error } = await supabase.rpc("miniapp_state_release", {
    p_user_id: userId,
    p_app: app,
    p_resource: resource,
    p_holder: holder,
  });
  if (error) {
    console.error(
      JSON.stringify({
        msg: "state lease release failed",
        app,
        resource,
        error: error.message,
      })
    );
  }
}

/**
 * Wake the Box, take the action-log lease, run `fn` against that Box, release.
 * `renew` extends the holder's own lease and throws `ActionLogBusyError` when
 * it has lapsed and been re-taken, so `fn` can check before a write that
 * follows a long read.
 */
async function withActionLogLease<T>(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  options: LeaseOptions,
  fn: (boxId: string, renew: () => Promise<void>) => Promise<T>
): Promise<T> {
  const box = await ensureBoxAwake(supabase, userId);
  const holder = randomUUID();
  const ttlMs = options.ttlMs ?? LEASE_TTL_MS;
  await acquireLease(supabase, userId, app, ACTION_LOG_RESOURCE, holder, options);
  try {
    return await fn(box.boxId, async () => {
      const stillHeld = await tryLease(
        supabase,
        userId,
        app,
        ACTION_LOG_RESOURCE,
        holder,
        ttlMs
      );
      if (!stillHeld) throw new ActionLogBusyError();
    });
  } finally {
    await releaseLease(supabase, userId, app, ACTION_LOG_RESOURCE, holder);
  }
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
  await withActionLogLease(supabase, userId, app, options, async (boxId, renew) => {
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
  await withActionLogLease(supabase, userId, app, options, async (boxId) => {
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
