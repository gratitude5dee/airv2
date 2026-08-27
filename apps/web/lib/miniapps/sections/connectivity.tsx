/**
 * Settings "Connectivity" section — owner-only opt-ins that live entirely on
 * the user's box:
 *
 *   - Cortex memory (Mitosis): office id + API key merged into the box
 *     ~/.hermes/.env (never Postgres) so the agent and the Persona panel can
 *     reach the user's own memory office.
 *   - Tailscale: join the USER'S own tailnet (never a platform tailnet, I1)
 *     with an auth key that transits a shredded one-shot file.
 *   - Cotal agent mesh: loopback NATS bus on the box for multi-agent
 *     coordination; single-tenant by construction.
 *
 * Mount like ../sections/memory: `await renderConnectivitySection(ctx)` and
 * dispatch `connect.*` actions to `connectivityAction(ctx, form)`.
 */
import { NextResponse } from "next/server";
import { externalOrigin } from "../gates";
import { esc, withBaseHeaders } from "../html";
import {
  clearMitosisCredentials,
  MitosisInputError,
  setMitosisCredentials,
} from "@/lib/memory/mitosis";
import {
  disableTailscale,
  enableTailscale,
  TailscaleInputError,
  tailscaleStatus,
} from "@/lib/box/tailscale";
import { cotalStatus, disableCotal, enableCotal } from "@/lib/box/cotal";
import { armStopAfter, ensureBoxAwake } from "@/lib/orchestrator/boxes";
import type { MiniAppContext } from "../apps/types";

export async function renderConnectivitySection(
  ctx: MiniAppContext
): Promise<string> {
  if (ctx.session.role !== "owner") {
    return `<h2>Connectivity</h2><p class="muted">Owner only.</p>`;
  }
  return `<h2>Connectivity</h2>
<p class="muted">Optional connections for your agent's computer. Everything here lives on your computer, not in our database.</p>
<h3>Cortex memory (Mitosis)</h3>
<p class="muted">Connect your Mitosis office so your agent can check your memory. Your key is stored only on your computer.</p>
<form method="post">
<input type="hidden" name="action" value="connect.mitosis_save">
<input name="office_id" placeholder="Office ID (UUID)" autocomplete="off" style="width:100%">
<input name="api_key" type="password" placeholder="API key" autocomplete="off" style="width:100%">
<button>Connect memory</button></form>
<form method="post" onsubmit="return confirm('Remove your Mitosis credentials from your computer?')" style="margin:0">
<input type="hidden" name="action" value="connect.mitosis_clear"><input type="hidden" name="confirm" value="true">
<button class="ghost">Disconnect memory</button></form>
<h3>Tailscale</h3>
<p class="muted">Join your own tailnet to reach your computer privately (SSH, dashboard). Off by default. Use an auth key from your own Tailscale admin console — your computer joins your network, nobody else's.</p>
<form method="post" onsubmit="return confirm('Join your tailnet? Your computer becomes reachable from devices on your own Tailscale network.')">
<input type="hidden" name="action" value="connect.tailscale_enable">
<input name="auth_key" type="password" placeholder="tskey-…" autocomplete="off" style="width:100%">
<button>Join my tailnet</button></form>
<form method="post" onsubmit="return confirm('Leave the tailnet and stop Tailscale?')" style="margin:0">
<input type="hidden" name="action" value="connect.tailscale_disable"><input type="hidden" name="confirm" value="true">
<button class="ghost">Leave tailnet</button></form>
<h3>Agent mesh (Cotal)</h3>
<p class="muted">A local coordination bus (loopback only) that lets your agent spawn and talk to helper agents on its own computer. Nothing leaves your computer.</p>
<form method="post" style="display:inline">
<input type="hidden" name="action" value="connect.cotal_enable">
<button>Start mesh</button></form>
<form method="post" style="display:inline">
<input type="hidden" name="action" value="connect.cotal_disable"><input type="hidden" name="confirm" value="true">
<button class="ghost">Stop mesh</button></form>`;
}

/** Handles `connect.*` actions; returns null when the action is not ours. */
export async function connectivityAction(
  ctx: MiniAppContext,
  form: FormData
): Promise<NextResponse | null> {
  const action = String(form.get("action") ?? "");
  if (!action.startsWith("connect.")) return null;
  if (ctx.session.role !== "owner") {
    return withBaseHeaders(
      NextResponse.json({ error: "owner only" }, { status: 403 })
    );
  }
  const redirect = withBaseHeaders(
    NextResponse.redirect(
      new URL(ctx.basePath, externalOrigin(ctx.request)),
      303
    )
  );
  const bad = (error: string) =>
    withBaseHeaders(NextResponse.json({ error }, { status: 400 }));
  const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
  try {
    if (action === "connect.mitosis_save") {
      try {
        await setMitosisCredentials(
          box.boxId,
          String(form.get("office_id") ?? "").trim(),
          String(form.get("api_key") ?? "").trim()
        );
      } catch (error) {
        if (error instanceof MitosisInputError) return bad(error.message);
        throw error;
      }
      return redirect;
    }
    if (action === "connect.mitosis_clear") {
      if (form.get("confirm") !== "true") return bad("confirm required");
      await clearMitosisCredentials(box.boxId);
      return redirect;
    }
    if (action === "connect.tailscale_enable") {
      try {
        const status = await enableTailscale(
          box.boxId,
          String(form.get("auth_key") ?? "").trim()
        );
        if (!status.running) {
          return bad("tailscale did not come up — check the auth key");
        }
      } catch (error) {
        if (error instanceof TailscaleInputError) return bad(error.message);
        throw error;
      }
      return redirect;
    }
    if (action === "connect.tailscale_disable") {
      if (form.get("confirm") !== "true") return bad("confirm required");
      await disableTailscale(box.boxId);
      return redirect;
    }
    if (action === "connect.cotal_enable") {
      const status = await enableCotal(box.boxId);
      if (!status.running) return bad("cotal mesh did not start");
      return redirect;
    }
    if (action === "connect.cotal_disable") {
      if (form.get("confirm") !== "true") return bad("confirm required");
      await disableCotal(box.boxId);
      return redirect;
    }
    return bad("unknown action");
  } finally {
    await armStopAfter(ctx.supabase, ctx.session.userId).catch(
      () => undefined
    );
  }
}

/** Read-only status line used by the section header (best-effort). */
export async function connectivityStatusLine(boxId: string): Promise<string> {
  const [ts, cotal] = await Promise.all([
    tailscaleStatus(boxId).catch(() => null),
    cotalStatus(boxId).catch(() => null),
  ]);
  const parts: string[] = [];
  if (ts?.running) {
    parts.push(`tailscale up${ts.dnsName ? ` (${esc(ts.dnsName)})` : ""}`);
  }
  if (cotal?.running) parts.push("cotal mesh up");
  return parts.join(" · ");
}
