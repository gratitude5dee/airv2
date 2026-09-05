/**
 * The per-app action log (`.hermes/miniapps/<slug>/actions.json`) is a Box
 * file appended to by two routes — the MA3 Apps API and the Functions runtime
 * API — and the Box files API has no compare-and-swap. Appends serialize on a
 * short Postgres lease (migration 0099) taken around the read-modify-write:
 * the Box is woken first so the lease only covers the bounded `cat` + PUT,
 * and a lease that outlives a crashed writer expires on its own.
 */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { readAppState, writeAppState } from "./store";

export const ACTION_LOG_RESOURCE = "actions";
export const ACTION_LOG_MAX_ENTRIES = 200;

export const LEASE_TTL_MS = 30_000;
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
  for (let attempt = 0; attempt < attempts; attempt++) {
    if (attempt > 0) {
      await sleep(backoffMs * 2 ** (attempt - 1) * (1 + Math.random() / 2));
    }
    const { data, error } = await supabase.rpc("miniapp_state_lease", {
      p_user_id: userId,
      p_app: app,
      p_resource: resource,
      p_holder: holder,
      p_ttl_ms: options.ttlMs ?? LEASE_TTL_MS,
    });
    if (error) throw new Error(`state lease failed: ${error.message}`);
    if (data === true) return;
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
  await ensureBoxAwake(supabase, userId);
  const holder = randomUUID();
  await acquireLease(supabase, userId, app, ACTION_LOG_RESOURCE, holder, options);
  try {
    const existing = await readAppState(supabase, userId, app, ACTION_LOG_RESOURCE);
    const entries: ActionLogEntry[] = Array.isArray(existing)
      ? (existing as ActionLogEntry[])
      : [];
    entries.push(entry);
    await writeAppState(
      supabase,
      userId,
      app,
      ACTION_LOG_RESOURCE,
      entries.slice(-ACTION_LOG_MAX_ENTRIES)
    );
  } finally {
    await releaseLease(supabase, userId, app, ACTION_LOG_RESOURCE, holder);
  }
}
