/**
 * AgentMail HTTP client (goal.md M3 step 7, M5). Two-key model
 * (SECURITY-DECISIONS.md): the org key held here can send; the box key we
 * mint is draft-only + read and physically cannot send (C10).
 */
import { env } from "../env";

const AGENTMAIL_API = "https://api.agentmail.to/v0";

export class AgentMailApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "AgentMailApiError";
    this.status = status;
  }
}

async function agentmailFetch<T>(
  path: string,
  init?: { method?: string; body?: object }
): Promise<T> {
  const response = await fetch(`${AGENTMAIL_API}${path}`, {
    method: init?.method ?? "GET",
    headers: {
      Authorization: `Bearer ${env.agentmailApiKey()}`,
      "Content-Type": "application/json",
    },
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new AgentMailApiError(response.status, text.slice(0, 500));
  }
  return (await response.json()) as T;
}

interface Pod {
  pod_id: string;
  client_id?: string;
}

/** client_id = user_id is the idempotency key AND the mapping (M3). */
export async function ensurePod(userId: string): Promise<Pod> {
  try {
    return await agentmailFetch<Pod>("/pods", {
      method: "POST",
      body: { client_id: userId },
    });
  } catch (error) {
    if (error instanceof AgentMailApiError && error.status === 400) {
      const pods = await agentmailFetch<{ pods?: Pod[] }>("/pods");
      const existing = (pods.pods ?? []).find((p) => p.client_id === userId);
      if (existing) return existing;
    }
    throw error;
  }
}

interface Inbox {
  inbox_id: string;
  username?: string;
  domain?: string;
}

export async function createInbox(
  podId: string,
  username: string,
  displayName?: string
): Promise<Inbox> {
  return await agentmailFetch<Inbox>(`/pods/${podId}/inboxes`, {
    method: "POST",
    body: {
      username,
      domain: env.agentEmailDomain(),
      ...(displayName ? { display_name: displayName } : {}),
      client_id: `inbox-${username}`,
    },
  });
}

/**
 * Draft-only + read key for the box. No message_send / draft_send: the box
 * can compose and read but structurally cannot send (C10).
 */
export async function createDraftOnlyKey(name: string): Promise<string> {
  const result = await agentmailFetch<{ api_key: string }>("/api-keys", {
    method: "POST",
    body: {
      name,
      permissions: {
        inbox_read: true,
        thread_read: true,
        message_read: true,
        draft_read: true,
        draft_create: true,
        draft_update: true,
      },
    },
  });
  return result.api_key;
}

export async function ensureWebhook(
  url: string,
  podIds: string[]
): Promise<void> {
  await agentmailFetch("/webhooks", {
    method: "POST",
    body: {
      url,
      event_types: ["message.received"],
      pod_ids: podIds,
      client_id: `air-inbound-${podIds[0] ?? "default"}`,
    },
  }).catch((error: unknown) => {
    // An existing webhook with the same client_id is fine (idempotent).
    if (error instanceof AgentMailApiError && error.status === 400) return;
    throw error;
  });
}
