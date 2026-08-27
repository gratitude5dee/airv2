/**
 * Opt-in Cotal agent mesh, scoped to ONE box (loopback NATS at
 * 127.0.0.1:4222): a session-coordination bus the agent can use to spawn and
 * talk to helper agents on its own computer. Nothing crosses tenants —
 * cross-user meshes are deliberately not a thing here. The template
 * preinstalls the pinned CLI; this owner-driven flow is the only thing that
 * ever starts it.
 */
import { command } from "./client";

/** The hermes-managed Node prefix where the template installs the CLI. */
const COTAL_PATH = "PATH=/home/user/.hermes/node/bin:$PATH";

export interface CotalStatus {
  installed: boolean;
  running: boolean;
}

export async function cotalStatus(boxId: string): Promise<CotalStatus> {
  const result = await command(
    boxId,
    `${COTAL_PATH}; command -v cotal >/dev/null || { echo missing; exit 0; }; cotal status >/dev/null 2>&1 && echo up || echo down`,
    60
  ).catch(() => null);
  const out = result?.stdout.trim() ?? "";
  if (!result || out === "missing") return { installed: false, running: false };
  return { installed: true, running: out === "up" };
}

/** Seed the local mesh config (idempotent) and start it detached. */
export async function enableCotal(boxId: string): Promise<CotalStatus> {
  const result = await command(
    boxId,
    `${COTAL_PATH}; cotal setup --yes && cotal up --detach`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`cotal up failed: ${result.stderr.slice(0, 500)}`);
  }
  return cotalStatus(boxId);
}

export async function disableCotal(boxId: string): Promise<void> {
  await command(boxId, `${COTAL_PATH}; cotal down`, 120).catch(() => undefined);
}
