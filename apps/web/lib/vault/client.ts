/**
 * V1: control-plane client for the box-side AIR Vault CLI.
 *
 * Transport rules (C18/C19):
 *  - values never travel in command argv (Box command history is logged) —
 *    mutations go through an inbox file the CLI shreds after applying;
 *  - the control plane never logs values, payload contents, or raw command
 *    output — item ids only;
 *  - Postgres receives metadata only (vault_items mirror + vault_events
 *    audit); the encrypted store and AIR_VAULT_KEY stay in the box.
 *
 * The single sanctioned value egress is `reveal` (owner-initiated, one field)
 * and `totp` (derived six-digit code); both are returned to the caller and
 * audited, never persisted.
 */
import { randomBytes } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, writeFile } from "../box/client";
import { serviceClient } from "../supabase";
import {
  registerVaultFields,
  registerVaultValue,
  unregisterVaultValues,
  vaultLog,
  vaultLogError,
} from "./scrub";

export type VaultItemKind = "login" | "card" | "api_key" | "note" | "identity";

export interface VaultItemMetadata {
  id: string;
  kind: VaultItemKind;
  name: string;
  masked: string | null;
  env_var: string | null;
  totp_enabled: boolean;
  created_at: string | null;
  updated_at: string | null;
}

export interface VaultItemInput {
  kind: VaultItemKind;
  name: string;
  /** Field values — plaintext in transit to the box only, never logged. */
  fields?: Record<string, string | null>;
  env_var?: string | null;
  totp_seed?: string | null;
}

export type VaultOperation =
  | { op: "create"; item: VaultItemInput }
  | { op: "update"; id: string; item: Partial<VaultItemInput> }
  | { op: "delete"; id: string };

interface ApplyResult {
  op: VaultOperation["op"];
  id: string;
  status: string;
  item?: VaultItemMetadata;
}

export class VaultCliError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "VaultCliError";
    this.code = code;
  }
}

/** Item ids / field names appear in argv — restrict to a shell-inert set. */
const SAFE_ARG = /^[A-Za-z0-9._-]+$/;

function safeArg(value: string, label: string): string {
  if (!SAFE_ARG.test(value)) {
    throw new VaultCliError("bad_argument", `invalid ${label}`);
  }
  return value;
}

function throwCliError(stderr: string, fallback: string): never {
  try {
    const parsed = JSON.parse(stderr.trim()) as {
      error?: string;
      message?: string;
    };
    if (parsed.error) {
      throw new VaultCliError(parsed.error, parsed.message ?? parsed.error);
    }
  } catch (error) {
    if (error instanceof VaultCliError) throw error;
  }
  throw new VaultCliError("cli_failed", fallback);
}

async function appendEvent(
  supabase: SupabaseClient,
  userId: string,
  action: string,
  itemId: string | null,
  context?: string
): Promise<void> {
  const { error } = await supabase.from("vault_events").insert({
    user_id: userId,
    item_id: itemId,
    action,
    context: context ?? null,
  });
  if (error) {
    // Audit failures must not lose the already-applied box mutation; log the
    // failure (ids only) and continue.
    vaultLogError({
      msg: "vault_events insert failed",
      user_id: userId,
      item_id: itemId,
      action,
      error: error.message,
    });
  }
}

async function mirrorItem(
  supabase: SupabaseClient,
  userId: string,
  item: VaultItemMetadata
): Promise<void> {
  const { error } = await supabase.from("vault_items").upsert({
    id: item.id,
    user_id: userId,
    kind: item.kind,
    name: item.name,
    masked: item.masked,
    env_var: item.env_var,
    totp_enabled: item.totp_enabled,
    updated_at: new Date().toISOString(),
    deleted_at: null,
  });
  if (error) {
    vaultLogError({
      msg: "vault_items mirror failed",
      user_id: userId,
      item_id: item.id,
      error: error.message,
    });
  }
}

/** Metadata list straight from the box store — never contains values. */
export async function listItems(boxId: string): Promise<VaultItemMetadata[]> {
  const result = await command(boxId, "air-vault list --masked");
  if (result.exitCode !== 0) {
    throwCliError(result.stderr, "air-vault list failed");
  }
  const parsed = JSON.parse(result.stdout) as { items: VaultItemMetadata[] };
  return parsed.items;
}

/**
 * Apply a create/update/delete batch. The payload is written to a one-shot
 * inbox file inside the box (files API — not argv), the CLI applies it into
 * the encrypted store and shreds the file, and the returned metadata is
 * mirrored to vault_items with an audit row per operation.
 */
export async function applyBatch(
  boxId: string,
  userId: string,
  operations: VaultOperation[]
): Promise<ApplyResult[]> {
  const supabase = serviceClient();
  // Registered for the duration of this operation only (scrub.ts is bounded).
  const transitedValues: (string | null | undefined)[] = [];
  for (const operation of operations) {
    if (operation.op !== "delete") {
      registerVaultFields(operation.item.fields ?? undefined);
      transitedValues.push(...Object.values(operation.item.fields ?? {}));
      if (operation.item.totp_seed) {
        registerVaultValue(operation.item.totp_seed);
        transitedValues.push(operation.item.totp_seed);
      }
    }
  }
  try {
    const nonce = randomBytes(16).toString("hex");
    const inboxRelative = `.hermes/vault/.inbox/${nonce}.json`;
    const inboxAbsolute = `/home/user/${inboxRelative}`;
    await command(
      boxId,
      "mkdir -p /home/user/.hermes/vault/.inbox && chmod 700 /home/user/.hermes/vault /home/user/.hermes/vault/.inbox"
    );
    await writeFile(
      boxId,
      inboxRelative,
      JSON.stringify({ version: 1, operations })
    );
    let result;
    try {
      result = await command(
        boxId,
        `air-vault apply ${JSON.stringify(inboxAbsolute)}`
      );
      if (result.exitCode !== 0) {
        throwCliError(result.stderr, "air-vault apply failed");
      }
    } catch (error) {
      // The CLI shreds the inbox on every path it reaches, but a failed exec
      // or an early abort (e.g. missing key) can leave the plaintext payload
      // behind — erase it best-effort before surfacing the failure (C18).
      try {
        await command(
          boxId,
          `shred -u ${JSON.stringify(inboxAbsolute)} 2>/dev/null || rm -f ${JSON.stringify(inboxAbsolute)}`
        );
      } catch {
        vaultLogError({
          msg: "vault inbox cleanup failed",
          user_id: userId,
          box_id: boxId,
        });
      }
      throw error;
    }
    const { results } = JSON.parse(result.stdout) as {
      results: ApplyResult[];
    };

    for (const applied of results) {
      if (applied.op === "delete") {
        const { error } = await supabase
          .from("vault_items")
          .update({
            deleted_at: new Date().toISOString(),
            // Free the unique (user_id, env_var) slot for future items.
            env_var: null,
          })
          .eq("id", applied.id)
          .eq("user_id", userId);
        if (error) {
          vaultLogError({
            msg: "vault_items delete mirror failed",
            user_id: userId,
            item_id: applied.id,
            error: error.message,
          });
        }
      } else if (applied.item) {
        await mirrorItem(supabase, userId, applied.item);
      }
      await appendEvent(supabase, userId, applied.op, applied.id);
      vaultLog({
        msg: "vault apply",
        user_id: userId,
        item_id: applied.id,
        op: applied.op,
      });
    }
    return results;
  } finally {
    unregisterVaultValues(transitedValues);
  }
}

/**
 * Owner reveal of exactly one field. Returns the plaintext to the caller —
 * it is never logged, never persisted, and the reveal is audited.
 */
export async function reveal(
  boxId: string,
  userId: string,
  itemId: string,
  field: string,
  context?: string
): Promise<string> {
  const result = await command(
    boxId,
    `air-vault get ${safeArg(itemId, "item id")} --field ${safeArg(field, "field name")} --reveal`
  );
  if (result.exitCode !== 0) {
    throwCliError(result.stderr, "air-vault get failed");
  }
  registerVaultValue(result.stdout);
  try {
    await appendEvent(serviceClient(), userId, "reveal", itemId, context);
  } finally {
    unregisterVaultValues([result.stdout]);
  }
  return result.stdout;
}

/** Current six-digit TOTP code for an item with a stored seed. */
export async function totp(
  boxId: string,
  userId: string,
  itemId: string,
  context?: string
): Promise<string> {
  const result = await command(
    boxId,
    `air-vault totp ${safeArg(itemId, "item id")}`
  );
  if (result.exitCode !== 0) {
    throwCliError(result.stderr, "air-vault totp failed");
  }
  await appendEvent(serviceClient(), userId, "reveal", itemId, context);
  return result.stdout.trim();
}
