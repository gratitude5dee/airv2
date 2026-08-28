/**
 * Latency instrumentation shared by the mini-app loader, the gate chain and
 * the per-app renderers. Timing lines are content-free — slug, block name
 * and milliseconds only.
 */

/** Milliseconds since `start`, rounded to a tenth. */
export function elapsedMs(start: number): number {
  return Math.round((performance.now() - start) * 10) / 10;
}

export type PartTimings = Record<string, number>;

/** Time one concurrent branch of a fan-out block. Wall-clock, so parts overlap;
 * the point is to find the long pole, not to sum to the total. */
export function timedPart<T>(
  parts: PartTimings,
  label: string,
  fn: () => PromiseLike<T>
): Promise<T> {
  const start = performance.now();
  try {
    return Promise.resolve(fn()).finally(() => {
      parts[label] = elapsedMs(start);
    });
  } catch (error) {
    parts[label] = elapsedMs(start);
    return Promise.reject(error);
  }
}

/** Run a fan-out block and log one line with the total and every part. */
export async function timedParts<T>(
  app: string,
  block: string,
  run: (parts: PartTimings) => Promise<T>
): Promise<T> {
  const start = performance.now();
  const parts: PartTimings = {};
  try {
    return await run(parts);
  } finally {
    console.log(
      JSON.stringify({
        msg: "miniapp data fetch",
        app,
        block,
        ms: elapsedMs(start),
        parts,
      })
    );
  }
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
