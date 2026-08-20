/**
 * Daytona managed-API-keys client (P1-11). The manager key (manage:api_keys)
 * lives in Vercel env only — never in a box (C2). It mints one scoped child
 * key per user at provision time and revokes it at deletion; the child key
 * can only touch that tenant's own sandboxes and cannot mint further keys.
 */
import { env } from "../env";

export class DaytonaApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "DaytonaApiError";
    this.status = status;
  }
}

/** Both credentials present — the per-user sandbox lane is enabled. */
export function daytonaConfigured(): boolean {
  return Boolean(env.daytonaManagerKey() && env.daytonaOrganizationId());
}

async function daytonaFetch(
  path: string,
  init?: { method?: string; body?: object }
): Promise<Response> {
  const response = await fetch(`${env.daytonaApiUrl()}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env.daytonaManagerKey()}`,
      "X-Daytona-Organization-ID": env.daytonaOrganizationId() ?? "",
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(15_000),
  });
  return response;
}

export function tenantKeyName(userId: string): string {
  return `box-${userId}`;
}

/**
 * Mint a per-user child key scoped to sandbox create/delete only — it can
 * never manage other keys or other tenants' resources.
 */
export async function createTenantKey(userId: string): Promise<string> {
  const response = await daytonaFetch("/api-keys", {
    method: "POST",
    body: {
      name: tenantKeyName(userId),
      permissions: ["write:sandboxes", "delete:sandboxes"],
    },
  });
  if (!response.ok) {
    const text = await response.text();
    throw new DaytonaApiError(response.status, text.slice(0, 500));
  }
  const parsed = (await response.json()) as {
    value?: string;
    key?: string;
    apiKey?: string;
  };
  const key = parsed.value ?? parsed.key ?? parsed.apiKey;
  if (!key) {
    throw new DaytonaApiError(500, "api-keys response missing key value");
  }
  return key;
}

/** Revoke the user's child key at deletion. 404 = already gone, fine. */
export async function deleteTenantKey(userId: string): Promise<void> {
  const response = await daytonaFetch(
    `/api-keys/${encodeURIComponent(tenantKeyName(userId))}`,
    { method: "DELETE" }
  );
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new DaytonaApiError(response.status, text.slice(0, 500));
  }
}
