/**
 * Connect mini-app (goal.md §MA5 #3) — one screen to sign the agent into
 * everything. Toolkit grid from Composio discovery, status chips from the
 * connections mirror, "used by" hints from lib/connectors/meta. Connect
 * mints a hosted Connect Link (existing lib/connectors/manage path — the
 * browser sees only toolkit names and statuses, never a Composio credential
 * or the MCP endpoint, C10); disconnect revokes. Owner-only (MA4).
 */
import { NextResponse } from "next/server";
import { listToolkits, type ComposioToolkit } from "@/lib/composio/client";
import { connectionHealth, type ConnectionHealth } from "@/lib/connectors/meta";
import {
  beginConnect,
  disconnectToolkit,
  syncConnections,
  TOOLKIT_SLUG_PATTERN,
  type ConnectionRow,
} from "@/lib/connectors/manage";
import { externalOrigin } from "../gates";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

function chip(status: string | null): string {
  if (status === "active") {
    return '<span class="chip on">● connected</span>';
  }
  if (status === "pending") {
    return '<span class="chip">◌ pending</span>';
  }
  if (status === "revoked") {
    return '<span class="chip">○ disconnected</span>';
  }
  return "";
}

function renderConnect(
  toolkits: ComposioToolkit[],
  connections: ConnectionRow[],
  health: ConnectionHealth[],
  notice: string | null,
  lite: boolean
): string {
  const statusByToolkit = new Map(connections.map((c) => [c.toolkit, c.status]));
  const healthByToolkit = new Map(health.map((h) => [h.toolkit, h]));
  const connectedFirst = [...toolkits].sort((a, b) => {
    const rank = (t: ComposioToolkit) =>
      statusByToolkit.get(t.slug) === "active"
        ? 0
        : statusByToolkit.get(t.slug) === "pending"
          ? 1
          : 2;
    return rank(a) - rank(b) || a.name.localeCompare(b.name);
  });
  const cards = connectedFirst
    .map((toolkit) => {
      const status = statusByToolkit.get(toolkit.slug) ?? null;
      const info = healthByToolkit.get(toolkit.slug);
      const usedBy = info?.used_by
        ? `<div class="when">Used by ${esc(info.used_by)}</div>`
        : "";
      const lastOk = info?.last_ok_at
        ? `<div class="when">Last used ${esc(new Date(info.last_ok_at).toLocaleDateString())}</div>`
        : "";
      const button =
        status === "active"
          ? `<form method="post"><input type="hidden" name="action" value="disconnect"><input type="hidden" name="toolkit" value="${esc(toolkit.slug)}"><button class="ghost">Disconnect</button></form>`
          : `<form method="post"><input type="hidden" name="action" value="connect"><input type="hidden" name="toolkit" value="${esc(toolkit.slug)}"><button>${status === "pending" ? "Resume" : "Connect"}</button></form>`;
      return `<div class="card" style="display:flex;align-items:center;gap:0.55rem"><div class="grow" style="min-width:0"><strong>${esc(toolkit.name)}</strong> ${chip(status)}${usedBy}${lastOk}</div>${button}</div>`;
    })
    .join("");
  const refresh = `<form method="post" style="margin:0.7rem 0 0"><input type="hidden" name="action" value="refresh"><button class="ghost">Refresh statuses</button></form>`;
  const body = `<section class="panel"><p class="muted">Sign your agent into your tools. OAuth happens on the provider's own page — no password ever touches this app.</p>${notice ? `<p class="muted">${esc(notice)}</p>` : ""}${cards}${refresh}
${promptBar("Ask your agent — e.g. what can you do with my calendar…")}</section>`;
  return renderShell({
    title: "Connect accounts",
    kicker: "Accounts",
    body,
    lite,
  });
}

async function loadAndRender(
  ctx: MiniAppContext,
  notice: string | null
): Promise<NextResponse> {
  const userId = ctx.session.userId;
  const [toolkits, { data: rows }] = await Promise.all([
    listToolkits(),
    ctx.supabase
      .from("connections")
      .select("toolkit, status, connected_at")
      .eq("user_id", userId),
  ]);
  let connections = (rows ?? []) as ConnectionRow[];
  // A pending Connect Link may have completed on the hosted page — sync the
  // mirror before rendering so chips are truthful (same path as PUT).
  if (connections.some((c) => c.status === "pending")) {
    connections = await syncConnections(ctx.supabase, userId).catch(
      () => connections
    );
  }
  const health = await connectionHealth(ctx.supabase, userId, connections);
  return shellHtml(
    renderConnect(
      toolkits,
      connections,
      health,
      notice,
      ctx.session.via === "card"
    )
  );
}

export const connect: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    return loadAndRender(ctx, null);
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const action = String(form.get("action") ?? "");
    const userId = ctx.session.userId;

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
      await syncConnections(ctx.supabase, userId).catch(() => undefined);
      return loadAndRender(ctx, null);
    }

    const toolkit = String(form.get("toolkit") ?? "").toLowerCase();
    if (!TOOLKIT_SLUG_PATTERN.test(toolkit)) {
      return forbidden("invalid toolkit");
    }

    if (action === "connect") {
      const callback = `${externalOrigin(ctx.request)}${ctx.basePath}`;
      const link = await beginConnect(ctx.supabase, userId, toolkit, callback);
      return withBaseHeaders(NextResponse.redirect(link.redirect_url, 303));
    }

    if (action === "disconnect") {
      const result = await disconnectToolkit(ctx.supabase, userId, toolkit);
      return loadAndRender(
        ctx,
        result === "ok"
          ? "Disconnected."
          : result === "not_found"
            ? "Nothing to disconnect."
            : "Revoke failed — the connection is unchanged. Try again."
      );
    }

    return forbidden("unknown action");
  },
};
