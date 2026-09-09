import { BoxApiError, getBox } from "@/lib/box/client";

/**
 * What the sweeper should write for a row stuck in a transitional state.
 *  - "ready":    the provider reports a live box; re-arm stop_after.
 *  - "stopped":  the provider confirmed the box is gone (404), parked, or dead.
 *  - "pending":  the provider still owns an in-flight boot or stop
 *                (cloning/starting/provisioned, stopping/archiving); look
 *                again later rather than writing a terminal state over it.
 * A lookup that fails for any other reason throws: the sweeper must not
 * treat a provider outage as proof that the VM is gone.
 */
export type ReconcileVerdict = "ready" | "stopped" | "pending";

const LIVE_STATES: ReadonlySet<string> = new Set(["ready", "idle"]);
const IN_FLIGHT_STATES: ReadonlySet<string> = new Set([
  "provisioned",
  "cloning",
  "starting",
  "stopping",
  "archiving",
]);

export async function reconcileVerdict(boxId: string): Promise<ReconcileVerdict> {
  try {
    const current = await getBox(boxId);
    if (LIVE_STATES.has(current.state)) return "ready";
    if (IN_FLIGHT_STATES.has(current.state)) return "pending";
    return "stopped";
  } catch (error) {
    if (error instanceof BoxApiError && error.status === 404) return "stopped";
    throw error;
  }
}
