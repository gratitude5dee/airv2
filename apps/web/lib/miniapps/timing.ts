/**
 * Latency instrumentation shared by the mini-app loader, the gate chain and
 * the per-app renderers. Timing lines are content-free — slug, block name
 * and milliseconds only.
 */

/** Milliseconds since `start`, rounded to a tenth. */
export function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 10) / 10;
}

/**
 * Run an app's data-fetch block and log how long it took. `block` names the
 * fetch (e.g. "registry+order") so the slowest app can be identified from
 * the server log without a profiler.
 */
export async function timedFetch<T>(
  app: string,
  block: string,
  fn: () => Promise<T>
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    console.log(
      JSON.stringify({
        msg: "miniapp data fetch",
        app,
        block,
        ms: elapsedMs(start),
      })
    );
  }
}
