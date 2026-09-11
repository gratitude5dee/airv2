/**
 * Box-to-box transfer driver (plan §5B). The control plane stages
 * air_transfer.py onto both sides and orchestrates:
 *
 *   inventory  ->  export (AES-256-GCM bundle)  ->  serve (--private hosted
 *   route + bearer)  ->  import on the target  ->  apply into home  ->  verify
 *
 * The bundle key and serve token never appear in argv or logs — they are
 * written as 0600 files under ~/.air/<migration>/ on each side. All durable
 * artifacts live under ~/.air/, which the inventory classifier excludes from
 * the transfer set.
 */
import { randomBytes } from "node:crypto";
import { hostRoute } from "../box/client";
import {
  runCommand,
  writeComputeFile,
  type ComputeTarget,
} from "../compute/runtime";
import { AIR_TRANSFER_SCRIPT_B64 } from "./airTransferScript";
import type { ManifestEntry } from "./types";

export const TRANSFER_PORT = 8735;
const PYTHON = "~/.hermes-venv/bin/python";
const SCRIPT = ".air/air_transfer.py";

export interface ExportReceipt {
  bundle: string;
  bundle_sha256: string;
  bytes: number;
  files: number;
  missing: string[];
}

export interface ApplyReceipt {
  applied: number;
  missing: string[];
  deleted: string[];
}

export interface VerifyReceipt {
  ok: boolean;
  checked: number;
  mismatches: { path: string; reason: string }[];
}

function airDir(migrationId: string): string {
  return `.air/${migrationId}`;
}

/** Stage the transfer tool and return the interpreter invocation prefix. */
export async function installTransferTool(
  target: ComputeTarget
): Promise<void> {
  const script = Buffer.from(AIR_TRANSFER_SCRIPT_B64, "base64").toString("utf8");
  await writeComputeFile(target, SCRIPT, script);
  const check = await runCommand(
    target,
    `chmod 700 .air ${SCRIPT} 2>/dev/null; ${PYTHON} ${SCRIPT} --help >/dev/null && echo READY`,
    60
  );
  if (!check.stdout.includes("READY")) {
    throw new Error(`transfer tool install failed: ${check.stderr.slice(0, 200)}`);
  }
}

async function writeSecretFile(
  target: ComputeTarget,
  path: string,
  contents: string
): Promise<void> {
  await writeComputeFile(target, path, contents);
  await runCommand(target, `chmod 600 ${path}`, 30);
}

/** Classified manifest written where the tool can read it. */
export async function writeManifest(
  target: ComputeTarget,
  migrationId: string,
  manifest: { entries: ManifestEntry[] },
  passName: string
): Promise<string> {
  const path = `${airDir(migrationId)}/manifest-${passName}.json`;
  await writeComputeFile(target, path, JSON.stringify(manifest));
  return path;
}

/** Full-home inventory scan; returns the raw entry list for classification. */
export async function runInventory(
  target: ComputeTarget,
  migrationId: string
): Promise<{ path: string; kind: string; bytes: number; sha256: string; mtime: number; link?: string }[]> {
  const out = `${airDir(migrationId)}/inventory.json`;
  const result = await runCommand(
    target,
    `mkdir -p ${airDir(migrationId)} && ${PYTHON} ${SCRIPT} inventory --home /home/user --out ${out} && cat ${out}`,
    600
  );
  if (result.exitCode !== 0) {
    throw new Error(`inventory failed: ${result.stderr.slice(0, 300)}`);
  }
  const jsonStart = result.stdout.indexOf("\n{");
  const payload = JSON.parse(
    result.stdout.slice(jsonStart >= 0 ? jsonStart + 1 : 0)
  ) as { entries: { path: string; kind: string; bytes: number; sha256: string; mtime: number; link?: string }[] };
  return payload.entries;
}

/**
 * Export one pass into an encrypted bundle on the source. The transfer key is
 * minted per migration and lands only as a 0600 file on both boxes.
 */
export async function exportPass(
  target: ComputeTarget,
  migrationId: string,
  passName: string,
  manifestPath: string,
  transferKey: string
): Promise<ExportReceipt> {
  const dir = airDir(migrationId);
  await writeSecretFile(target, `${dir}/key`, transferKey);
  const result = await runCommand(
    target,
    `${PYTHON} ${SCRIPT} export --home /home/user --manifest ${manifestPath} ` +
      `--out ${dir}/bundle-${passName}.bin --keyfile ${dir}/key ` +
      `--staging ${dir}/export-${passName} --receipt-out ${dir}/receipt-${passName}.json ` +
      `--pass-name ${passName} && cat ${dir}/receipt-${passName}.json`,
    600
  );
  if (result.exitCode !== 0) {
    throw new Error(`export ${passName} failed: ${result.stderr.slice(0, 300)}`);
  }
  const jsonStart = result.stdout.indexOf("{");
  return JSON.parse(result.stdout.slice(jsonStart)) as ExportReceipt;
}

/** Start the source's bundle server; returns its private hosted URL. */
export async function serveBundle(
  target: ComputeTarget,
  migrationId: string,
  passName: string,
  serveToken: string
): Promise<{ url: string; pid: number }> {
  const dir = airDir(migrationId);
  await writeSecretFile(target, `${dir}/token`, serveToken);
  const start = await runCommand(
    target,
    `nohup ${PYTHON} ${SCRIPT} serve --bundle ${dir}/bundle-${passName}.bin ` +
      `--tokenfile ${dir}/token --port ${TRANSFER_PORT} --seconds 900 ` +
      `> ${dir}/serve-${passName}.log 2>&1 & echo $!`,
    30
  );
  const pid = Number.parseInt(start.stdout.trim(), 10);
  if (start.exitCode !== 0 || !Number.isFinite(pid)) {
    throw new Error(`serve start failed: ${start.stderr.slice(0, 200)}`);
  }
  const route = await hostRoute(target.instanceId, TRANSFER_PORT, {
    timeoutSeconds: 120,
  });
  const url = route.token ? `${route.url}?_token=${route.token}` : route.url;
  return { url, pid };
}

export async function stopServe(
  target: ComputeTarget,
  pid: number
): Promise<void> {
  await runCommand(target, `kill ${pid} 2>/dev/null || true`, 30).catch(
    () => undefined
  );
}

/** Fetch + decrypt + unpack a bundle on the target. */
export async function importPass(
  target: ComputeTarget,
  migrationId: string,
  passName: string,
  url: string,
  serveToken: string,
  transferKey: string
): Promise<void> {
  const dir = airDir(migrationId);
  await writeSecretFile(target, `${dir}/key`, transferKey);
  await writeSecretFile(target, `${dir}/token`, serveToken);
  const result = await runCommand(
    target,
    `${PYTHON} ${SCRIPT} import --url '${url.replace(/'/g, "'\\''")}' ` +
      `--tokenfile ${dir}/token --keyfile ${dir}/key ` +
      `--dest ${dir}/staging-${passName} --timeout 550`,
    600
  );
  if (result.exitCode !== 0) {
    throw new Error(`import ${passName} failed: ${result.stderr.slice(0, 300)}`);
  }
}

/** Apply a staged pass into the target's home, honoring deletions. */
export async function applyPass(
  target: ComputeTarget,
  migrationId: string,
  passName: string,
  manifestPath: string
): Promise<ApplyReceipt> {
  const dir = airDir(migrationId);
  const result = await runCommand(
    target,
    `${PYTHON} ${SCRIPT} apply --home /home/user ` +
      `--staging ${dir}/staging-${passName} --manifest ${manifestPath}`,
    300
  );
  if (result.exitCode !== 0) {
    throw new Error(`apply ${passName} failed: ${result.stderr.slice(0, 300)}`);
  }
  const jsonStart = result.stdout.indexOf("{");
  return JSON.parse(result.stdout.slice(jsonStart)) as ApplyReceipt;
}

/** Re-hash the applied transfer set on the target against the manifest. */
export async function verifyPass(
  target: ComputeTarget,
  _migrationId: string,
  manifestPath: string
): Promise<VerifyReceipt> {
  const result = await runCommand(
    target,
    `${PYTHON} ${SCRIPT} verify --home /home/user --manifest ${manifestPath}`,
    300
  );
  // Exit 2 = mismatches; that is data, not a crash.
  if (result.exitCode !== 0 && result.exitCode !== 2) {
    throw new Error(`verify failed: ${result.stderr.slice(0, 300)}`);
  }
  const jsonStart = result.stdout.indexOf("{");
  return JSON.parse(result.stdout.slice(jsonStart)) as VerifyReceipt;
}

export function newTransferKey(): string {
  return randomBytes(32).toString("hex");
}

export function newServeToken(): string {
  return randomBytes(24).toString("hex");
}
