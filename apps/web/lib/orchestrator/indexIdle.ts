import { command } from "@/lib/box/client";

/** Read only; never wakes a sleeping box or interprets failed probes as idle. */
export async function indexingAllowsIdleStop(boxId: string): Promise<boolean> {
  try {
    const result = await command(boxId, "ovctl idle-check --grace-seconds 1200", 15);
    if (result.exitCode !== 0) return false;
    const state: unknown = JSON.parse(result.stdout);
    return typeof state === "object" && state !== null &&
      "can_stop" in state && state.can_stop === true;
  } catch {
    return false;
  }
}
