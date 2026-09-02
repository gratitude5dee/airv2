/**
 * wzrdmail HTTP client — same surface as lib/agentmail/client.ts so
 * lib/mail/client.ts can route to either by MAIL_PROVIDER. Two-key model
 * (SECURITY-DECISIONS.md): the org key held here can send; the box key we
 * mint is an inbox-scoped `read,drafts` key that structurally cannot send
 * or reach another inbox (C10).
 *
 * Differences from AgentMail worth knowing:
 *  - draft-only key: POST /api-keys { inbox_id, permissions: ["read","drafts"] }
 *  - webhook payload envelope is { type, data: { message } } (see
 *    lib/mail/inbound-event.ts for the normaliser)
 *  - pods: POST /pods { client_id } is idempotent (retry returns the same pod)
 */
import { env } from "../env";
import { DEFAULT_REQUEST_TIMEOUT_MS, requestSignal } from "../http/timeout";
import { MailApiError } from "../mail/errors";
import type {
  AgentMailDraft,
  AgentMailMessage,
  AgentMailThread,
  AgentMailThreadDetail,
} from "../agentmail/client";

/** Attachment bytes can be large; allow a longer download window. */
const ATTACHMENT_TIMEOUT_MS = 60_000;

export class WzrdMailApiError extends MailApiError {
  constructor(status: number, message: string) {
    super(status, message);
    this.name = "WzrdMailApiError";
  }
}

function apiBase(): string {
  return `${env.wzrdmailBaseUrl()}/v0`;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  return { Authorization: `Bearer ${env.wzrdmailApiKey()}`, ...extra };
}

async function wzrdmailFetch<T>(
  path: string,
  init?: { method?: string; body?: object; headers?: Record<string, string> }
): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: init?.method ?? "GET",
    signal: requestSignal(DEFAULT_REQUEST_TIMEOUT_MS),
    headers: authHeaders({ "Content-Type": "application/json", ...init?.headers }),
    ...(init?.body ? { body: JSON.stringify(init.body) } : {}),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new WzrdMailApiError(response.status, text.slice(0, 500));
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

/** Deleting a pod soft-deletes its inboxes with it (M8). */
export async function deletePod(podId: string): Promise<void> {
  const response = await fetch(
    `${apiBase()}/pods/${encodeURIComponent(podId)}`,
    {
      method: "DELETE",
      signal: requestSignal(DEFAULT_REQUEST_TIMEOUT_MS),
      headers: authHeaders(),
    }
  );
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new WzrdMailApiError(response.status, text.slice(0, 500));
  }
}

interface Pod {
  pod_id: string;
  client_id?: string;
}

/**
 * client_id = user_id is the idempotency key AND the mapping (M3). wzrdmail
 * replays the original response for a repeated client_id, so the create is
 * itself idempotent; the list fallback only covers a 409 from a pod created
 * outside the idempotency window.
 */
export async function ensurePod(userId: string): Promise<Pod> {
  try {
    return await wzrdmailFetch<Pod>("/pods", {
      method: "POST",
      body: { client_id: userId, name: `air-${userId}` },
    });
  } catch (error) {
    if (error instanceof WzrdMailApiError && error.status === 409) {
      const pods = await wzrdmailFetch<{ pods?: Pod[] }>("/pods");
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
  return await wzrdmailFetch<Inbox>(
    `/pods/${encodeURIComponent(podId)}/inboxes`,
    {
      method: "POST",
      body: {
        username,
        domain: env.agentEmailDomain(),
        ...(displayName ? { display_name: displayName } : {}),
        client_id: `inbox-${username}`,
      },
    }
  );
}

/**
 * Inbox-scoped `read,drafts` key for the box. No `send`: the box can compose
 * and read but structurally cannot send (C10); the inbox scope makes every
 * other user's mail unreachable.
 */
export async function createDraftOnlyKey(
  inboxId: string,
  name: string
): Promise<string> {
  const result = await wzrdmailFetch<{ api_key: string }>("/api-keys", {
    method: "POST",
    body: { name, inbox_id: inboxId, permissions: ["read", "drafts"] },
  });
  return result.api_key;
}

/** Fetch raw attachment bytes (V3: emailed .ics invites → box inbox). */
export async function getAttachmentBytes(
  inboxId: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const response = await fetch(
    `${apiBase()}/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { signal: requestSignal(ATTACHMENT_TIMEOUT_MS), headers: authHeaders() }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new WzrdMailApiError(response.status, text.slice(0, 500));
  }
  // The endpoint may serve bytes directly or a JSON pointer to a signed URL.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { download_url?: string; url?: string };
    const url = body.download_url ?? body.url;
    if (!url) {
      throw new WzrdMailApiError(502, "attachment response had no bytes or url");
    }
    const download = await fetch(url, {
      signal: requestSignal(ATTACHMENT_TIMEOUT_MS),
    });
    if (!download.ok) {
      throw new WzrdMailApiError(download.status, "attachment download failed");
    }
    return Buffer.from(await download.arrayBuffer());
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function getMessage(
  inboxId: string,
  messageId: string
): Promise<AgentMailMessage> {
  return await wzrdmailFetch<AgentMailMessage>(
    `/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}`
  );
}

export async function listThreads(
  inboxId: string,
  limit = 25
): Promise<AgentMailThread[]> {
  const result = await wzrdmailFetch<{ threads?: AgentMailThread[] }>(
    `/inboxes/${encodeURIComponent(inboxId)}/threads?limit=${limit}`
  );
  return result.threads ?? [];
}

export async function getThread(
  inboxId: string,
  threadId: string
): Promise<AgentMailThreadDetail> {
  return await wzrdmailFetch<AgentMailThreadDetail>(
    `/inboxes/${encodeURIComponent(inboxId)}/threads/${encodeURIComponent(threadId)}`
  );
}

/** Control-plane reply; Idempotency-Key makes retried sends single-effect. */
export async function replyToMessage(
  inboxId: string,
  messageId: string,
  text: string,
  idempotencyKey: string
): Promise<void> {
  await wzrdmailFetch(
    `/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/reply`,
    {
      method: "POST",
      headers: { "Idempotency-Key": idempotencyKey },
      body: { text },
    }
  );
}

export async function createDraft(
  inboxId: string,
  draft: {
    to?: string[];
    subject?: string;
    text: string;
    in_reply_to?: string;
    client_id?: string;
  }
): Promise<string> {
  const result = await wzrdmailFetch<{ draft_id: string }>(
    `/inboxes/${encodeURIComponent(inboxId)}/drafts`,
    { method: "POST", body: draft }
  );
  return result.draft_id;
}

/** Send a held draft — the only send path for agent-composed mail (C10). */
export async function sendDraft(
  inboxId: string,
  draftId: string,
  idempotencyKey: string
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/inboxes/${encodeURIComponent(inboxId)}/drafts/${encodeURIComponent(draftId)}/send`,
    {
      method: "POST",
      signal: requestSignal(DEFAULT_REQUEST_TIMEOUT_MS),
      headers: authHeaders({ "Idempotency-Key": idempotencyKey }),
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new WzrdMailApiError(response.status, body.slice(0, 500));
  }
}

export async function listDrafts(
  inboxId: string,
  limit = 25
): Promise<AgentMailDraft[]> {
  const result = await wzrdmailFetch<{ drafts?: AgentMailDraft[] }>(
    `/inboxes/${encodeURIComponent(inboxId)}/drafts?limit=${limit}`
  );
  return result.drafts ?? [];
}

export async function getDraft(
  inboxId: string,
  draftId: string
): Promise<AgentMailDraft> {
  return await wzrdmailFetch<AgentMailDraft>(
    `/inboxes/${encodeURIComponent(inboxId)}/drafts/${encodeURIComponent(draftId)}`
  );
}

/**
 * Inbox receive-block list via the AgentMail-compatible alias
 * (POST /inboxes/{id}/lists/receive/block → { kind: "block", pattern }).
 */
export async function addInboxBlockEntry(
  inboxId: string,
  entry: string
): Promise<void> {
  try {
    await wzrdmailFetch(
      `/inboxes/${encodeURIComponent(inboxId)}/lists/receive/block`,
      { method: "POST", body: { entry, reason: "blocked from People" } }
    );
  } catch (error) {
    // 409: already on the list — the desired state holds.
    if (error instanceof WzrdMailApiError && error.status === 409) return;
    throw error;
  }
}

export async function removeInboxBlockEntry(
  inboxId: string,
  entry: string
): Promise<void> {
  const response = await fetch(
    `${apiBase()}/inboxes/${encodeURIComponent(inboxId)}/lists/receive/block/${encodeURIComponent(entry)}`,
    {
      method: "DELETE",
      signal: requestSignal(DEFAULT_REQUEST_TIMEOUT_MS),
      headers: authHeaders(),
    }
  );
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new WzrdMailApiError(response.status, text.slice(0, 500));
  }
}

interface Webhook {
  webhook_id: string;
  client_id?: string | null;
  pod_ids?: string[];
}

/**
 * One shared inbound webhook for the whole deployment: each webhook has its
 * own `whsec_` signing secret and we hold exactly one (WZRDMAIL_WEBHOOK_SECRET),
 * so new pods are appended to the existing webhook's pod_ids instead of
 * creating a second webhook with an unknown secret.
 */
export async function ensureWebhook(
  url: string,
  podIds: string[]
): Promise<void> {
  const listed = await wzrdmailFetch<{ webhooks?: Webhook[] }>("/webhooks");
  const existing = (listed.webhooks ?? []).find((w) =>
    (w.client_id ?? "").startsWith("air-inbound")
  );
  if (existing) {
    const merged = Array.from(
      new Set([...(existing.pod_ids ?? []), ...podIds])
    );
    if (merged.length !== (existing.pod_ids ?? []).length) {
      await wzrdmailFetch(`/webhooks/${encodeURIComponent(existing.webhook_id)}`, {
        method: "PATCH",
        body: { pod_ids: merged },
      });
    }
    return;
  }
  const created = await wzrdmailFetch<{ webhook_id: string }>("/webhooks", {
    method: "POST",
    body: {
      url,
      event_types: ["message.received"],
      pod_ids: podIds,
      client_id: "air-inbound",
    },
  });
  console.error(
    JSON.stringify({
      msg: "wzrdmail webhook created — set WZRDMAIL_WEBHOOK_SECRET to its signing secret",
      webhook_id: created.webhook_id,
    })
  );
}
