/**
 * Outbound HTTP deadlines for the control plane's fetch helpers. A hung
 * upstream must reject instead of pinning a function to maxDuration.
 *
 * Two shapes:
 *  - requestSignal: an overall AbortSignal.timeout covering connection,
 *    headers, and body — for JSON request/response calls.
 *  - fetchWithHeaderTimeout: bounds only the time to response headers, so an
 *    actively-streaming body (SSE) is never aborted by the timer.
 */

/** Default deadline for control-plane JSON calls. */
export const DEFAULT_REQUEST_TIMEOUT_MS = 30_000;

/** Overall request deadline unless the caller supplied its own signal. */
export function requestSignal(
  timeoutMs: number,
  signal?: AbortSignal | null
): AbortSignal {
  return signal ?? AbortSignal.timeout(timeoutMs);
}

/**
 * Fetch that rejects with a TimeoutError if response headers do not arrive
 * within timeoutMs. Once headers arrive the timer is cleared, so reading the
 * body (e.g. an SSE stream) can continue indefinitely.
 */
export async function fetchWithHeaderTimeout(
  input: string | URL,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(
    () =>
      controller.abort(
        new DOMException(
          `response headers not received within ${timeoutMs}ms`,
          "TimeoutError"
        )
      ),
    timeoutMs
  );
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
