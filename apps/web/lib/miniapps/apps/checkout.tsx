import { NextResponse } from "next/server";
import {
  beginCheckoutHumanControl,
  cancelCheckoutHandoff,
  getCheckoutHandoff,
  humanControlActive,
  returnCheckoutHumanControl,
  type CheckoutHandoff,
} from "@/lib/checkout/handoffs";
import { armStopAfter } from "@/lib/orchestrator/boxes";
import {
  mintCheckoutBrowserLink,
  mintSignedLink,
  refreshCheckoutCard,
} from "../cards";
import { externalOrigin } from "../gates";
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";

function amount(h: CheckoutHandoff): string {
  if (h.amount_cents === null || !h.currency) return "Amount to verify";
  try { return new Intl.NumberFormat("en-US", { style: "currency", currency: h.currency.toUpperCase() }).format(h.amount_cents / 100); }
  catch { return `${h.amount_cents} ${h.currency.toUpperCase()}`; }
}

function timestamp(value: string | null, unknownLabel: string): string {
  if (!value) return unknownLabel;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toLocaleString("en-US") : unknownLabel;
}

function renderCheckout(ctx: MiniAppContext, h: CheckoutHandoff): NextResponse {
  const expired = h.expires_at !== null && Date.parse(h.expires_at) <= Date.now();
  const status = expired && !["completed", "cancelled"].includes(h.status) ? "expired" : h.status;
  const browserLaunch = mintCheckoutBrowserLink(ctx.session.userId, h.id);
  const controlActive = humanControlActive(h);
  const blocker = h.blocker ? `<div class="card"><strong>Needs you</strong><div>${esc(h.blocker)}</div></div>` : "";
  const browser = !h.same_session
    ? ""
    : controlActive
      ? `<div class="card"><strong>You control this browser</strong><p class="muted">Agent browser input stays paused until you return control or this short lease expires.</p><form method="post"><input type="hidden" name="action" value="return_control"><button>Return control to agent</button></form></div>`
      : `<p class="muted">A merchant link may not carry over the remote browser's cookies, cart, queue, or challenge clearance.</p><form method="post"><input type="hidden" name="action" value="take_control"><button>Control existing browser</button></form>`;
  const cancel = ["preparing", "needs_human", "ready_for_review", "payment_pending", "requires_action"].includes(status) ? `<form method="post"><input type="hidden" name="action" value="cancel"><button class="ghost">Cancel handoff</button></form>` : "";
  const payment = h.payment_request_id
    ? status === "payment_pending"
      ? '<p class="muted">Payment approval is pending in Needs you. No charge has been confirmed.</p>'
      : status === "requires_action"
        ? '<p class="muted">The payment provider needs an action from you. Complete it in the merchant checkout, then verify the receipt.</p>'
        : ""
    : '<p class="muted">Payment method: manual merchant checkout. No automatic approval is enabled.</p>';
  const details = `<span class="muted" style="display:block;margin-top:.75rem">Verified: ${esc(timestamp(h.verified_at, "not verified"))} · Hold expires: ${esc(timestamp(h.expires_at, "unknown"))}</span>`;
  const body = `<section class="panel"><div class="item"><span class="grow"><strong>${esc(h.item_summary)}</strong><br><span class="muted">${esc(h.merchant_host)} · ${esc(h.quantity === null ? "quantity unknown" : String(h.quantity))} · ${esc(amount(h))}</span>${details}</span><span class="when">${esc(status.replaceAll("_", " "))}</span></div>${blocker}${payment}<p><a href="${esc(browserLaunch)}" target="_blank" rel="noopener">Open checkout in browser</a></p><p class="muted">Use this if the Messages sheet does not load. It creates a fresh, short-lived browser session for this handoff.</p><p><a href="${esc(h.merchant_url)}" target="_blank" rel="noopener">Open merchant site — you may need to rebuild the cart</a></p>${browser}${status === "expired" ? '<p class="muted">This checkout hold expired. Ask Air for a fresh handoff.</p>' : ""}${status === "completed" ? '<p>Payment completed — verify the merchant receipt before closing this task.</p>' : ""}${cancel}</section>`;
  return shellHtml(renderShell({ title: "Checkout", kicker: "Purchase", body, lite: ctx.session.via === "card" }));
}

export const checkout: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") return forbidden("this view is owner-only");
    const h = await getCheckoutHandoff(ctx.supabase, ctx.session.userId, ctx.session.resourceId);
    if (!h) return new NextResponse("checkout handoff not found", { status: 404 });
    return renderCheckout(ctx, h);
  },
  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") return forbidden("this view is owner-only");
    const action = String(form.get("action") ?? "");
    if (action === "take_control") {
      await beginCheckoutHumanControl(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
      await armStopAfter(ctx.supabase, ctx.session.userId, 20);
      return withBaseHeaders(NextResponse.redirect(
        mintSignedLink(ctx.session.userId, "computer", "default"),
        303
      ));
    }
    if (action === "return_control") {
      await returnCheckoutHumanControl(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
    } else if (action === "cancel") {
      const cancelled = await cancelCheckoutHandoff(
        ctx.supabase,
        ctx.session.userId,
        ctx.session.resourceId
      );
      if (cancelled) {
        // Do not send a new card after cancellation: only edit the existing
        // session if there is one, then let the owner return to the mini-app.
        await refreshCheckoutCard(ctx.supabase, ctx.session.userId, {
          id: ctx.session.resourceId,
          status: "cancelled",
        }).catch(() => undefined);
      }
    } else {
      return forbidden("unknown action");
    }
    return withBaseHeaders(NextResponse.redirect(new URL(ctx.basePath, externalOrigin(ctx.request)), 303));
  },
};
