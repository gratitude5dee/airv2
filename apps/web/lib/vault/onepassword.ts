/**
 * 1Password site grants (opt-in half of V5's fill path).
 *
 * A 1Password login is grantable per host exactly like a local vault item:
 * the control plane writes the stable key `op:<vault>/<item>` into the box's
 * site_grants.json, and `air-vault op-fill` refuses unless the frontmost
 * page's host is listed under it. Nothing here runs unless the owner
 * connected a 1Password account (vault_managers.onepassword.enabled), and
 * the only thing ever read out of the box is item NAMES and ids — never a
 * field value (C18/C19).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command } from "../box/client";
import { asRecord } from "../records";

export const OP_GRANT_PREFIX = "op:";

/** Vault names and item titles as they appear in an `op://` reference: no
 * slashes (they would make the reference ambiguous), no control characters. */
const OP_SEGMENT_RE = /^[^/\\\s][^/\\]{0,62}[^/\\\s]$|^[^/\\\s]$/;

export interface OnePasswordItem {
  /** Stable grant key — `op:<vault>/<item>`, field-independent. */
  id: string;
  vault: string;
  item: string;
  /** The reference prefix the agent completes with a field name. */
  ref_prefix: string;
}

export function opGrantKey(vault: string, item: string): string {
  return `${OP_GRANT_PREFIX}${vault}/${item}`;
}

export function isOpGrantKey(key: string): boolean {
  return parseOpGrantKey(key) !== null;
}

/** Inverse of {@link opGrantKey}; null when the key is not a well-formed one. */
export function parseOpGrantKey(
  key: string
): { vault: string; item: string } | null {
  if (!key.startsWith(OP_GRANT_PREFIX)) return null;
  const rest = key.slice(OP_GRANT_PREFIX.length);
  const slash = rest.indexOf("/");
  if (slash <= 0) return null;
  const vault = rest.slice(0, slash);
  const item = rest.slice(slash + 1);
  if (!OP_SEGMENT_RE.test(vault) || !OP_SEGMENT_RE.test(item)) return null;
  return { vault, item };
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
    const item = typeof record["item"] === "string" ? record["item"] : "";
    const vault = typeof record["vault"] === "string" ? record["vault"] : "";
    // Titles or vaults carrying a slash cannot be addressed unambiguously in
    // an op:// reference, so they are not grantable here.
    if (!OP_SEGMENT_RE.test(vault) || !OP_SEGMENT_RE.test(item)) continue;
    const id = opGrantKey(vault, item);
    if (seen.has(id)) continue;
    seen.add(id);
    items.push({ id, vault, item, ref_prefix: `op://${vault}/${item}` });
  }
  return items.sort((a, b) => a.id.localeCompare(b.id));
}
