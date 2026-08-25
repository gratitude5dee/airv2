/**
 * MA1 registry: mini_apps is the single source of truth the loader, the
 * store, discovery, and card mints all read. The path slug is a routing hint
 * — every load re-reads the row, so a `suspended` flip takes effect on the
 * next request.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { asRecord } from "../records";

export type MiniAppVisibility = "public" | "unlisted" | "private";
export type MiniAppStatus = "draft" | "published" | "suspended";

export interface RegistryApp {
  id: string;
  slug: string;
  kind: "render" | "input" | "passthrough";
  owner_user_id: string | null;
  name: string;
  description: string;
  icon_key: string | null;
  publisher_username: string | null;
  publisher_wallet: string | null;
  agent_identity: string | null;
  visibility: MiniAppVisibility;
  access: "single" | "multiplayer";
  password_hash: string | null;
  x402_enabled: boolean;
  x402_price_usdc: number | null;
  plugin_signin_enabled: boolean;
  status: MiniAppStatus;
  bundle_version: string | null;
  listed_at: string | null;
  updated_at: string;
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

export function parseNullableNumeric(
  value: unknown
): number | null | undefined {
  if (value === null) return null;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string" || value.trim() === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isRegistryKind(value: unknown): value is RegistryApp["kind"] {
  return value === "render" || value === "input" || value === "passthrough";
}

function isRegistryVisibility(
  value: unknown
): value is RegistryApp["visibility"] {
  return value === "public" || value === "unlisted" || value === "private";
}

function isRegistryStatus(value: unknown): value is RegistryApp["status"] {
  return value === "draft" || value === "published" || value === "suspended";
}

function isRegistryAccess(value: unknown): value is RegistryApp["access"] {
  return value === "single" || value === "multiplayer";
}

/** Validate a selected mini_apps row before exposing it as registry metadata. */
export function parseRegistryApp(value: unknown): RegistryApp | null {
  const row = asRecord(value);
  if (!row) return null;
  const x402PriceUsdc = parseNullableNumeric(row.x402_price_usdc);
  if (
    typeof row.id !== "string" ||
    typeof row.slug !== "string" ||
    !isRegistryKind(row.kind) ||
    !isNullableString(row.owner_user_id) ||
    typeof row.name !== "string" ||
    typeof row.description !== "string" ||
    !isNullableString(row.icon_key) ||
    !isNullableString(row.publisher_username) ||
    !isNullableString(row.publisher_wallet) ||
    !isNullableString(row.agent_identity) ||
    !isRegistryVisibility(row.visibility) ||
    !isRegistryAccess(row.access) ||
    !isNullableString(row.password_hash) ||
    typeof row.x402_enabled !== "boolean" ||
    x402PriceUsdc === undefined ||
    typeof row.plugin_signin_enabled !== "boolean" ||
    !isRegistryStatus(row.status) ||
    !isNullableString(row.bundle_version) ||
    !isNullableString(row.listed_at) ||
    typeof row.updated_at !== "string"
  ) {
    return null;
  }
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    owner_user_id: row.owner_user_id,
    name: row.name,
    description: row.description,
    icon_key: row.icon_key,
    publisher_username: row.publisher_username,
    publisher_wallet: row.publisher_wallet,
    agent_identity: row.agent_identity,
    visibility: row.visibility,
    access: row.access,
    password_hash: row.password_hash,
    x402_enabled: row.x402_enabled,
    x402_price_usdc: x402PriceUsdc,
    plugin_signin_enabled: row.plugin_signin_enabled,
    status: row.status,
    bundle_version: row.bundle_version,
    listed_at: row.listed_at,
    updated_at: row.updated_at,
  };
}

const COLUMNS =
  "id, slug, kind, owner_user_id, name, description, icon_key, " +
  "publisher_username, publisher_wallet, agent_identity, visibility, access, " +
  "password_hash, x402_enabled, x402_price_usdc, plugin_signin_enabled, " +
  "status, bundle_version, listed_at, updated_at";

const SLUG_RE = /^[a-z0-9][a-z0-9_-]{0,63}$/;

export async function getRegistryApp(
  supabase: SupabaseClient,
  slug: string
): Promise<RegistryApp | null> {
  if (!SLUG_RE.test(slug)) return null;
  const { data, error } = await supabase
    .from("mini_apps")
    .select(COLUMNS)
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`mini_apps lookup failed: ${error.message}`);
  return parseRegistryApp(data);
}

/** Store home / discovery rows: public + published metadata only (MA7). */
export async function listPublicApps(
  supabase: SupabaseClient
): Promise<RegistryApp[]> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select(COLUMNS)
    .eq("status", "published")
    .eq("visibility", "public")
    .order("listed_at", { ascending: false });
  if (error) throw new Error(`mini_apps list failed: ${error.message}`);
  return (data ?? [])
    .map(parseRegistryApp)
    .filter((app): app is RegistryApp => app !== null);
}

/** First-party rows for the /home Apps tab (owner-facing, any visibility). */
export async function listFirstPartyApps(
  supabase: SupabaseClient
): Promise<RegistryApp[]> {
  const { data, error } = await supabase
    .from("mini_apps")
    .select(COLUMNS)
    .is("owner_user_id", null)
    .order("slug", { ascending: true });
  if (error) throw new Error(`mini_apps list failed: ${error.message}`);
  return (data ?? [])
    .map(parseRegistryApp)
    .filter((app): app is RegistryApp => app !== null);
}
