/**
 * link.wzrd.tech/<slug> — public product payment-link pages (Phase 3). A
 * shareable URL per product: reads an active pay_links row and renders the
 * product with a Buy button that starts the existing Connect Checkout
 * (card + Link — inbound sales). Stripe success returns here with
 * ?order=<id>&k=<buyer-key> and renders the receipt.
 *
 * Server-derived prices only: startCheckout re-reads the product and the
 * merchant's Stripe account — the URL carries no price, and a paused link
 * is indistinguishable from a missing one.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  baseHeaders,
  esc,
  page,
  withBaseHeaders,
} from "@/lib/miniapps/html";
import { renderShell } from "@/lib/miniapps/shell";
import {
  getPayLinkBySlug,
  recordPayLinkEvent,
} from "@/lib/commerce/payLinks";
import { CommerceError } from "@/lib/commerce/merchants";
import {
  orderForReceipt,
  sanitizeRef,
  startCheckout,
} from "@/lib/commerce/checkout";
import { env } from "@/lib/env";
import {
  pairAttemptSource,
  payLinkCheckoutRateLimited,
} from "@/lib/security/limits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function html(body: string, status = 200): NextResponse {
  return new NextResponse(page("Payment link", body), {
    status,
    headers: { ...baseHeaders(), "Content-Type": "text/html; charset=utf-8" },
  });
}

async function receipt(
  orderId: string,
  buyerKey: string
): Promise<NextResponse> {
  const supabase = serviceClient();
  const order = await orderForReceipt(supabase, orderId, buyerKey);
  if (!order) return html(`<h1>Order</h1><div class="card">Order not found.</div>`, 404);
  const body = renderShell({
    title: "Thanks for your order",
    kicker: "Payment link",
    body: `<section class="panel">
<div class="card"><strong>${esc(order.product?.name ?? "Order")}</strong> × ${order.quantity} — $${(order.amount_cents / 100).toFixed(2)}<div class="when">${esc(order.status)}</div></div>
${order.status === "pending" ? '<p class="muted">Payment confirmation is on its way — refresh in a moment.</p>' : ""}
${order.ticket_code ? `<div class="card"><strong>Your ticket</strong><div class="when">${esc(order.ticket_code)}</div>Show this at the door.</div>` : ""}
</section>`,
    lite: false,
  });
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...baseHeaders(),
      "Content-Type": "text/html; charset=utf-8",
      // Stripe success_url redirects here; keep the receipt off referrers.
      "Referrer-Policy": "no-referrer",
    },
  });
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await context.params;
  const params = request.nextUrl.searchParams;
  const orderId = params.get("order");
  const buyerKey = params.get("k");
  if (orderId && buyerKey) return receipt(orderId, buyerKey);

  const supabase = serviceClient();
  const found = await getPayLinkBySlug(supabase, slug);
  if (!found) {
    return html(`<h1>Payment link</h1><div class="card">This link is not available.</div>`, 404);
  }
  const { link, product } = found;
  await recordPayLinkEvent(supabase, link.id, "views").catch(() => undefined);
  const soldOut = product.inventory !== null && product.inventory < 1;
  const note = params.get("note");
  const buy = soldOut
    ? '<p class="muted">Sold out.</p>'
    : `<form method="post" class="addrow"><input type="text" name="quantity" value="1" maxlength="2" style="flex:0 0 60px"><button>Buy now</button></form>`;
  const body = renderShell({
    title: product.name,
    kicker: "Payment link",
    body: `<section class="panel">
${note ? `<div class="card">${esc(note)}</div>` : ""}
<div class="card">${product.image_url ? `<img src="${esc(product.image_url)}" alt="" style="max-width:100%;border-radius:var(--radius-well)">` : ""}<strong>${esc(product.name)}</strong> — $${(product.price_cents / 100).toFixed(2)}${product.description ? `<div class="muted" style="margin-top:4px">${esc(product.description)}</div>` : ""}${buy}</div>
<p class="muted">Secure checkout by Stripe — card or Link.</p>
</section>`,
    lite: false,
  });
  const response = new NextResponse(body, {
    status: 200,
    headers: { ...baseHeaders(), "Content-Type": "text/html; charset=utf-8" },
  });
  // Product images come from R2 — same widen as the shop surface.
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  response.headers.set(
    "Content-Security-Policy",
    csp.replace("img-src", `img-src ${env.r2PublicBaseUrl()}`)
  );
  return response;
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await context.params;
  const supabase = serviceClient();
  const found = await getPayLinkBySlug(supabase, slug);
  if (!found) {
    return html(`<h1>Payment link</h1><div class="card">This link is not available.</div>`, 404);
  }
  const { link, product } = found;
  const source = pairAttemptSource(request.headers);
  if (await payLinkCheckoutRateLimited(supabase, source, link.id)) {
    return html(
      `<h1>Payment link</h1><div class="card">Too many checkout attempts. Try again in a minute.</div>`,
      429
    );
  }
  const form = await request.formData();
  const linkOrigin = `${env.linkappOrigin()}/${slug}`;
  try {
    const result = await startCheckout(
      supabase,
      link.user_id,
      product.product_key,
      String(form.get("quantity") ?? "1"),
      sanitizeRef(form.get("ref")),
      linkOrigin
    );
    await recordPayLinkEvent(supabase, link.id, "checkouts").catch(
      () => undefined
    );
    return withBaseHeaders(NextResponse.redirect(result.checkoutUrl, 303));
  } catch (error) {
    if (error instanceof CommerceError) {
      return withBaseHeaders(
        NextResponse.redirect(
          `${env.linkappOrigin()}/${slug}?note=${encodeURIComponent(error.message)}`,
          303
        )
      );
    }
    throw error;
  }
}
