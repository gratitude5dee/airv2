/**
 * 1Password site grants (opt-in half of V5's fill path).
 *
 * A 1Password login is grantable per host exactly like a local vault item:
 * the control plane writes the stable key `op:<item-id>` (the opaque
 * 1Password item id — vault/title strings are display labels only, so
 * duplicate titles stay distinct and renames don't orphan grants) into the
 * box's site_grants.json, and `air-vault op-fill` refuses unless the frontmost
 * page's host is listed under it. Nothing here runs unless the owner
 * connected a 1Password account (vault_managers.onepassword.enabled), and
 * the only thing ever read out of the box is item NAMES and ids — never a
 * field value (C18/C19).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command } from "../box/client";
import { asRecord } from "../records";

export const OP_GRANT_PREFIX = "op:";

/** Opaque 1Password ids: 26 lowercase base32 characters. */
const OP_ID_RE = /^[a-z0-9]{26}$/;

export interface OnePasswordItem {
  /** Stable grant key — `op:<item-id>`, field-independent. */
  id: string;
  /** Display label only — never part of the grant identity. */
  vault: string;
  /** Display label only — never part of the grant identity. */
  item: string;
  /** The id-form reference prefix the agent completes with a field name. */
  ref_prefix: string;
}

export function opGrantKey(itemId: string): string {
  return `${OP_GRANT_PREFIX}${itemId}`;
}

export function isOpGrantKey(key: string): boolean {
  return parseOpGrantKey(key) !== null;
}

/** Inverse of {@link opGrantKey}; null when the key is not a well-formed one. */
export function parseOpGrantKey(key: string): { itemId: string } | null {
  if (!key.startsWith(OP_GRANT_PREFIX)) return null;
  const itemId = key.slice(OP_GRANT_PREFIX.length);
  if (!OP_ID_RE.test(itemId)) return null;
  return { itemId };
}

/** True only when the owner explicitly connected a 1Password account. */
export async function onePasswordConnected(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("vault_managers")
    .select("enabled")
    .eq("user_id", userId)
    .eq("manager", "onepassword")
    .maybeSingle();
  return data?.enabled === true;
}

/**
 * List the owner's 1Password LOGIN items through the box's own CLI. The
 * service-account token never leaves the box (the `air-vault` wrapper reads
 * it out of ~/.hermes/.env into the process env), and `op-list` prints item
 * names and vaults only — no field is resolved.
 */
export async function listOnePasswordLogins(
  boxId: string
): Promise<OnePasswordItem[]> {
  const result = await command(boxId, "air-vault op-list", 60);
  if (result.exitCode !== 0) return [];
  return parseOnePasswordLogins(result.stdout);
}

/** Tolerant parse of `air-vault op-list`; anything odd is dropped. */
export function parseOnePasswordLogins(stdout: string): OnePasswordItem[] {
  let payload: unknown;
  try {
    payload = JSON.parse(stdout);
  } catch {
    return [];
  }
  const entries = asRecord(payload)?.["items"];
  if (!Array.isArray(entries)) return [];
  const items: OnePasswordItem[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const record = asRecord(entry);
    if (!record) continue;
    const itemId = typeof record["id"] === "string" ? record["id"] : "";
    const item = typeof record["item"] === "string" ? record["item"] : "";
    const vault = typeof record["vault"] === "string" ? record["vault"] : "";
    const refPrefix =
      typeof record["ref_prefix"] === "string" ? record["ref_prefix"] : "";
    if (!OP_ID_RE.test(itemId)) continue;
    // The ref prefix must be the id form `op://<vault-id>/<item-id>` — names
    // never enter a reference.
    const refMatch = /^op:\/\/([a-z0-9]{26})\/([a-z0-9]{26})$/.exec(refPrefix);
    if (!refMatch || refMatch[2] !== itemId) continue;
    if (!vault || !item) continue;
    const id = opGrantKey(itemId);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, vault, item, ref_prefix: refPrefix });
  }
  return items.sort((a, b) => a.id.localeCompare(b.id));
}
