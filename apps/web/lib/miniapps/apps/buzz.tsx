/**
 * Buzz mini-app (buzz.goal.md §MA-Z1) — a control surface over the owner's
 * own Buzz community (one relay URL = one workspace), not a hosted Buzz.
 * This is the skeleton: owner-only server HTML over the box-side document
 * (`.hermes/miniapps/buzz/<res>.json`, C4). Community binding (§MA-Z2) and
 * the signed intent lane (§MA-Z3) land next; until then unimplemented verbs
 * are refused server-side (MA5).
 *
 * Two rules this file must never break: no field on this surface accepts a
 * private key and none is ever rendered (C18), and an agent draft is
 * "ready for review", never "created" — `buzz agents draft-create` returns
 * `saved: false` and the owner saves it in Buzz itself.
 */
import { NextResponse } from "next/server";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { esc, forbidden } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import {
  getBuzzDoc,
  putBuzzDoc,
  type BuzzDoc,
  type BuzzLinkStatus,
} from "../buzz/state";
import type { MiniAppContext, MiniAppModule } from "./types";

function chip(status: BuzzLinkStatus): string {
  if (status === "connected") return '<span class="chip on">● connected</span>';
  if (status === "pending") return '<span class="chip">◌ connecting</span>';
  if (status === "revoked") return '<span class="chip">○ disconnected</span>';
  return '<span class="chip">○ not connected</span>';
}

function section(title: string, rows: string[]): string {
  const body = rows.length
    ? rows.join("")
    : '<div class="card pending">nothing synced yet.</div>';
  return `<details style="border-top:1px solid var(--ring);padding:0.55rem 0">
<summary style="cursor:pointer;list-style:none;font-size:11px;letter-spacing:0.14em;text-transform:uppercase;opacity:0.75">${esc(title)} · ${rows.length}</summary>
<div style="display:flex;flex-direction:column;gap:0.45rem;margin-top:0.6rem">${body}</div>
</details>`;
}

function row(primary: string, secondary?: string): string {
  const detail = secondary ? `<div class="when">${esc(secondary)}</div>` : "";
  return `<div class="card"><strong>${esc(primary)}</strong>${detail}</div>`;
}

/** Public identity only, shortened for display. */
function shortNpub(npub: string): string {
  return npub.length > 20 ? `${npub.slice(0, 12)}…${npub.slice(-4)}` : npub;
}

function linkPanel(doc: BuzzDoc): string {
  const { link } = doc;
  const community = link.communityLabel ?? link.relayUrl;
  const identity = link.npub ? ` · ${esc(shortNpub(link.npub))}` : "";
  const signer = link.signerKind ? ` · ${esc(link.signerKind)} signer` : "";
  const sync = link.lastSyncAt
    ? `Relay last reached ${esc(link.lastSyncAt)}.`
    : "This surface has never reached the relay.";
  const hint =
    link.status === "connected"
      ? "Everything below is the last state the relay reported — it stays readable when the relay is unreachable."
      : "Connect a community by signing in again from your Buzz app. Your key stays where it lives: this surface never asks for one and never sees one.";
  return `<div class="card"><div style="display:flex;align-items:center;gap:0.5rem"><strong class="grow">${esc(community ?? "No community")}</strong>${chip(link.status)}${identity}${signer}</div>
<div class="when">${sync}</div>
<p class="muted">${esc(hint)}</p>
<form method="post"><input type="hidden" name="action" value="refresh"><button class="ghost">Refresh</button></form></div>`;
}

function renderBuzz(doc: BuzzDoc, notice: string | null, lite: boolean): string {
  const workflows = [...doc.workflows].sort(
    (a, b) => (b.pendingApprovals ?? 0) - (a.pendingApprovals ?? 0)
  );
  const body = `<section class="panel">
${linkPanel(doc)}
${section(
  "Channels",
  doc.channels.map((channel) =>
    row(
      `#${channel.name}`,
      [
        channel.kind,
        channel.visibility,
        channel.unread ? `${channel.unread} unread` : null,
      ]
        .filter(Boolean)
        .join(" · ")
    )
  )
)}
${section(
  "Threads",
  doc.threads.map((thread) =>
    row(
      thread.excerpt || thread.rootEventId,
      thread.replyCount ? `${thread.replyCount} replies` : thread.updatedAt
    )
  )
)}
${section(
  "DMs",
  doc.dms.map((dm) =>
    row(
      dm.participants.map(shortNpub).join(", ") || dm.id,
      dm.updatedAt
    )
  )
)}
${section(
  "Agents",
  doc.agents.map((agent) =>
    row(
      agent.name,
      agent.draftState === "ready-for-review"
        ? "ready for review — save it in Buzz to activate"
        : agent.access
    )
  )
)}
${section(
  "Workflows",
  workflows.map((workflow) =>
    row(
      workflow.name,
      workflow.pendingApprovals
        ? `${workflow.pendingApprovals} awaiting approval`
        : undefined
    )
  )
)}
${section(
  "Canvases",
  doc.canvases.map((canvas) => row(canvas.channelId, canvas.updatedAt))
)}
${section(
  "Pending",
  doc.pending.map((op) => row(`${op.group} ${op.verb}`, op.state))
)}
${promptBar("Ask your agent — e.g. what happened in #engineering today…")}</section>`;
  return renderShell({ title: doc.title, kicker: "Buzz", body, notice, lite });
}

async function loadAndRender(
  ctx: MiniAppContext,
  notice: string | null
): Promise<NextResponse> {
  const doc = await getBuzzDoc(
    ctx.supabase,
    ctx.session.userId,
    ctx.session.resourceId
  );
  return shellHtml(renderBuzz(doc, notice, ctx.session.via === "card"));
}

export const buzz: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    return loadAndRender(ctx, null);
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
          return loadAndRender(
            ctx,
            "Your agent's computer can't start right now — try again in a few minutes."
          );
        }
        throw error;
      }
      return loadAndRender(ctx, "Sent to your agent.");
    }

    if (action === "refresh") {
      const doc = await getBuzzDoc(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
      if (doc.link.status !== "connected") {
        return loadAndRender(
          ctx,
          "No Buzz community is connected yet, so there is nothing to refresh."
        );
      }
      // The intent lane (§MA-Z3) runs the read fan-out; for now this re-reads
      // the mirror and says exactly that.
      await putBuzzDoc(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId,
        doc
      );
      return loadAndRender(ctx, "Showing the last state the relay reported.");
    }

    // Binding, intents, and every write verb are §MA-Z2+. Fail closed.
    return forbidden("unknown action");
  },
};
