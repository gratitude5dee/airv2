/**
 * V13 §9.1 — the shared half of the Box-adapter routes under
 * `/api/internal/create/`. Every route is worker-called only: CF1 demands a
 * valid `x-air-sig`/`x-air-ts` over the raw body, so each handler begins
 * with `adapterJob` (verifies the signature, then loads the job the body
 * names — a job id that does not exist is a 404, one that exists carries
 * the owner context the route acts under).
 *
 * Content rules hold here too (CF5): bodies carry job ids, rule ids,
 * counters and booleans — never prompt or page text.
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { BridgeError, verifyBridgeRequest } from "./bridge";
import { getJob, JobError, type JobRow } from "./job";
import { log } from "../log";

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

/**
 * Read the raw JSON body and verify the CF1 signature against it. Returns
 * the parsed body; throws `AdapterError` 401 on a missing/stale/bad
 * signature and 503 when the bridge secret is not configured (the lane is
 * off — every adapter route answers the same way).
 */
export async function adapterBody<T = Record<string, unknown>>(
  request: NextRequest
): Promise<{ body: T; raw: string }> {
  const raw = await request.text();
  const verdict = verifyBridgeRequest(
    request.headers,
    request.method,
    request.nextUrl.pathname,
    raw
  );
  if (verdict === null) throw new AdapterError("create bridge unconfigured", 503);
  if (!verdict) {
    log.info("create adapter bad signature", {path: request.nextUrl.pathname});
    throw new AdapterError("unauthorized", 401);
  }
  let body: T;
  try {
    body = JSON.parse(raw) as T;
  } catch {
    throw new AdapterError("invalid json", 400);
  }
  return { body, raw };
}

const JOB_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Verify + load the job `body.job_id` names (the only caller context). */
export async function adapterJob<T extends { job_id?: unknown }>(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<{ job: JobRow; body: T }> {
  const { body } = await adapterBody<T>(request);
  if (typeof body.job_id !== "string" || !JOB_ID_RE.test(body.job_id)) {
    throw new AdapterError("invalid job_id", 400);
  }
  let job: JobRow | null;
  try {
    job = await getJob(supabase, body.job_id);
  } catch (error) {
    if (error instanceof JobError) throw new AdapterError(error.message, error.status);
    throw error;
  }
  if (!job) throw new AdapterError("job not found", 404);
  return { job, body };
}

/** Map the adapter's errors to a JSON response; rethrows anything else. */
export function adapterErrorResponse(error: unknown): Response | null {
  if (error instanceof AdapterError || error instanceof BridgeError) {
    const status = error instanceof AdapterError ? error.status : 503;
    return Response.json({ error: error.message }, { status });
  }
  return null;
}
