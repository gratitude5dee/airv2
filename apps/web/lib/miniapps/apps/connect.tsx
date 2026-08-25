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
import { env } from "@/lib/env";
import { mintToken } from "../tokens";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

// Chrome enforces form-action on the redirect that follows a form POST, so
// the connect redirect into the Composio hosted page must be allowed on top
// of the shell's CSP (same pattern as pay.tsx for Stripe Checkout).
function connectHtml(body: string): NextResponse {
  const response = shellHtml(body);
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  response.headers.set(
    "Content-Security-Policy",
    csp.replace(
      "form-action 'self'",
      "form-action 'self' https://*.composio.dev"
    )
  );
  return response;
}

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

/**
 * Signed jump into the real browser — OAuth providers (Google above all)
 * refuse sign-in inside embedded webviews (disallowed_useragent), so a
 * card-opened Messages sheet must finish connecting in Safari. Multi-use
 * within its TTL, minted per render, never stored.
 */
function browserJumpHref(ctx: MiniAppContext): string | null {
  if (ctx.session.via !== "card") return null;
  const token = mintToken(
    ctx.session.userId,
    ctx.app.slug,
    ctx.session.resourceId,
    15
  );
  return `${env.appOrigin()}/mini/${ctx.app.slug}?t=${token}`;
}

function renderConnect(
  toolkits: ComposioToolkit[],
  connections: ConnectionRow[],
  health: ConnectionHealth[],
  notice: string | null,
  lite: boolean,
  browserJump: string | null
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
          : `<form method="post" target="_top"><input type="hidden" name="action" value="connect"><input type="hidden" name="toolkit" value="${esc(toolkit.slug)}"><button>${status === "pending" ? "Resume" : "Connect"}</button></form>`;
      return `<div class="card" style="display:flex;align-items:center;gap:0.55rem"><div class="grow" style="min-width:0"><strong>${esc(toolkit.name)}</strong> ${chip(status)}${usedBy}${lastOk}</div>${button}</div>`;
    })
    .join("");
  const refresh = `<form method="post" style="margin:0.7rem 0 0"><input type="hidden" name="action" value="refresh"><button class="ghost">Refresh statuses</button></form>`;
  const browserLine = browserJump
    ? `<p class="muted">Providers like Google block sign-in inside Messages — <a href="${esc(browserJump)}" target="_blank" rel="noopener">open Connect in your browser</a> to link an account, then come back and tap Refresh statuses.</p>`
    : "";
  const body = `<section class="panel"><p class="muted">Sign your agent into your tools. OAuth happens on the provider's own page — no password ever touches this app.</p>${browserLine}${notice ? `<p class="muted">${esc(notice)}</p>` : ""}${cards}${refresh}
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
      (error: unknown) => {
        console.error(
          JSON.stringify({
            msg: "connections sync failed",
            user_id: userId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
        return connections;
      }
    );
  }
  const health = await connectionHealth(ctx.supabase, userId, connections);
  return connectHtml(
    renderConnect(
      toolkits,
      connections,
      health,
      notice,
      ctx.session.via === "card",
      browserJumpHref(ctx)
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
      try {
        await syncConnections(ctx.supabase, userId);
      } catch (error) {
        console.error(
          JSON.stringify({
            msg: "connections sync failed",
            user_id: userId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
        return loadAndRender(
          ctx,
          "Couldn't refresh statuses just now — try again in a moment."
        );
      }
      return loadAndRender(ctx, null);
    }

    const toolkit = String(form.get("toolkit") ?? "").toLowerCase();
    if (!TOOLKIT_SLUG_PATTERN.test(toolkit)) {
      return forbidden("invalid toolkit");
    }

    if (action === "connect") {
      // Inside a Messages card webview the provider's OAuth page refuses to
      // load (Google returns disallowed_useragent), so the flow must run in
      // a real browser — don't mint a Connect Link that can never finish.
      if (ctx.session.via === "card") {
        return loadAndRender(
          ctx,
          "Sign-in can't run inside Messages — use the \"open Connect in your browser\" link above to finish connecting."
        );
      }
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
