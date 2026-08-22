/**
 * Feedback mini-app — in-air bug reports and feature requests. The owner taps
 * the card from iMessage, picks bug or feature, and submits a title plus an
 * optional description; the row lands in feedback_items and shows up in the
 * operator dashboard's feedback inbox. Owner-only: nothing here reads or
 * writes anything but this user's own feedback rows.
 */
import { NextResponse } from "next/server";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import type { SupabaseClient } from "@supabase/supabase-js";
import { esc, forbidden } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

const KINDS = ["bug", "feature"] as const;
type FeedbackKind = (typeof KINDS)[number];

const TITLE_MAX = 140;
const BODY_MAX = 2000;
const RECENT_LIMIT = 10;

function isKind(value: string): value is FeedbackKind {
  return (KINDS as readonly string[]).includes(value);
}

interface FeedbackRow {
  id: string;
  kind: string | null;
  title: string | null;
  status: string;
  created_at: string;
}

async function recentFeedback(
  supabase: SupabaseClient,
  userId: string
): Promise<FeedbackRow[]> {
  const { data } = await supabase
    .from("feedback_items")
    .select("id, kind, title, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(RECENT_LIMIT);
  return (data ?? []) as FeedbackRow[];
}

function renderFeedback(
  rows: FeedbackRow[],
  notice: string | null,
  lite: boolean
): string {
  const kindButtons = KINDS.map(
    (kind) =>
      `<label class="row muted"><input type="radio" name="kind" value="${esc(kind)}"${kind === "bug" ? " checked" : ""}><span class="grow">${kind === "bug" ? "Something is broken" : "I want a new feature"}</span></label>`
  ).join("");
  const form = `<div class="card"><form method="post" class="stack"><input type="hidden" name="action" value="submit">${kindButtons}<input type="text" name="title" placeholder="One line — what happened, or what you want" maxlength="${TITLE_MAX}" autocomplete="off"><textarea name="body" rows="4" placeholder="Any detail that helps (optional)" maxlength="${BODY_MAX}"></textarea><button>Send it</button></form></div>`;
  const items = rows
    .map(
      (row) =>
        `<div class="item"><span class="grow">${esc(row.title ?? "(untitled)")}</span><span class="when">${esc(row.kind ?? "")} · ${esc(row.status)} · ${esc(new Date(row.created_at).toLocaleDateString())}</span></div>`
    )
    .join("");
  const body = `<section class="panel"><h2>SEND FEEDBACK</h2>${form}<h2>YOUR REPORTS</h2>${items || '<div class="card muted">Nothing sent yet.</div>'}
${promptBar("Ask your agent — e.g. file a bug about the calendar…")}</section>`;
  return renderShell({
    title: "Feedback",
    kicker: "Bugs & Ideas",
    body,
    notice,
    lite,
  });
}

async function respond(
  ctx: MiniAppContext,
  notice: string | null
): Promise<NextResponse> {
  const rows = await recentFeedback(ctx.supabase, ctx.session.userId);
  return shellHtml(renderFeedback(rows, notice, ctx.session.via === "card"));
}

export const feedback: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    return respond(ctx, null);
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const action = String(form.get("action") ?? "");

    if (action === "prompt") {
      try {
        await runPrompt(ctx, String(form.get("text") ?? ""));
      } catch (error) {
        if (error instanceof StartLimitError) {
          return respond(
            ctx,
            "Your agent's computer can't start right now — try again in a few minutes."
          );
        }
        throw error;
      }
      return respond(ctx, "Sent to your agent.");
    }

    if (action !== "submit") return forbidden("unknown action");

    const kind = String(form.get("kind") ?? "");
    if (!isKind(kind)) return forbidden("invalid kind");
    const title = String(form.get("title") ?? "").trim();
    if (!title) return respond(ctx, "Add a one-line summary first.");
    const detail = String(form.get("body") ?? "").trim();

    const { error } = await ctx.supabase.from("feedback_items").insert({
      user_id: ctx.session.userId,
      kind,
      title: title.slice(0, TITLE_MAX),
      body: detail ? detail.slice(0, BODY_MAX) : null,
    });
    if (error) return respond(ctx, "Couldn't save that — try again.");
    return respond(
      ctx,
      kind === "bug" ? "Bug filed — thank you." : "Request filed — thank you."
    );
  },
};
