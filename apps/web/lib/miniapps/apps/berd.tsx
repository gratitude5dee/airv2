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
  type BerdDoc,
  type BerdLinkStatus,
} from "../berd/state";
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

function linkPanel(doc: BerdDoc): string {
  const { link } = doc;
  const label = link.deviceLabel ? ` · ${esc(link.deviceLabel)}` : "";
  const protocol = link.protocolVersion
    ? ` · protocol v${link.protocolVersion}`
    : "";
  const sync = link.lastSyncAt
    ? `Berd last checked in ${esc(link.lastSyncAt)}.`
    : "Berd has never checked in.";
  const hint =
    link.status === "paired"
      ? "Everything below is the last state Berd reported — it stays readable with the desktop closed."
      : "Pair this surface with the Berd app on your own machine to manage agents, projects, skills, and sessions from here. Berd runs locally: nothing reaches it unless it asks.";
  return `<div class="card"><div style="display:flex;align-items:center;gap:0.5rem"><strong class="grow">Berd desktop</strong>${chip(link.status)}${label}${protocol}</div>
<div class="when">${sync}</div>
<p class="muted">${esc(hint)}</p>
<form method="post"><input type="hidden" name="action" value="refresh"><button class="ghost">Refresh</button></form></div>`;
}

function renderBerd(doc: BerdDoc, notice: string | null, lite: boolean): string {
  const body = `<section class="panel">
${linkPanel(doc)}
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
${section(
  "Pending",
  doc.pending.map((op) => row(`${op.group} ${op.action}`, op.state))
)}
${promptBar("Ask your agent — e.g. what is running in Berd right now…")}</section>`;
  return renderShell({ title: doc.title, kicker: "Berd", body, notice, lite });
}

async function loadAndRender(
  ctx: MiniAppContext,
  notice: string | null
): Promise<NextResponse> {
  const doc = await getBerdDoc(
    ctx.supabase,
    ctx.session.userId,
    ctx.session.resourceId
  );
  return shellHtml(renderBerd(doc, notice, ctx.session.via === "card"));
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

    if (action === "refresh") {
      const doc = await getBerdDoc(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
      if (doc.link.status !== "paired") {
        return loadAndRender(
          ctx,
          "No Berd device is paired yet, so there is nothing to refresh."
        );
      }
      // The envelope lane (§MA-B3) does the fan-out; until it lands this only
      // re-reads what Berd itself last wrote, and says so.
      await putBerdDoc(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId,
        doc
      );
      return loadAndRender(ctx, "Showing the last state Berd reported.");
    }

    // Pairing, envelopes, and every write verb are §MA-B2+. Fail closed.
    return forbidden("unknown action");
  },
};
