/**
 * Coordinated idle stop against the box's durable index worker.
 *
 * The sweeper never stops a box on the strength of a read-only probe: it
 * takes an exclusive stop claim (`ovctl stop-claim`) that the worker
 * (`ovctl resume-pending`) refuses to start indexing against, so nothing
 * can begin between the check and the provider stop. The claim is voided
 * by the box's next boot, by the wake path's `ovctl resumed` (providers
 * that restore memory keep the boot id) and by a TTL, and is released
 * explicitly when the stop is aborted.
 *
 * Boxes whose ovctl predates the claim fall back in a bounded way:
 *  - idle-check only: the legacy probe (racy, but no worse than before);
 *  - neither command: stop once the box has been overdue for
 *    LEGACY_STOP_GRACE_MS, the pre-probe behaviour with the same grace the
 *    worker uses.
 * Everything else — pending work, grace window, corrupt state, failed
 * probes — defers, and the reason is reported so a stuck fleet is visible.
 */
import { command, type CommandResult } from "@/lib/box/client";

export const IDLE_GRACE_SECONDS = 1200;
export const LEGACY_STOP_GRACE_MS = IDLE_GRACE_SECONDS * 1000;
const PROBE_TIMEOUT_SECONDS = 15;

export type DeferReason =
  | "pending"
  | "grace"
  | "busy"
  | "claimed"
  | "probe_failed"
  | "legacy_grace";

export type StopDecision =
  | { kind: "claimed"; token: string }
  | { kind: "legacy_probe" }
  | { kind: "legacy_stop" }
  | { kind: "deferred"; reason: DeferReason };

const DEFER_REASONS = new Set<string>(["pending", "grace", "busy", "claimed"]);

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : null;
}

function parseJson(stdout: string): Record<string, unknown> | null {
  try {
    return record(JSON.parse(stdout));
  } catch {
    return null;
  }
}

/** argparse rejects an unknown subcommand with exit 2; a missing ovctl is 127. */
export function commandMissing(result: CommandResult, subcommand: string): boolean {
  if (result.exitCode === 127) return true;
  return result.exitCode === 2 && result.stderr.includes(`invalid choice: '${subcommand}'`);
}

async function run(boxId: string, subcommand: string, args: string): Promise<CommandResult | null> {
  let result: CommandResult;
  try {
    result = await command(boxId, `ovctl ${subcommand} ${args}`.trimEnd(), PROBE_TIMEOUT_SECONDS);
  } catch (error) {
    probeFailed(boxId, subcommand, { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
  if (result.exitCode !== 0 && !commandMissing(result, subcommand)) {
    probeFailed(boxId, subcommand, { exit: result.exitCode, stderr: result.stderr.slice(-300) });
  }
  return result;
}

/** ovctl stderr is diagnostics (tracebacks, argparse), never owner content. */
function probeFailed(boxId: string, subcommand: string, detail: Record<string, unknown>): void {
  console.error(JSON.stringify({ msg: "ovctl probe failed", box_id: boxId, subcommand, ...detail }));
}

/** Old boxes with idle-check but no claim: read-only probe, deny on anything unclear. */
async function legacyProbe(boxId: string, overdueMs: number): Promise<StopDecision> {
  const result = await run(boxId, "idle-check", `--grace-seconds ${IDLE_GRACE_SECONDS}`);
  if (result === null) return { kind: "deferred", reason: "probe_failed" };
  if (commandMissing(result, "idle-check")) {
    return overdueMs >= LEGACY_STOP_GRACE_MS
      ? { kind: "legacy_stop" }
      : { kind: "deferred", reason: "legacy_grace" };
  }
  if (result.exitCode !== 0) return { kind: "deferred", reason: "probe_failed" };
  const state = parseJson(result.stdout);
  if (state === null) return { kind: "deferred", reason: "probe_failed" };
  if (state["can_stop"] === true) return { kind: "legacy_probe" };
  if (typeof state["pending"] === "number" && state["pending"] > 0) {
    return { kind: "deferred", reason: "pending" };
  }
  if (typeof state["idle_remaining_seconds"] === "number" && state["idle_remaining_seconds"] > 0) {
    return { kind: "deferred", reason: "grace" };
  }
  return { kind: "deferred", reason: "probe_failed" };
}

/**
 * Acquire the box's stop claim. `overdueMs` is how long the box has been
 * past its deadline; it only matters for boxes without any idle command.
 * Never wakes a sleeping box and never treats a failed probe as idle.
 */
export async function claimIdleStop(boxId: string, overdueMs: number): Promise<StopDecision> {
  const result = await run(boxId, "stop-claim", `--grace-seconds ${IDLE_GRACE_SECONDS}`);
  if (result === null) return { kind: "deferred", reason: "probe_failed" };
  if (commandMissing(result, "stop-claim")) return legacyProbe(boxId, overdueMs);
  if (result.exitCode !== 0) return { kind: "deferred", reason: "probe_failed" };
  const state = parseJson(result.stdout);
  if (state === null) return { kind: "deferred", reason: "probe_failed" };
  // The token is echoed back on a shell command line; accept only ovctl's hex.
  if (state["claimed"] === true && typeof state["token"] === "string" && /^[0-9a-f]{32}$/.test(state["token"])) {
    return { kind: "claimed", token: state["token"] };
  }
  const reason = state["reason"];
  if (typeof reason === "string" && DEFER_REASONS.has(reason)) {
    return { kind: "deferred", reason: reason as DeferReason };
  }
  return { kind: "deferred", reason: "probe_failed" };
}

/** Best effort: the claim also expires by TTL and is void after the next boot. */
export async function releaseIdleStop(boxId: string, token: string): Promise<boolean> {
  const result = await run(boxId, "stop-release", `--token ${token}`);
  return result !== null && result.exitCode === 0;
}
