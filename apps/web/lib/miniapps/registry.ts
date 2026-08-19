/**
 * MA1 registry: mini_apps is the single source of truth the loader, the
 * store, discovery, and card mints all read. The path slug is a routing hint
 * — every load re-reads the row, so a `suspended` flip takes effect on the
 * next request.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

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
}

const COLUMNS =
  "id, slug, kind, owner_user_id, name, description, icon_key, " +
  "publisher_username, publisher_wallet, agent_identity, visibility, access, " +
  "password_hash, x402_enabled, x402_price_usdc, plugin_signin_enabled, " +
  "status, bundle_version, listed_at";

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
  return (data as RegistryApp | null) ?? null;
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
  return (data ?? []) as unknown as RegistryApp[];
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
  return (data ?? []) as unknown as RegistryApp[];
}
