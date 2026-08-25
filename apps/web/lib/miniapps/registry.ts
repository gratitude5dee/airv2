/**
 * MA1 registry: mini_apps is the single source of truth the loader, the
 * store, discovery, and card mints all read. The path slug is a routing hint
 * — every load re-reads the row, so a `suspended` flip takes effect on the
 * next request.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";

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

const RegistryAppSchema = z.object({
  id: z.string(),
  slug: z.string(),
  kind: z.enum(["render", "input", "passthrough"]),
  owner_user_id: z.string().nullable(),
  name: z.string(),
  description: z.string(),
  icon_key: z.string().nullable(),
  publisher_username: z.string().nullable(),
  publisher_wallet: z.string().nullable(),
  agent_identity: z.string().nullable(),
  visibility: z.enum(["public", "unlisted", "private"]),
  access: z.enum(["single", "multiplayer"]),
  password_hash: z.string().nullable(),
  x402_enabled: z.boolean(),
  // Postgres numeric columns arrive as strings; parseNullableNumeric owns
  // that coercion, so the raw value stays unknown here.
  x402_price_usdc: z.unknown(),
  plugin_signin_enabled: z.boolean(),
  status: z.enum(["draft", "published", "suspended"]),
  bundle_version: z.string().nullable(),
  listed_at: z.string().nullable(),
  updated_at: z.string(),
});

/** Validate a selected mini_apps row before exposing it as registry metadata. */
export function parseRegistryApp(value: unknown): RegistryApp | null {
  const parsed = RegistryAppSchema.safeParse(value);
  if (!parsed.success) return null;
  const row = parsed.data;
  const x402PriceUsdc = parseNullableNumeric(row.x402_price_usdc);
  if (x402PriceUsdc === undefined) return null;
  return { ...row, x402_price_usdc: x402PriceUsdc };
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
