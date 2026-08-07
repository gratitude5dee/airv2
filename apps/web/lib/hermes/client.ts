/**
 * Client for Hermes api_server (port 8642) reached over the Box hosted URL.
 * Two independent secrets gate every call: the `?_token=` on the hosted URL
 * and the per-box API_SERVER_KEY (ARCHITECTURE.md §8.1). Neither may ever
 * reach a browser (C3).
 */

export interface HermesBoxTarget {
  /** e.g. https://<sub>-8642.on.ascii.dev — SECRET-adjacent, server-side only */
  hostedUrl: string;
  hostedToken: string;
  apiServerKey: string;
}

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
  const separator = path.includes("?") ? "&" : "?";
  return `${target.hostedUrl}${path}${separator}_token=${encodeURIComponent(target.hostedToken)}`;
}

function headers(target: HermesBoxTarget): HeadersInit {
  return {
    Authorization: `Bearer ${target.apiServerKey}`,
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
  return hermesFetch<RunResponse>(target, "/v1/runs", {
    method: "POST",
    body: JSON.stringify(request),
  });
}

/** SSE stream of run events; pipe into the channel renderer. */
export async function runEvents(
  target: HermesBoxTarget,
  runId: string
): Promise<ReadableStream<Uint8Array>> {
  const response = await fetch(url(target, `/v1/runs/${runId}/events`), {
    headers: headers(target),
  });
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

/** Post-resume readiness probe. Use /api/health, not /api/status (§7.4). */
export async function health(target: HermesBoxTarget): Promise<boolean> {
  try {
    const response = await fetch(url(target, "/health"), {
      headers: headers(target),
    });
    return response.ok;
  } catch {
    return false;
  }
}
