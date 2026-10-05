/**
 * Mail inbox mini-app: folder navigation (Inbox · Unread · Drafts · Sent ·
 * Spam · Trash), a full thread view, and draft-first compose — manual or
 * "Draft with Air". C10 stays structural — this module never imports a send
 * call; composing files a draft plus an `email_draft` Needs-you decision,
 * and the only send path remains the control-plane approval in
 * lib/decisions/email.ts (resolveEmailDraftDecision / sendHeldDraft).
 * Forward and reply-all land as drafts, not sends.
 *
 * Reduced-trust surface (I5): message HTML is converted to escaped text,
 * never emitted as provider HTML; attachments stream only through the
 * same-origin route. All state lives in query params (`?folder=`,
 * `?thread=`, `?draft=`, `?q=`, `?page_token=`) — forms POST and 303 back
 * (C17). Owner-only, every POST re-checked. Label writes run under the
 * provider's control-plane key (wzrdmail `admin` permission).
 */
import { NextResponse } from "next/server";
import {
  addInboxBlockEntry,
  batchUpdateMessages,
  createDraft,
  deleteDraft,
  getAttachmentBytes,
  getDraft,
  getMessage,
  getThread,
  listDrafts,
  listMessages,
  listThreadsFiltered,
  MailApiError,
  patchMessage,
  patchThread,
  removeInboxBlockEntry,
  restoreMessage,
  restoreThread,
  searchThreads,
  trashMessage,
  trashThread,
  updateDraft,
  type MailAttachment as AgentMailAttachment,
  type MailDraft as AgentMailDraft,
  type MailMessage as AgentMailMessage,
  type MailThread as AgentMailThread,
  type MailThreadDetail as AgentMailThreadDetail,
} from "../../mail/client";
import {
  EmailDraftError,
  resolveEmailDraftDecision,
} from "../../decisions/email";
import { queueEmailDraftReview } from "../../email/review";
import { createRun, MAIN_SESSION } from "../../hermes/client";
import { armStopAfter, ensureBoxAwake } from "../../orchestrator/boxes";
import { externalOrigin } from "../gates";
import { esc, forbidden, notFound, withBaseHeaders } from "../html";
import { promptBar, runPrompt } from "../promptBar";
import { avatarHtml, renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";

const PAGE_SIZE = 25;

/** Folder vocabulary — drives the chip row and the query mapping. */
const FOLDERS = ["inbox", "unread", "drafts", "sent", "spam", "trash"] as const;
type Folder = (typeof FOLDERS)[number];
const FOLDER_LABELS: Record<Folder, string> = {
  inbox: "Inbox",
  unread: "Unread",
  drafts: "Drafts",
  sent: "Sent",
  spam: "Spam",
  trash: "Trash",
};

function folderOf(raw: string | null): Folder {
  return (FOLDERS as readonly string[]).includes(raw ?? "")
    ? (raw as Folder)
    : "inbox";
}

/** Where a thread view's back link points: a folder name, or `search` with
 * the query carried alongside. */
function backHref(ctx: MiniAppContext, from: string | null, q: string | null) {
  const params = new URLSearchParams();
  if (from === "search" && q) {
    params.set("q", q);
  } else {
    params.set("folder", folderOf(from));
  }
  return `${ctx.basePath}?${params}`;
}

/** Query-string target a form should 303 back to after a POST. Accepts only
 * same-app `?…` strings so a forged `return` can't bounce elsewhere. */
function safeReturn(raw: FormDataEntryValue | null, fallback: string) {
  const value = typeof raw === "string" ? raw.slice(0, 400) : "";
  return value.startsWith("?") ? value : fallback;
}

/** Mail-only classes — shell tokens, no new colors or fonts (§6). */
const MAIL_CSS = `
.mailbar{display:flex;gap:0.4rem;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;width:min(100%,36rem);padding-bottom:0.5rem;align-items:center}
.mailbar::-webkit-scrollbar{display:none}
.mailbar .mailbar-end{margin-left:auto;display:flex;gap:0.4rem}
.mailbar form{margin:0}
.mailbar input[type=text]{min-height:2rem;padding:0.3rem 0.7rem;font-size:0.8rem;border-radius:var(--radius-pill)}
.mailsearch{width:min(100%,36rem);margin-bottom:0.45rem}
.mailsearch form{margin:0}
.mailsearch input[type=text]{width:100%;min-height:2.15rem;padding:0.35rem 1rem;font-size:0.85rem;border-radius:var(--radius-pill)}
.mailrows{display:flex;flex-direction:column;width:min(100%,36rem);border-top:1px solid var(--ring)}
.mailrow{display:flex;align-items:center;gap:0.7rem;min-height:3.5rem;padding:0.55rem 0.15rem;border-bottom:1px solid var(--ring);color:var(--ink);text-decoration:none}
.mailrow .who{display:flex;align-items:center;position:relative;flex-shrink:0}
.mailrow .avatar{width:2.4rem;height:2.4rem;font-size:0.85rem}
.mailrow .meta{min-width:0;flex:1;display:flex;flex-direction:column;gap:0.12rem}
.mailrow .topline{display:flex;align-items:baseline;justify-content:space-between;gap:0.6rem}
.mailrow .name{color:var(--accent);font-weight:600;font-size:0.92rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mailrow .prev{color:var(--ink-muted);font-size:0.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mailrow.unread .prev{color:var(--ink)}
.mailrow .tail{display:flex;flex-direction:column;align-items:flex-end;gap:0.25rem;flex-shrink:0}
.mailrow .when{color:var(--ink-muted);font-size:0.72rem}
.unread-dot{position:absolute;right:-3px;bottom:-3px;width:9px;height:9px;border-radius:50%;background:var(--accent);border:2px solid var(--canvas)}
.countpill{min-width:1.3rem;padding:0.05rem 0.45rem;border-radius:var(--radius-pill);background:var(--well-bg);border:1px solid var(--ring);color:var(--ink);font-size:0.68rem;text-align:center}
.msgcard{padding:0.75rem 0;margin-bottom:0;font-size:0.92rem;line-height:1.5;border-bottom:1px solid var(--ring)}
.msgcard .msghead{display:flex;align-items:center;gap:0.65rem;margin-bottom:0.4rem}
.msgcard .msghead .avatar{width:2.6rem;height:2.6rem;font-size:0.9rem;flex-shrink:0}
.msgcard .mwho{display:flex;flex-direction:column;min-width:0}
.msgcard .mwho .name{font-size:0.95rem;font-weight:500}
.msgcard .mwho .meta{color:var(--ink-muted);font-size:0.75rem}
.msgcard .mwho .meta .tome{color:var(--accent)}
.msgcard .msgbody{white-space:pre-wrap;word-break:break-word}
.msgcard .msgactions{margin-top:0.5rem}
.threadtitle{width:min(100%,36rem);text-align:left;font-size:1.25rem;line-height:1.3;margin:0.2rem 0 0.8rem}
.toolbar{display:flex;gap:0.4rem;flex-wrap:wrap;width:min(100%,36rem);margin-bottom:0.8rem}
.toolbar button{min-height:2rem;padding:0.3rem 0.8rem;font-size:0.6rem;border-radius:var(--radius-pill)}
.flagbanner{display:flex;gap:0.6rem;align-items:flex-start;width:min(100%,36rem);margin:0 0 0.8rem;font-size:0.8rem;line-height:1.45;color:var(--ink);background:rgba(224,49,77,0.12);border:1px solid rgba(224,49,77,0.35);border-radius:var(--radius-well);padding:0.65rem 0.8rem}
.flagbanner .warnicon{color:#e0314d;font-size:1rem;line-height:1.2;flex-shrink:0}
.flagbanner strong{display:block;font-size:0.85rem}
.flagbanner .warnsub{color:var(--ink-muted);font-size:0.75rem}
.flagbanner.plain{background:none;border:1px dashed var(--ring);color:var(--ink-muted);font-family:var(--font-ui);font-size:0.66rem;letter-spacing:0.08em;text-transform:uppercase;padding:0.55rem 0.8rem}
.emptybox{width:min(100%,36rem);text-align:center;color:var(--ink-muted);font-size:0.9rem;padding:1.6rem 1rem;border:1px dashed var(--ring);border-radius:var(--radius-well)}
.rowaction{display:flex;justify-content:center;width:min(100%,36rem);margin-bottom:0.6rem}
.rowaction form{margin:0}
.rowaction button{min-height:2.1rem;padding:0.3rem 1.1rem;font-size:0.8rem}
label.field{display:flex;flex-direction:column;gap:0.3rem;font-family:var(--font-ui);font-size:0.62rem;letter-spacing:0.08em;text-transform:uppercase;color:var(--ink-muted)}
`;

/** A thread row in a folder listing — the whole row is one link. */
function threadRow(
  ctx: MiniAppContext,
  thread: AgentMailThread,
  from: string,
  q: string | null,
  blocked: Set<string>
): string {
  const labels = thread.labels ?? [];
  const unread = labels.includes("unread");
  const first = thread.participants?.[0] ?? thread.senders?.[0] ?? "?";
  const who = first.split("@")[0] || "?";
  const isBlocked = first.includes("@") && blocked.has(first.toLowerCase());
  const badges = [
    isBlocked ? `<span class="chip">Blocked</span>` : "",
    labels.includes("spam") ? `<span class="chip">Spam</span>` : "",
    thread.deleted_at ? `<span class="chip">Trash</span>` : "",
  ]
    .filter(Boolean)
    .join(" ");
  const params = new URLSearchParams({ thread: thread.thread_id });
  params.set("from", from);
  if (q) params.set("q", q);
  const count = thread.message_count ?? 1;
  const preview = [thread.subject ?? "(no subject)", thread.preview ?? ""]
    .filter(Boolean)
    .join(" — ");
  return `<a class="mailrow${unread ? " unread" : ""}" href="${ctx.basePath}?${params}">
    <span class="who">${avatarHtml(who, first)}${unread ? `<span class="unread-dot" aria-label="unread"></span>` : ""}</span>
    <span class="meta">
      <span class="topline"><span class="name">${esc(displayName(first))}</span><span class="when">${esc(mailWhen(thread.last_message_at ?? thread.updated_at))}</span></span>
      <span class="prev">${esc(preview)} ${badges}</span>
    </span>
    ${count > 1 ? `<span class="countpill">${count}</span>` : ""}
  </a>`;
}

/** A sent-message row — sent mail lists flat messages, not threads. */
function sentRow(
  ctx: MiniAppContext,
  message: AgentMailMessage,
  from: string
): string {
  const to = (message.to ?? [])[0] ?? "?";
  const params = new URLSearchParams({ thread: message.thread_id ?? "" });
  params.set("from", from);
  const href = message.thread_id
    ? `${ctx.basePath}?${params}`
    : `${ctx.basePath}?folder=sent`;
  return `<a class="mailrow" href="${href}">
    <span class="who">${avatarHtml(to.split("@")[0] || "?", to)}</span>
    <span class="meta">
      <span class="topline"><span class="name">${esc(displayName(to))}</span><span class="when">${esc(mailWhen(message.created_at ?? message.updated_at))}</span></span>
      <span class="prev">${esc(message.subject ?? "(no subject)")}</span>
    </span>
  </a>`;
}

/** A draft row → `?draft=` editor. */
function draftRow(ctx: MiniAppContext, draft: AgentMailDraft): string {
  const to = (draft.to ?? [])[0] ?? "(no recipient)";
  return `<a class="mailrow" href="${ctx.basePath}?${new URLSearchParams({ draft: draft.draft_id })}">
    <span class="who">${avatarHtml(to.split("@")[0] || "?", to)}</span>
    <span class="meta">
      <span class="topline"><span class="name">${esc(displayName(to))}</span><span class="when">${esc(mailWhen(draft.updated_at ?? draft.created_at))}</span></span>
      <span class="prev">${esc(draft.subject ?? "(no subject)")}${draft.labels?.includes("spam") ? ' <span class="chip">Spam</span>' : ""}</span>
    </span>
  </a>`;
}

function mailWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();
  if (sameDay) {
    return date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });
  }
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}

/** Message-card timestamp — "Today, 10:48 AM" / "Yesterday, 5:30 PM" /
 * "Oct 3, 9:12 AM". */
function mailWhenFull(iso: string | null | undefined): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
  const now = new Date();
  const dayMs = 86_400_000;
  const startOf = (d: Date) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const deltaDays = Math.round((startOf(now) - startOf(date)) / dayMs);
  if (deltaDays === 0) return `Today, ${time}`;
  if (deltaDays === 1) return `Yesterday, ${time}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return `${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(sameYear ? {} : { year: "numeric" }),
  })}, ${time}`;
}

/** Display name from an address header: `"Name <n@x>"` → `Name`,
 * bare email → local part. */
function displayName(header: string | undefined): string {
  const raw = (header ?? "").trim();
  const named = raw.match(/^(?:"([^"]+)"|([^<"']+?))\s*</);
  const name = (named?.[1] ?? named?.[2] ?? "").trim();
  if (name) return name;
  return raw.split("@")[0] || "?";
}

/** Shared fetch: the primary agent inbox's provider id plus the address
 * string (used to exclude own address from reply-all cc). */
async function primaryInbox(
  ctx: MiniAppContext
): Promise<{ inboxId: string; address: string } | null> {
  const { data: row } = await ctx.supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id,address")
    .eq("user_id", ctx.session.userId)
    .eq("is_primary", true)
    .is("retired_at", null)
    .maybeSingle();
  if (!row?.agentmail_inbox_id) return null;
  return { inboxId: row.agentmail_inbox_id as string, address: (row.address as string) ?? "" };
}

function emailOf(header: string | undefined): string {
  const match = header?.match(/<([^>]+)>/);
  return (match?.[1] ?? header ?? "").trim().toLowerCase();
}

async function blockedAddresses(ctx: MiniAppContext): Promise<Set<string>> {
  const { data } = await ctx.supabase
    .from("senders")
    .select("address")
    .eq("user_id", ctx.session.userId)
    .eq("platform", "email")
    .not("blocked_at", "is", null);
  return new Set(
    (data ?? []).map((row) => (row.address as string).toLowerCase())
  );
}

interface PendingReview {
  decisionId: string;
  draftId: string;
  to: string;
  subject: string;
}

/** Drafts waiting on a Needs-you decision — shown as review cards on the
 * inbox and marked on the drafts folder. */
async function pendingDraftReviews(
  ctx: MiniAppContext,
  inboxId: string
): Promise<PendingReview[]> {
  const { data: decisions } = await ctx.supabase
    .from("decisions")
    .select("id,ref,payload")
    .eq("user_id", ctx.session.userId)
    .eq("kind", "email_draft")
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(10);
  const reviews: PendingReview[] = [];
  for (const decision of decisions ?? []) {
    const ref = typeof decision.ref === "string" ? decision.ref : "";
    if (!ref) continue;
    let to = "";
    let subject = "";
    try {
      const draft = await getDraft(inboxId, ref);
      to = draft.to?.[0] ?? "";
      subject = draft.subject ?? "";
    } catch {
      continue;
    }
    reviews.push({ decisionId: decision.id as string, draftId: ref, to, subject });
  }
  return reviews;
}

function renderReviews(reviews: PendingReview[]): string {
  if (reviews.length === 0) return "";
  return `<div class="panel"><h2>Needs you</h2>${reviews
    .map(
      (r) => `<div class="card pending">
      <div class="muted">Draft to ${esc(r.to)}</div>
      <div>${esc(r.subject || "(no subject)")}</div>
      <form class="inline" method="post">
        <input type="hidden" name="action" value="approve_draft">
        <input type="hidden" name="decision" value="${esc(r.decisionId)}">
        <button type="submit">Approve &amp; send</button>
      </form>
      <form class="inline" method="post">
        <input type="hidden" name="action" value="dismiss_draft">
        <input type="hidden" name="decision" value="${esc(r.decisionId)}">
        <input type="hidden" name="return" value="?folder=drafts">
        <button type="submit" class="ghost">Discard</button>
      </form>
    </div>`
    )
    .join("")}</div>`;
}

/** "Flagged by organization rules" banner — spec §5 spam treatment,
 * styled as a warning card. `.plain` variant for the trash note. */
function flagBanner(): string {
  return `<div class="flagbanner"><span class="warnicon" aria-hidden="true">⚠</span><span><strong>Flagged by your organization rules</strong><span class="warnsub">Email content matches the prevalent spam patterns.</span></span></div>`;
}

function plainBanner(text: string): string {
  return `<div class="flagbanner plain">${esc(text)}</div>`;
}

/** Folder chip row — `.chip` / `.chip.on` from the shell, plus the Compose
 * affordance and a search field on the right end. */
function mailBar(ctx: MiniAppContext, current: Folder, q: string | null) {
  const chips = FOLDERS.map(
    (f) =>
      `<a class="chip${f === current && !q ? " on" : ""}" href="${ctx.basePath}?folder=${f}">${FOLDER_LABELS[f]}</a>`
  ).join("");
  return `<div class="mailsearch">
      <form method="get" action="${ctx.basePath}">
        <input type="text" name="q" value="${esc(q ?? "")}" placeholder="Search mail" aria-label="Search mail">
      </form>
    </div>
    <div class="mailbar">
    ${chips}
    <span class="mailbar-end">
      <a class="chip" href="${ctx.basePath}?compose=1">+ Compose</a>
    </span>
  </div>`;
}

function emptyBox(text: string): string {
  return `<div class="emptybox">${esc(text)}</div>`;
}

const EMPTY_COPY: Record<Folder, string> = {
  inbox: "Inbox is empty. Nothing waits.",
  unread: "Nothing unread.",
  drafts: "No drafts.",
  sent: "Nothing sent yet.",
  spam: "Spam is empty. Nice.",
  trash: "Trash is empty.",
};

/* ------------------------------------------------------------------------
 * Render
 * ---------------------------------------------------------------------- */

export const inbox: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") return forbidden("this view is owner-only");
    const url = new URL(ctx.request.url);
    const lite = ctx.session.via === "card";

    const inbox = await primaryInbox(ctx);
    if (!inbox) {
      return shellHtml(
        renderShell({
          title: "Inbox",
          kicker: "Mail",
          lite,
          body: `<div class="panel"><p class="muted">No inbox is provisioned yet.</p></div>`,
        })
      );
    }

    // Attachment bytes pass through the same authenticated gate that renders
    // mail — never a provider URL in markup.
    const messageForAttachment = url.searchParams.get("message");
    const attachmentId = url.searchParams.get("attachment");
    if (messageForAttachment && attachmentId) {
      return serveAttachment(inbox.inboxId, messageForAttachment, attachmentId);
    }

    const folder = folderOf(url.searchParams.get("folder"));
    const query = url.searchParams.get("q")?.slice(0, 200) ?? null;
    const pageToken = url.searchParams.get("page_token") ?? undefined;
    const from = url.searchParams.get("from");
    const notice = url.searchParams.get("notice") ?? "";

    if (lite) {
      return renderLite(ctx, inbox, url.searchParams);
    }

    // `?compose=1&mode=reply&thread=…` carries a thread id for prefill —
    // compose must dispatch before thread or reply links re-render the thread.
    if (url.searchParams.get("compose")) {
      return renderCompose(ctx, inbox, url.searchParams, notice);
    }
    const threadId = url.searchParams.get("thread");
    if (threadId) {
      return renderThread(ctx, inbox, threadId, from, query, notice);
    }
    const draftId = url.searchParams.get("draft");
    if (draftId) {
      return renderDraft(ctx, inbox, draftId, notice);
    }
    if (query) {
      return renderSearch(ctx, inbox, query, pageToken, notice);
    }
    return renderFolder(ctx, inbox, folder, pageToken, notice);
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") return forbidden("this view is owner-only");
    const action = String(form.get("action") ?? "");

    // The prompt bar stays; air_draft is the structured sibling.
    if (action === "prompt") {
      await runPrompt(ctx, String(form.get("text") ?? ""));
      return backTo(ctx, safeReturn(form.get("return"), "?folder=inbox"));
    }
    if (action === "air_draft") return airDraftAction(ctx, form);

    const inbox = await primaryInbox(ctx);
    if (!inbox) return notFound();

    const ret = safeReturn(form.get("return"), "?folder=inbox");
    const back = (notice: string) =>
      backTo(ctx, `${ret}${ret.includes("?") ? "&" : "?"}notice=${encodeURIComponent(notice)}`);

    switch (action) {
      case "approve_draft":
      case "dismiss_draft":
        return draftDecisionAction(ctx, form, back);
      case "compose":
        return composeAction(ctx, inbox.inboxId, form, back);
      case "mark_read":
      case "mark_unread":
        return markAction(ctx, inbox.inboxId, form, action === "mark_read", back);
      case "spam":
      case "not_spam":
        return spamAction(ctx, inbox.inboxId, form, action === "spam", back);
      case "block_sender":
      case "unblock_sender":
        return blockAction(ctx, inbox.inboxId, form, action === "block_sender", back);
      case "trash_thread":
      case "restore_thread":
        return trashThreadAction(ctx, inbox.inboxId, form, action === "trash_thread", back);
      case "trash_message":
      case "restore_message":
        return trashMessageAction(ctx, inbox.inboxId, form, action === "trash_message", back);
      case "draft_update":
        return draftUpdateAction(ctx, inbox.inboxId, form, back);
      case "draft_delete":
        return draftDeleteAction(ctx, inbox.inboxId, form, back);
      case "draft_send":
        return draftSendAction(ctx, inbox.inboxId, form, back);
      case "empty_spam":
        return emptySpamAction(ctx, inbox.inboxId, back);
      default:
        return backTo(ctx, ret);
    }
  },
};

function backTo(ctx: MiniAppContext, target: string): NextResponse {
  return withBaseHeaders(
    NextResponse.redirect(
      new URL(`${ctx.basePath}${target}`, externalOrigin(ctx.request)),
      303
    )
  );
}

function isUnsupported(error: unknown): boolean {
  return error instanceof MailApiError && error.status === 501;
}

/* ------------------------------------------------------------------------
 * Folder views
 * ---------------------------------------------------------------------- */

async function renderFolder(
  ctx: MiniAppContext,
  inbox: { inboxId: string; address: string },
  folder: Folder,
  pageToken: string | undefined,
  notice: string
): Promise<NextResponse> {
  const blocked = await blockedAddresses(ctx);
  let rows = "";
  let nextToken: string | null | undefined;
  let banner = "";
  let footnote = "";

  if (folder === "drafts") {
    const drafts = (await listDrafts(inbox.inboxId)).filter(
      (d) => !d.sent_message_id
    );
    // Pending drafts render as review cards; their rows are redundant.
    const pending = await pendingDraftReviews(ctx, inbox.inboxId);
    const pendingIds = new Set(pending.map((p) => p.draftId));
    rows =
      renderReviews(pending) +
      drafts
        .filter((d) => !pendingIds.has(d.draft_id))
        .map((d) => draftRow(ctx, d))
        .join("");
  } else if (folder === "sent") {
    try {
      const page = await listMessages(inbox.inboxId, {
        labels: ["sent"],
        limit: PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
      });
      nextToken = page.next_page_token;
      rows = page.messages.map((m) => sentRow(ctx, m, folder)).join("");
    } catch (error) {
      if (!isUnsupported(error)) throw error;
      rows = emptyBox("Sent isn't supported by this mail provider.");
      return finishFolder(ctx, folder, notice, rows, banner, footnote);
    }
  } else {
    const labels = FOLDER_LABELS_MAP[folder];
    let page;
    try {
      page = await listThreadsFiltered(inbox.inboxId, {
        limit: PAGE_SIZE,
        ...(pageToken ? { pageToken } : {}),
        ...(folder === "trash" ? { folder: "trash" as const } : {}),
        ...(labels.length ? { labels } : {}),
      });
    } catch (error) {
      if (!isUnsupported(error)) throw error;
      rows = emptyBox("This folder isn't supported by the mail provider.");
      return finishFolder(ctx, folder, notice, rows, banner, footnote);
    }
    nextToken = page.next_page_token;
    let threads = page.threads;
    // Inbox excludes spam-flagged threads regardless of API-side filtering.
    if (folder === "inbox") {
      threads = threads.filter((t) => !(t.labels ?? []).includes("spam"));
    }
    rows = threads
      .map((t) => threadRow(ctx, t, folder, null, blocked))
      .join("");
    if (folder === "spam") {
      banner = flagBanner() + (threads.length
        ? `<div class="rowaction"><form class="inline" method="post"><input type="hidden" name="action" value="empty_spam"><input type="hidden" name="return" value="?folder=spam"><button type="submit" class="ghost">Empty Spam</button></form></div>`
        : "");
    }
    if (folder === "trash") {
      footnote = `<p class="muted" style="text-align:center">Trash purges after 30 days.</p>`;
    }
    if (folder === "inbox") {
      const pending = await pendingDraftReviews(ctx, inbox.inboxId);
      rows = renderReviews(pending) + rows;
    }
  }

  if (!rows) rows = emptyBox(EMPTY_COPY[folder]);

  const more =
    nextToken != null
      ? `<a class="navlink" href="${ctx.basePath}?folder=${folder}&page_token=${encodeURIComponent(nextToken)}">Older mail</a>`
      : "";

  return finishFolder(ctx, folder, notice, rows + footnote + more, banner, "");
}

const FOLDER_LABELS_MAP: Record<Folder, string[]> = {
  inbox: [],
  unread: ["unread"],
  drafts: [],
  sent: [],
  spam: ["spam"],
  trash: [],
};

function finishFolder(
  ctx: MiniAppContext,
  folder: Folder,
  notice: string,
  rows: string,
  banner: string,
  _extra: string
): NextResponse {
  const folderIndex = FOLDERS.indexOf(folder);
  const prev = folderIndex > 0 ? FOLDERS[folderIndex - 1] : undefined;
  const next = folderIndex < FOLDERS.length - 1 ? FOLDERS[folderIndex + 1] : undefined;
  return shellHtml(
    renderShell({
      title: "Inbox",
      kicker: "Mail",
      notice,
      body:
        `<style>${MAIL_CSS}</style>` +
        mailBar(ctx, folder, null) +
        banner +
        `<div class="mailrows">${rows}</div>` +
        promptBar("Ask Air about your mail…"),
      swipe: {
        ...(prev ? { prev: `${ctx.basePath}?folder=${prev}` } : {}),
        ...(next ? { next: `${ctx.basePath}?folder=${next}` } : {}),
      },
    })
  );
}

async function renderSearch(
  ctx: MiniAppContext,
  inbox: { inboxId: string; address: string },
  query: string,
  pageToken: string | undefined,
  notice: string
): Promise<NextResponse> {
  const blocked = await blockedAddresses(ctx);
  let rows = "";
  try {
    const page = await searchThreads(inbox.inboxId, query, {
      limit: PAGE_SIZE,
      ...(pageToken ? { pageToken } : {}),
    });
    rows = page.threads
      .map((t) => threadRow(ctx, t, "search", query, blocked))
      .join("");
    if (!rows) rows = emptyBox(`No mail matches “${query}”.`);
    const more =
      page.next_page_token != null
        ? `<a class="navlink" href="${ctx.basePath}?q=${encodeURIComponent(query)}&page_token=${encodeURIComponent(page.next_page_token)}">Older mail</a>`
        : "";
    rows += more;
  } catch (error) {
    if (!isUnsupported(error)) throw error;
    rows = emptyBox("Search isn't supported by this mail provider.");
  }
  return shellHtml(
    renderShell({
      title: "Inbox",
      kicker: "Mail",
      notice,
      body:
        `<style>${MAIL_CSS}</style>` +
        mailBar(ctx, "inbox", query) +
        `<div class="mailrows">${rows}</div>`,
      swipe: { prev: `${ctx.basePath}?folder=inbox` },
    })
  );
}

/* ------------------------------------------------------------------------
 * Thread view
 * ---------------------------------------------------------------------- */

async function renderThread(
  ctx: MiniAppContext,
  inbox: { inboxId: string; address: string },
  threadId: string,
  from: string | null,
  q: string | null,
  notice: string,
  lite = false
): Promise<NextResponse> {
  let thread: AgentMailThreadDetail;
  try {
    thread = await getThread(inbox.inboxId, threadId);
  } catch {
    return shellHtml(
      renderShell({
        title: "Inbox",
        kicker: "Mail",
        lite,
        body: `<div class="panel"><p class="muted">This thread is gone.</p></div>`,
      })
    );
  }
  const messages = thread.messages ?? [];
  const labels = thread.labels ?? [];
  const trashed = Boolean(thread.deleted_at) || from === "trash";
  const spam = labels.includes("spam") || from === "spam";

  // Opening a thread marks it read — per-message `read:true` plus the
  // thread-level `unread` label (wzrdmail accumulates them separately).
  // Best-effort: failures must not fail the render.
  const unreadIds = messages
    .filter((m) => (m.labels ?? []).includes("unread"))
    .map((m) => m.message_id);
  if (unreadIds.length > 0 || labels.includes("unread")) {
    const marks: Promise<unknown>[] = unreadIds.map((id) =>
      patchMessage(inbox.inboxId, id, { read: true })
    );
    if (labels.includes("unread")) {
      marks.push(
        patchThread(inbox.inboxId, threadId, { remove_labels: ["unread"] })
      );
    }
    await Promise.allSettled(marks);
  }

  const blocked = await blockedAddresses(ctx);
  const lastInbound = [...messages].reverse().find((m) => m.direction !== "outbound");
  const replyTarget = emailOf(lastInbound?.from ?? messages[messages.length - 1]?.from);
  const isBlocked = replyTarget !== "" && blocked.has(replyTarget);
  const backLink = backHref(ctx, from, q);
  const ret = `?thread=${encodeURIComponent(threadId)}&from=${encodeURIComponent(from ?? "inbox")}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
  // Mark unread must land on the folder: staying on the thread view would
  // re-render renderThread, whose mark-read-on-open undoes the action.
  const unreadRet = backLink.slice(ctx.basePath.length);

  const toolbar = lite
    ? ""
    : `<div class="toolbar">
      ${toolButton(ctx, unreadRet, "mark_unread", { thread: threadId }, "Mark unread")}
      ${spam
        ? toolButton(ctx, ret, "not_spam", { thread: threadId }, "Not spam")
        : toolButton(ctx, ret, "spam", { thread: threadId }, "Spam")}
      ${replyTarget && (isBlocked
        ? toolButton(ctx, ret, "unblock_sender", { thread: threadId, sender: replyTarget }, "Unblock sender")
        : toolButton(ctx, ret, "block_sender", { thread: threadId, sender: replyTarget }, "Block sender"))}
      ${trashed
        ? toolButton(ctx, ret, "restore_thread", { thread: threadId }, "Restore")
        : toolButton(ctx, ret, "trash_thread", { thread: threadId }, "Trash")}
      <a class="chip" href="${ctx.basePath}?compose=1&mode=reply&thread=${encodeURIComponent(threadId)}&from=${encodeURIComponent(from ?? "inbox")}">Reply</a>
      <a class="chip" href="${ctx.basePath}?compose=1&mode=reply_all&thread=${encodeURIComponent(threadId)}&from=${encodeURIComponent(from ?? "inbox")}">Reply all</a>
      <a class="chip" href="${ctx.basePath}?compose=1&mode=forward&thread=${encodeURIComponent(threadId)}&from=${encodeURIComponent(from ?? "inbox")}">Forward</a>
      ${toolButton(ctx, ret, "air_draft", { thread: threadId, brief: "", sender: replyTarget }, "Ask Air to reply")}
    </div>`;

  const body =
    `<style>${MAIL_CSS}</style>` +
    `<div class="toolbar"><a class="navlink" href="${backLink}">← ${esc(FOLDER_LABELS[folderOf(from)] ?? "Back")}</a></div>` +
    (spam ? flagBanner() : "") +
    (trashed ? plainBanner("In trash — purges after 30 days") : "") +
    toolbar +
    `<h3 class="threadtitle">${esc(thread.subject ?? "(no subject)")}</h3>` +
    messages.map((m) => renderMessage(ctx, inbox.inboxId, m, ret, FOLDER_LABELS[folderOf(from)] ?? "Inbox", lite)).join("") +
    (lite
      ? liteReplyForm(ctx, messages[messages.length - 1]?.message_id ?? "", ret)
      : "");

  return shellHtml(
    renderShell({
      title: thread.subject ?? "Thread",
      kicker: "Mail",
      notice,
      lite,
      body,
      swipe: { prev: backLink },
    })
  );
}

/** A single `form.inline` POST pill for the thread toolbar. */
function toolButton(
  _ctx: MiniAppContext,
  ret: string,
  action: string,
  fields: Record<string, string>,
  label: string
): string {
  const hidden = Object.entries(fields)
    .map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`)
    .join("");
  return `<form class="inline" method="post"><input type="hidden" name="action" value="${action}"><input type="hidden" name="return" value="${esc(ret)}">${hidden}<button type="submit" class="ghost">${esc(label)}</button></form>`;
}

function renderMessage(
  ctx: MiniAppContext,
  _inboxId: string,
  message: AgentMailMessage,
  ret: string,
  folderLabel: string,
  lite = false
): string {
  const text = message.extracted_text ?? message.text ?? htmlToText(message.html ?? "");
  const attachments = renderAttachments(ctx, message);
  const msgAction = lite
    ? ""
    : message.deleted_at
      ? `<form class="inline" method="post"><input type="hidden" name="action" value="restore_message"><input type="hidden" name="return" value="${esc(ret)}"><input type="hidden" name="message" value="${esc(message.message_id)}"><button type="submit" class="ghost">Restore</button></form>`
      : `<form class="inline" method="post"><input type="hidden" name="action" value="trash_message"><input type="hidden" name="return" value="${esc(ret)}"><input type="hidden" name="message" value="${esc(message.message_id)}"><button type="submit" class="ghost">Delete</button></form>`;
  const sender = message.from ?? "unknown";
  const name = displayName(sender);
  const meta = `${mailWhenFull(message.created_at)}${folderLabel ? ` · ${folderLabel}` : ""}`;
  return `<div class="msgcard">
    <div class="msghead">${avatarHtml(name, sender)}<span class="mwho"><span class="name">${esc(name)}</span><span class="meta">${esc(meta)}<br><span class="tome">to Me</span></span></span></div>
    <div class="msgbody">${esc(text)}</div>
    ${attachments}
    ${msgAction ? `<div class="msgactions">${msgAction}</div>` : ""}
  </div>`;
}

/** Lite (card) thread view reply — draft + review decision only. The
 * in_reply_to anchor is a message id, matching the provider contract. */
function liteReplyForm(
  _ctx: MiniAppContext,
  lastMessageId: string,
  ret: string
): string {
  if (!lastMessageId) return "";
  return `<form class="stack" method="post">
    <input type="hidden" name="action" value="compose">
    <input type="hidden" name="intent" value="draft">
    <input type="hidden" name="in_reply_to" value="${esc(lastMessageId)}">
    <input type="hidden" name="return" value="${esc(ret)}">
    <label class="field">Reply<textarea name="text" rows="3" required></textarea></label>
    <button type="submit">Draft reply</button>
  </form>`;
}

function renderAttachments(ctx: MiniAppContext, message: AgentMailMessage): string {
  const files = message.attachments ?? [];
  if (files.length === 0) return "";
  return `<div class="row" style="margin-top:0.4rem">${files
    .map((a: AgentMailAttachment) => {
      const params = new URLSearchParams({
        message: message.message_id,
        attachment: a.attachment_id,
      });
      return `<a class="chip" href="${esc(`${ctx.basePath}?${params}`)}">${esc(a.filename ?? "attachment")}</a>`;
    })
    .join("")}</div>`;
}

/* ------------------------------------------------------------------------
 * Drafts
 * ---------------------------------------------------------------------- */

async function renderDraft(
  ctx: MiniAppContext,
  inbox: { inboxId: string; address: string },
  draftId: string,
  notice: string
): Promise<NextResponse> {
  let draft: AgentMailDraft;
  try {
    draft = await getDraft(inbox.inboxId, draftId);
  } catch {
    return shellHtml(
      renderShell({
        title: "Inbox",
        kicker: "Mail",
        body: `<style>${MAIL_CSS}</style>${mailBar(ctx, "drafts", null)}${emptyBox("This draft is gone.")}`,
        swipe: { prev: `${ctx.basePath}?folder=drafts` },
      })
    );
  }
  const ret = `?draft=${encodeURIComponent(draftId)}`;
  const sent = Boolean(draft.sent_message_id);
  const pending = await pendingDraftReviews(ctx, inbox.inboxId);
  const isPending = pending.some((p) => p.draftId === draftId);

  const body =
    `<style>${MAIL_CSS}</style>` +
    mailBar(ctx, "drafts", null) +
    (sent
      ? emptyBox("This draft was already sent.")
      : `<div class="panel"><h2>${isPending ? "Needs you — pending review" : "Draft"}</h2>
      <form class="stack" method="post">
        <input type="hidden" name="action" value="draft_update">
        <input type="hidden" name="draft" value="${esc(draftId)}">
        <input type="hidden" name="return" value="${esc(ret)}">
        <label class="field">To<input type="text" name="to" value="${esc((draft.to ?? []).join(", "))}"></label>
        <label class="field">Cc<input type="text" name="cc" value="${esc((draft.cc ?? []).join(", "))}"></label>
        <label class="field">Subject<input type="text" name="subject" value="${esc(draft.subject ?? "")}"></label>
        <label class="field">Body<textarea name="text" rows="8">${esc(draft.text ?? "")}</textarea></label>
        <div class="row actions"><button type="submit">Save</button></div>
      </form>
      <div class="toolbar">
        ${toolButton(ctx, ret, "draft_send", { draft: draftId }, "Approve & send")}
        ${toolButton(ctx, "?folder=drafts", "draft_delete", { draft: draftId }, "Delete draft")}
      </div>
      ${isPending ? `<p class="muted">Pending review — approving sends through the Needs-you decision.</p>` : ""}
    </div>`);

  return shellHtml(
    renderShell({
      title: "Draft",
      kicker: "Mail",
      notice,
      body,
      swipe: { prev: `${ctx.basePath}?folder=drafts` },
    })
  );
}

/* ------------------------------------------------------------------------
 * Compose
 * ---------------------------------------------------------------------- */

/** Prefill for reply / reply-all / forward anchored to a thread. */
async function composePrefill(
  _ctx: MiniAppContext,
  inbox: { inboxId: string; address: string },
  threadId: string | null,
  mode: string | null
): Promise<{ to: string; cc: string; subject: string; text: string; inReplyTo: string }> {
  const blank = { to: "", cc: "", subject: "", text: "", inReplyTo: "" };
  if (!threadId || !mode) return blank;
  let thread: AgentMailThreadDetail;
  try {
    thread = await getThread(inbox.inboxId, threadId);
  } catch {
    return blank;
  }
  const messages = thread.messages ?? [];
  const lastInbound = [...messages].reverse().find((m) => m.direction !== "outbound");
  const last = lastInbound ?? messages[messages.length - 1];
  if (!last) return blank;
  const subject = thread.subject ?? last.subject ?? "";
  const reSubject = subject.startsWith("Re:") ? subject : `Re: ${subject}`;
  if (mode === "forward") {
    const fwdSubject = subject.startsWith("Fwd:") ? subject : `Fwd: ${subject}`;
    const quoted = `\n\n---------- Forwarded message ----------\nFrom: ${last.from ?? ""}\nSubject: ${subject}\n\n${last.extracted_text ?? last.text ?? ""}`;
    return { to: "", cc: "", subject: fwdSubject, text: quoted, inReplyTo: "" };
  }
  const to = emailOf(last.from);
  const own = inbox.address.toLowerCase();
  const cc =
    mode === "reply_all"
      ? [...(last.to ?? []), ...(last.cc ?? [])]
          .map(emailOf)
          .filter((a) => a && a !== own && a !== to)
          .join(", ")
      : "";
  return { to, cc, subject: reSubject, text: "", inReplyTo: last.message_id };
}

async function renderCompose(
  ctx: MiniAppContext,
  inbox: { inboxId: string; address: string },
  params: URLSearchParams,
  notice: string
): Promise<NextResponse> {
  const threadId = params.get("thread");
  const mode = params.get("mode");
  const prefill = await composePrefill(ctx, inbox, threadId, mode);
  const ret = threadId
    ? `?thread=${encodeURIComponent(threadId)}&from=${encodeURIComponent(params.get("from") ?? "inbox")}`
    : "?folder=inbox";
  const heading =
    mode === "reply" ? "Reply" : mode === "reply_all" ? "Reply all" : mode === "forward" ? "Forward" : "Compose";

  const body =
    `<style>${MAIL_CSS}</style>` +
    mailBar(ctx, "inbox", null) +
    `<div class="panel"><h2>${heading}</h2>
    <form class="stack" method="post">
      <input type="hidden" name="action" value="compose">
      <input type="hidden" name="return" value="${esc(ret)}">
      <input type="hidden" name="in_reply_to" value="${esc(prefill.inReplyTo)}">
      ${threadId ? `<input type="hidden" name="thread" value="${esc(threadId)}">` : ""}
      <label class="field">To<input type="text" name="to" value="${esc(prefill.to)}" placeholder="name@example.com"></label>
      <label class="field">Cc<input type="text" name="cc" value="${esc(prefill.cc)}"></label>
      <label class="field">Subject<input type="text" name="subject" value="${esc(prefill.subject)}"></label>
      <label class="field">${mode === null ? "Body or brief" : "Body"}<textarea name="text" rows="8">${esc(prefill.text)}</textarea></label>
      <div class="row actions">
        <button type="submit" name="intent" value="draft">Save draft</button>
        <button type="submit" name="intent" value="send">Send now</button>
        <button type="submit" name="intent" value="air" class="ghost">Draft with Air</button>
      </div>
    </form></div>`;

  return shellHtml(
    renderShell({
      title: "Inbox",
      kicker: "Mail",
      notice,
      body,
      swipe: { prev: backHref(ctx, params.get("from"), null) },
    })
  );
}

/* ------------------------------------------------------------------------
 * Lite (card) reduced surface — inbox + thread + approve/discard only.
 * ---------------------------------------------------------------------- */

async function renderLite(
  ctx: MiniAppContext,
  inbox: { inboxId: string; address: string },
  params: URLSearchParams
): Promise<NextResponse> {
  const threadId = params.get("thread");
  if (threadId) {
    return renderThread(ctx, inbox, threadId, "inbox", null, "", true);
  }
  const pending = await pendingDraftReviews(ctx, inbox.inboxId);
  const page = await listThreadsFiltered(inbox.inboxId, { limit: PAGE_SIZE }).catch(
    () => ({ threads: [] as AgentMailThread[] })
  );
  const blocked = await blockedAddresses(ctx);
  const rows =
    renderReviews(pending) +
    page.threads
      .filter((t) => !(t.labels ?? []).includes("spam"))
      .map((t) => threadRow(ctx, t, "inbox", null, blocked))
      .join("");
  return shellHtml(
    renderShell({
      title: "Inbox",
      kicker: "Mail",
      lite: true,
      body:
        `<style>${MAIL_CSS}</style>` +
        (rows ? `<div class="mailrows">${rows}</div>` : emptyBox(EMPTY_COPY.inbox)),
      swipe: {},
    })
  );
}

/* ------------------------------------------------------------------------
 * Actions
 * ---------------------------------------------------------------------- */

/** Needs-you cards: resolve the email_draft decision through the one send
 * path (approve) or discard it. */
async function draftDecisionAction(
  ctx: MiniAppContext,
  form: FormData,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const decisionId = String(form.get("decision") ?? "");
  const approve = String(form.get("action")) === "approve_draft";
  try {
    await resolveEmailDraftDecision(
      ctx.supabase,
      ctx.session.userId,
      decisionId,
      approve
    );
    return back(approve ? "Email sent." : "Draft dismissed.");
  } catch (error) {
    if (error instanceof EmailDraftError) {
      return back("Couldn't send that draft.");
    }
    throw error;
  }
}

/** Compose submit — intent=draft|send|air. "Send now" still files the
 * draft + decision and resolves it through the single control-plane path. */
async function composeAction(
  ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const intent = String(form.get("intent") ?? "draft");
  const to = String(form.get("to") ?? "").trim();
  const cc = String(form.get("cc") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim();
  const text = String(form.get("text") ?? "").trim();
  const inReplyTo = String(form.get("in_reply_to") ?? "").trim();
  const threadId = String(form.get("thread") ?? "");

  if (intent === "air") {
    return launchAirDraft(ctx, {
      to,
      subject,
      threadId,
      brief: text || subject,
    }, back);
  }

  if (!to && !inReplyTo) return back("Add a recipient first.");
  if (!text) return back("Write something first.");

  let draftId: string;
  try {
    draftId = await createDraft(inboxId, {
      ...(to ? { to: to.split(",").map((s) => s.trim()).filter(Boolean) } : {}),
      ...(subject ? { subject } : {}),
      text,
      ...(inReplyTo ? { in_reply_to: inReplyTo } : {}),
    });
    // cc rides a PATCH — createDraft's contract is to/subject/text/thread.
    if (cc) {
      await updateDraft(inboxId, draftId, {
        cc: cc.split(",").map((s) => s.trim()).filter(Boolean),
      });
    }
  } catch {
    return back("Couldn't create the draft.");
  }
  await queueEmailDraftReview(ctx.supabase, ctx.session.userId, {
    draftId,
    to,
    subject,
  });
  if (intent === "send") {
    // File the decision, then resolve it — the decision row is the audit
    // trail and the send leaves through sendHeldDraft with the decision id
    // as the Idempotency-Key.
    const decision = await pendingDraftDecisionId(ctx, draftId);
    if (!decision) return back("Draft saved — approval didn't file; send it from Drafts.");
    try {
      await resolveEmailDraftDecision(
        ctx.supabase,
        ctx.session.userId,
        decision,
        true
      );
      return back("Email sent.");
    } catch (error) {
      if (error instanceof EmailDraftError) {
        return back("Draft saved — couldn't send it.");
      }
      throw error;
    }
  }
  return back("Draft saved — review it under Drafts or Needs-you.");
}

/** Find the freshly filed email_draft decision for a draft — createDecision
 * returns void, so the ref lookup is how send-now binds the audit row. */
async function pendingDraftDecisionId(
  ctx: MiniAppContext,
  draftId: string
): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("decisions")
    .select("id")
    .eq("user_id", ctx.session.userId)
    .eq("kind", "email_draft")
    .eq("ref", draftId)
    .is("resolved_at", null)
    .order("created_at", { ascending: false })
    .limit(1);
  return (data?.[0]?.id as string) ?? null;
}

/** Draft with Air / Ask Air to reply — one MAIN_SESSION run carrying the
 * structured instruction for the box's email-draft-review skill. */
async function launchAirDraft(
  ctx: MiniAppContext,
  input: { to?: string; subject?: string; brief: string; threadId?: string; sender?: string },
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const lines = [
    `Draft an email${input.threadId ? ` replying to thread ${input.threadId}` : ""}`,
    `to ${input.to || input.sender || "(choose from context)"} — subject: ${input.subject || "(derive)"}.`,
    `Owner's brief: ${input.brief || "(none — write an appropriate reply)"}`,
    "Create the draft via the mail MCP create_draft tool, then POST it to",
    "/api/email/drafts/review per your email-draft-review skill.",
  ];
  const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
  const run = await createRun(box.target, {
    input: lines.join("\n"),
    sessionId: MAIN_SESSION,
    metadata: {
      app: "inbox",
      surface: "miniapp",
      resource: ctx.session.resourceId,
      ...(input.threadId ? { thread_id: input.threadId } : {}),
      brief: input.brief.slice(0, 200),
    },
  });
  await ctx.supabase.from("agent_runs").insert({
    user_id: ctx.session.userId,
    hermes_run_id: run.run_id,
    trigger: "web",
  });
  await armStopAfter(ctx.supabase, ctx.session.userId).catch(() => undefined);
  return back("Air is drafting — it'll appear under Drafts / Needs-you.");
}

async function airDraftAction(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
  const ret = safeReturn(form.get("return"), "?folder=inbox");
  const back = (notice: string) =>
    backTo(ctx, `${ret}${ret.includes("?") ? "&" : "?"}notice=${encodeURIComponent(notice)}`);
  const inbox = await primaryInbox(ctx);
  if (!inbox) return notFound();
  return launchAirDraft(
    ctx,
    {
      threadId: String(form.get("thread") ?? ""),
      brief: String(form.get("brief") ?? ""),
      sender: String(form.get("sender") ?? ""),
    },
    back
  );
}

/** Mark read/unread — per-message `read` PATCH plus the thread label (the
 * thread's `unread` label only clears via a thread patch). */
async function markAction(
  _ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  markRead: boolean,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const threadId = String(form.get("thread") ?? "");
  try {
    const thread = await getThread(inboxId, threadId);
    const messages = thread.messages ?? [];
    if (markRead) {
      const unreadIds = messages
        .filter((m) => (m.labels ?? []).includes("unread"))
        .map((m) => m.message_id);
      await Promise.allSettled(
        unreadIds.map((id) => patchMessage(inboxId, id, { read: true }))
      );
      await patchThread(inboxId, threadId, { remove_labels: ["unread"] }).catch(
        () => undefined
      );
    } else {
      // Mark unread = the latest message re-flags, not every message.
      const last = messages[messages.length - 1];
      if (last) {
        await patchMessage(inboxId, last.message_id, { read: false }).catch(
          () => undefined
        );
      }
      await patchThread(inboxId, threadId, { add_labels: ["unread"] }).catch(
        () => undefined
      );
    }
  } catch (error) {
    if (!isUnsupported(error)) throw error;
  }
  return back(markRead ? "Marked read." : "Marked unread.");
}

/** Empty Spam — trash every spam-labeled thread on the current page
 * (bounded; the label is our own, replays are no-ops). */
async function emptySpamAction(
  _ctx: MiniAppContext,
  inboxId: string,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  try {
    const page = await listThreadsFiltered(inboxId, {
      limit: 50,
      labels: ["spam"],
    });
    await Promise.allSettled(
      page.threads.map((t) => trashThread(inboxId, t.thread_id))
    );
  } catch (error) {
    if (!isUnsupported(error)) throw error;
  }
  return back("Spam folder emptied.");
}

/** Move to spam / Not spam — thread patch plus batch label sync on its
 * messages. Not spam also records the sender as trusted. */
async function spamAction(
  ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  toSpam: boolean,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const threadId = String(form.get("thread") ?? "");
  try {
    const thread = await getThread(inboxId, threadId);
    const ids = (thread.messages ?? []).map((m) => m.message_id);
    const patch = toSpam
      ? { add_labels: ["spam"] }
      : { remove_labels: ["spam"] };
    await patchThread(inboxId, threadId, patch);
    await batchUpdateMessages(inboxId, ids, patch).catch(() => [] as string[]);
    if (!toSpam) {
      await markSenderTrusted(ctx, inboxId, thread);
    }
  } catch (error) {
    if (isUnsupported(error)) return back("This provider can't label mail.");
    throw error;
  }
  return back(toSpam ? "Moved to spam." : "Moved back to inbox.");
}

/** Not spam → upsert the sender as trusted (no blocked_at); if a provider
 * block exists, lift it first — the same order as /api/senders. */
async function markSenderTrusted(
  ctx: MiniAppContext,
  inboxId: string,
  thread: AgentMailThreadDetail
): Promise<void> {
  const from = emailOf(
    [...(thread.messages ?? [])].reverse().find((m) => m.direction !== "outbound")?.from ??
      thread.messages?.[0]?.from
  );
  if (!from) return;
  const { data: existing } = await ctx.supabase
    .from("senders")
    .select("id,blocked_at")
    .eq("user_id", ctx.session.userId)
    .eq("platform", "email")
    .eq("address", from)
    .maybeSingle();
  if (existing?.blocked_at) {
    await removeInboxBlockEntry(inboxId, from).catch(() => undefined);
  }
  await ctx.supabase.from("senders").upsert(
    {
      user_id: ctx.session.userId,
      platform: "email",
      address: from,
      trust_tier: 1,
      blocked_at: null,
    },
    { onConflict: "user_id,platform,address" }
  );
}

/** Block / unblock sender — provider block list first, then the senders
 * row, matching /api/senders (never record a block the provider rejected). */
async function blockAction(
  ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  block: boolean,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const sender = String(form.get("sender") ?? "").trim().toLowerCase();
  if (!sender || !sender.includes("@")) return back("No sender to block.");
  try {
    if (block) {
      await addInboxBlockEntry(inboxId, sender);
      await ctx.supabase.from("senders").upsert(
        {
          user_id: ctx.session.userId,
          platform: "email",
          address: sender,
          blocked_at: new Date().toISOString(),
        },
        { onConflict: "user_id,platform,address" }
      );
    } else {
      await removeInboxBlockEntry(inboxId, sender);
      await ctx.supabase
        .from("senders")
        .update({ blocked_at: null })
        .eq("user_id", ctx.session.userId)
        .eq("platform", "email")
        .eq("address", sender);
    }
  } catch (error) {
    if (isUnsupported(error)) return back("This provider can't block senders.");
    throw error;
  }
  return back(block ? "Sender blocked." : "Sender unblocked.");
}

async function trashThreadAction(
  _ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  trash: boolean,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const threadId = String(form.get("thread") ?? "");
  try {
    if (trash) {
      await trashThread(inboxId, threadId);
    } else {
      await restoreThread(inboxId, threadId);
    }
  } catch (error) {
    if (isUnsupported(error)) return back("This provider can't trash mail.");
    throw error;
  }
  return back(trash ? "Moved to trash." : "Restored.");
}

async function trashMessageAction(
  _ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  trash: boolean,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const messageId = String(form.get("message") ?? "");
  try {
    if (trash) {
      await trashMessage(inboxId, messageId);
    } else {
      await restoreMessage(inboxId, messageId);
    }
  } catch (error) {
    if (isUnsupported(error)) return back("This provider can't trash mail.");
    throw error;
  }
  return back(trash ? "Message trashed." : "Message restored.");
}

async function draftUpdateAction(
  _ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const draftId = String(form.get("draft") ?? "");
  const to = String(form.get("to") ?? "").trim();
  const cc = String(form.get("cc") ?? "").trim();
  const subject = String(form.get("subject") ?? "").trim();
  const text = String(form.get("text") ?? "");
  try {
    await updateDraft(inboxId, draftId, {
      to: to ? to.split(",").map((s) => s.trim()).filter(Boolean) : [],
      cc: cc ? cc.split(",").map((s) => s.trim()).filter(Boolean) : [],
      subject,
      text,
    });
  } catch (error) {
    if (isUnsupported(error)) return back("This provider can't edit drafts.");
    return back("Couldn't save that draft.");
  }
  return back("Draft saved.");
}

async function draftDeleteAction(
  _ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const draftId = String(form.get("draft") ?? "");
  try {
    await deleteDraft(inboxId, draftId);
  } catch (error) {
    if (isUnsupported(error)) return back("This provider can't delete drafts.");
    throw error;
  }
  return back("Draft deleted.");
}

/** Approve & send from the draft editor — file-or-reuse the email_draft
 * decision, then resolve it (the same single send path as the cards). */
async function draftSendAction(
  ctx: MiniAppContext,
  inboxId: string,
  form: FormData,
  back: (notice: string) => NextResponse
): Promise<NextResponse> {
  const draftId = String(form.get("draft") ?? "");
  let decisionId = await pendingDraftDecisionId(ctx, draftId);
  if (!decisionId) {
    let draft: AgentMailDraft | null = null;
    try {
      draft = await getDraft(inboxId, draftId);
    } catch {
      return back("This draft is gone.");
    }
    await queueEmailDraftReview(ctx.supabase, ctx.session.userId, {
      draftId,
      to: draft.to?.[0] ?? "",
      subject: draft.subject ?? "",
    });
    decisionId = await pendingDraftDecisionId(ctx, draftId);
  }
  if (!decisionId) return back("Couldn't file the approval.");
  try {
    await resolveEmailDraftDecision(
      ctx.supabase,
      ctx.session.userId,
      decisionId,
      true
    );
    return back("Email sent.");
  } catch (error) {
    if (error instanceof EmailDraftError) {
      return back("Couldn't send that draft.");
    }
    throw error;
  }
}

/* ------------------------------------------------------------------------
 * Attachments + text conversion — unchanged reduced-trust surface (I5).
 * ---------------------------------------------------------------------- */

async function serveAttachment(
  inboxId: string,
  messageId: string,
  attachmentId: string
): Promise<NextResponse> {
  const message = await getMessage(inboxId, messageId).catch(() => null);
  const meta = message?.attachments?.find(
    (a) => a.attachment_id === attachmentId
  );
  if (!meta) return notFound();
  const bytes = await getAttachmentBytes(inboxId, messageId, attachmentId);
  const contentType = /^[\w.+-]+\/[\w.+-]+$/.test(meta.content_type ?? "")
    ? meta.content_type!
    : "application/octet-stream";
  const filename = (meta.filename ?? "attachment").replace(/[^\w.\- ()]/g, "_");
  return withBaseHeaders(
    new NextResponse(new Uint8Array(bytes), {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    })
  );
}

/** Defensive HTML→text for providers without extracted_text: strip
 * script/style/noscript blocks, convert breaks, then entity-decode. */
function htmlToText(html: string): string {
  return html
    .replace(/<(script|style|noscript)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
