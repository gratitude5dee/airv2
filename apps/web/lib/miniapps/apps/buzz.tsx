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
  queueBuzzPending,
  type BuzzDoc,
  type BuzzLinkStatus,
} from "../buzz/state";
import { parseBuzzIntent } from "../buzz/commands";
import { BUZZ_LANE, enqueueEnvelope } from "../commandLane";
import {
  beginBuzzBinding,
  buzzLiveLink,
  cancelBuzzBinding,
  disconnectBuzz,
  validateRelayUrl,
  type BuzzLiveLink,
} from "../buzz/link";
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

function actionButton(action: string, label: string): string {
  return `<form method="post" style="display:inline"><input type="hidden" name="action" value="${esc(action)}"><button class="ghost">${esc(label)}</button></form>`;
}

/** Relay URL + signer choice; never a key field (C18). */
function bindForm(): string {
  return `<form method="post" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="bind-begin">
<input type="text" name="relayUrl" placeholder="wss://relay.example.com" maxlength="200" required>
<label style="font-size:12px;display:flex;align-items:center;gap:0.4rem"><input type="radio" name="signer" value="box" checked> Sign with the Buzz on my Box (your agent already holds the key there)</label>
<label style="font-size:12px;display:flex;align-items:center;gap:0.4rem"><input type="radio" name="signer" value="desktop"> Sign with Buzz Desktop on my machine</label>
<button>Connect Buzz</button>
</form>`;
}

function channelOptions(doc: BuzzDoc): string {
  return doc.channels
    .map(
      (channel) =>
        `<option value="${esc(channel.id)}">#${esc(channel.name)}</option>`
    )
    .join("");
}

function confirmBox(label: string): string {
  return `<label style="font-size:12px;display:flex;align-items:center;gap:0.4rem"><input type="checkbox" name="confirm" value="yes" required> I understand — ${esc(label)}</label>`;
}

/**
 * §MA-Z5 write surface: every form posts one allowlisted verb that becomes
 * a signed single-use intent for the signer that holds the key. Anything
 * public and one-way carries an explicit confirm gate, checked server-side.
 */
function manageForms(doc: BuzzDoc): string {
  const channels = channelOptions(doc);
  const workflowOptions = doc.workflows
    .map(
      (workflow) =>
        `<option value="${esc(workflow.id)}">${esc(workflow.name)}</option>`
    )
    .join("");
  const forms: string[] = [];
  if (channels) {
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="message-send">
<strong>Send message</strong>
<select name="channelId">${channels}</select>
<textarea name="stdin" placeholder="message" rows="3" required></textarea>
${confirmBox("a sent message is public and one-way")}
<button>Queue send</button></form>`);
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="channel-topic">
<strong>Set channel topic</strong>
<select name="channelId">${channels}</select>
<input type="text" name="stdin" placeholder="topic" required>
<button class="ghost">Queue topic</button></form>`);
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="canvas-set">
<strong>Set canvas</strong>
<select name="channelId">${channels}</select>
<textarea name="stdin" placeholder="canvas content" rows="3" required></textarea>
${confirmBox("the canvas is last-write-wins")}
<button class="ghost">Queue canvas</button></form>`);
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="agent-draft-create">
<strong>Draft a new agent</strong>
<select name="channelId">${channels}</select>
<input type="text" name="displayName" placeholder="display name" required>
<textarea name="stdin" placeholder="system prompt" rows="3" required></textarea>
<div class="when">Sends an owner-reviewed draft — the agent only exists after you save it in Buzz.</div>
<button>Queue draft</button></form>`);
  }
  forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="channel-create">
<strong>New channel</strong>
<input type="text" name="name" placeholder="name" required>
<select name="kind"><option value="stream">stream</option><option value="forum">forum</option></select>
<button>Queue create</button></form>`);
  forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="dm-open">
<strong>Open a DM</strong>
<input type="text" name="pubkey" placeholder="hex pubkey" required>
<button class="ghost">Queue open</button></form>`);
  if (workflowOptions) {
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="workflow-approve">
<strong>Approve workflow step</strong>
<select name="workflowId">${workflowOptions}</select>
<input type="text" name="approvalToken" placeholder="approval token (optional)">
${confirmBox("an approval cannot be batched or undone")}
<button>Queue approval</button></form>`);
  }
  return section("Manage", forms);
}

function linkPanel(live: BuzzLiveLink, doc: BuzzDoc): string {
  const community =
    live.communityLabel ?? live.relayUrl ?? doc.link.communityLabel;
  const identity = live.npub ? ` · ${esc(shortNpub(live.npub))}` : "";
  const signer = live.signerKind ? ` · ${esc(live.signerKind)} signer` : "";
  const lastSeen = live.lastSeenAt ?? doc.link.lastSyncAt;
  const sync = lastSeen
    ? `Relay last reached ${esc(lastSeen)}.`
    : "This surface has never reached the relay.";
  let hint: string;
  let controls: string;
  if (live.status === "connected") {
    hint =
      "Everything below is the last state the relay reported — it stays readable when the relay is unreachable.";
    controls = `${actionButton("refresh", "Refresh")} ${actionButton("disconnect", "Disconnect")}`;
  } else if (live.status === "pending") {
    hint = `A binding code is waiting${live.pendingExpiresAt ? ` (expires ${live.pendingExpiresAt})` : ""} for ${live.relayUrl ?? "the relay"} via the ${live.signerKind ?? "chosen"} signer. Complete it from that signer — your key never comes here.`;
    controls = `${actionButton("bind-cancel", "Cancel")}`;
  } else {
    hint =
      "Bind this surface to your community: one relay URL is one workspace. Your key stays where it lives — on your Box or in Buzz Desktop; this surface never asks for one and never sees one.";
    controls = bindForm();
  }
  return `<div class="card"><div style="display:flex;align-items:center;gap:0.5rem"><strong class="grow">${esc(community ?? "No community")}</strong>${chip(live.status)}${identity}${signer}</div>
<div class="when">${sync}</div>
<p class="muted">${esc(hint)}</p>
<div style="display:flex;flex-direction:column;gap:0.4rem">${controls}</div></div>`;
}

function renderBuzz(
  doc: BuzzDoc,
  live: BuzzLiveLink,
  notice: string | null,
  lite: boolean
): string {
  const workflows = [...doc.workflows].sort(
    (a, b) => (b.pendingApprovals ?? 0) - (a.pendingApprovals ?? 0)
  );
  const body = `<section class="panel">
${linkPanel(live, doc)}
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
${live.status === "connected" ? manageForms(doc) : ""}
${section(
  "Pending",
  doc.pending.map((op) =>
    row(`${op.group} ${op.verb}`, [op.state, op.note].filter(Boolean).join(" · "))
  )
)}
${promptBar("Ask your agent — e.g. what happened in #engineering today…")}</section>`;
  return renderShell({ title: doc.title, kicker: "Buzz", body, notice, lite });
}

async function loadAndRender(
  ctx: MiniAppContext,
  notice: string | null
): Promise<NextResponse> {
  const [doc, live] = await Promise.all([
    getBuzzDoc(ctx.supabase, ctx.session.userId, ctx.session.resourceId),
    buzzLiveLink(ctx.supabase, ctx.session.userId),
  ]);
  return shellHtml(renderBuzz(doc, live, notice, ctx.session.via === "card"));
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

    if (action === "bind-begin") {
      const relayUrl = validateRelayUrl(String(form.get("relayUrl") ?? ""));
      if (!relayUrl) {
        return loadAndRender(
          ctx,
          "That relay URL was refused: it must be a public wss:// endpoint (C5)."
        );
      }
      const signer = String(form.get("signer") ?? "");
      if (signer !== "box" && signer !== "desktop") {
        return forbidden("unknown signer");
      }
      const { code } = await beginBuzzBinding(
        ctx.supabase,
        ctx.session.userId,
        relayUrl,
        signer
      );
      // Shown once: only its hash is stored, so a reload cannot re-reveal it.
      const where =
        signer === "box"
          ? "ask your agent to bind Buzz with this code (it runs `buzz` on your Box, where your key already lives)"
          : "enter it in Buzz Desktop under Settings → Communities → Air";
      return loadAndRender(
        ctx,
        `Binding code: ${code} — ${where}. It is single-use and expires in 10 minutes; this is the only time it is shown.`
      );
    }

    if (action === "bind-cancel") {
      await cancelBuzzBinding(ctx.supabase, ctx.session.userId);
      return loadAndRender(ctx, "Binding cancelled.");
    }

    if (action === "disconnect") {
      await disconnectBuzz(ctx.supabase, ctx.session.userId);
      return loadAndRender(
        ctx,
        "Disconnected. The signer's link token is revoked and will be refused on its next contact."
      );
    }

    // Everything else is the §MA-Z3 intent lane: an allowlisted
    // (group, verb) pair with validated args — content on `stdin`, never a
    // flag — becomes a signed single-use intent the connected signer pulls
    // outbound and executes where the key lives. Unknown actions fail closed.
    const parsed = parseBuzzIntent(action, form);
    if (!parsed.ok) {
      if (parsed.error === "unknown action") return forbidden(parsed.error);
      return loadAndRender(ctx, parsed.error);
    }
    if (parsed.confirmLabel && form.get("confirm") !== "yes") {
      return loadAndRender(
        ctx,
        `Tick the confirmation first — ${parsed.confirmLabel}.`
      );
    }
    const live = await buzzLiveLink(ctx.supabase, ctx.session.userId);
    if (live.status !== "connected") {
      return loadAndRender(
        ctx,
        "No Buzz community is connected yet — intents run on your own signer. Bind one below first."
      );
    }
    const queued = await enqueueEnvelope(
      ctx.supabase,
      BUZZ_LANE,
      ctx.session.userId,
      ctx.session.resourceId,
      parsed.intent.group,
      parsed.intent.verb,
      parsed.intent.args
    );
    if (!queued.ok) {
      return loadAndRender(ctx, queued.error);
    }
    const doc = await getBuzzDoc(
      ctx.supabase,
      ctx.session.userId,
      ctx.session.resourceId
    );
    await putBuzzDoc(
      ctx.supabase,
      ctx.session.userId,
      ctx.session.resourceId,
      queueBuzzPending(doc, queued.id, parsed.intent.group, parsed.intent.verb)
    );
    return loadAndRender(
      ctx,
      "Queued — your signer runs it on its next check-in and the result lands below."
    );
  },
};
