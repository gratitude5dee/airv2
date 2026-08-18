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

/** Deleting a pod takes its inboxes, threads, and drafts with it (M8). */
export async function deletePod(podId: string): Promise<void> {
  const response = await fetch(
    `${AGENTMAIL_API}/pods/${encodeURIComponent(podId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${env.agentmailApiKey()}` },
    }
  );
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new AgentMailApiError(response.status, text.slice(0, 500));
  }
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

export interface AgentMailAttachment {
  attachment_id: string;
  filename?: string;
  content_type?: string;
  size?: number;
  inline?: boolean;
}

export interface AgentMailMessage {
  message_id: string;
  inbox_id: string;
  thread_id?: string;
  from?: string;
  subject?: string;
  text?: string;
  /** Provider-extracted new content, already quote-stripped. */
  extracted_text?: string;
  html?: string;
  attachments?: AgentMailAttachment[];
}

/** Fetch raw attachment bytes (V3: emailed .ics invites → box inbox). */
export async function getAttachmentBytes(
  inboxId: string,
  messageId: string,
  attachmentId: string
): Promise<Buffer> {
  const response = await fetch(
    `${AGENTMAIL_API}/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}`,
    { headers: { Authorization: `Bearer ${env.agentmailApiKey()}` } }
  );
  if (!response.ok) {
    const text = await response.text();
    throw new AgentMailApiError(response.status, text.slice(0, 500));
  }
  // The endpoint may serve bytes directly or a JSON pointer to a signed URL.
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const body = (await response.json()) as { download_url?: string; url?: string };
    const url = body.download_url ?? body.url;
    if (!url) {
      throw new AgentMailApiError(502, "attachment response had no bytes or url");
    }
    const download = await fetch(url);
    if (!download.ok) {
      throw new AgentMailApiError(download.status, "attachment download failed");
    }
    return Buffer.from(await download.arrayBuffer());
  }
  return Buffer.from(await response.arrayBuffer());
}

export async function getMessage(
  inboxId: string,
  messageId: string
): Promise<AgentMailMessage> {
  return await agentmailFetch<AgentMailMessage>(
    `/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}`
  );
}

/**
 * Control-plane reply (M5 task 3): threading preserved by replying to the
 * message itself; Idempotency-Key makes retried sends single-effect.
 */
export async function replyToMessage(
  inboxId: string,
  messageId: string,
  text: string,
  idempotencyKey: string
): Promise<void> {
  const response = await fetch(
    `${AGENTMAIL_API}/inboxes/${encodeURIComponent(inboxId)}/messages/${encodeURIComponent(messageId)}/reply`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.agentmailApiKey()}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ text }),
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new AgentMailApiError(response.status, body.slice(0, 500));
  }
}

/**
 * V3 scheduled-email delivery: compose a draft control-plane-side, then send
 * it through the policy-send path — the same draft→send shape agent mail
 * uses (C10). Never a direct box send.
 */
export async function createDraft(
  inboxId: string,
  draft: { to: string[]; subject?: string; text: string }
): Promise<string> {
  const result = await agentmailFetch<{ draft_id: string }>(
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
    `${AGENTMAIL_API}/inboxes/${encodeURIComponent(inboxId)}/drafts/${encodeURIComponent(draftId)}/send`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.agentmailApiKey()}`,
        "Idempotency-Key": idempotencyKey,
      },
    }
  );
  if (!response.ok) {
    const body = await response.text();
    throw new AgentMailApiError(response.status, body.slice(0, 500));
  }
}

interface Webhook {
  webhook_id: string;
  client_id?: string;
  pod_ids?: string[];
}

/**
 * One shared inbound webhook for the whole deployment: each AgentMail webhook
 * has its own signing secret and we hold exactly one (AGENTMAIL_WEBHOOK_SECRET),
 * so new pods are appended to the existing webhook's pod_ids instead of
 * creating a second webhook with an unknown secret.
 */
export async function ensureWebhook(
  url: string,
  podIds: string[]
): Promise<void> {
  const listed = await agentmailFetch<{ webhooks?: Webhook[] }>("/webhooks");
  const existing = (listed.webhooks ?? []).find((w) =>
    (w.client_id ?? "").startsWith("air-inbound")
  );
  if (existing) {
    const merged = Array.from(
      new Set([...(existing.pod_ids ?? []), ...podIds])
    );
    if (merged.length !== (existing.pod_ids ?? []).length) {
      await agentmailFetch(`/webhooks/${existing.webhook_id}`, {
        method: "PATCH",
        body: { pod_ids: merged },
      });
    }
    return;
  }
  const created = await agentmailFetch<{ webhook_id: string }>("/webhooks", {
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
      msg: "agentmail webhook created — set AGENTMAIL_WEBHOOK_SECRET to its signing secret",
      webhook_id: created.webhook_id,
    })
  );
}
