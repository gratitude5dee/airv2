/**
 * MA8 #12 Pay mini-app: the owner's payment-request surface. Requests are
 * filed by the agent (backing tool) or here; approving a fiat request
 * redirects into Stripe Checkout (Link) on the payee's connected account,
 * approving a USDC request files the existing wallet transfer approval.
 * Owner sessions only — no guest actions.
 */
import { NextResponse } from "next/server";
import { externalOrigin } from "../gates";
import { esc, forbidden, html, page, withBaseHeaders } from "../html";
import {
  approvePaymentRequest,
  createPaymentRequest,
  dismissPaymentRequest,
  listPaymentRequests,
  type PaymentRequest,
} from "@/lib/commerce/paymentRequests";
import { CommerceError } from "@/lib/commerce/merchants";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

// Chrome enforces form-action on the redirect that follows a form POST, so
// the approval redirect into Stripe Checkout must be allowed here.
const PAY_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; " +
  "form-action 'self' https://checkout.stripe.com https://*.stripe.com; " +
  "frame-ancestors 'self'";

function statusBadge(request: PaymentRequest): string {
  return `<span class="when">${esc(request.status)}</span>`;
}

function requestCard(request: PaymentRequest): string {
  const amount =
    request.currency === "usdc"
      ? `${request.amount_display} USDC`
      : request.amount_display;
  const actions =
    request.status === "pending"
      ? `<form method="post"><input type="hidden" name="action" value="approve"><input type="hidden" name="id" value="${esc(request.id)}"><button>Approve &amp; pay</button></form>
<form method="post"><input type="hidden" name="action" value="dismiss"><input type="hidden" name="id" value="${esc(request.id)}"><button class="ghost">Dismiss</button></form>`
      : "";
  return `<div class="card"><strong>${esc(amount)}</strong> to ${esc(request.payee)} ${statusBadge(request)}${request.memo ? `<div>${esc(request.memo)}</div>` : ""}${actions}</div>`;
}

function renderPay(requests: PaymentRequest[], note: string | null): string {
  const pending = requests.filter((r) => r.status === "pending");
  const rest = requests.filter((r) => r.status !== "pending");
  return page(
    "Pay",
    `<h1>Pay</h1>
${note ? `<div class="card">${esc(note)}</div>` : ""}
${pending.length > 0 ? `<div class="day">Needs you</div>${pending.map(requestCard).join("")}` : "<p class=\"when\" style=\"white-space:normal\">No pending payment requests.</p>"}
${rest.length > 0 ? `<div class="day">History</div>${rest.map(requestCard).join("")}` : ""}
<div class="day">New request</div>
<form method="post" class="addrow"><input type="hidden" name="action" value="request"><input type="text" name="amount" placeholder="Amount (USD, e.g. 12.50)" maxlength="20"><input type="text" name="payee" placeholder="Payee username" maxlength="64"><input type="text" name="memo" placeholder="Memo" maxlength="200"><button>Request</button></form>
${promptBar("Ask your agent — e.g. request $20 from sam for dinner…")}`
  );
}

export const pay: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const requests = await listPaymentRequests(ctx.supabase, ctx.session.userId);
    const note = ctx.request.nextUrl.searchParams.get("note");
    return html(renderPay(requests, note), {
      "Content-Security-Policy": PAY_CSP,
    });
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const action = String(form.get("action") ?? "");
    const origin = externalOrigin(ctx.request);
    const back = (note?: string) =>
      withBaseHeaders(
        NextResponse.redirect(
          new URL(
            note
              ? `${ctx.basePath}?note=${encodeURIComponent(note)}`
              : ctx.basePath,
            origin
          ),
          303
        )
      );
    try {
      if (action === "prompt") {
        await runPrompt(ctx, String(form.get("text") ?? ""));
        return back("sent to your agent");
      }
      if (action === "approve") {
        const result = await approvePaymentRequest(
          ctx.supabase,
          ctx.session.userId,
          String(form.get("id") ?? ""),
          `${origin}${ctx.basePath}`
        );
        if (result.checkoutUrl) {
          return withBaseHeaders(
            NextResponse.redirect(result.checkoutUrl, 303)
          );
        }
        return back("approve the send in Needs you — it executes from your wallet");
      }
      if (action === "dismiss") {
        await dismissPaymentRequest(
          ctx.supabase,
          ctx.session.userId,
          String(form.get("id") ?? "")
        );
        return back();
      }
      if (action === "request") {
        const raw = String(form.get("amount") ?? "").trim();
        const cents = Math.round(Number(raw) * 100);
        await createPaymentRequest(ctx.supabase, ctx.session.userId, {
          currency: "usd",
          amount: cents,
          payee: String(form.get("payee") ?? ""),
          memo: String(form.get("memo") ?? ""),
        });
        return back("request filed — approve it when you're ready");
      }
    } catch (error) {
      if (error instanceof CommerceError) return back(error.message);
      if (error instanceof StartLimitError) {
        return back("your agent's computer can't start right now — try again in a few minutes");
      }
      throw error;
    }
    return back();
  },
};
