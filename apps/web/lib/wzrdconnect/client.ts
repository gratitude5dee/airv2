/**
 * WZRD Connect control-plane client (R-CONN-01): our self-hosted connector
 * gateway at connector.wzrd.tech (OOMOL open-connector). Server-side only —
 * the admin bearer and per-user runtime tokens never reach a browser or a
 * box; the box only sees the /api/mcp/wzrdconnect proxy.
 *
 * Tenancy model: open-connector has a single admin identity, so airv2 scopes
 * users by (a) a named connection per user+service — alias `air-<userId>` —
 * and (b) a per-user runtime token (users.wzrd_connect_token) whose
 * `allowedConnections` policy lists exactly the connection ids the user's
 * box may act on.
 */
import { env } from "../env";
import { DEFAULT_REQUEST_TIMEOUT_MS, requestSignal } from "../http/timeout";

export class WzrdConnectApiError extends Error {
  status: number;
  code: string | null;
  constructor(status: number, message: string, code: string | null = null) {
    super(`wzrd connect api ${status}: ${message}`);
    this.name = "WzrdConnectApiError";
    this.status = status;
    this.code = code;
  }
}

function adminToken(): string {
  const token = env.wzrdConnectAdminToken();
  if (!token) {
    throw new WzrdConnectApiError(
      500,
      "WZRD_CONNECT_ADMIN_TOKEN is not configured",
      "wzrd_connect_not_configured"
    );
  }
  return token;
}

async function wzrdFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown; token?: string }
): Promise<T> {
  const response = await fetch(`${env.wzrdConnectOrigin()}${path}`, {
    method: init?.method ?? "GET",
    signal: requestSignal(DEFAULT_REQUEST_TIMEOUT_MS),
    headers: {
      authorization: `Bearer ${init?.token ?? adminToken()}`,
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const record =
      body && typeof body === "object"
        ? (body as { error?: { code?: string; message?: string } }).error
        : null;
    throw new WzrdConnectApiError(
      response.status,
      (record?.message ?? response.statusText ?? "request failed").slice(
        0,
        500
      ),
      record?.code ?? null
    );
  }
  // Runtime /v1 endpoints wrap payloads in { success, data }; /api admin
  // endpoints return the payload directly.
  if (
    body &&
    typeof body === "object" &&
    "success" in body &&
    "data" in body
  ) {
    return (body as { data: T }).data;
  }
  return body as T;
}

export interface WzrdProviderSummary {
  service: string;
  displayName: string;
  categories?: string[];
  authTypes?: string[];
  homepageUrl?: string;
}

/** Provider catalog summaries for the Connect grid. */
export async function listProviders(): Promise<WzrdProviderSummary[]> {
  return await wzrdFetch<WzrdProviderSummary[]>("/api/providers");
}

export interface WzrdOAuthRequestStart {
  authorizationUrl: string;
  connectionRequestId: string;
  status: string;
  expiresAt: string;
}

/**
 * Start a hosted OAuth flow for one service under a deterministic
 * connection name — the alias is how the box proxy addresses this user's
 * connection without a DB lookup.
 */
export async function createOAuthRequest(options: {
  service: string;
  connectionName: string;
}): Promise<WzrdOAuthRequestStart> {
  return await wzrdFetch<WzrdOAuthRequestStart>(
    "/api/oauth/connection-requests",
    { method: "POST", body: options }
  );
}

export interface WzrdConnectionRequest {
  connectionRequestId: string;
  service: string;
  status: "initiated" | "connected" | "failed" | "expired";
  appId: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  expiresAt: string;
}

/** Poll a pending OAuth request (admin bearer — returns latest status). */
export async function getConnectionRequest(
  connectionRequestId: string
): Promise<WzrdConnectionRequest> {
  return await wzrdFetch<WzrdConnectionRequest>(
    `/v1/connection-requests/${encodeURIComponent(connectionRequestId)}`
  );
}

export interface WzrdConnection {
  id: string;
  service: string;
  /** The alias the connection was created under (`air-<userId>`). */
  connectionName: string;
  authType: string;
  /** Credential present and usable — the admin-list equivalent of active. */
  configured: boolean;
  /** Built-in no-auth defaults appear as virtual rows; airv2 never mirrors them. */
  virtual?: boolean;
}

/** Admin-side connection list (every service's connections, incl. virtual). */
export async function listConnections(): Promise<WzrdConnection[]> {
  return await wzrdFetch<WzrdConnection[]>("/api/connections");
}

/** Delete the named connection and revoke its credential at the provider. */
export async function disconnectConnection(options: {
  service: string;
  connectionName: string;
}): Promise<void> {
  await wzrdFetch<unknown>(
    `/api/connections/${encodeURIComponent(options.service)}`,
    {
      method: "DELETE",
      body: { connectionName: options.connectionName, revoke: true },
    }
  );
}

/**
 * PUT /api/runtime-tokens/:id replaces the WHOLE policy — every array is
 * required, so grant/revoke sends the record's other lists back untouched
 * rather than omitting them.
 */
export interface WzrdTokenPolicy {
  allowedConnections: string[];
  allowedActions: string[];
  blockedActions: string[];
  allowedProxies: string[];
  allowedTriggers: string[];
}

export interface WzrdRuntimeTokenRecord {
  id: string;
  name: string;
}

/** Create-time policy — POST accepts omitted lists; the grant lists are
 *  still required non-empty because empty means unrestricted. */
export type WzrdTokenPolicyInput = Partial<WzrdTokenPolicy> & {
  allowedConnections: string[];
};

/** Mint a per-user runtime token. `allowedConnections` MUST be non-empty
 *  from the start — an empty list is unrestricted, so a placeholder id
 *  stands in until the user's first connection lands. */
export async function createRuntimeToken(
  name: string,
  policy: WzrdTokenPolicyInput
): Promise<{ token: string; record: WzrdRuntimeTokenRecord }> {
  return await wzrdFetch<{ token: string; record: WzrdRuntimeTokenRecord }>(
    "/api/runtime-tokens",
    { method: "POST", body: { name, ...policy } }
  );
}

/** Replace a token's policy wholesale (grant/revoke connection ids). */
export async function updateRuntimeToken(
  id: string,
  policy: WzrdTokenPolicy
): Promise<void> {
  await wzrdFetch<unknown>(`/api/runtime-tokens/${encodeURIComponent(id)}`, {
    method: "PUT",
    body: policy,
  });
}

export type WzrdRuntimeTokenSummary = WzrdRuntimeTokenRecord &
  Partial<WzrdTokenPolicy>;

/** The runtime-token record only stores the policy on create — fetch the
 *  live grant list before updating so a grant is never silently dropped. */
export async function listRuntimeTokens(): Promise<
  WzrdRuntimeTokenSummary[]
> {
  return await wzrdFetch<WzrdRuntimeTokenSummary[]>("/api/runtime-tokens");
}

/** Execute one catalog action as a user, addressed by connection alias. */
export async function executeAction(options: {
  token: string;
  actionId: string;
  input?: Record<string, unknown>;
  connectionName?: string;
}): Promise<unknown> {
  return await wzrdFetch<unknown>(
    `/v1/actions/${encodeURIComponent(options.actionId)}`,
    {
      method: "POST",
      token: options.token,
      body: {
        input: options.input ?? {},
        ...(options.connectionName
          ? { connectionName: options.connectionName }
          : {}),
      },
    }
  );
}
