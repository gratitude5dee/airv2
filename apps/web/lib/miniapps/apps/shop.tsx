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
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
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
import { StartLimitError } from "@/lib/orchestrator/boxes";
import {
  createPayLink,
  ensurePublishedPayLinks,
  listPayLinks,
  payLinkUrl,
  setPayLinkStatus,
  setPayLinkSlug,
  type PayLink,
  type PayLinkProduct,
} from "@/lib/commerce/payLinks";
import { kernelAvailable, KernelError } from "@/lib/kernel/client";
import {
  ensureKernelVault,
  listKernelVaultItems,
  syncKernelVaultItems,
} from "@/lib/kernel/vaults";
import { stageKernelAction } from "@/lib/kernel/actions";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

// The onboarding redirect targets Stripe's hosted account-link flow, and
// product images come from R2 — both widen the shell's theme-derived CSP.
function shopHtml(body: string): NextResponse {
  const response = shellHtml(body);
  const csp = response.headers.get("Content-Security-Policy") ?? "";
  response.headers.set(
    "Content-Security-Policy",
    csp
      .replace("img-src", `img-src ${env.r2PublicBaseUrl()}`)
      .replace(
        "form-action 'self'",
        "form-action 'self' https://connect.stripe.com https://*.stripe.com"
      )
  );
  return response;
}

function productCard(
  product: StorefrontProduct,
  link: (PayLink & { product: PayLinkProduct | null }) | undefined,
  linksEnabled: boolean
): string {
  const linkRow = linksEnabled
    ? link
      ? `<div class="muted" style="margin:4px 0">${esc(payLinkUrl(link.slug))}${link.status === "paused" ? " · paused" : ""}</div>`
      : `<form method="post"><input type="hidden" name="action" value="pay_link_create"><input type="hidden" name="product_id" value="${esc(product.id)}"><input type="text" name="slug" placeholder="custom slug (optional)" maxlength="65"><button class="ghost">Create payment link</button></form>`
    : "";
  return `<div class="card">${product.image_url ? `<img src="${esc(product.image_url)}" alt="" style="max-width:100%;border-radius:var(--radius-well)">` : ""}<strong>${esc(product.name)}</strong> — $${(product.price_cents / 100).toFixed(2)} <span class="when">${esc(product.kind)}${product.inventory !== null ? ` · ${product.inventory} left` : ""}${product.active ? "" : " · inactive"}</span>
${linkRow}<form method="post"><input type="hidden" name="action" value="promote"><button class="ghost">Propose a promo</button></form>
<form method="post"><input type="hidden" name="action" value="retarget"><input type="hidden" name="product_key" value="${esc(product.product_key)}"><button class="ghost">Propose retargeting</button></form></div>`;
}

function payLinkRow(link: PayLink & { product: PayLinkProduct | null }): string {
  const toggle =
    link.status === "active"
      ? `<form method="post" style="display:inline"><input type="hidden" name="action" value="pay_link_pause"><input type="hidden" name="link_id" value="${esc(link.id)}"><button class="ghost">Pause</button></form>`
      : `<form method="post" style="display:inline"><input type="hidden" name="action" value="pay_link_resume"><input type="hidden" name="link_id" value="${esc(link.id)}"><button class="ghost">Resume</button></form>`;
  return `<div class="item"><span class="grow"><strong>${esc(link.product?.name ?? link.slug)}</strong><br><span class="muted">${esc(payLinkUrl(link.slug))} · ${link.views} views · ${link.checkouts} checkouts${link.status === "paused" ? " · paused" : ""}</span><form method="post"><input type="hidden" name="action" value="pay_link_slug"><input type="hidden" name="link_id" value="${esc(link.id)}"><input type="text" name="slug" value="${esc(link.slug)}" maxlength="65"><button class="ghost">Update URL</button></form></span><span>${toggle}</span></div>`;
}

function kernelCardsSection(
  enabled: boolean,
  items: Array<{ item_key: string; provider: string; kind: string; state: string; brand: string | null; last4: string | null }>
): string {
  if (!enabled) {
    return `<div class="day">Payment cards</div><p class="muted">Cloud card payments aren't enabled yet.</p>`;
  }
  const cards = items.filter((item) => item.kind === "card");
  const wallets = items.filter((item) => item.kind === "wallet");
  const rows = cards.length > 0
    ? cards
        .map(
          (item) =>
            `<div class="item"><span class="grow"><strong>${esc(item.brand ?? item.provider)}</strong>${item.last4 ? ` •••• ${esc(item.last4)}` : ""}<br><span class="muted">${esc(item.state)}</span></span></div>`
        )
        .join("")
    : `<p class="muted">No cards yet — enroll once and every purchase still asks you first.</p>`;
  const walletLine = wallets
    .map((item) => `${esc(item.provider)}: ${esc(item.state)}`)
    .join(" · ");
  return `<div class="day">Payment cards</div>${rows}${walletLine ? `<p class="muted">${walletLine}</p>` : ""}<form method="post"><input type="hidden" name="action" value="payment_enroll"><button class="ghost">Set up card</button></form>`;
}

function orderRow(order: Order): string {
  return `<div class="item"><span>$${(order.amount_cents / 100).toFixed(2)} × ${order.quantity}</span><span class="when">${esc(order.status)}${order.checked_in_at ? " · checked in" : ""}</span></div>`;
}

export const shop: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const { supabase, session } = ctx;
    const note = ctx.request.nextUrl.searchParams.get("note");
    const merchant = await getMerchant(supabase, session.userId);
    const products = await listPublishedProducts(supabase, session.userId);
    const orders = await listOrders(supabase, session.userId);
    const slug = merchant?.charges_enabled
      ? await storefrontSlug(supabase, session.userId)
      : null;
    const payLinks = await listPayLinks(supabase, session.userId);
    const linksEnabled = env.linkHostEnabled();
    const vaultsEnabled = env.kernelVaultsEnabled() && kernelAvailable();
    const kernelItems = vaultsEnabled
      ? await listKernelVaultItems(supabase, session.userId).catch(
          () => [] as Awaited<ReturnType<typeof listKernelVaultItems>>
        )
      : [];
    const status = !merchant
      ? `<div class="card">Connect your own Stripe account to start selling — funds settle directly to you.<form method="post"><input type="hidden" name="action" value="connect"><button>Connect Stripe</button></form></div>`
      : merchant.charges_enabled
        ? `<div class="card">Stripe connected — charges enabled.${slug ? ` Your storefront: <strong>${esc(env.miniappOrigin())}/${esc(slug)}</strong>` : ""}</div>`
        : `<div class="card">Stripe onboarding in progress.<form method="post"><input type="hidden" name="action" value="connect"><button>Resume onboarding</button></form></div>`;
    const linksByProduct = new Map(payLinks.map((link) => [link.product_id, link]));
    const body = `<section class="panel">
${status}
${kernelCardsSection(vaultsEnabled, kernelItems)}
<div class="day">Payment links</div>
${payLinks.length > 0 ? payLinks.map(payLinkRow).join("") : '<p class="muted">No payment links yet — create one from a product below, then share the link.</p>'}
<div class="day">Published products</div>
${products.length > 0 ? products.map((product) => productCard(product, linksByProduct.get(product.id), linksEnabled)).join("") : '<p class="muted">No published products — ask your agent to build your catalog, then approve the publish.</p>'}
<div class="day">Orders</div>
${orders.length > 0 ? orders.map(orderRow).join("") : '<p class="muted">No orders yet.</p>'}
<div class="day">Event check-in</div>
<form method="post" class="addrow"><input type="hidden" name="action" value="check_in"><input type="text" name="code" placeholder="Ticket code" maxlength="64"><button>Check in</button></form>
${promptBar("Ask your agent — e.g. draft a promo for my newest product…")}</section>`;
    return shopHtml(
      renderShell({
        title: "Shop",
        kicker: "Store",
        body,
        notice: note,
        lite: session.via === "card",
      })
    );
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
        if (env.linkHostEnabled()) {
          await ensurePublishedPayLinks(ctx.supabase, ctx.session.userId);
        }
        return back(`published ${count} product${count === 1 ? "" : "s"}`);
      }
      if (action === "pay_link_create") {
        const productId = String(form.get("product_id") ?? "");
        const link = await createPayLink(
          ctx.supabase,
          ctx.session.userId,
          productId,
          String(form.get("slug") ?? "") || null
        );
        return back(`payment link: ${payLinkUrl(link.slug)}`);
      }
      if (action === "pay_link_pause" || action === "pay_link_resume") {
        await setPayLinkStatus(
          ctx.supabase,
          ctx.session.userId,
          String(form.get("link_id") ?? ""),
          action === "pay_link_pause" ? "paused" : "active"
        );
        return back(action === "pay_link_pause" ? "link paused" : "link resumed");
      }
      if (action === "pay_link_slug") {
        await setPayLinkSlug(
          ctx.supabase,
          ctx.session.userId,
          String(form.get("link_id") ?? ""),
          String(form.get("slug") ?? "")
        );
        return back("payment link updated");
      }
      if (action === "payment_enroll") {
        if (!env.kernelVaultsEnabled() || !kernelAvailable()) {
          return back("cloud card payments aren't enabled yet");
        }
        const vault = await ensureKernelVault(
          ctx.supabase,
          ctx.session.userId
        );
        const { action: pending } = await syncKernelVaultItems(
          ctx.supabase,
          ctx.session.userId,
          vault
        );
        if (pending) {
          // Provider-hosted enrollment — the owner goes straight to the
          // staged presenter, which carries the sealed URL once.
          const staged = await stageKernelAction(
            ctx.supabase,
            ctx.session.userId,
            pending,
            null
          );
          return withBaseHeaders(NextResponse.redirect(staged.url, 303));
        }
        return back("no payment step is needed right now");
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
      if (error instanceof KernelError) return back(error.message);
      if (error instanceof AdWriteError) return back(error.message);
      if (error instanceof StartLimitError) {
        return back(
          "your agent's computer can't start right now — try again in a few minutes"
        );
      }
      throw error;
    }
    return back();
  },
};
