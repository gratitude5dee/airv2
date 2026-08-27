/**
 * Opt-in Tailscale on the user's OWN tailnet. The box joins with the user's
 * auth key — never a platform tailnet (that would be a lateral-movement
 * fabric across tenants, violating I1). The key is a user credential: it
 * travels once via the files API into a shredded one-shot file (never argv,
 * never Postgres) and tailscaled keeps only its own derived node state under
 * ~/.tailscale. Default off; the template installs the binaries and the
 * (disabled) unit, and only this owner-driven flow ever starts it.
 */
import { randomBytes } from "node:crypto";
import { command, writeFile } from "./client";
import {
  registerVaultValue,
  scrubVaultValues,
  unregisterVaultValues,
} from "../vault/scrub";

export interface TailscaleStatus {
  installed: boolean;
  running: boolean;
  /** MagicDNS name of the box on the user's tailnet, when connected. */
  dnsName: string | null;
}

const AUTH_KEY_RE = /^tskey-[\x21-\x7e]{8,256}$/;

export class TailscaleInputError extends Error {}

const TS_SOCKET = "/home/user/.tailscale/tailscaled.sock";

export async function tailscaleStatus(boxId: string): Promise<TailscaleStatus> {
  const result = await command(
    boxId,
    `command -v tailscale >/dev/null || { echo missing; exit 0; }; tailscale --socket=${TS_SOCKET} status --json 2>/dev/null || echo down`
  ).catch(() => null);
  const out = result?.stdout.trim() ?? "";
  if (!result || out === "missing") {
    return { installed: false, running: false, dnsName: null };
  }
  if (out === "down" || out === "") {
    return { installed: true, running: false, dnsName: null };
  }
  try {
    const doc = JSON.parse(out) as {
      BackendState?: string;
      Self?: { DNSName?: string };
    };
    const running = doc.BackendState === "Running";
    return {
      installed: true,
      running,
      dnsName: running
        ? (doc.Self?.DNSName ?? "").replace(/\.$/, "") || null
        : null,
    };
  } catch {
    return { installed: true, running: false, dnsName: null };
  }
}

/**
 * Join the user's tailnet: start tailscaled (userspace networking — the box
 * has no TUN) and `tailscale up` with the auth key read from a one-shot file.
 */
export async function enableTailscale(
  boxId: string,
  authKey: string
): Promise<TailscaleStatus> {
  if (!AUTH_KEY_RE.test(authKey)) {
    throw new TailscaleInputError(
      "auth key must start with tskey- (create one in your Tailscale admin console)"
    );
  }
  registerVaultValue(authKey);
  const nonce = randomBytes(8).toString("hex");
  const relative = `.tailscale/authkey-${nonce}`;
  const absolute = `/home/user/${relative}`;
  try {
    await command(
      boxId,
      "mkdir -p /home/user/.tailscale && chmod 700 /home/user/.tailscale"
    );
    await writeFile(boxId, relative, authKey);
    const result = await command(
      boxId,
      `sudo systemctl enable --now tailscaled.service && sleep 2 && tailscale --socket=${TS_SOCKET} up --auth-key=file:${absolute} --hostname=air-box --accept-dns=false --accept-routes=false --ssh=false --timeout=60s`,
      120
    );
    if (result.exitCode !== 0) {
      throw new Error(`tailscale up failed: ${scrubVaultValues(result.stderr)}`);
    }
  } finally {
    await command(
      boxId,
      `shred -u ${absolute} 2>/dev/null || rm -f ${absolute}`
    ).catch(() => undefined);
    unregisterVaultValues([authKey]);
  }
  return tailscaleStatus(boxId);
}

/** Leave the tailnet and stop the daemon; local node state is removed. */
export async function disableTailscale(boxId: string): Promise<void> {
  await command(
    boxId,
    `tailscale --socket=${TS_SOCKET} logout 2>/dev/null; sudo systemctl disable --now tailscaled.service 2>/dev/null; rm -f /home/user/.tailscale/tailscaled.state`,
    60
  ).catch(() => undefined);
}
