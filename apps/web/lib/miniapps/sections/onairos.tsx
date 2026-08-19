/**
 * MA9.2 — Settings "Connected context" (Onairos) section, self-contained for
 * Session D to mount:
 *
 *   render: `await renderOnairosSection(ctx)` → HTML fragment (owner only).
 *   action: dispatch form posts whose `action` starts with "onairos." to
 *           `onairosAction(ctx, form)`; it returns null for actions it does
 *           not own.
 *
 * Connect itself happens in the onboarding step (client SDK consent →
 * POST /api/onairos with the handoff — see lib/onairos/sync.ts). This
 * section shows status and offers Re-sync / Disconnect.
 */
import { NextResponse } from "next/server";
import { externalOrigin } from "../gates";
import { esc, withBaseHeaders } from "../html";
import { OnairosError } from "@/lib/onairos/context";
import {
  disconnectOnairos,
  onairosStatus,
  resyncOnairos,
} from "@/lib/onairos/sync";
import type { MiniAppContext } from "../apps/types";

export async function renderOnairosSection(
  ctx: MiniAppContext
): Promise<string> {
  if (ctx.session.role !== "owner") {
    return `<h2>Connected context</h2><p class="muted">Owner only.</p>`;
  }
  const state = await onairosStatus(ctx.supabase, ctx.session.userId);
  if (!state.configured) {
    return `<h2>Connected context</h2><p class="muted">Onairos is not configured on this deployment.</p>`;
  }
  if (state.status !== "active") {
    return `<h2>Connected context</h2>
<p class="muted">Not connected. Connect Onairos from onboarding to give your agent your personal context.</p>`;
  }
  return `<h2>Connected context</h2>
<p class="muted">Onairos connected${state.connectedAt ? ` since ${esc(state.connectedAt.slice(0, 10))}` : ""}. Your imported context lives on your computer at ~/.hermes/context/onairos.md.</p>
<form method="post" style="display:inline"><input type="hidden" name="action" value="onairos.resync"><button class="ghost">Re-sync</button></form>
<form method="post" style="display:inline" onsubmit="return confirm('Disconnect Onairos? All imported context will be deleted from your computer.')">
<input type="hidden" name="action" value="onairos.disconnect"><button class="ghost">Disconnect</button></form>`;
}

/** Handles `onairos.*` actions; returns null when the action is not ours. */
export async function onairosAction(
  ctx: MiniAppContext,
  form: FormData
): Promise<NextResponse | null> {
  const action = String(form.get("action") ?? "");
  if (!action.startsWith("onairos.")) return null;
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
  try {
    if (action === "onairos.resync") {
      await resyncOnairos(ctx.supabase, ctx.session.userId);
      return redirect;
    }
    if (action === "onairos.disconnect") {
      await disconnectOnairos(ctx.supabase, ctx.session.userId);
      return redirect;
    }
  } catch (error) {
    const status = error instanceof OnairosError ? error.status : 502;
    const message =
      error instanceof OnairosError ? error.message : "onairos action failed";
    return withBaseHeaders(
      NextResponse.json({ error: message }, { status })
    );
  }
  return withBaseHeaders(
    NextResponse.json({ error: "unknown action" }, { status: 400 })
  );
}
