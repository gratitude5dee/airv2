/**
 * MA8 #13 Shop mini-app — the MERCHANT view (owner only). Onboarding runs
 * through a Stripe Connect Standard account link (the merchant's own Stripe
 * account; the platform never custodies funds). The catalog's source of
 * truth stays box-side; this surface shows the published projection,
 * orders, event check-in, and files decision-gated promotion / retargeting
 * proposals — it never publishes or spends by itself.
 */
import { NextResponse } from "next/server";
import { externalOrigin } from "../gates";
import { esc, html, page, withBaseHeaders } from "../html";
import { env } from "@/lib/env";
import {
  CommerceError,
  getMerchant,
  startOnboarding,
  storefrontSlug,
} from "@/lib/commerce/merchants";
import {
  applyCatalogPublish,
  listPublishedProducts,
  type StorefrontProduct,
} from "@/lib/commerce/catalog";
import { checkInTicket, listOrders, type Order } from "@/lib/commerce/checkout";
import { proposeForUser } from "@/lib/publish/propose";
import { requestAdWrite, AdWriteError } from "@/lib/ads/approvals";
import type { MiniAppContext, MiniAppModule } from "./types";

// The onboarding redirect targets Stripe's hosted account-link flow.
const SHOP_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; " +
  `img-src ${env.r2PublicBaseUrl()}; ` +
  "form-action 'self' https://connect.stripe.com https://*.stripe.com; " +
  "frame-ancestors 'self'";

function productCard(product: StorefrontProduct): string {
  return `<div class="card">${product.image_url ? `<img src="${esc(product.image_url)}" alt="" style="max-width:100%;border-radius:8px">` : ""}<strong>${esc(product.name)}</strong> — $${(product.price_cents / 100).toFixed(2)} <span class="when">${esc(product.kind)}${product.inventory !== null ? ` · ${product.inventory} left` : ""}${product.active ? "" : " · inactive"}</span>
<form method="post"><input type="hidden" name="action" value="promote"><button class="ghost">Propose a promo</button></form>
<form method="post"><input type="hidden" name="action" value="retarget"><input type="hidden" name="product_key" value="${esc(product.product_key)}"><button class="ghost">Propose retargeting</button></form></div>`;
}

function orderRow(order: Order): string {
  return `<div class="item"><span>$${(order.amount_cents / 100).toFixed(2)} × ${order.quantity}</span><span class="when">${esc(order.status)}${order.checked_in_at ? " · checked in" : ""}</span></div>`;
}

export const shop: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    const { supabase, session } = ctx;
    const note = ctx.request.nextUrl.searchParams.get("note");
    const merchant = await getMerchant(supabase, session.userId);
    const products = await listPublishedProducts(supabase, session.userId);
    const orders = await listOrders(supabase, session.userId);
    const slug = merchant?.charges_enabled
      ? await storefrontSlug(supabase, session.userId)
      : null;
    const status = !merchant
      ? `<div class="card">Connect your own Stripe account to start selling — funds settle directly to you.<form method="post"><input type="hidden" name="action" value="connect"><button>Connect Stripe</button></form></div>`
      : merchant.charges_enabled
        ? `<div class="card">Stripe connected — charges enabled.${slug ? ` Your storefront: <strong>${esc(env.miniappOrigin())}/${esc(slug)}</strong>` : ""}</div>`
        : `<div class="card">Stripe onboarding in progress.<form method="post"><input type="hidden" name="action" value="connect"><button>Resume onboarding</button></form></div>`;
    const body = page(
      "Shop",
      `<h1>Shop</h1>
${note ? `<div class="card">${esc(note)}</div>` : ""}
${status}
<div class="day">Published products</div>
${products.length > 0 ? products.map(productCard).join("") : `<p class="when" style="white-space:normal">No published products — ask your agent to build your catalog, then approve the publish.</p>`}
<div class="day">Orders</div>
${orders.length > 0 ? orders.map(orderRow).join("") : `<p class="when" style="white-space:normal">No orders yet.</p>`}
<div class="day">Event check-in</div>
<form method="post" class="addrow"><input type="hidden" name="action" value="check_in"><input type="text" name="code" placeholder="Ticket code" maxlength="64"><button>Check in</button></form>`
    );
    return html(body, { "Content-Security-Policy": SHOP_CSP });
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
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
      if (action === "connect") {
        const here = `${origin}${ctx.basePath}`;
        const url = await startOnboarding(
          ctx.supabase,
          ctx.session.userId,
          here,
          here
        );
        return withBaseHeaders(NextResponse.redirect(url, 303));
      }
      if (action === "publish_catalog") {
        // Owner session = the approval surface; project the box catalog now.
        const count = await applyCatalogPublish(ctx.supabase, ctx.session.userId);
        return back(`published ${count} product${count === 1 ? "" : "s"}`);
      }
      if (action === "check_in") {
        const result = await checkInTicket(
          ctx.supabase,
          ctx.session.userId,
          String(form.get("code") ?? "")
        );
        return back(result.message);
      }
      if (action === "promote") {
        // Proposals only: the sweep files content_plan decisions; nothing
        // is published until the owner approves in Needs you.
        const result = await proposeForUser(ctx.supabase, ctx.session.userId);
        return back(
          result.slotsProposed > 0
            ? `proposed ${result.slotsProposed} post${result.slotsProposed === 1 ? "" : "s"} — approve in Needs you`
            : "nothing new to propose right now"
        );
      }
      if (action === "retarget") {
        const productKey = String(form.get("product_key") ?? "");
        const { data: account } = await ctx.supabase
          .from("ad_accounts")
          .select("id")
          .eq("user_id", ctx.session.userId)
          .eq("status", "active")
          .limit(1)
          .maybeSingle();
        if (!account) return back("connect an ad account first");
        // Decision-gated ad write: files the proposal; the existing
        // approval + spend-ceiling gates own execution.
        await requestAdWrite(ctx.supabase, ctx.session.userId, {
          accountId: account.id as string,
          kind: "create_campaign",
          campaignName: `Retarget: ${productKey}`.slice(0, 100),
          dailyBudgetCents: 1000,
          args: { product_key: productKey, objective: "retargeting" },
        });
        return back("retargeting campaign proposed — approve in Needs you");
      }
    } catch (error) {
      if (error instanceof CommerceError) return back(error.message);
      if (error instanceof AdWriteError) return back(error.message);
      throw error;
    }
    return back();
  },
};
