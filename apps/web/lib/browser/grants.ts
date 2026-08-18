/**
 * Site grants (V5): the owner's per-login "Allow agent sign-in" allowlist.
 * The file lives on the box at ~/.hermes/vault/site_grants.json and is
 * ENFORCED by the air-vault CLI (the guard is code, not prompt): `air-vault
 * type` refuses when the frontmost page's host is not granted for the item.
 * The control plane only ever writes item ids and hostnames here — never
 * values (C18/C19). Default is no grants: a fresh box refuses every fill.
 */
import { readFile, writeFile } from "../box/client";

// readFile runs `cat` (absolute path); writeFile posts to the box files API,
// which — like every other caller — takes a home-relative path.
export const SITE_GRANTS_PATH = "/home/user/.hermes/vault/site_grants.json";
export const SITE_GRANTS_RELATIVE = ".hermes/vault/site_grants.json";

export type SiteGrants = Record<string, string[]>;

/** Hostname from a URL or bare host; lowercased, www-stripped. */
export function normalizeHost(input: string): string | null {
  const raw = (input ?? "").trim().toLowerCase();
  if (!raw) return null;
  let host = raw;
  if (raw.includes("/") || raw.includes(":")) {
    try {
      host = new URL(raw.includes("://") ? raw : `https://${raw}`).hostname;
    } catch {
      return null;
    }
  }
  host = host.replace(/^www\./, "");
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(host)) {
    return null;
  }
  return host;
}

/** Tolerant parse of the grants envelope; anything malformed reads as none. */
export function parseSiteGrants(content: string): SiteGrants {
  let payload: unknown;
  try {
    payload = JSON.parse(content);
  } catch {
    return {};
  }
  if (payload === null || typeof payload !== "object") return {};
  const grants = (payload as { grants?: unknown }).grants;
  if (grants === null || typeof grants !== "object") return {};
  const result: SiteGrants = {};
  for (const [itemId, hosts] of Object.entries(grants as Record<string, unknown>)) {
    if (Array.isArray(hosts)) {
      result[itemId] = hosts.filter(
        (host): host is string => typeof host === "string"
      );
    }
  }
  return result;
}

export async function readSiteGrants(boxId: string): Promise<SiteGrants> {
  try {
    return parseSiteGrants(await readFile(boxId, SITE_GRANTS_PATH));
  } catch {
    return {}; // no file yet — default deny
  }
}

/** Flip one (item, host) grant; returns the updated grant map. */
export async function setSiteGrant(
  boxId: string,
  itemId: string,
  host: string,
  allow: boolean
): Promise<SiteGrants> {
  const normalized = normalizeHost(host);
  if (!normalized) {
    throw new Error("invalid host");
  }
  const grants = await readSiteGrants(boxId);
  const hosts = new Set(grants[itemId] ?? []);
  if (allow) {
    hosts.add(normalized);
  } else {
    hosts.delete(normalized);
  }
  if (hosts.size > 0) {
    grants[itemId] = [...hosts].sort();
  } else {
    delete grants[itemId];
  }
  await writeFile(
    boxId,
    SITE_GRANTS_RELATIVE,
    JSON.stringify({ version: 1, grants }, null, 2)
  );
  return grants;
}
