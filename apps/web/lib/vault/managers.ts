/**
 * V2 — bring-your-own secret managers (C23).
 *
 * Bootstrap credentials (Bitwarden machine-account token, 1Password service
 * account token, command-helper text) are transported to the box exactly
 * once, via the files API into the box .env / config.yaml — never through
 * command argv, never into Postgres, never echoed back to a browser.
 * Postgres (`vault_managers`) mirrors PARSED SUMMARIES only: an off /
 * configured / error label, a provenance count when one can be parsed, and
 * scrubbed warning lines.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { command, writeFile } from "../box/client";
import {
  registerVaultValue,
  scrubVaultValues,
  unregisterVaultValues,
  vaultLogError,
} from "./scrub";

export type ManagerId = "bitwarden" | "onepassword" | "command";

export const MANAGER_IDS: ManagerId[] = ["bitwarden", "onepassword", "command"];

export interface ManagerStatus {
  manager: ManagerId;
  enabled: boolean;
  status: "off" | "configured" | "error";
  provenance_count: number | null;
  warnings: string | null;
  last_synced_at: string | null;
}

const ENV_NAME_RE = /^[A-Z_][A-Z0-9_]*$/;

const MANAGER_ENV_KEY: Record<ManagerId, string | null> = {
  bitwarden: "BWS_ACCESS_TOKEN",
  onepassword: "OP_SERVICE_ACCOUNT_TOKEN",
  command: null,
};

const CONFIG_SECTION: Record<ManagerId, string> = {
  bitwarden: "bitwarden",
  onepassword: "onepassword",
  command: "command",
};

export class ManagerInputError extends Error {}

function assertToken(token: string, label: string): void {
  if (!/^[\x21-\x7e]{8,512}$/.test(token)) {
    throw new ManagerInputError(`${label} has an unexpected format`);
  }
}

/**
 * Merge KEY=VALUE entries into the box .env via a one-shot file (same
 * delete-then-append semantics provisioning uses). Values never touch argv.
 */
async function mergeBoxEnv(
  boxId: string,
  entries: Record<string, string>
): Promise<void> {
  const keys = Object.keys(entries);
  for (const key of keys) {
    if (!ENV_NAME_RE.test(key)) throw new ManagerInputError(`bad env key ${key}`);
    const value = entries[key] ?? "";
    if (/[\r\n]/.test(value)) {
      throw new ManagerInputError("env values must be single-line");
    }
  }
  // Register values with the request-scoped scrubber so a box error echoing
  // the merged line can never surface a token in logs or thrown messages.
  const values = keys.map((key) => entries[key] ?? "");
  for (const value of values) registerVaultValue(value);
  const nonce = randomBytes(8).toString("hex");
  const relative = `.hermes/.env.mgr-${nonce}`;
  const absolute = `/home/user/${relative}`;
  const lines =
    keys.map((key) => `${key}=${entries[key] ?? ""}`).join("\n") + "\n";
  try {
    await writeFile(boxId, relative, lines);
    const result = await command(
      boxId,
      `touch /home/user/.hermes/.env && sed -i ${keys
        .map((key) => `-e '/^${key}=/d'`)
        .join(" ")} /home/user/.hermes/.env && cat ${absolute} >> /home/user/.hermes/.env && chmod 600 /home/user/.hermes/.env`
    );
    if (result.exitCode !== 0) {
      throw new Error(`env merge failed: ${scrubVaultValues(result.stderr)}`);
    }
  } finally {
    await command(
      boxId,
      `shred -u ${absolute} 2>/dev/null || rm -f ${absolute}`
    ).catch(() => undefined);
    unregisterVaultValues(values);
  }
}

async function removeBoxEnvKeys(boxId: string, keys: string[]): Promise<void> {
  const safe = keys.filter((key) => ENV_NAME_RE.test(key));
  if (safe.length === 0) return;
  await command(
    boxId,
    `test -f /home/user/.hermes/.env && sed -i ${safe
      .map((key) => `-e '/^${key}=/d'`)
      .join(" ")} /home/user/.hermes/.env || true`
  );
}

/**
 * Patch `secrets.<section>` in the box config.yaml. The patch travels as a
 * one-shot JSON file (helper commands may contain arbitrary shell text).
 */
async function patchSecretsConfig(
  boxId: string,
  section: string,
  patch: Record<string, unknown>
): Promise<void> {
  const nonce = randomBytes(8).toString("hex");
  const relative = `.hermes/.cfg.mgr-${nonce}.json`;
  const absolute = `/home/user/${relative}`;
  await writeFile(boxId, relative, JSON.stringify(patch));
  try {
    const result = await command(
      boxId,
      `python3 - ${absolute} ${JSON.stringify(section)} <<'PYEOF'
import json, sys, yaml, pathlib
patch = json.load(open(sys.argv[1]))
section = sys.argv[2]
p = pathlib.Path.home() / ".hermes" / "config.yaml"
cfg = yaml.safe_load(p.read_text()) if p.exists() else None
cfg = cfg if isinstance(cfg, dict) else {}
secrets = cfg.get("secrets")
secrets = secrets if isinstance(secrets, dict) else {}
entry = secrets.get(section)
entry = entry if isinstance(entry, dict) else {}
entry.update(patch)
secrets[section] = entry
cfg["secrets"] = secrets
p.write_text(yaml.safe_dump(cfg, default_flow_style=False))
PYEOF`
    );
    if (result.exitCode !== 0) {
      throw new Error(`config patch failed: ${scrubVaultValues(result.stderr)}`);
    }
  } finally {
    await command(
      boxId,
      `shred -u ${absolute} 2>/dev/null || rm -f ${absolute}`
    ).catch(() => undefined);
  }
}

export async function restartGateway(boxId: string): Promise<void> {
  const result = await command(
    boxId,
    "sudo systemctl restart hermes-gateway",
    120
  );
  if (result.exitCode !== 0) {
    throw new Error(`gateway restart failed: ${scrubVaultValues(result.stderr)}`);
  }
}

/**
 * Parse a value-free summary out of the gateway journal's latest secret-source
 * startup report. Only counts and warning labels survive into Postgres.
 */
async function fetchStatusSummary(
  boxId: string,
  manager: ManagerId
): Promise<{ count: number | null; warnings: string | null; ok: boolean }> {
  const result = await command(
    boxId,
    "journalctl -u hermes-gateway -n 200 --no-pager 2>/dev/null | grep -iE 'secret|source|conflict|provenance' | tail -n 40 || true"
  );
  const text = scrubVaultValues(result.stdout || "");
  const section = CONFIG_SECTION[manager];
  const lines = text
    .split("\n")
    .filter((line) => line.toLowerCase().includes(section));
  let count: number | null = null;
  const countMatch = lines
    .map((line) => line.match(/(\d+)\s+(secret|value|variable)s?/i))
    .find((match) => match !== null);
  if (countMatch?.[1]) count = parseInt(countMatch[1], 10);
  const warningLines = lines.filter((line) =>
    /conflict|skipped|overridden|error|failed/i.test(line)
  );
  const warnings =
    warningLines.length > 0 ? warningLines.join("\n").slice(0, 2000) : null;
  return { count, warnings, ok: result.exitCode === 0 };
}

/** Real gateway health signal (the journal pipeline always exits 0). */
async function gatewayActive(boxId: string): Promise<boolean> {
  // Let transport failures propagate: only a returned non-zero exit code
  // means the unit is genuinely not active.
  const result = await command(
    boxId,
    "systemctl is-active --quiet hermes-gateway"
  );
  return result.exitCode === 0;
}

/** Probe gateway health + parse the journal summary, then mirror both. */
async function mirrorGatewayHealth(
  supabase: SupabaseClient,
  userId: string,
  boxId: string,
  manager: ManagerId
): Promise<void> {
  const active = await gatewayActive(boxId);
  const summary = await fetchStatusSummary(boxId, manager).catch(() => ({
    count: null,
    warnings: null,
    ok: false,
  }));
  await upsertManagerRow(supabase, userId, manager, {
    status: active ? "configured" : "error",
    provenance_count: summary.count,
    warnings: active
      ? summary.warnings
      : [summary.warnings, "gateway is not running — retry Restart gateway"]
          .filter(Boolean)
          .join("\n"),
    last_synced_at: new Date().toISOString(),
  });
}

async function assertManagerEnabled(
  supabase: SupabaseClient,
  userId: string,
  manager: ManagerId
): Promise<void> {
  const { data, error } = await supabase
    .from("vault_managers")
    .select("enabled")
    .eq("user_id", userId)
    .eq("manager", manager)
    .maybeSingle();
  if (error) throw new Error("manager lookup failed");
  if (!data?.enabled) {
    throw new ManagerInputError("manager is not enabled");
  }
}

async function upsertManagerRow(
  supabase: SupabaseClient,
  userId: string,
  manager: ManagerId,
  patch: Partial<ManagerStatus>
): Promise<void> {
  const { error } = await supabase.from("vault_managers").upsert(
    {
      user_id: userId,
      manager,
      updated_at: new Date().toISOString(),
      ...patch,
    },
    { onConflict: "user_id,manager" }
  );
  if (error) {
    vaultLogError({ msg: "vault_managers upsert failed", error: error.message });
    throw new Error("manager status update failed");
  }
}

async function appendManagerEvent(
  supabase: SupabaseClient,
  userId: string,
  action: "manager_enabled" | "manager_disabled",
  manager: ManagerId
): Promise<void> {
  const { error } = await supabase.from("vault_events").insert({
    user_id: userId,
    item_id: null,
    action,
    context: manager,
  });
  if (error) {
    vaultLogError({ msg: "vault_events insert failed", error: error.message });
  }
}

export async function listManagers(
  supabase: SupabaseClient,
  userId: string
): Promise<ManagerStatus[]> {
  const { data, error } = await supabase
    .from("vault_managers")
    .select("manager, enabled, status, provenance_count, warnings, last_synced_at")
    .eq("user_id", userId);
  if (error) throw new Error("manager list failed");
  const byId = new Map((data ?? []).map((row) => [row.manager, row]));
  return MANAGER_IDS.map((manager) => {
    const row = byId.get(manager);
    return {
      manager,
      enabled: row?.enabled ?? false,
      status: (row?.status as ManagerStatus["status"]) ?? "off",
      provenance_count: row?.provenance_count ?? null,
      warnings: row?.warnings ?? null,
      last_synced_at: row?.last_synced_at ?? null,
    };
  });
}

export interface EnableInput {
  manager: ManagerId;
  /** Bitwarden machine-account token or 1Password service-account token. */
  token?: string;
  /** Bitwarden project id filter (optional). */
  project_id?: string;
  /** Command helper text — runs with agent privilege on the box. */
  helper_command?: string;
  /** Optional mapped bindings ENV_VAR -> reference (op:// URI etc.). */
  mappings?: Record<string, string>;
}

export async function enableManager(
  supabase: SupabaseClient,
  userId: string,
  boxId: string,
  input: EnableInput
): Promise<ManagerStatus[]> {
  const { manager } = input;
  const configPatch: Record<string, unknown> = { enabled: true };

  if (manager === "bitwarden") {
    if (!input.token) throw new ManagerInputError("Bitwarden token is required");
    assertToken(input.token, "Bitwarden token");
    if (input.project_id) {
      if (!/^[0-9a-fA-F-]{8,64}$/.test(input.project_id)) {
        throw new ManagerInputError("project id has an unexpected format");
      }
      configPatch.project_id = input.project_id;
    }
    await mergeBoxEnv(boxId, { BWS_ACCESS_TOKEN: input.token });
  } else if (manager === "onepassword") {
    if (!input.token) throw new ManagerInputError("1Password token is required");
    assertToken(input.token, "1Password token");
    await mergeBoxEnv(boxId, { OP_SERVICE_ACCOUNT_TOKEN: input.token });
  } else {
    if (!input.helper_command || input.helper_command.trim().length === 0) {
      throw new ManagerInputError("helper command is required");
    }
    if (input.helper_command.length > 1000) {
      throw new ManagerInputError("helper command is too long");
    }
    configPatch.command = input.helper_command.trim();
  }

  if (input.mappings) {
    const mapped: Record<string, string> = {};
    for (const [envVar, ref] of Object.entries(input.mappings)) {
      if (!ENV_NAME_RE.test(envVar)) {
        throw new ManagerInputError(`invalid env var name: ${envVar}`);
      }
      if (typeof ref !== "string" || ref.length === 0 || ref.length > 500) {
        throw new ManagerInputError("invalid mapping reference");
      }
      mapped[envVar] = ref;
    }
    configPatch.mapped = mapped;
  }

  await patchSecretsConfig(boxId, CONFIG_SECTION[manager], configPatch);

  // The box now holds the binding: mirror that before the restart so a
  // restart failure cannot leave the status row claiming "off" (truthful
  // mirror; the user can retry the restart from the Vault tab).
  await upsertManagerRow(supabase, userId, manager, {
    enabled: true,
    status: "configured",
    provenance_count: null,
    warnings: "takes effect next boot — restart the gateway",
    last_synced_at: new Date().toISOString(),
  });
  await appendManagerEvent(supabase, userId, "manager_enabled", manager);

  try {
    await restartGateway(boxId);
  } catch (error) {
    await upsertManagerRow(supabase, userId, manager, {
      status: "error",
      warnings:
        "configured, but the gateway restart failed — retry Restart from the Vault tab",
    }).catch(() => undefined);
    throw error;
  }

  await mirrorGatewayHealth(supabase, userId, boxId, manager);
  return listManagers(supabase, userId);
}

export async function disableManager(
  supabase: SupabaseClient,
  userId: string,
  boxId: string,
  manager: ManagerId
): Promise<ManagerStatus[]> {
  await patchSecretsConfig(boxId, CONFIG_SECTION[manager], { enabled: false });
  const envKey = MANAGER_ENV_KEY[manager];
  if (envKey) await removeBoxEnvKeys(boxId, [envKey]);
  await restartGateway(boxId);
  await upsertManagerRow(supabase, userId, manager, {
    enabled: false,
    status: "off",
    provenance_count: null,
    warnings: null,
    last_synced_at: new Date().toISOString(),
  });
  await appendManagerEvent(supabase, userId, "manager_disabled", manager);
  return listManagers(supabase, userId);
}

export async function refreshManager(
  supabase: SupabaseClient,
  userId: string,
  boxId: string,
  manager: ManagerId
): Promise<ManagerStatus[]> {
  await assertManagerEnabled(supabase, userId, manager);
  await mirrorGatewayHealth(supabase, userId, boxId, manager);
  return listManagers(supabase, userId);
}

/** Retry the gateway restart for a manager stuck in an error state. */
export async function restartManager(
  supabase: SupabaseClient,
  userId: string,
  boxId: string,
  manager: ManagerId
): Promise<ManagerStatus[]> {
  await assertManagerEnabled(supabase, userId, manager);
  try {
    await restartGateway(boxId);
  } catch (error) {
    await upsertManagerRow(supabase, userId, manager, {
      status: "error",
      warnings:
        "configured, but the gateway restart failed — retry Restart from the Vault tab",
      last_synced_at: new Date().toISOString(),
    }).catch(() => undefined);
    throw error;
  }
  await mirrorGatewayHealth(supabase, userId, boxId, manager);
  return listManagers(supabase, userId);
}
