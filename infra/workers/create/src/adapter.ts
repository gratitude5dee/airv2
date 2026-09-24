/**
 * The signed client for the Vercel Box adapter (V13 §9.1). Every call is a
 * CF1 POST; the responses carry ids, counters and rule ids only — the same
 * shape the control plane's own mirror expects. Failures are `AdapterError`
 * with the upstream status so the workflow's retry table can classify.
 */
import { bridgeSign, BRIDGE_SIG_HEADER, BRIDGE_TS_HEADER } from "./sign";

export class AdapterError extends Error {
  constructor(
    message: string,
    public readonly status: number
  ) {
    super(message);
    this.name = "AdapterError";
  }
}

export interface AdapterEnv {
  CONTROL_PLANE_ORIGIN: string;
  CREATE_BRIDGE_SECRET?: string;
}

export async function adapterPost<T = Record<string, unknown>>(
  env: AdapterEnv,
  path: string,
  body: Record<string, unknown>
): Promise<T> {
  const secret = env.CREATE_BRIDGE_SECRET;
  if (!secret) throw new AdapterError("bridge secret not configured", 503);
  const origin = env.CONTROL_PLANE_ORIGIN.replace(/\/+$/, "");
  const text = JSON.stringify(body);
  const { ts, sig } = await bridgeSign(secret, "POST", path, text);
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [BRIDGE_TS_HEADER]: ts,
        [BRIDGE_SIG_HEADER]: sig,
      },
      body: text,
    });
  } catch (error) {
    throw new AdapterError(
      `adapter unreachable: ${error instanceof Error ? error.name : "fetch"}`,
      503
    );
  }
  if (!response.ok) {
    // The body may carry an error id — take it, never prose (CF5).
    const text = await response.text().catch(() => "");
    let rule: string | null = null;
    try {
      const parsed = JSON.parse(text) as { error?: unknown };
      rule = typeof parsed.error === "string" && parsed.error.length <= 120 ? parsed.error : null;
    } catch {
      rule = null;
    }
    throw new AdapterError(rule ?? `adapter ${response.status}`, response.status);
  }
  return (await response.json().catch(() => ({}))) as T;
}

/** Facts the job mirrors onto its Supabase row (CF2). Ids and counters only. */
export interface JobFact {
  state?: string;
  step?: string;
  percent?: number;
  round?: number;
  version?: string | null;
  dev_url?: string | null;
  error_rule?: string | null;
  locked_test_ids?: string[];
}

/** §4.3 turn request: one Hermes turn on the workspace. */
export interface TurnRequest {
  job_id: string;
  role: "brief" | "code" | "fix";
  round: number;
  findings?: string[];
  change_file?: string;
}

export async function adapterTurn(
  env: AdapterEnv,
  request: TurnRequest
): Promise<{ run_id: string }> {
  return adapterPost<{ run_id: string }>(env, "/api/internal/create/turn", { ...request });
}

export async function adapterBuild(
  env: AdapterEnv,
  jobId: string
): Promise<{ version: string | null; findings: { rule: string }[] }> {
  return adapterPost(env, "/api/internal/create/build", { job_id: jobId });
}

export async function adapterTests(
  env: AdapterEnv,
  jobId: string
): Promise<{ ids: string[]; locked: string[]; tests?: CheckTestLike[] }> {
  return adapterPost(env, "/api/internal/create/tests", { job_id: jobId });
}

/** The V12 DSL shape the check runs; mirrored loosely so the worker needs no zod. */
export interface CheckTestLike {
  id: string;
  locked?: boolean;
  viewport?: string;
  type?: [string, string];
  tap?: string;
  wait?: number;
  changed?: string;
  see?: string;
  missing?: string;
  expectHref?: string;
}

export async function adapterFacts(
  env: AdapterEnv,
  jobId: string,
  job: JobFact,
  check?: {
    smoke: boolean | null;
    locked_passed: number;
    locked_total: number;
    score: number;
    locked_failed_ids: string[];
  }
): Promise<{ ok: boolean }> {
  return adapterPost(env, "/api/internal/create/facts", { job_id: jobId, job, check });
}

export async function adapterPublishDev(
  env: AdapterEnv,
  jobId: string,
  version: string
): Promise<{ dev_url: string; version: string }> {
  return adapterPost(env, "/api/internal/create/publish-dev", {
    job_id: jobId,
    version,
  });
}

export async function adapterNotify(
  env: AdapterEnv,
  jobId: string,
  outcome: "live" | "stuck" | "failed"
): Promise<{ ok: boolean }> {
  return adapterPost(env, "/api/internal/create/notify", { job_id: jobId, outcome });
}

/** §4.4 cancel: kill the running turn before the instance terminates. */
export async function adapterStopTurn(
  env: AdapterEnv,
  jobId: string,
  runId: string
): Promise<{ ok: boolean }> {
  return adapterPost(env, "/api/internal/create/turn", {
    job_id: jobId,
    stop: true,
    run_id: runId,
  });
}

/** The cron sweep: revoke dev links past dev_expires_at. */
export async function adapterDevExpire(env: AdapterEnv): Promise<{ ok: boolean; revoked?: number }> {
  return adapterPost(env, "/api/internal/create/dev-expire", {});
}
