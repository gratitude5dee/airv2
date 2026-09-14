import { NextResponse } from "next/server";
import { cancelCheckoutHandoff, getCheckoutHandoff, type CheckoutHandoff } from "@/lib/checkout/handoffs";
import { mintSignedLink, refreshCheckoutCard } from "../cards";
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
  const computer = mintSignedLink(ctx.session.userId, "computer", "default");
  const blocker = h.blocker ? `<div class="card"><strong>Needs you</strong><div>${esc(h.blocker)}</div></div>` : "";
  const browser = h.same_session ? `<p class="muted">A merchant link may not carry over the remote browser's cookies, cart, queue, or challenge clearance.</p><p><a href="${esc(computer)}" target="_blank" rel="noopener">Control existing browser</a></p>` : "";
  const cancel = ["preparing", "needs_human", "ready_for_review", "payment_pending", "requires_action"].includes(status) ? `<form method="post"><input type="hidden" name="action" value="cancel"><button class="ghost">Cancel handoff</button></form>` : "";
  const payment = h.payment_request_id
    ? status === "payment_pending"
      ? '<p class="muted">Payment approval is pending in Needs you. No charge has been confirmed.</p>'
      : status === "requires_action"
        ? '<p class="muted">The payment provider needs an action from you. Complete it in the merchant checkout, then verify the receipt.</p>'
        : ""
    : '<p class="muted">Payment method: manual merchant checkout. No automatic approval is enabled.</p>';
  const details = `<span class="muted" style="display:block;margin-top:.75rem">Verified: ${esc(timestamp(h.verified_at, "not verified"))} · Hold expires: ${esc(timestamp(h.expires_at, "unknown"))}</span>`;
  const body = `<section class="panel"><div class="item"><span class="grow"><strong>${esc(h.item_summary)}</strong><br><span class="muted">${esc(h.merchant_host)} · ${esc(h.quantity === null ? "quantity unknown" : String(h.quantity))} · ${esc(amount(h))}</span>${details}</span><span class="when">${esc(status.replaceAll("_", " "))}</span></div>${blocker}${payment}<p><a href="${esc(h.merchant_url)}" target="_blank" rel="noopener">Continue on merchant site</a></p>${browser}${status === "expired" ? '<p class="muted">This checkout hold expired. Ask Air for a fresh handoff.</p>' : ""}${status === "completed" ? '<p>Payment completed — verify the merchant receipt before closing this task.</p>' : ""}${cancel}</section>`;
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
    if (String(form.get("action") ?? "") !== "cancel") return forbidden("unknown action");
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
    return withBaseHeaders(NextResponse.redirect(new URL(ctx.basePath, externalOrigin(ctx.request)), 303));
  },
};
