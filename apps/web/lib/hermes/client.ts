/**
 * Client for Hermes api_server (port 8642) reached over the Box hosted URL.
 * Two independent secrets gate every call: the `?_token=` on the hosted URL
 * and the per-box API_SERVER_KEY (ARCHITECTURE.md §8.1). Neither may ever
 * reach a browser (C3).
 */
import { z } from "zod";
import { fetchWithHeaderTimeout, requestSignal } from "../http/timeout";
import {
  parseRawMessages,
  sanitizeConversation,
  type ConversationMessage,
} from "./history";

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
/** Title used when creating MAIN_SESSION on first use. */
export const MAIN_SESSION_TITLE = "Air";

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
  /** Explicit history replay; when omitted and sessionId is set, createRun
   * loads the persisted session transcript itself. */
  conversationHistory?: ConversationMessage[];
}

const RunResponseSchema = z.object({ run_id: z.string() });
export type RunResponse = z.infer<typeof RunResponseSchema>;

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
  schema: z.ZodType<T>,
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
  const json: unknown = await response.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    throw new HermesApiError(
      502,
      `unexpected response shape from ${path}: ${parsed.error.message.slice(0, 300)}`
    );
  }
  return parsed.data;
}

/**
 * Load the persisted transcript for a session as replayable history.
 * Best-effort: a missing session (first turn), an unreachable box, or an
 * unexpected payload all degrade to an empty history rather than failing
 * the turn.
 */
export async function loadConversationHistory(
  target: HermesBoxTarget,
  sessionId: string
): Promise<ConversationMessage[]> {
  try {
    const response = await fetch(
      url(target, `/api/sessions/${encodeURIComponent(sessionId)}/messages`),
      {
        signal: requestSignal(HERMES_REQUEST_TIMEOUT_MS),
        headers: headers(target),
      }
    );
    if (!response.ok) return [];
    return sanitizeConversation(parseRawMessages(await response.json()));
  } catch {
    return [];
  }
}

export async function createRun(
  target: HermesBoxTarget,
  request: RunRequest
): Promise<RunResponse> {
  // The runs endpoint persists into `session_id` but does NOT load its
  // transcript into the model context — continuity requires replaying the
  // stored history as `conversation_history` (see lib/hermes/history.ts).
  const history =
    request.conversationHistory ??
    (request.sessionId
      ? await loadConversationHistory(target, request.sessionId)
      : []);
  // api_server expects snake_case `session_id`; a camelCase key is silently
  // ignored and every run lands in its own throwaway session.
  return hermesFetch(target, "/v1/runs", RunResponseSchema, {
    method: "POST",
    body: JSON.stringify({
      input: request.input,
      ...(request.sessionId ? { session_id: request.sessionId } : {}),
      ...(history.length > 0 ? { conversation_history: history } : {}),
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
  await hermesFetch(target, `/v1/runs/${runId}/stop`, z.unknown(), {
    method: "POST",
  });
}

export async function approveRun(
  target: HermesBoxTarget,
  runId: string,
  approved: boolean
): Promise<void> {
  await hermesFetch(target, `/v1/runs/${runId}/approval`, z.unknown(), {
    method: "POST",
    body: JSON.stringify({ approved }),
  });
}

/** Hermes cron job (5d): exposed over REST as /api/jobs. */
const HermesJobSchema = z.object({
  id: z.string(),
  name: z.string().optional(),
  schedule: z.string().optional(),
  prompt: z.string().optional(),
  enabled: z.boolean().optional(),
  paused: z.boolean().optional(),
  deliver: z.string().optional(),
  next_run_at: z.string().nullable().optional(),
  last_run_at: z.string().nullable().optional(),
  last_output: z.string().nullable().optional(),
});
export type HermesJob = z.infer<typeof HermesJobSchema>;

const JobResultSchema = z.union([
  HermesJobSchema,
  z.object({ job: HermesJobSchema.optional() }),
]);

export async function listJobs(target: HermesBoxTarget): Promise<HermesJob[]> {
  const result = await hermesFetch(
    target,
    "/api/jobs",
    z.union([
      z.array(HermesJobSchema),
      z.object({ jobs: z.array(HermesJobSchema).optional() }),
    ])
  );
  return Array.isArray(result) ? result : (result.jobs ?? []);
}

export async function createJob(
  target: HermesBoxTarget,
  job: { name: string; schedule: string; prompt: string; deliver?: string }
): Promise<HermesJob> {
  return hermesFetch(target, "/api/jobs", HermesJobSchema, {
    method: "POST",
    body: JSON.stringify(job),
  });
}

export async function runJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<void> {
  await hermesFetch(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}/run`,
    z.unknown(),
    { method: "POST" }
  );
}

export async function getJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<HermesJob> {
  const result = await hermesFetch(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}`,
    JobResultSchema
  );
  return unwrapJob(result, jobId);
}

export async function updateJob(
  target: HermesBoxTarget,
  jobId: string,
  patch: { name?: string; schedule?: string; prompt?: string }
): Promise<HermesJob> {
  const result = await hermesFetch(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}`,
    JobResultSchema,
    { method: "PATCH", body: JSON.stringify(patch) }
  );
  return unwrapJob(result, jobId);
}

function unwrapJob(
  result: z.infer<typeof JobResultSchema>,
  jobId: string
): HermesJob {
  if ("id" in result) return result;
  if (result.job) return result.job;
  throw new HermesApiError(502, `job ${jobId}: empty job envelope`);
}

export async function deleteJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<void> {
  await hermesFetch(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}`,
    z.unknown(),
    { method: "DELETE" }
  );
}

export async function pauseJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<void> {
  await hermesFetch(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}/pause`,
    z.unknown(),
    { method: "POST" }
  );
}

export async function resumeJob(
  target: HermesBoxTarget,
  jobId: string
): Promise<void> {
  await hermesFetch(
    target,
    `/api/jobs/${encodeURIComponent(jobId)}/resume`,
    z.unknown(),
    { method: "POST" }
  );
}

/** Hermes session row (api_server /api/sessions). */
const HermesSessionSchema = z.object({
  id: z.string(),
  title: z.string().nullable().optional(),
  started_at: z.number().nullable().optional(),
  last_active: z.number().nullable().optional(),
  message_count: z.number().nullable().optional(),
  preview: z.string().nullable().optional(),
});
export type HermesSession = z.infer<typeof HermesSessionSchema>;

export async function listSessions(
  target: HermesBoxTarget
): Promise<HermesSession[]> {
  const result = await hermesFetch(
    target,
    "/api/sessions",
    z.union([
      z.array(HermesSessionSchema),
      z.object({ sessions: z.array(HermesSessionSchema).optional() }),
    ])
  );
  return Array.isArray(result) ? result : (result.sessions ?? []);
}

/**
 * Create a session with an explicit id + title. A 409/exists answer is
 * success for callers that want ensure-once semantics (the canonical
 * per-bot "Bot Chat" session). `created` is false when the box reported the
 * session already existed, which tells callers a transcript should be there
 * to replay.
 */
export async function ensureSession(
  target: HermesBoxTarget,
  sessionId: string,
  title: string
): Promise<{ created: boolean }> {
  const response = await fetch(url(target, "/api/sessions"), {
    method: "POST",
    signal: requestSignal(HERMES_REQUEST_TIMEOUT_MS),
    headers: headers(target),
    body: JSON.stringify({ id: sessionId, title }),
  });
  if (response.status === 409) return { created: false };
  if (response.ok) return { created: true };
  const body = await response.text();
  // Older builds answer duplicate creates with a 400 "exists" error.
  if (response.status === 400 && /exist/i.test(body)) return { created: false };
  throw new HermesApiError(response.status, body.slice(0, 500));
}

const HermesMessageSchema = z.object({
  role: z.string(),
  content: z.string(),
  created_at: z.number().nullable().optional(),
});
export type HermesMessage = z.infer<typeof HermesMessageSchema>;

export async function sessionMessages(
  target: HermesBoxTarget,
  sessionId: string
): Promise<HermesMessage[]> {
  const result = await hermesFetch(
    target,
    `/api/sessions/${encodeURIComponent(sessionId)}/messages`,
    z.union([
      z.array(HermesMessageSchema),
      z.object({ messages: z.array(HermesMessageSchema).optional() }),
    ])
  );
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
