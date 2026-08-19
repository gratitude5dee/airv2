/**
 * MA8 #13 public storefront pages at mini.wzrd.tech/<username>-shop — a
 * first-party-rendered published app auto-provisioned per merchant. SSR,
 * public by definition: it renders only the storefront_products projection
 * (already public listing data). Anonymous visitors browse and check out;
 * the only mutation is `checkout`, which resolves price/merchant server-side
 * and redirects into Stripe Checkout (Link) on the merchant's connected
 * account. Receipt pages authorize by the buyer key from the success URL.
 */
import { NextResponse } from "next/server";
import { env } from "@/lib/env";
import {
  getPublishedProduct,
  listPublishedProducts,
  type StorefrontProduct,
} from "@/lib/commerce/catalog";
import {
  logStorefrontEvent,
  orderForReceipt,
  sanitizeRef,
  startCheckout,
} from "@/lib/commerce/checkout";
import { CommerceError } from "@/lib/commerce/merchants";
import { addressQrDataUrl } from "@/lib/wallet/qr";
import { externalOrigin } from "../gates";
import { esc, html, notFound, page, withBaseHeaders } from "../html";
import type { RegistryApp } from "../registry";
import type { MiniAppContext, MiniAppModule } from "./types";

const STOREFRONT_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; " +
  `img-src data: ${env.r2PublicBaseUrl()}; ` +
  "form-action 'self' https://checkout.stripe.com https://*.stripe.com; " +
  "frame-ancestors 'self'";

/** A merchant storefront row: first-party rendered, no bundle, owned. */
export function isStorefrontApp(app: RegistryApp): boolean {
  return (
    app.owner_user_id !== null &&
    app.bundle_version === null &&
    app.publisher_username !== null &&
    app.slug === `${app.publisher_username}-shop`
  );
}

function price(product: StorefrontProduct): string {
  return `$${(product.price_cents / 100).toFixed(2)}`;
}

function refField(ref: string | null): string {
  return ref ? `<input type="hidden" name="ref" value="${esc(ref)}">` : "";
}

function listingPage(
  app: RegistryApp,
  products: StorefrontProduct[],
  ref: string | null,
  note: string | null
): string {
  const cards = products
    .map(
      (product) =>
        `<div class="card">${product.image_url ? `<img src="${esc(product.image_url)}" alt="${esc(product.name)}" style="max-width:100%;border-radius:8px">` : ""}<strong>${esc(product.name)}</strong> — ${price(product)}<div class="when" style="white-space:normal">${esc(product.description.slice(0, 140))}</div><form method="get"><input type="hidden" name="p" value="${esc(product.product_key)}">${ref ? `<input type="hidden" name="ref" value="${esc(ref)}">` : ""}<button>View</button></form></div>`
    )
    .join("");
  return page(
    app.name,
    `<h1>${esc(app.name)}</h1>${note ? `<div class="card">${esc(note)}</div>` : ""}<p class="when" style="white-space:normal">${esc(app.description)}</p>${cards || `<p class="when" style="white-space:normal">Nothing for sale yet — check back soon.</p>`}`
  );
}

function productPage(
  app: RegistryApp,
  product: StorefrontProduct,
  ref: string | null
): string {
  const soldOut = product.inventory !== null && product.inventory < 1;
  return page(
    `${product.name} — ${app.name}`,
    `<h1>${esc(product.name)}</h1>
${product.image_url ? `<img src="${esc(product.image_url)}" alt="${esc(product.name)}" style="max-width:100%;border-radius:12px">` : ""}
<p>${esc(product.description)}</p>
<p><strong>${price(product)}</strong>${product.inventory !== null ? ` <span class="when">${product.inventory} left</span>` : ""}</p>
${
  soldOut
    ? `<p class="when" style="white-space:normal">Sold out.</p>`
    : `<form method="post" class="addrow"><input type="hidden" name="action" value="checkout"><input type="hidden" name="product_key" value="${esc(product.product_key)}">${refField(ref)}<input type="text" name="quantity" value="1" maxlength="2" style="flex:0 0 60px"><button>Buy with Link</button></form>`
}`
  );
}

async function receiptPage(
  ctx: MiniAppContext,
  orderId: string,
  buyerKey: string
): Promise<NextResponse> {
  const order = await orderForReceipt(ctx.supabase, orderId, buyerKey);
  if (!order) return notFound();
  const qr =
    order.ticket_code !== null
      ? await addressQrDataUrl(order.ticket_code)
      : null;
  const body = page(
    "Receipt",
    `<h1>Thanks for your order</h1>
<div class="card"><strong>${esc(order.product?.name ?? "Order")}</strong> × ${order.quantity} — $${(order.amount_cents / 100).toFixed(2)}<div class="when">${esc(order.status)}</div></div>
${
  order.status === "pending"
    ? `<p class="when" style="white-space:normal">Payment confirmation is on its way — refresh in a moment.</p>`
    : ""
}
${
  order.ticket_code
    ? `<div class="card"><strong>Your ticket</strong>${qr ? `<div><img src="${qr}" alt="ticket QR" style="width:180px;height:180px"></div>` : ""}<div class="when">${esc(order.ticket_code)}</div>Show this at the door.</div>`
    : ""
}`
  );
  return html(body, { "Content-Security-Policy": STOREFRONT_CSP });
}

export const storefront: MiniAppModule = {
  publicAccess: true,
  guestActions: ["checkout"],

  async render(ctx: MiniAppContext): Promise<NextResponse> {
    const merchantUserId = ctx.app.owner_user_id;
    if (!merchantUserId) return notFound();
    const params = ctx.request.nextUrl.searchParams;

    const orderId = params.get("order");
    const buyerKey = params.get("k");
    if (orderId && buyerKey) return await receiptPage(ctx, orderId, buyerKey);

    const ref =
      sanitizeRef(params.get("ref")) ?? sanitizeRef(params.get("utm_campaign"));
    const productKey = params.get("p");
    if (productKey) {
      const product = await getPublishedProduct(
        ctx.supabase,
        merchantUserId,
        productKey
      );
      if (!product) return notFound();
      await logStorefrontEvent(ctx.supabase, merchantUserId, "product_view", {
        productId: product.id,
        ref,
      });
      return html(productPage(ctx.app, product, ref), {
        "Content-Security-Policy": STOREFRONT_CSP,
      });
    }

    const products = await listPublishedProducts(ctx.supabase, merchantUserId);
    await logStorefrontEvent(ctx.supabase, merchantUserId, "visit", { ref });
    return html(listingPage(ctx.app, products, ref, params.get("note")), {
      "Content-Security-Policy": STOREFRONT_CSP,
    });
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const action = String(form.get("action") ?? "");
    if (action !== "checkout") return notFound();
    const merchantUserId = ctx.app.owner_user_id;
    if (!merchantUserId) return notFound();
    const storefrontUrl = `${externalOrigin(ctx.request)}${ctx.basePath}`;
    try {
      const result = await startCheckout(
        ctx.supabase,
        merchantUserId,
        String(form.get("product_key") ?? ""),
        String(form.get("quantity") ?? "1"),
        sanitizeRef(form.get("ref")),
        storefrontUrl
      );
      return withBaseHeaders(NextResponse.redirect(result.checkoutUrl, 303));
    } catch (error) {
      if (error instanceof CommerceError) {
        return withBaseHeaders(
          NextResponse.redirect(
            new URL(
              `${ctx.basePath}?note=${encodeURIComponent(error.message)}`,
              externalOrigin(ctx.request)
            ),
            303
          )
        );
      }
      throw error;
    }
  },
};
