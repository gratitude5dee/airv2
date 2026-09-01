/**
 * MasterKey (x402 service catalog) client — control-plane side only.
 *
 * MasterKey holds one per-user Sponge agent wallet per airv2 user and pays
 * x402 providers on their behalf; airv2 owns identity, approvals and the
 * spend cap. The proxy at /api/mcp/masterkey and the Store mini-app both go
 * through here so the per-user MCP token is minted, cached and attached
 * server-side — the box and the browser only ever see airv2 credentials.
 *
 * The `connections` row (provider='masterkey', toolkit='mcp') records
 * status only; tokens live in process memory and are re-minted on expiry.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { env } from "../env";

export const MASTERKEY_PROVIDER = "masterkey";
export const MASTERKEY_TOOLKIT = "mcp";

interface CachedToken {
  token: string;
  expiresAt: number;
  masterkeyUserId: string;
  connectionId: string;
}

const TOKEN_REFRESH_SKEW_MS = 5 * 60 * 1000;
const tokenCache = new Map<string, CachedToken>();
const inflight = new Map<string, Promise<CachedToken>>();

export class MasterkeyError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "MasterkeyError";
  }
}

interface PartnerTokenResponse {
  access_token: string;
  expires_in: number;
  connection_id: string;
  user_id: string;
  wallet: { agent_id: string; addresses: Record<string, string> } | null;
}

async function setConnectionStatus(
  supabase: SupabaseClient,
  userId: string,
  status: "active" | "error",
  externalAccountId?: string
): Promise<void> {
  const row: Record<string, unknown> = {
    user_id: userId,
    provider: MASTERKEY_PROVIDER,
    toolkit: MASTERKEY_TOOLKIT,
    status,
  };
  if (externalAccountId) row["external_account_id"] = externalAccountId;
  if (status === "active") row["connected_at"] = new Date().toISOString();
  const { error } = await supabase
    .from("connections")
    .upsert(row, { onConflict: "user_id,provider,toolkit" });
  if (error) {
    console.error(
      JSON.stringify({ msg: "masterkey connection upsert failed", user_id: userId, error: error.message })
    );
  }
}

async function mintToken(supabase: SupabaseClient, userId: string): Promise<CachedToken> {
  const [{ data: user }, { data: entitlement }] = await Promise.all([
    supabase.from("users").select("wallet_address").eq("id", userId).maybeSingle(),
    supabase.from("entitlements").select("monthly_cap_usd").eq("user_id", userId).maybeSingle(),
  ]);
  const body = {
    external_user_id: userId,
    wallet_address: (user?.wallet_address as string | null | undefined) ?? null,
    monthly_cap_usd: entitlement ? Number(entitlement.monthly_cap_usd) : undefined,
    per_call_max_usd: env.masterkeyPerCallMaxUsd(),
  };
  let response: Response;
  try {
    response = await fetch(`${env.masterkeyOrigin()}/api/partner/airv2/token`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${env.masterkeyPartnerSecret()}`,
      },
      body: JSON.stringify(body),
      cache: "no-store",
    });
  } catch (error) {
    await setConnectionStatus(supabase, userId, "error");
    throw new MasterkeyError(502, error instanceof Error ? error.message : "masterkey unreachable");
  }
  if (!response.ok) {
    await setConnectionStatus(supabase, userId, "error");
    throw new MasterkeyError(502, `masterkey token mint failed (${response.status})`);
  }
  const json = (await response.json()) as PartnerTokenResponse;
  const cached: CachedToken = {
    token: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
    masterkeyUserId: json.user_id,
    connectionId: json.connection_id,
  };
  tokenCache.set(userId, cached);
  await setConnectionStatus(supabase, userId, "active", json.user_id);
  return cached;
}

/**
 * Ensure the user has a MasterKey account + per-user wallet and return a
 * live MCP bearer token for them. Never hand this token to a box or browser.
 */
export async function ensureMasterkeyToken(
  supabase: SupabaseClient,
  userId: string
): Promise<CachedToken> {
  const hit = tokenCache.get(userId);
  if (hit && hit.expiresAt - TOKEN_REFRESH_SKEW_MS > Date.now()) return hit;
  let pending = inflight.get(userId);
  if (!pending) {
    pending = mintToken(supabase, userId).finally(() => inflight.delete(userId));
    inflight.set(userId, pending);
  }
  return pending;
}

/** Drop a cached token (e.g. after MasterKey answered 401). */
export function forgetMasterkeyToken(userId: string): void {
  tokenCache.delete(userId);
}

/** Records the connection without minting a token — used by provisioning. */
export async function ensureMasterkeyConnection(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  await ensureMasterkeyToken(supabase, userId);
}

// ─── catalog (public, summary-only) ─────────────────────────────────────────

export interface CatalogEntry {
  id: string;
  kind: "model" | "api";
  name: string;
  provider: string;
  category: string;
  subcategory: string;
  price: { display: string; amount: number | null; unit: string };
  tags: string[];
  description?: string;
  domain?: string | null;
}

export interface CatalogCategory {
  name: string;
  slug: string;
  count: number;
  subcategories: { name: string; slug: string; count: number }[];
}

export interface Catalog {
  syncedAt: string;
  categories: CatalogCategory[];
  entries: CatalogEntry[];
}

let catalogCache: { at: number; value: Catalog } | null = null;
const CATALOG_TTL_MS = 10 * 60 * 1000;

export async function fetchCatalog(): Promise<Catalog> {
  if (catalogCache && Date.now() - catalogCache.at < CATALOG_TTL_MS) return catalogCache.value;
  const response = await fetch(`${env.masterkeyOrigin()}/api/catalog`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) {
    if (catalogCache) return catalogCache.value;
    throw new MasterkeyError(502, `masterkey catalog unavailable (${response.status})`);
  }
  const value = (await response.json()) as Catalog;
  catalogCache = { at: Date.now(), value };
  return value;
}

export async function findCatalogEntry(serviceId: string): Promise<CatalogEntry | null> {
  const catalog = await fetchCatalog();
  return catalog.entries.find((entry) => entry.id === serviceId) ?? null;
}

export interface ServiceDetail {
  id: string;
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown> | null;
  usage?: { inputExample?: unknown; guide?: string };
  operations?: { name: string; description?: string }[];
}

/** Full detail for one subcategory (the only path to schemas/backends). */
export async function fetchSubcategory(slug: string): Promise<ServiceDetail[]> {
  if (!/^[a-z0-9-]+$/.test(slug)) return [];
  const response = await fetch(`${env.masterkeyOrigin()}/api/subcat/${slug}`, {
    headers: { accept: "application/json" },
    cache: "no-store",
  });
  if (!response.ok) return [];
  return (await response.json()) as ServiceDetail[];
}

// ─── MCP tool calls (server-side) ───────────────────────────────────────────

interface JsonRpcResponse {
  jsonrpc: "2.0";
  id: number | string | null;
  result?: unknown;
  error?: { code: number; message: string };
}

/** Parses either a plain JSON body or a text/event-stream body into responses. */
export function parseMcpBody(contentType: string, text: string): JsonRpcResponse[] {
  const out: JsonRpcResponse[] = [];
  const push = (raw: string) => {
    try {
      const parsed = JSON.parse(raw) as JsonRpcResponse | JsonRpcResponse[];
      if (Array.isArray(parsed)) out.push(...parsed);
      else out.push(parsed);
    } catch {
      /* ignore non-JSON frames */
    }
  };
  if (contentType.includes("text/event-stream")) {
    for (const frame of text.split(/\n\n+/)) {
      const data = frame
        .split("\n")
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim())
        .join("\n");
      if (data) push(data);
    }
  } else if (text.trim()) {
    push(text);
  }
  return out;
}

export interface ToolResult {
  content: { type: string; text?: string }[];
  structuredContent?: Record<string, unknown>;
  isError?: boolean;
}

/** Call one MasterKey MCP tool as the user. Stateless streamable-HTTP POST. */
export async function callMasterkeyTool(
  supabase: SupabaseClient,
  userId: string,
  name: string,
  args: Record<string, unknown>,
  opts: { signal?: AbortSignal } = {}
): Promise<ToolResult> {
  const { token } = await ensureMasterkeyToken(supabase, userId);
  const response = await fetch(`${env.masterkeyOrigin()}/mcp`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
      authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name, arguments: args },
    }),
    cache: "no-store",
    signal: opts.signal ?? null,
  });
  if (response.status === 401) forgetMasterkeyToken(userId);
  const text = await response.text();
  if (!response.ok) {
    throw new MasterkeyError(502, `masterkey mcp ${response.status}: ${text.slice(0, 200)}`);
  }
  const messages = parseMcpBody(response.headers.get("content-type") ?? "", text);
  const reply = messages.find((message) => message.id === 1);
  if (!reply) throw new MasterkeyError(502, "masterkey mcp: empty reply");
  if (reply.error) throw new MasterkeyError(502, reply.error.message);
  return reply.result as ToolResult;
}

/** Cost MasterKey reports for a run_service result, when it did charge. */
export function runCostUsd(result: ToolResult): number | null {
  const structured = result.structuredContent;
  if (!structured || structured["error"]) return null;
  const cost = structured["providerCostUsd"];
  return typeof cost === "number" && Number.isFinite(cost) ? cost : null;
}

/** The human-readable text of a tool result. */
export function resultText(result: ToolResult): string {
  return result.content
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string)
    .join("\n")
    .trim();
}
