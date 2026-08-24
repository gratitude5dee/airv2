/**
 * AgentMail inbox mini-app (MA6 #11): thread list → thread view →
 * reply/compose as DRAFTS. C10 stays structural — this module never imports
 * a send call; composing creates an AgentMail draft plus an email_draft
 * Needs-you decision, and the only send path remains the control-plane
 * approval in /api/decisions.
 *
 * This is a reduced-trust surface: message bodies render as escaped plain
 * text (extracted_text/text), never provider HTML — so a remote image from
 * any sender, blocked or not, is structurally stripped. The page CSP is the
 * shared shell's theme CSP: script/img limited to 'self' (no inline), styles
 * and fonts only from the theme's allow-listed font host — sender-controlled
 * content can never introduce a remote load.
 */
import { NextResponse } from "next/server";
import {
  createDraft,
  getDraft,
  getThread,
  listThreads,
  type AgentMailMessage,
  type AgentMailThread,
} from "@/lib/agentmail/client";
import { queueEmailDraftReview } from "@/lib/email/review";
import {
  EmailDraftError,
  resolveEmailDraftDecision,
} from "@/lib/decisions/email";
import { externalOrigin } from "../gates";
import { esc, forbidden, withBaseHeaders } from "../html";
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
  lite: boolean
): string {
  const rows = threads
    .map((thread) => {
      const sender = thread.senders?.[0] ?? "";
      const isBlocked = sender ? blocked.has(emailOf(sender)) : false;
      const when = thread.updated_at
        ? new Date(thread.updated_at).toLocaleDateString()
        : "";
      return `<a href="${esc(basePath)}?thread=${encodeURIComponent(thread.thread_id)}" style="text-decoration:none;color:inherit"><div class="item"><span class="grow" style="min-width:0"><strong style="display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(thread.subject ?? "(no subject)")}</strong><span class="when">${esc(sender)}${isBlocked ? ` \u00b7 blocked` : ""}</span></span><span class="when">${esc(when)}</span></div></a>`;
    })
    .join("");
  const empty =
    threads.length === 0 ? `<p class="when">No mail yet.</p>` : "";
  const compose = `<div class="day">Compose (drafts only \u2014 nothing sends without you)</div><form method="post" class="stack"><input type="hidden" name="action" value="compose"><input type="text" name="to" placeholder="To" required><input type="text" name="subject" placeholder="Subject"><input type="text" name="text" placeholder="Message" required><div class="row"><button>Save draft</button></div></form>`;
  const body = `<section class="panel">${renderReviews(reviews)}${rows}${empty}${compose}\n${promptBar("Ask your agent \u2014 e.g. summarize unread threads\u2026")}</section>`;
  return renderShell({ title: "Inbox", kicker: "Mail", body, lite });
}

function renderThread(
  basePath: string,
  threadId: string,
  subject: string,
  messages: AgentMailMessage[],
  blocked: Set<string>,
  lite: boolean
): string {
  const rows = messages
    .map((message) => {
      const from = message.from ?? "";
      const isBlocked = from ? blocked.has(emailOf(from)) : false;
      // Escaped plain text only — provider HTML (and any remote image in
      // it) never reaches the page.
      const body = message.extracted_text ?? message.text ?? "";
      return `<div class="card"><div class="when">${esc(from)}${isBlocked ? " \u00b7 blocked sender" : ""}</div><p style="margin:0.4rem 0 0;white-space:pre-wrap">${esc(body.slice(0, 5000))}</p></div>`;
    })
    .join("");
  const last = messages[messages.length - 1];
  const replyTo = last?.from ? emailOf(last.from) : "";
  const reply = replyTo
    ? `<form method="post" class="addrow"><input type="hidden" name="action" value="reply"><input type="hidden" name="to" value="${esc(replyTo)}"><input type="hidden" name="subject" value="${esc(subject.startsWith("Re:") ? subject : `Re: ${subject}`)}"><input type="text" name="text" placeholder="Reply as a draft\u2026" required><button>Draft reply</button></form><p class="when">Replies are drafts \u2014 they wait in Needs&nbsp;you until you approve the send.</p>`
    : "";
  const body = `<section class="panel"><a href="${esc(basePath)}" style="text-decoration:none" class="when">\u2190 Inbox</a>${rows}${reply}</section>`;
  return renderShell({ title: subject, kicker: "Mail", body, lite });
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
      const [threads, reviews] = await Promise.all([
        listThreads(inboxId),
        pendingDraftReviews(ctx, inboxId),
      ]);
      return shellHtml(
        renderThreads(ctx.basePath, threads, blocked, reviews, lite)
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
          // Already resolved / gone: the redirect re-renders without it.
        }
      }
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(ctx.basePath, externalOrigin(ctx.request)),
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
          to: [to],
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
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(ctx.basePath, externalOrigin(ctx.request)),
        303
      )
    );
  },
};
