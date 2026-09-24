/**
 * V13 §11.3 — the readiness gate `POST /api/create/go` checks before it
 * inserts a job. Two halves, both cached 60 s so a burst of `go` calls does
 * not stampede the probes:
 *
 *   Vercel (`vercelReady`) — the Box-adapter half: lane env vars present,
 *     the bridge secret set, CREATE_JOBS_ORIGIN configured. (The live
 *     probes — R2 reachability, lane manifest, Box skill version — run on
 *     the admin route `GET /api/admin/create/health`, which reuses
 *     `vercelHealth`.)
 *   Cloudflare (`workerReady`) — `GET <createJobsOrigin>/v1/health`, which
 *     self-checks the Workflow binding, an OwnerRoom round-trip, a cached
 *     Browser Run launch, the dispatch namespace and R2, plus a signed
 *     ping back at this origin.
 *
 * Both return content-free `{ ok, checks }` maps — a failing check names
 * the probe, never a value (CF5).
 */
import { env } from "../env";
import { appOriginLaneReady } from "../functions/deploy";

export interface ReadyCheck {
  ok: boolean;
  /** probe name → "ok" | "fail" | "skip" */
  checks: Record<string, "ok" | "fail" | "skip">;
}

const CACHE_MS = 60_000;
const PROBE_TIMEOUT_MS = 8_000;

let vercelCache: { at: number; result: ReadyCheck } | null = null;
let workerCache: { at: number; result: ReadyCheck } | null = null;

/** The Vercel half, no I/O: the env the adapter and the go route need. */
export function vercelHealth(): ReadyCheck {
  const checks: ReadyCheck["checks"] = {};
  checks["lane_env"] = appOriginLaneReady() ? "ok" : "fail";
  checks["bridge_secret"] = env.createBridgeSecret() !== null ? "ok" : "fail";
  checks["jobs_origin"] = /^https:\/\//.test(env.createJobsOrigin()) ? "ok" : "fail";
  checks["live_token_secret"] = env.liveTokenSecret() !== null ? "ok" : "fail";
  return {
    ok: Object.values(checks).every((state) => state === "ok"),
    checks,
  };
}

export async function vercelReady(now = Date.now()): Promise<ReadyCheck> {
  if (vercelCache && now - vercelCache.at < CACHE_MS) return vercelCache.result;
  const result = vercelHealth();
  vercelCache = { at: now, result };
  return result;
}

/**
 * The worker's own health probe. Unconfigured origin or an unreachable /
 * failing health endpoint is a `fail`, never a throw — `go` must be able to
 * answer `not_ready` instead of a 500.
 */
export async function workerReady(now = Date.now()): Promise<ReadyCheck> {
  if (workerCache && now - workerCache.at < CACHE_MS) return workerCache.result;
  const result = await probeWorker();
  workerCache = { at: now, result };
  return result;
}

async function probeWorker(): Promise<ReadyCheck> {
  const origin = env.createJobsOrigin();
  if (!/^https:\/\//.test(origin)) {
    return { ok: false, checks: { jobs_origin: "fail" } };
  }
  try {
    const response = await fetch(`${origin}/v1/health`, {
      signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      headers: { accept: "application/json" },
    });
    if (!response.ok) return { ok: false, checks: { worker_http: "fail" } };
    const body = (await response.json().catch(() => null)) as { ok?: unknown } | null;
    return { ok: body?.ok === true, checks: { worker_http: "ok" } };
  } catch {
    return { ok: false, checks: { worker_http: "fail" } };
  }
}

/**
 * `go` refuses with `not_ready` naming the failing half when either side is
 * down (§4.1). Only consulted on the V13 lane — a flag-off caller never
 * reaches this.
 */
export async function createLaneReady(): Promise<ReadyCheck & { reasons: string[] }> {
  const [vercel, worker] = await Promise.all([vercelReady(), workerReady()]);
  const checks = { ...vercel.checks, ...worker.checks };
  const reasons = Object.entries(checks)
    .filter(([, state]) => state === "fail")
    .map(([probe]) => probe);
  return { ok: vercel.ok && worker.ok, checks, reasons };
}

/** Test hook: drop both 60 s caches. */
export function resetReadyCaches(): void {
  vercelCache = null;
  workerCache = null;
}
