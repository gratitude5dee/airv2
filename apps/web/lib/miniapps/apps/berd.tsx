/**
 * Berd mini-app (berd.goal.md §MA-B1) — a control surface over the owner's
 * own Berd desktop, not a hosted Berd. This is the skeleton: owner-only
 * server HTML over the box-side document (`.hermes/miniapps/berd/<res>.json`,
 * C4), the pairing/envelope lanes land in §MA-B2/§MA-B3. Until a device is
 * paired the view says so instead of inventing data, and every action that
 * is not implemented yet is refused server-side rather than redirected to a
 * page that pretends it worked (MA5).
 */
import { NextResponse } from "next/server";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { esc, forbidden } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import {
  getBerdDoc,
  putBerdDoc,
  queueBerdPending,
  type BerdDoc,
  type BerdLinkStatus,
} from "../berd/state";
import { parseBerdCommand } from "../berd/commands";
import { BERD_LANE, enqueueEnvelope } from "../commandLane";
import {
  beginBerdPairing,
  berdLiveLink,
  cancelBerdPairing,
  disconnectBerd,
  type BerdLiveLink,
} from "../berd/link";
import type { MiniAppContext, MiniAppModule } from "./types";

function chip(status: BerdLinkStatus): string {
  if (status === "paired") return '<span class="chip on">● connected</span>';
  if (status === "pending") return '<span class="chip">◌ pairing</span>';
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

function actionButton(action: string, label: string): string {
  return `<form method="post" style="display:inline"><input type="hidden" name="action" value="${esc(action)}"><button class="ghost">${esc(label)}</button></form>`;
}

function field(
  name: string,
  placeholder: string,
  required: boolean
): string {
  return `<input type="text" name="${esc(name)}" placeholder="${esc(placeholder)}"${required ? " required" : ""}>`;
}

function idOptions(rows: { id: string; label: string }[]): string {
  return rows
    .map(
      (row) =>
        `<option value="${esc(row.id)}">${esc(row.label)}</option>`
    )
    .join("");
}

/**
 * §MA-B5 write surface: every form posts one allowlisted action that
 * becomes a signed envelope for the paired Berd. Create/edit only — the
 * destructive verbs stay in Berd's own UI.
 */
function manageForms(doc: BerdDoc): string {
  const agentOptions = idOptions(
    doc.agents.map((agent) => ({ id: agent.id, label: agent.name }))
  );
  const projectOptions = idOptions(
    doc.projects.map((project) => ({ id: project.id, label: project.name }))
  );
  const automationOptions = idOptions(
    doc.automations.map((automation) => ({
      id: automation.id,
      label: automation.name,
    }))
  );
  const forms: string[] = [
    `<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="agent-create">
<strong>New agent</strong>
${field("name", "name", true)}${field("description", "description (optional)", false)}${field("harness", "harness (optional)", false)}${field("model", "model (optional)", false)}
<button>Queue create</button></form>`,
    `<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="project-create">
<strong>New project</strong>
${field("name", "name", true)}
<button>Queue create</button></form>`,
    `<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="skill-create">
<strong>New skill</strong>
${field("name", "name", true)}${field("summary", "summary (optional)", false)}
<textarea name="body" placeholder="skill body (optional)" rows="3"></textarea>
<button>Queue create</button></form>`,
  ];
  if (agentOptions) {
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="agent-update">
<strong>Edit agent</strong>
<select name="id">${agentOptions}</select>
${field("name", "new name (optional)", false)}${field("description", "new description (optional)", false)}${field("model", "new model (optional)", false)}
<button>Queue update</button></form>`);
  }
  if (projectOptions) {
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="session-start">
<strong>Start session</strong>
<select name="projectId">${projectOptions}</select>
${field("title", "title (optional)", false)}
<button>Queue start</button></form>`);
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="project-archive">
<strong>Archive project</strong>
<select name="id">${projectOptions}</select>
<button class="ghost">Queue archive</button></form>`);
  }
  if (automationOptions) {
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="automation-enable">
<strong>Enable automation</strong>
<select name="id">${automationOptions}</select>
<button class="ghost">Queue enable</button></form>`);
    forms.push(`<form method="post" class="card" style="display:flex;flex-direction:column;gap:0.4rem">
<input type="hidden" name="action" value="automation-disable">
<strong>Pause automation</strong>
<select name="id">${automationOptions}</select>
<button class="ghost">Queue pause</button></form>`);
  }
  return section("Manage", forms);
}

function linkPanel(live: BerdLiveLink, doc: BerdDoc): string {
  const label = live.deviceLabel ? ` · ${esc(live.deviceLabel)}` : "";
  const protocol = live.protocolVersion
    ? ` · protocol v${live.protocolVersion}`
    : "";
  const lastSeen = live.lastSeenAt ?? doc.link.lastSyncAt;
  const sync = lastSeen
    ? `Berd last checked in ${esc(lastSeen)}.`
    : "Berd has never checked in.";
  let hint: string;
  let controls: string;
  if (live.status === "paired") {
    hint =
      "Everything below is the last state Berd reported — it stays readable with the desktop closed.";
    controls = `${actionButton("refresh", "Refresh")} ${actionButton("disconnect", "Disconnect")}`;
  } else if (live.status === "pending") {
    hint = `A pairing code is waiting${live.pendingExpiresAt ? ` (expires ${live.pendingExpiresAt})` : ""}. Enter it in Berd under Settings → Connections → Air — on your desktop, or in a Berd running on your own Box — then come back here.`;
    controls = `${actionButton("pair-begin", "New code")} ${actionButton("pair-cancel", "Cancel pairing")}`;
  } else {
    hint =
      "Pair this surface with your own Berd — the desktop app on your machine, or a self-hosted Berd on your Box — to manage agents, projects, skills, and sessions from here. Berd is the side that connects out: nothing here can dial it.";
    controls = actionButton("pair-begin", "Connect Berd");
  }
  return `<div class="card"><div style="display:flex;align-items:center;gap:0.5rem"><strong class="grow">Berd</strong>${chip(live.status)}${label}${protocol}</div>
<div class="when">${sync}</div>
<p class="muted">${esc(hint)}</p>
<div style="display:flex;gap:0.4rem">${controls}</div></div>`;
}

function renderBerd(
  doc: BerdDoc,
  live: BerdLiveLink,
  notice: string | null,
  lite: boolean
): string {
  const body = `<section class="panel">
${linkPanel(live, doc)}
${section(
  "Agents",
  doc.agents.map((agent) =>
    row(agent.name, [agent.harness, agent.model].filter(Boolean).join(" · "))
  )
)}
${section(
  "Projects",
  doc.projects.map((project) =>
    row(project.name, project.archived ? "archived" : project.startupMode)
  )
)}
${section("Skills", doc.skills.map((skill) => row(skill.name, skill.summary)))}
${section(
  "Sessions",
  doc.sessions.map((session) => row(session.title, session.updatedAt))
)}
${section(
  "Providers",
  doc.providers.map((provider) =>
    row(provider.name, provider.configured ? "configured" : "not configured")
  )
)}
${section(
  "Automations",
  doc.automations.map((automation) =>
    row(automation.name, automation.enabled ? "enabled" : "paused")
  )
)}
${live.status === "paired" ? manageForms(doc) : ""}
${section(
  "Pending",
  doc.pending.map((op) =>
    row(`${op.group} ${op.action}`, [op.state, op.note].filter(Boolean).join(" · "))
  )
)}
${promptBar("Ask your agent — e.g. what is running in Berd right now…")}</section>`;
  return renderShell({ title: doc.title, kicker: "Berd", body, notice, lite });
}

async function loadAndRender(
  ctx: MiniAppContext,
  notice: string | null
): Promise<NextResponse> {
  const [doc, live] = await Promise.all([
    getBerdDoc(ctx.supabase, ctx.session.userId, ctx.session.resourceId),
    berdLiveLink(ctx.supabase, ctx.session.userId),
  ]);
  return shellHtml(renderBerd(doc, live, notice, ctx.session.via === "card"));
}

export const berd: MiniAppModule = {
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

    if (action === "pair-begin") {
      const { code } = await beginBerdPairing(ctx.supabase, ctx.session.userId);
      // Shown once: only its hash is stored, so a reload cannot re-reveal it.
      return loadAndRender(
        ctx,
        `Pairing code: ${code} — enter it in Berd under Settings → Connections → Air (desktop or your Box-hosted Berd). It is single-use and expires in 10 minutes; this is the only time it is shown.`
      );
    }

    if (action === "pair-cancel") {
      await cancelBerdPairing(ctx.supabase, ctx.session.userId);
      return loadAndRender(ctx, "Pairing cancelled.");
    }

    if (action === "disconnect") {
      await disconnectBerd(ctx.supabase, ctx.session.userId);
      return loadAndRender(
        ctx,
        "Disconnected. Berd's token is revoked and will be refused on its next check-in."
      );
    }

    // Everything else is the §MA-B3 command lane: an allowlisted
    // (group, action) pair with validated args becomes a signed single-use
    // envelope the paired Berd pulls outbound and routes through its own
    // berdctl broker and renderer registry. Unknown actions fail closed.
    const parsed = parseBerdCommand(action, form);
    if (!parsed.ok) {
      if (parsed.error === "unknown action") return forbidden(parsed.error);
      return loadAndRender(ctx, parsed.error);
    }
    const live = await berdLiveLink(ctx.supabase, ctx.session.userId);
    if (live.status !== "paired") {
      return loadAndRender(
        ctx,
        "No Berd device is paired yet — commands run on your own device. Pair one below first."
      );
    }
    const queued = await enqueueEnvelope(
      ctx.supabase,
      BERD_LANE,
      ctx.session.userId,
      ctx.session.resourceId,
      parsed.command.group,
      parsed.command.action,
      parsed.command.args
    );
    if (!queued.ok) {
      return loadAndRender(ctx, queued.error);
    }
    const doc = await getBerdDoc(
      ctx.supabase,
      ctx.session.userId,
      ctx.session.resourceId
    );
    await putBerdDoc(
      ctx.supabase,
      ctx.session.userId,
      ctx.session.resourceId,
      queueBerdPending(
        doc,
        queued.id,
        parsed.command.group,
        parsed.command.action
      )
    );
    return loadAndRender(
      ctx,
      "Queued — Berd runs it on its next check-in and the result lands below."
    );
  },
};
