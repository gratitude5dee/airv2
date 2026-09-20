/**
 * Air × Muse owner console. It is deliberately a server-rendered settings
 * surface: bearer keys are shown once in the POST response path and nothing
 * here embeds Muse, stores a credential in a browser, or opens a third-party
 * frame.
 */
import { NextResponse } from "next/server";
import { externalOrigin } from "../gates";
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";
import { museEnabled } from "@/lib/muse/auth";
import { MUSE_SCOPES, MUSE_SCOPE_COPY } from "@/lib/muse/contracts";
import { recordMuseEvent } from "@/lib/muse/events";
import { listMuseKeys, mintMuseKey, revokeMuseKey } from "@/lib/muse/keys";
import { listMuseLink, revokeMuseLink } from "@/lib/muse/link";
import { sendMuseUpdate } from "@/lib/muse/notify";
import { getMuseSettings, saveMuseSettings } from "@/lib/muse/settings";
import { callMuseWorker } from "@/lib/muse/worker";
import { writeConnectedToolsFile } from "@/lib/provisioning/connectors";

const ENDPOINT = "https://muse.wzrd.tech/mcp";
const DOCS = "https://muse.wzrd.tech/muse.md";

function redactPhone(phone: string | null): string {
  if (!phone || phone.length < 5) return "not assigned";
  return `${phone.slice(0, 3)} ··· ${phone.slice(-4)}`;
}

function redirect(ctx: MiniAppContext, note: string): NextResponse {
  return withBaseHeaders(
    NextResponse.redirect(
      new URL(`${ctx.basePath}?note=${encodeURIComponent(note)}`, externalOrigin(ctx.request)),
      303,
    ),
  );
}

function scopeChecks(): string {
  return MUSE_SCOPES.map((scope) =>
    `<label class="item"><input type="checkbox" name="scope" value="${esc(scope)}"${scope === "profile" ? " checked" : ""}>` +
    `<span><strong>${esc(scope)}</strong><br><span class="muted">${esc(MUSE_SCOPE_COPY[scope])}</span></span></label>`,
  ).join("");
}

function relayRecipe(): string {
  return "Create a scheduled agent named Air relay. Every few minutes, call air.commands.pull. For each command returned, do what it asks using my connected apps, then call air.commands.reply with a short result. If pull returns nothing, end quietly. Never ask me for Air credentials; Air already knows who I am.";
}

export const muse: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (!museEnabled()) return new NextResponse("Not found", { status: 404 });
    if (ctx.session.role !== "owner") return forbidden("this view is owner-only");
    const userId = ctx.session.userId;
    const [link, keys, settings, events, line] = await Promise.all([
      listMuseLink(ctx.supabase, userId),
      listMuseKeys(ctx.supabase, userId),
      getMuseSettings(ctx.supabase, userId),
      ctx.supabase
        .from("muse_events")
        .select("kind, agent, chars, status, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(50),
      ctx.supabase
        .from("lines")
        .select("phone")
        .eq("assigned_user_id", userId)
        .eq("platform", "imessage")
        .maybeSingle(),
    ]);
    const note = ctx.request.nextUrl.searchParams.get("note");
    const linePhone = typeof line.data?.phone === "string" ? line.data.phone : null;
    const keyRows = keys.length
      ? `<div class="tablewrap"><table><thead><tr><th>Key</th><th>Scopes</th><th>Last used</th><th></th></tr></thead><tbody>${keys.map((key) =>
        `<tr><td class="nowrap">${esc(key.id.slice(0, 8))}…</td><td>${esc(key.scopes.join(", ") || "none")}</td><td>${esc(key.last_used_at ? new Date(key.last_used_at).toLocaleString() : "never")}</td>` +
        `<td><form method="post"><input type="hidden" name="action" value="revoke_key"><input type="hidden" name="key_id" value="${esc(key.id)}"><button class="ghost">Revoke</button></form></td></tr>`,
      ).join("")}</tbody></table></div>`
      : '<p class="muted">No API keys. OAuth with PKCE is the usual connection path.</p>';
    const eventRows = (events.data ?? []).length
      ? `<div class="tablewrap"><table><thead><tr><th>Kind</th><th>Agent</th><th>Status</th><th>When</th></tr></thead><tbody>${(events.data ?? []).map((event) =>
        `<tr><td>${esc(String(event.kind))}</td><td>${esc(String(event.agent ?? "—"))}</td><td>${esc(String(event.status ?? "—"))}</td><td class="nowrap">${esc(new Date(String(event.created_at)).toLocaleString())}</td></tr>`,
      ).join("")}</tbody></table></div>`
      : '<p class="muted">Activity will appear here without storing command or update text.</p>';
    const body = `<section class="panel">
<div class="day">Your Air line</div>
<div class="card"><strong>${esc(redactPhone(linePhone))}</strong><div class="muted">This is the iMessage number Muse uses to reach you. It belongs to your Air project and is not a Muse credential.</div></div>
<div class="day">Status</div>
<div class="card"><div class="row"><strong>${link.connected ? "Connected" : "Not connected"}</strong><span class="chip${link.connected ? " on" : ""}">${link.connected ? "active" : "setup"}</span></div>
<div class="muted">${link.connected ? `${link.grants.length} active connection${link.grants.length === 1 ? "" : "s"}.` : "In Muse, say the connection sentence below."}</div></div>
<div class="day">Connect Muse</div>
<div class="card"><p>In Muse, say:</p><pre>connect to ${esc(ENDPOINT)}</pre><p class="muted">Sign in with the phone number on your Air account. New verified accounts are provisioned with an Air line, WZRDMail, and a Box before the connection finishes.</p><p><a href="${esc(DOCS)}">Read the public connector brief</a></p></div>
<div class="day">Updates</div>
<form method="post" class="card stack"><input type="hidden" name="action" value="settings"><label class="row"><input type="checkbox" name="updates_enabled" value="true"${settings.updates_enabled ? " checked" : ""}> Text updates to my Air line</label><label>Daily cap <input type="number" name="daily_cap" value="${settings.daily_cap}" min="0" max="120"></label><div class="row"><label>Quiet starts <input type="text" name="quiet_start" value="${esc(settings.quiet_hours.start)}" pattern="([01]\\d|2[0-3]):[0-5]\\d"></label><label>Ends <input type="text" name="quiet_end" value="${esc(settings.quiet_hours.end)}" pattern="([01]\\d|2[0-3]):[0-5]\\d"></label></div><button>Save update limits</button></form>
<form method="post" class="inline"><input type="hidden" name="action" value="test_update"><button class="ghost">Send test update</button></form>
<div class="day">Control from Messages</div>
<div class="card"><p>Text <code>/muse …</code> on your Air line. A Muse relay agent pulls the instruction, acts, then replies in the same thread.</p><details><summary>Relay recipe</summary><pre>${esc(relayRecipe())}</pre></details></div>
<div class="day">API keys</div>
<details><summary>Mint a Muse key for the Raw API lane</summary><p class="muted">A key is shown once. It is only for Muse's secure credential store when OAuth is unavailable.</p><form method="post" class="stack"><input type="hidden" name="action" value="mint_key">${scopeChecks()}<button>Mint key</button></form></details>${keyRows}
<div class="day">Activity</div>${eventRows}
<div class="day">Disconnect</div><form method="post" class="card"><input type="hidden" name="action" value="disconnect"><p class="muted">Disconnecting revokes every OAuth grant and Muse API key. Your Air account, line, Box, and mail remain yours.</p><button class="ghost">Disconnect Muse</button></form>
</section>`;
    return shellHtml(renderShell({ title: "Muse", kicker: "Your Air × Muse", body, notice: note, lite: ctx.session.via === "card" }));
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (!museEnabled()) return new NextResponse("Not found", { status: 404 });
    if (ctx.session.role !== "owner") return forbidden("this view is owner-only");
    const userId = ctx.session.userId;
    const action = String(form.get("action") ?? "");
    if (action === "settings") {
      const dailyCap = Number.parseInt(String(form.get("daily_cap") ?? ""), 10);
      await saveMuseSettings(ctx.supabase, userId, {
        updates_enabled: form.get("updates_enabled") === "true",
        daily_cap: Number.isInteger(dailyCap) ? dailyCap : 30,
        quiet_hours: { start: String(form.get("quiet_start") ?? ""), end: String(form.get("quiet_end") ?? "") },
      });
      return redirect(ctx, "update limits saved");
    }
    if (action === "test_update") {
      const delivered = await sendMuseUpdate(ctx.supabase, { userId, agent: "air", text: "Your Muse updates are connected.", kind: "info" });
      return redirect(ctx, delivered.delivered ? "test update sent" : delivered.reason === "owner_has_not_texted" ? "text your Air line once before updates can arrive" : "test update was deferred by your limits");
    }
    if (action === "mint_key") {
      const result = await mintMuseKey(ctx.supabase, userId, form.getAll("scope").map(String));
      await recordMuseEvent(ctx.supabase, { userId, kind: "key", status: "minted" });
      // Do not put a capability in the URL or a database row. This page has
      // no client-side state, so the one-time reveal uses a POST response.
      const body = `<section class="panel"><p class="kicker">Muse key</p><h1>Copy it now</h1><div class="card"><pre>${esc(result.token)}</pre><p class="muted">This key is shown once. Store it only in Muse's secure credential store. You can revoke it from the Muse app at any time.</p><a class="navlink" href="${esc(ctx.basePath)}">Back to Muse</a></div></section>`;
      return shellHtml(renderShell({ title: "Muse key", kicker: "One-time reveal", body, lite: ctx.session.via === "card" }));
    }
    if (action === "revoke_key") {
      const revoked = await revokeMuseKey(ctx.supabase, userId, String(form.get("key_id") ?? ""));
      return redirect(ctx, revoked ? "key revoked" : "key was already unavailable");
    }
    if (action === "disconnect") {
      const grants = await revokeMuseLink(ctx.supabase, userId);
      await Promise.all(grants.map((grant) => callMuseWorker("/internal/revoke", { user_id: userId, grant_id: grant.id }).catch(() => null)));
      await callMuseWorker("/internal/purge", { user_id: userId }).catch(() => null);
      await writeConnectedToolsFile(ctx.supabase, userId).catch(() => undefined);
      return redirect(ctx, "Muse disconnected");
    }
    return redirect(ctx, "unknown action");
  },
};
