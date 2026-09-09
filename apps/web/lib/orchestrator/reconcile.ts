import { BoxApiError, getBox } from "@/lib/box/client";

/**
 * What the sweeper should write for a row stuck in a transitional state.
 *  - "ready":    the provider reports a live box; re-arm stop_after.
 *  - "stopped":  the provider confirmed the box is gone (404) or parked.
 *  - "stopping": the provider is still finishing a stop; look again later.
 * A lookup that fails for any other reason throws: the sweeper must not
 * treat a provider outage as proof that the VM is gone.
 */
export type ReconcileVerdict = "ready" | "stopped" | "stopping";

export async function reconcileVerdict(boxId: string): Promise<ReconcileVerdict> {
  try {
    const current = await getBox(boxId);
    if (current.state === "stopping") return "stopping";
    return current.state === "ready" || current.state === "idle" ? "ready" : "stopped";
  } catch (error) {
    if (error instanceof BoxApiError && error.status === 404) return "stopped";
    throw error;
  }
}
