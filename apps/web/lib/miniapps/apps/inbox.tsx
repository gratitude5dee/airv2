/**
 * Mail inbox mini-app (MA6 #11): thread list → full thread view →
 * reply/compose as DRAFTS. C10 stays structural — this module never imports
 * a send call; composing creates a draft plus an email_draft Needs-you
 * decision, and the only send path remains the control-plane approval in
 * /api/decisions. That makes the same screen safe to open from an iMessage
 * card: the owner can write, review, and explicitly approve a send there.
 *
 * This is a reduced-trust surface: message HTML is converted to escaped text,
 * never emitted as provider HTML. Images are served only from the owner's
 * authenticated mail attachment route on this same mini-app origin; remote
 * sender URLs, scripts, forms, and styles never reach the page.
 */
import { NextResponse } from "next/server";
import {
  createDraft,
  getAttachmentBytes,
  getDraft,
  getMessage,
  getThread,
  listThreadsPage,
  type MailAttachment,
  type MailMessage as AgentMailMessage,
  type MailThread as AgentMailThread,
} from "@/lib/mail/client";
import { queueEmailDraftReview } from "@/lib/email/review";
import {
  EmailDraftError,
  resolveEmailDraftDecision,
} from "@/lib/decisions/email";
import { externalOrigin } from "../gates";
import { esc, forbidden, notFound, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

async function primaryInboxId(
  ctx: MiniAppContext
): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id")
    .eq("user_id", ctx.session.userId)
    .eq("is_primary", true)
    .is("retired_at", null)
    .maybeSingle();
  return (data?.agentmail_inbox_id as string | undefined) ?? null;
}

const emailOf = (from: string): string => {
  const match = /<([^>]+)>/.exec(from);
  return (match?.[1] ?? from).trim().toLowerCase();
};

async function blockedAddresses(ctx: MiniAppContext): Promise<Set<string>> {
  const { data } = await ctx.supabase
    .from("senders")
    .select("address")
    .eq("user_id", ctx.session.userId)
    .eq("platform", "email")
    .not("blocked_at", "is", null);
  return new Set(
    ((data ?? []) as { address: string }[]).map((row) =>
      row.address.toLowerCase()
    )
  );
}

interface PendingDraftReview {
  decisionId: string;
  to: string;
  subject: string;
  preview: string;
}

const IMAGE_TYPES = new Set([
  "image/avif",
  "image/gif",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function attachmentHref(
  basePath: string,
  messageId: string,
  attachmentId: string
): string {
  return `${basePath}?message=${encodeURIComponent(messageId)}&attachment=${encodeURIComponent(attachmentId)}`;
}

function attachmentFilename(attachment: MailAttachment): string {
  return attachment.filename?.trim() || "attachment";
}

function isDisplayableImage(attachment: MailAttachment): boolean {
  return IMAGE_TYPES.has((attachment.content_type ?? "").split(";", 1)[0]?.toLowerCase() ?? "");
}

/**
 * A defensive, deliberately small HTML-to-text converter. Provider HTML is
 * never trusted as markup; this just gives HTML-only mail a readable fallback
 * in the same safe, escaped-text reader as ordinary messages.
 */
function htmlToText(html: string): string {
  const withoutActiveContent = html
    .replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1\s*>/gi, "")
    .replace(/<\s*br\s*\/?\s*>/gi, "\n")
    .replace(/<\s*\/\s*(?:p|div|h[1-6]|li|tr|blockquote)\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ");
  const decoded = withoutActiveContent
    .replace(/&#x([0-9a-f]+);?/gi, (_match, value: string) => {
      const codePoint = Number.parseInt(value, 16);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replace(/&#(\d+);?/g, (_match, value: string) => {
      const codePoint = Number.parseInt(value, 10);
      return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
        ? String.fromCodePoint(codePoint)
        : "";
    })
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
  return decoded
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+([.,!?;:])/g, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function messageText(message: AgentMailMessage): string {
  return message.extracted_text ?? message.text ?? htmlToText(message.html ?? "");
}

function renderAttachments(
  basePath: string,
  message: AgentMailMessage
): string {
  const attachments = message.attachments ?? [];
  if (attachments.length === 0) return "";
  const items = attachments
    .map((attachment) => {
      const href = attachmentHref(basePath, message.message_id, attachment.attachment_id);
      const filename = attachmentFilename(attachment);
      const size = attachment.size ? ` · ${Math.ceil(attachment.size / 1024)} KB` : "";
      if (isDisplayableImage(attachment)) {
        return `<a href="${esc(href)}" aria-label="Open ${esc(filename)}"><img src="${esc(href)}" alt="${esc(filename)}" loading="lazy" style="display:block;max-width:100%;height:auto;margin-top:0.65rem;border-radius:0.5rem"></a>`;
      }
      return `<a class="chip" href="${esc(href)}">📎 ${esc(filename)}${esc(size)}</a>`;
    })
    .join("");
  return `<div class="mail-attachments">${items}</div>`;
}

/**
 * Pending email_draft decisions with the held draft read from AgentMail at
 * view time — the body never lands in Postgres (C4). A gone draft (already
 * sent or expired) degrades to the stored safe metadata.
 */
async function pendingDraftReviews(
  ctx: MiniAppContext,
  inboxId: string
): Promise<PendingDraftReview[]> {
  const { data } = await ctx.supabase
    .from("decisions")
    .select("id, ref, sender, label")
    .eq("user_id", ctx.session.userId)
    .eq("kind", "email_draft")
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  const rows = (data ?? []) as {
    id: string;
    ref: string | null;
    sender: string | null;
    label: string | null;
  }[];
  const reviews: PendingDraftReview[] = [];
  for (const row of rows) {
    let to = row.sender ?? "";
    let subject = row.label ?? "";
    let preview = "";
    if (row.ref) {
      try {
        const draft = await getDraft(inboxId, row.ref);
        to = draft.to?.join(", ") || to;
        subject = draft.subject || subject;
        preview = draft.text ?? "";
      } catch {
        // Draft may be gone; the stored metadata still identifies the card.
      }
    }
    reviews.push({ decisionId: row.id, to, subject, preview });
  }
  return reviews;
}

function renderReviews(reviews: PendingDraftReview[]): string {
  if (reviews.length === 0) return "";
  const items = reviews
    .map(
      (review) =>
        `<div class="card"><div class="when">To ${esc(review.to || "(no recipient)")}</div><strong>${esc(review.subject || "(no subject)")}</strong>${review.preview ? `<p style="margin:0.4rem 0 0;white-space:pre-wrap">${esc(review.preview.slice(0, 2000))}</p>` : ""}<div class="row" style="margin-top:0.6rem"><form method="post"><input type="hidden" name="action" value="approve_draft"><input type="hidden" name="decision" value="${esc(review.decisionId)}"><button>Approve &amp; send</button></form><form method="post"><input type="hidden" name="action" value="dismiss_draft"><input type="hidden" name="decision" value="${esc(review.decisionId)}"><button>Discard</button></form></div></div>`
    )
    .join("");
  return `<div class="day">Waiting for your approval — nothing sends until you approve</div>${items}`;
}

function renderThreads(
  basePath: string,
  threads: AgentMailThread[],
  blocked: Set<string>,
  reviews: PendingDraftReview[],
  lite: boolean,
  notice: string | null,
  nextPageToken?: string | null
): string {
  const rows = threads
    .map((thread) => {
      const sender = thread.senders?.[0] ?? "";
      const isBlocked = sender ? blocked.has(emailOf(sender)) : false;
      const when = thread.updated_at
        ? new Date(thread.updated_at).toLocaleDateString()
        : "";
      const count = thread.message_count && thread.message_count > 1 ? ` · ${thread.message_count} messages` : "";
      const preview = thread.preview?.trim();
      return `<a href="${esc(basePath)}?thread=${encodeURIComponent(thread.thread_id)}" style="text-decoration:none;color:inherit"><div class="item"><span class="grow" style="min-width:0"><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(thread.subject ?? "(no subject)")}</strong><span class="when">${esc(sender)}${isBlocked ? ` \u00b7 blocked` : ""}${esc(count)}</span>${preview ? `<span class="when" style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(preview)}</span>` : ""}</span><span class="when">${esc(when)}</span></div></a>`;
    })
    .join("");
  const empty =
    threads.length === 0 ? `<p class="when">No mail yet.</p>` : "";
  const older = nextPageToken
    ? `<a class="navlink" href="${esc(basePath)}?page_token=${encodeURIComponent(nextPageToken)}">Older mail</a>`
    : "";
  const compose = `<div class="day">Compose</div><form method="post" class="stack"><input type="hidden" name="action" value="compose"><input type="email" name="to" placeholder="To — separate addresses with commas" multiple required><input type="text" name="subject" placeholder="Subject"><textarea name="text" rows="7" placeholder="Write your email…" required></textarea><div class="row"><button>Save draft for review</button></div><p class="when" style="margin:0">Your draft appears above. Tap Approve &amp; send to send it from your Air agent.</p></form>`;
  const body = `<section class="panel">${renderReviews(reviews)}${rows}${empty}${older}${compose}\n${promptBar("Ask your agent \u2014 e.g. summarize unread threads\u2026")}</section>`;
  return renderShell({ title: "Inbox", kicker: "Mail", body, lite, notice });
}

function renderThread(
  basePath: string,
  _threadId: string,
  subject: string,
  messages: AgentMailMessage[],
  blocked: Set<string>,
  lite: boolean
): string {
  const rows = messages
    .map((message) => {
      const from = message.from ?? "";
      const isBlocked = from ? blocked.has(emailOf(from)) : false;
      const body = messageText(message);
      return `<article class="card"><div class="when">${esc(from)}${isBlocked ? " \u00b7 blocked sender" : ""}</div><p style="margin:0.4rem 0 0;white-space:pre-wrap">${esc(body || "(no readable message body)")}</p>${renderAttachments(basePath, message)}</article>`;
    })
    .join("");
  const last = messages[messages.length - 1];
  const replyTo = last?.from ? emailOf(last.from) : "";
  const reply = replyTo
    ? `<form method="post" class="addrow"><input type="hidden" name="action" value="reply"><input type="hidden" name="to" value="${esc(replyTo)}"><input type="hidden" name="subject" value="${esc(subject.startsWith("Re:") ? subject : `Re: ${subject}`)}"><input type="text" name="text" placeholder="Reply as a draft\u2026" required><button>Draft reply</button></form><p class="when">Replies are drafts \u2014 they wait in Needs&nbsp;you until you approve the send.</p>`
    : "";
  const body = `<section class="panel"><a href="${esc(basePath)}" style="text-decoration:none" class="when">\u2190 Inbox</a>${rows}${reply}</section>`;
  // A right swipe goes back to the thread list, like iOS Mail.
  return renderShell({
    title: subject,
    kicker: "Mail",
    body,
    lite,
    swipe: { prev: basePath },
  });
}

function validMediaType(value: string | undefined): string {
  const mediaType = (value ?? "").split(";", 1)[0]?.trim().toLowerCase() ?? "";
  return /^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(mediaType)
    ? mediaType
    : "application/octet-stream";
}

function safeFilename(value: string): string {
  return value.replace(/[\\/\r\n"]/g, "_").slice(0, 180) || "attachment";
}

async function serveAttachment(
  inboxId: string,
  messageId: string,
  attachmentId: string
): Promise<NextResponse> {
  const message = await getMessage(inboxId, messageId);
  const attachment = (message.attachments ?? []).find(
    (candidate) => candidate.attachment_id === attachmentId
  );
  if (!attachment) return notFound();
  const contentType = validMediaType(attachment.content_type);
  const bytes = await getAttachmentBytes(inboxId, messageId, attachmentId);
  // Next's BodyInit type intentionally excludes Node's Buffer, even though
  // Buffer is a Uint8Array at runtime. Copy into a browser-standard buffer.
  const body = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(body).set(bytes);
  const response = new NextResponse(body, {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `${isDisplayableImage(attachment) ? "inline" : "attachment"}; filename="${safeFilename(attachmentFilename(attachment))}"`,
      "X-Content-Type-Options": "nosniff"
    }
  });
  return withBaseHeaders(response);
}

export const inbox: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const lite = ctx.session.via === "card";
    const inboxId = await primaryInboxId(ctx);
    if (!inboxId) {
      return shellHtml(
        renderShell({
          title: "Inbox",
          kicker: "Mail",
          body: '<section class="panel"><p>Your agent has no inbox yet.</p></section>',
          lite,
        })
      );
    }
    const blocked = await blockedAddresses(ctx);
    const attachmentId = ctx.request.nextUrl.searchParams.get("attachment");
    const messageId = ctx.request.nextUrl.searchParams.get("message");
    if (attachmentId && messageId) {
      try {
        return await serveAttachment(inboxId, messageId, attachmentId);
      } catch {
        return notFound();
      }
    }
    const threadId = ctx.request.nextUrl.searchParams.get("thread");
    try {
      if (threadId) {
        const thread = await getThread(inboxId, threadId);
        return shellHtml(
          renderThread(
            ctx.basePath,
            threadId,
            thread.subject ?? "(no subject)",
            thread.messages ?? [],
            blocked,
            lite
          )
        );
      }
      const pageToken = ctx.request.nextUrl.searchParams.get("page_token") ?? undefined;
      const [threadPage, reviews] = await Promise.all([
        // The mini-app is the reader, not a notification teaser. Fetch the
        // provider's maximum page and continue via the returned cursor.
        listThreadsPage(inboxId, 100, pageToken),
        pendingDraftReviews(ctx, inboxId),
      ]);
      return shellHtml(
        renderThreads(
          ctx.basePath,
          threadPage.threads,
          blocked,
          reviews,
          lite,
          ctx.request.nextUrl.searchParams.get("notice"),
          threadPage.next_page_token
        )
      );
    } catch {
      return shellHtml(
        renderShell({
          title: "Inbox",
          kicker: "Mail",
          body: "<section class=\"panel\"><p>Couldn't reach the mailbox \u2014 try again shortly.</p></section>",
          lite,
        })
      );
    }
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const action = String(form.get("action") ?? "");
    if (action === "approve_draft" || action === "dismiss_draft") {
      // The inline card's resolution path — identical checks to the
      // Needs-you API (owner-scoped, pending-only, control-plane send).
      const decisionId = String(form.get("decision") ?? "");
      if (decisionId) {
        try {
          await resolveEmailDraftDecision(
            ctx.supabase,
            ctx.session.userId,
            decisionId,
            action === "approve_draft"
          );
        } catch (error) {
          if (!(error instanceof EmailDraftError)) throw error;
          return withBaseHeaders(
            NextResponse.redirect(
              new URL(
                `${ctx.basePath}?notice=${encodeURIComponent(error.message)}`,
                externalOrigin(ctx.request)
              ),
              303
            )
          );
        }
      }
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(
            `${ctx.basePath}?notice=${encodeURIComponent(action === "approve_draft" ? "Email sent." : "Draft discarded.")}`,
            externalOrigin(ctx.request)
          ),
          303
        )
      );
    }
    if (action === "prompt") {
      await runPrompt(ctx, String(form.get("text") ?? ""));
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(ctx.basePath, externalOrigin(ctx.request)),
          303
        )
      );
    }
    const to = String(form.get("to") ?? "").trim().slice(0, 320);
    const subject = String(form.get("subject") ?? "").trim().slice(0, 300);
    const text = String(form.get("text") ?? "").trim().slice(0, 10_000);
    if ((action === "reply" || action === "compose") && to && text) {
      const inboxId = await primaryInboxId(ctx);
      if (inboxId) {
        // Draft + Needs-you entry; zero sent mail until approved (C10).
        const draftId = await createDraft(inboxId, {
          to: to.split(",").map((address) => address.trim()).filter(Boolean),
          ...(subject ? { subject } : {}),
          text,
        });
        await queueEmailDraftReview(ctx.supabase, ctx.session.userId, {
          draftId,
          to,
          ...(subject ? { subject } : {}),
        });
      }
    }
    const notice = action === "reply" || action === "compose"
      ? "Draft saved. Review it above, then tap Approve & send when it is ready."
      : "";
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(
          `${ctx.basePath}${notice ? `?notice=${encodeURIComponent(notice)}` : ""}`,
          externalOrigin(ctx.request)
        ),
        303
      )
    );
  },
};
