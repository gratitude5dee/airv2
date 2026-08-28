/**
 * Composio control-plane client (goal.md M7). Server-side only: the project
 * API key never reaches a browser or a box. Composio holds every OAuth
 * token; we record only (user_id, provider, toolkit, external_account_id,
 * status) in `connections` (C10, §7.3).
 *
 * One session per user (user_id = our users.id): the session's hosted MCP
 * URL is the per-user endpoint installed into the user's box.
 */
import { env } from "../env";
import { DEFAULT_REQUEST_TIMEOUT_MS, requestSignal } from "../http/timeout";

const COMPOSIO_API = "https://backend.composio.dev/api/v3.1";

export class ComposioApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(`composio api ${status}: ${message}`);
    this.name = "ComposioApiError";
    this.status = status;
  }
}

async function composioFetch<T>(
  path: string,
  init?: { method?: string; body?: unknown }
): Promise<T> {
  const response = await fetch(`${COMPOSIO_API}${path}`, {
    method: init?.method ?? "GET",
    signal: requestSignal(DEFAULT_REQUEST_TIMEOUT_MS),
    headers: {
      "x-api-key": env.composioApiKey(),
      ...(init?.body !== undefined
        ? { "Content-Type": "application/json" }
        : {}),
    },
    ...(init?.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    const body = await response.text();
    throw new ComposioApiError(response.status, body.slice(0, 500));
  }
  return (await response.json()) as T;
}

export interface ComposioToolkit {
  slug: string;
  name: string;
  no_auth?: boolean;
  meta?: { logo?: string; description?: string };
}

/** Connectable toolkits only — no-auth toolkits (composio_search, browser
 *  tool, …) have no Connect Link and the link endpoint 400s on them. */
export async function listToolkits(): Promise<ComposioToolkit[]> {
  const result = await composioFetch<{ items?: ComposioToolkit[] }>(
    "/toolkits?limit=100&managed_by=composio&sort_by=usage"
  );
  return (result.items ?? []).filter((toolkit) => !toolkit.no_auth);
}

export interface ComposioSession {
  session_id: string;
  mcp?: { type: string; url: string };
}

export async function createSession(userId: string): Promise<ComposioSession> {
  return await composioFetch<ComposioSession>("/tool_router/session", {
    method: "POST",
    body: { user_id: userId },
  });
}

export async function getSession(
  sessionId: string
): Promise<ComposioSession> {
  return await composioFetch<ComposioSession>(
    `/tool_router/session/${encodeURIComponent(sessionId)}`
  );
}

export interface LinkSession {
  redirect_url: string;
  connected_account_id: string;
}

/** Hosted Connect Link for one toolkit inside the user's session. */
export async function createLinkSession(
  sessionId: string,
  toolkit: string,
  callbackUrl: string
): Promise<LinkSession> {
  return await composioFetch<LinkSession>(
    `/tool_router/session/${encodeURIComponent(sessionId)}/link`,
    { method: "POST", body: { toolkit, callback_url: callbackUrl } }
  );
}

export interface ConnectedAccount {
  id: string;
  toolkit?: { slug?: string };
  status?: string;
  user_id?: string;
}

export async function deleteConnectedAccount(id: string): Promise<void> {
  await composioFetch<unknown>(
    `/connected_accounts/${encodeURIComponent(id)}`,
    { method: "DELETE" }
  );
}

export async function deleteSession(sessionId: string): Promise<void> {
  await composioFetch<unknown>(
    `/tool_router/session/${encodeURIComponent(sessionId)}`,
    { method: "DELETE" }
  );
}

/**
 * Execute a Composio tool as a user (v3 tools/execute). The OAuth token
 * stays with Composio; we pass only our user id (and optionally a specific
 * connected account) and get the tool's JSON result back.
 */
export async function executeTool(
  toolSlug: string,
  userId: string,
  args: Record<string, unknown>,
  connectedAccountId?: string
): Promise<unknown> {
  return await composioFetch<unknown>(
    `/tools/execute/${encodeURIComponent(toolSlug)}`,
    {
      method: "POST",
      body: {
        user_id: userId,
        arguments: args,
        ...(connectedAccountId
          ? { connected_account_id: connectedAccountId }
          : {}),
      },
    }
  );
}

export async function listConnectedAccounts(
  userId: string
): Promise<ConnectedAccount[]> {
  const result = await composioFetch<{ items?: ConnectedAccount[] }>(
    `/connected_accounts?user_ids=${encodeURIComponent(userId)}&statuses=ACTIVE`
  );
  return result.items ?? [];
}

/** Every connected account for the user, any status — lets the sync tell a
 *  live INITIATED link apart from one that EXPIRED before authorization. */
export async function listAllConnectedAccounts(
  userId: string
): Promise<ConnectedAccount[]> {
  const result = await composioFetch<{ items?: ConnectedAccount[] }>(
    `/connected_accounts?user_ids=${encodeURIComponent(userId)}&limit=50`
  );
  return result.items ?? [];
}
