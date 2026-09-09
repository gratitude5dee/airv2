/** Shared metadata-only lease for Box document mutations. */
import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { ensureBoxAwake } from "../orchestrator/boxes";

// Renew after reads; the lease outlasts the bounded 60-second Box write.
export const LEASE_TTL_MS = 90_000;
export const LEASE_ATTEMPTS = 6;
export const LEASE_BACKOFF_MS = 50;

/** Another writer held the lease for the whole retry budget; retry later. */
export class StateBusyError extends Error {
  readonly code = "state_busy";
  constructor() {
    super("mini-app state busy");
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
  throw new StateBusyError();
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
 * Wake the Box, take the resource lease, run `fn` against that Box, release.
 * `renew` extends the holder's own lease and throws `StateBusyError` when
 * it has lapsed and been re-taken, so `fn` can check before a write that
 * follows a long read.
 */
export async function withStateLease<T>(
  supabase: SupabaseClient,
  userId: string,
  app: string,
  resource: string,
  options: LeaseOptions,
  fn: (boxId: string, renew: () => Promise<void>) => Promise<T>
): Promise<T> {
  const box = await ensureBoxAwake(supabase, userId);
  const holder = randomUUID();
  const ttlMs = options.ttlMs ?? LEASE_TTL_MS;
  await acquireLease(supabase, userId, app, resource, holder, options);
  try {
    return await fn(box.boxId, async () => {
      const stillHeld = await tryLease(
        supabase,
        userId,
        app,
        resource,
        holder,
        ttlMs
      );
      if (!stillHeld) throw new StateBusyError();
    });
  } finally {
    await releaseLease(supabase, userId, app, resource, holder);
  }
}
