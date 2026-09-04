/**
 * MA1 registry: mini_apps is the single source of truth the loader, the
 * store, discovery, and card mints all read. The path slug is a routing hint
 * — every load re-reads the row, so a `suspended` flip takes effect on the
 * next request.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { USERNAME_RE } from "./nested";

export type MiniAppVisibility = "public" | "unlisted" | "private";
export type MiniAppStatus = "draft" | "published" | "suspended";
/** V11 lane a version was produced by (docs/goal-create-v11.md §3). */
export type CreateLane = "drop" | "vibe" | "import" | "push";

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
  /** V11: denormalized `<appname>` half of a published slug; null first-party. */
  appname: string | null;
  /** V11: draft version the owner is previewing (points into miniapp_versions). */
  draft_version: string | null;
  lane: CreateLane | null;
  functions_enabled: boolean;
  kit_version: string | null;
  /** V11: owner's Create inference budget (USD, numeric(10,2)). */
  create_budget_usd: number;
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
  // V11 columns (0082). Optional so pre-0082 fixtures and narrower selects
  // still parse; normalized below.
  appname: z.string().nullable().optional(),
  draft_version: z.string().nullable().optional(),
  lane: z.enum(["drop", "vibe", "import", "push"]).nullable().optional(),
  functions_enabled: z.boolean().optional(),
  kit_version: z.string().nullable().optional(),
  create_budget_usd: z.unknown().optional(),
});

const DEFAULT_CREATE_BUDGET_USD = 5;

/** Validate a selected mini_apps row before exposing it as registry metadata. */
export function parseRegistryApp(value: unknown): RegistryApp | null {
  const parsed = RegistryAppSchema.safeParse(value);
  if (!parsed.success) return null;
  const row = parsed.data;
  const x402PriceUsdc = parseNullableNumeric(row.x402_price_usdc);
  if (x402PriceUsdc === undefined) return null;
  const createBudgetUsd =
    row.create_budget_usd === undefined
      ? DEFAULT_CREATE_BUDGET_USD
      : parseNullableNumeric(row.create_budget_usd);
  if (createBudgetUsd === undefined || createBudgetUsd === null) return null;
  return {
    ...row,
    x402_price_usdc: x402PriceUsdc,
    create_budget_usd: createBudgetUsd,
    appname: row.appname ?? null,
    draft_version: row.draft_version ?? null,
    lane: row.lane ?? null,
    functions_enabled: row.functions_enabled ?? false,
    kit_version: row.kit_version ?? null,
  };
}

export const REGISTRY_COLUMNS =
  "id, slug, kind, owner_user_id, name, description, icon_key, " +
  "publisher_username, publisher_wallet, agent_identity, visibility, access, " +
  "password_hash, x402_enabled, x402_price_usdc, plugin_signin_enabled, " +
  "status, bundle_version, listed_at, updated_at, " +
  "appname, draft_version, lane, functions_enabled, kit_version, create_budget_usd";
const COLUMNS = REGISTRY_COLUMNS;

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

/**
 * Publisher page rows (V11 §6): a publisher's public + published apps only,
 * so the page discloses exactly what the store index already does (MA7).
 */
export async function listPublisherApps(
  supabase: SupabaseClient,
  username: string
): Promise<RegistryApp[]> {
  if (!USERNAME_RE.test(username)) return [];
  const { data, error } = await supabase
    .from("mini_apps")
    .select(COLUMNS)
    .eq("publisher_username", username)
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
