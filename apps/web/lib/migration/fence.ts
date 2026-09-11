/**
 * The persistent, box-side barrier (plan §3 "Control-plane fencing alone is
 * not sufficient"). installFence masks every user-facing service unit and
 * drops a marker file at ${FENCE_MARKER}; a masked unit cannot restart across
 * resume, reboot, or provider restore, and the marker survives both. The
 * entire `.air/` tree is excluded from the transfer set, so a source's
 * retained-role marker can never be copied onto the candidate.
 */
import { runCommand } from "../compute/runtime";
import type { ComputeTarget } from "../compute/runtime";

/** Every service the template can enable — masked for the duration. */
export const FENCED_UNITS = [
  "hermes-gateway.service",
  "hermes-dashboard.service",
  "hermes-host.service",
  "hermes-sidecar-owner.service",
  "hermes-sidecar-owner.timer",
  "openviking.service",
  "openviking-index.service",
  "openviking-index.timer",
  "taskrouter.service",
  "tailscaled.service",
] as const;

export const FENCE_MARKER = ".air/migration-fence.json";

export interface FenceProof {
  migration_id: string;
  role: "candidate" | "retained";
  fence_epoch: number;
  routing_generation: number;
  installed_at: string;
}

export async function installFence(
  target: ComputeTarget,
  proof: FenceProof
): Promise<void> {
  const unitList = FENCED_UNITS.join(" ");
  const result = await runCommand(
    target,
    `for u in ${unitList}; do sudo -n systemctl stop "$u" >/dev/null 2>&1 || true; sudo -n systemctl mask "$u" >/dev/null 2>&1 || true; done; ` +
      `mkdir -p .air && chmod 700 .air && ` +
      `printf '%s' '${JSON.stringify(proof).replace(/'/g, "'\\''")}' > ${FENCE_MARKER} && chmod 600 ${FENCE_MARKER} && echo FENCED`,
    120
  );
  if (result.exitCode !== 0 || !result.stdout.includes("FENCED")) {
    throw new Error(
      `fence install failed: ${result.stderr.slice(0, 300) || result.stdout.slice(0, 300)}`
    );
  }
}

/**
 * Prove the fence is still holding: marker file intact with the expected
 * identity, and the gateway unit still masked. A resumed source that lost
 * either is a repairable-drift signal, not data loss — the mask is the hard
 * barrier, the marker is the audit trail.
 */
export async function probeFence(
  target: ComputeTarget,
  expected: { migration_id: string; fence_epoch: number }
): Promise<{ holding: boolean; detail: Record<string, unknown> }> {
  const result = await runCommand(
    target,
    `cat ${FENCE_MARKER} 2>/dev/null; echo; echo '---'; sudo -n systemctl is-enabled hermes-gateway.service 2>/dev/null || true`,
    60
  );
  if (result.exitCode !== 0) {
    return { holding: false, detail: { probe_error: result.stderr.slice(0, 200) } };
  }
  const [markerText = "", , unitState = ""] = result.stdout.split("\n");
  let marker: Record<string, unknown> = {};
  try {
    marker = JSON.parse(markerText) as Record<string, unknown>;
  } catch {
    marker = {};
  }
  const holding =
    marker["migration_id"] === expected.migration_id &&
    marker["fence_epoch"] === expected.fence_epoch &&
    unitState.trim() === "masked";
  return {
    holding,
    detail: {
      marker_ok:
        marker["migration_id"] === expected.migration_id &&
        marker["fence_epoch"] === expected.fence_epoch,
      gateway_unit: unitState.trim(),
    },
  };
}

/**
 * Lift the fence: unmask every unit, start the ones that make a box live, and
 * remove the marker. Order matters — gateway before the host oneshot that
 * re-registers its route.
 */
export async function liftFence(target: ComputeTarget): Promise<void> {
  const unmask = FENCED_UNITS.join(" ");
  const start = [
    "hermes-gateway.service",
    "hermes-dashboard.service",
    "hermes-host.service",
    "openviking.service",
    "taskrouter.service",
    "tailscaled.service",
    "hermes-sidecar-owner.timer",
    "openviking-index.timer",
  ].join(" ");
  const result = await runCommand(
    target,
    `for u in ${unmask}; do sudo -n systemctl unmask "$u" >/dev/null 2>&1 || true; done; ` +
      `rm -f ${FENCE_MARKER} && ` +
      `for u in ${start}; do sudo -n systemctl start "$u" >/dev/null 2>&1 || true; done; ` +
      `sudo -n systemctl is-active hermes-gateway.service 2>/dev/null || true`,
    120
  );
  if (result.exitCode !== 0) {
    throw new Error(`fence lift failed: ${result.stderr.slice(0, 300)}`);
  }
}
