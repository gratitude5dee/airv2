/**
 * Client for Hermes api_server (port 8642) reached over the Box hosted URL.
 * Two independent secrets gate every call: the `?_token=` on the hosted URL
 * and the per-box API_SERVER_KEY (ARCHITECTURE.md §8.1). Neither may ever
 * reach a browser (C3).
 */
import { fetchWithHeaderTimeout, requestSignal } from "../http/timeout";

export interface HermesBoxTarget {
  /** e.g. https://<sub>-8642.on.ascii.dev — SECRET-adjacent, server-side only */
  hostedUrl: string;
  hostedToken: string;
  apiServerKey: string;
}

/**
 * The one durable conversation every chat client shares (goal.md M6, C13
 * adjacent): iMessage, web, and any future channel (WhatsApp…) all run their
 * turns in this Hermes session, so history and context are synced — email
 * stays per-thread because threads are the conversation unit there.
 */
export const MAIN_SESSION = "air-main";

/** Calls traverse the hosted proxy into the box; generous but bounded. */
const HERMES_REQUEST_TIMEOUT_MS = 60_000;
/** SSE opens bound only connection/headers; the body streams unbounded. */
const HERMES_STREAM_OPEN_TIMEOUT_MS = 60_000;
/** The health probe is a wake-loop poll; fail fast so the loop can retry. */
const HEALTH_TIMEOUT_MS = 10_000;

export interface RunRequest {
  input: string;
  sessionId?: string;
  metadata?: Record<string, string>;
}

export interface RunResponse {
  run_id: string;
}

export class HermesApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "HermesApiError";
    this.status = status;
  }
}

function url(target: HermesBoxTarget, path: string): string {
  return `${target.hostedUrl}${path}`;
}

// The hosted proxy authenticates via the _port_auth cookie: passing `?_token`
// only triggers a 302 that sets the cookie and strips the query, which
// server-side fetch cannot follow. Send the cookie directly.
function headers(target: HermesBoxTarget): HeadersInit {
  return {
    Authorization: `Bearer ${target.apiServerKey}`,
    Cookie: `_port_auth=${target.hostedToken}`,
    "Content-Type": "application/json",
  };
}

async function hermesFetch<T>(
  target: HermesBoxTarget,
  path: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(url(target, path), {
    ...init,
    signal: requestSignal(HERMES_REQUEST_TIMEOUT_MS, init?.signal),
    headers: { ...headers(target), ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.text();
    throw new HermesApiError(response.status, body.slice(0, 500));
  }
  return (await response.json()) as T;
}

export async function createRun(
  target: HermesBoxTarget,
  request: RunRequest
): Promise<RunResponse> {
  // api_server expects snake_case `session_id`; a camelCase key is silently
  // ignored and every run lands in its own throwaway session.
  return hermesFetch<RunResponse>(target, "/v1/runs", {
    method: "POST",
    body: JSON.stringify({
      input: request.input,
      ...(request.sessionId ? { session_id: request.sessionId } : {}),
      ...(request.metadata ? { metadata: request.metadata } : {}),
    }),
  });
}

/** SSE stream of run events; pipe into the channel renderer. */
export async function runEvents(
  target: HermesBoxTarget,
  runId: string
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetchWithHeaderTimeout(
    url(target, `/v1/runs/${runId}/events`),
    { headers: headers(target) },
    HERMES_STREAM_OPEN_TIMEOUT_MS
  );
  if (!response.ok || !response.body) {
    throw new HermesApiError(response.status, "failed to open run event stream");
  }
  return response.body;
}

export async function stopRun(
  target: HermesBoxTarget,
  runId: string
): Promise<void> {
  await hermesFetch<unknown>(target, `/v1/runs/${runId}/stop`, {
    method: "POST",
  });
}

export async function approveRun(
  target: HermesBoxTarget,
  runId: string,
  approved: boolean
): Promise<void> {
  await hermesFetch<unknown>(target, `/v1/runs/${runId}/approval`, {
    method: "POST",
    body: JSON.stringify({ approved }),
  });
}

/** Hermes cron job (5d): exposed over REST as /api/jobs. */
export interface HermesJob {
  id: string;
  name?: string;
  schedule?: string;
  prompt?: string;
  enabled?: boolean;
  paused?: boolean;
  deliver?: string;
  next_run_at?: string | null;
  last_run_at?: string | null;
  last_output?: string | null;
}

export async function listJobs(target: HermesBoxTarget): Promise<HermesJob[]> {
  const result = await hermesFetch<HermesJob[] | { jobs?: HermesJob[] }>(
    target,
    "/api/jobs"
  );
  return Array.isArray(result) ? result : (result.jobs ?? []);
}

export async function createJob(
  target: HermesBoxTarget,
  job: { name: string; schedule: string; prompt: string; deliver?: string }
): Promise<HermesJob> {
  return hermesFetch<HermesJob>(target, "/api/jobs", {
    method: "POST",
    body: JSON.stringify(job),
  });
}

export async function runJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<void> {
  await hermesFetch<unknown>(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}/run`,
    { method: "POST" }
  );
}

export async function getJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<HermesJob> {
  const result = await hermesFetch<HermesJob | { job?: HermesJob }>(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}`
  );
  return "job" in result && result.job ? result.job : (result as HermesJob);
}

export async function updateJob(
  target: HermesBoxTarget,
  jobId: string,
  patch: { name?: string; schedule?: string; prompt?: string }
): Promise<HermesJob> {
  const result = await hermesFetch<HermesJob | { job?: HermesJob }>(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}`,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  return "job" in result && result.job ? result.job : (result as HermesJob);
}

export async function deleteJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<void> {
  await hermesFetch<unknown>(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}`,
    { method: "DELETE" }
  );
}

export async function pauseJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<void> {
  await hermesFetch<unknown>(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}/pause`,
    { method: "POST" }
  );
}

export async function resumeJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<void> {
  await hermesFetch<unknown>(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}/resume`,
    { method: "POST" }
  );
}

/** Hermes session row (api_server /api/sessions). */
export interface HermesSession {
  id: string;
  title?: string | null;
  started_at?: number | null;
  last_active?: number | null;
  message_count?: number | null;
  preview?: string | null;
}

export async function listSessions(
  target: HermesBoxTarget
): Promise<HermesSession[]> {
  const result = await hermesFetch<
    HermesSession[] | { sessions?: HermesSession[] }
  >(target, "/api/sessions");
  return Array.isArray(result) ? result : (result.sessions ?? []);
}

/**
 * Create a session with an explicit id + title. A 409/exists answer is
 * success for callers that want ensure-once semantics (the canonical
 * per-bot "Bot Chat" session).
 */
export async function ensureSession(
  target: HermesBoxTarget,
  sessionId: string,
  title: string
): Promise<void> {
  const response = await fetch(url(target, "/api/sessions"), {
    method: "POST",
    signal: requestSignal(HERMES_REQUEST_TIMEOUT_MS),
    headers: headers(target),
    body: JSON.stringify({ id: sessionId, title }),
  });
  if (response.ok || response.status === 409) return;
  const body = await response.text();
  // Older builds answer duplicate creates with a 400 "exists" error.
  if (response.status === 400 && /exist/i.test(body)) return;
  throw new HermesApiError(response.status, body.slice(0, 500));
}

export interface HermesMessage {
  role: string;
  content: string;
  created_at?: number | null;
}

export async function sessionMessages(
  target: HermesBoxTarget,
  sessionId: string
): Promise<HermesMessage[]> {
  const result = await hermesFetch<
    HermesMessage[] | { messages?: HermesMessage[] }
  >(target, `/api/sessions/${encodeURIComponent(sessionId)}/messages`);
  return Array.isArray(result) ? result : (result.messages ?? []);
}

/** Post-resume readiness probe against api_server's /health. */
export async function health(target: HermesBoxTarget): Promise<boolean> {
  try {
    const response = await fetch(url(target, "/health"), {
      signal: requestSignal(HEALTH_TIMEOUT_MS),
      headers: headers(target),
    });
    return response.ok;
  } catch {
    return false;
  }
}
