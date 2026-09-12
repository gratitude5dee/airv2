/**
 * Trade mini-app (docs/trade/plan.md §5.2). Five tabs — Portfolio, Trade,
 * Orders, Watch, Settings — server-rendered, owner-only (access='single').
 * The Trust block is the whole product: every order is previewed, the exact
 * order is signed into a 5-minute token (T2), and only the owner's tap on
 * Approve reaches the venue through the decisions resolver (T1). The Coinbase
 * key is BYOK via Settings → connect: written, sealed, never echoed (C18).
 */
import { NextResponse } from "next/server";
import { esc, forbidden, notFound } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { resolveHostedDecision, type HostedDecision } from "@/lib/approvals/hosted";
import {
  connectCoinbase,
  disconnectCoinbase,
  listTradeOrders,
  portfolioView,
  previewTrade,
  proposeTrade,
  proposeTradeCancel,
  setTradeMode,
  tradeMode,
  updateTradeCaps,
  venueFor,
  type PortfolioView,
  type TradeMode,
} from "@/lib/trade/service";
import { deliverTradeApproval } from "@/lib/trade/imessage";
import { TradeError, tradeOrderSchema, type TradeOrder } from "@/lib/trade/order";
import { TradeVenueError } from "@/lib/trade/venue";
import { addWatch, listWatches, removeWatch } from "@/lib/trade/watch";
import type { TradeWatchlistItem } from "@/lib/trade/state";
import type { TradeOrderRecord } from "@/lib/trade/venue";
import type { MiniAppContext, MiniAppModule } from "./types";

const TABS = ["portfolio", "trade", "orders", "watch", "settings"] as const;
type Tab = (typeof TABS)[number];

function tabFor(ctx: MiniAppContext): Tab {
  const fromQuery = ctx.request.nextUrl.searchParams.get("tab");
  if ((TABS as readonly string[]).includes(fromQuery ?? "")) {
    return fromQuery as Tab;
  }
  if (ctx.session.resourceId === "approve") return "trade";
  if (ctx.session.resourceId === "settings") return "settings";
  return "portfolio";
}

function tabNav(ctx: MiniAppContext, active: Tab): string {
  const links = TABS.map((tab) => {
    const label = tab === "watch" ? "Watch" : tab.charAt(0).toUpperCase() + tab.slice(1);
    const cls = tab === active ? "navlink" : "navlink ghost";
    return `<a class="${cls}" style="font-size:0.6rem;min-height:2.3rem;padding:0 0.8rem" href="${esc(
      `${ctx.basePath}?tab=${tab}`,
    )}">${esc(label)}</a>`;
  }).join("");
  return `<nav class="row" style="justify-content:center;width:min(100%,36rem);margin-bottom:0.4rem">${links}</nav>`;
}

function money(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `$${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function qty(value: string | null | undefined): string {
  if (!value) return "—";
  const n = Number(value);
  if (!Number.isFinite(n)) return esc(value);
  if (n >= 1000) return n.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (n >= 1) return n.toLocaleString("en-US", { maximumFractionDigits: 6 });
  return n.toPrecision(4);
}

function modeChip(mode: TradeMode, connected: boolean): string {
  if (mode === "live") {
    return `<span class="chip on">live</span>`;
  }
  return `<span class="chip">paper</span>${connected ? '<span class="chip on">coinbase linked</span>' : '<span class="chip">no coinbase key</span>'}`;
}

function errorNotice(error: unknown): string {
  if (error instanceof TradeError || error instanceof TradeVenueError) {
    return error.message;
  }
  return "Something didn't go through — try again.";
}

/* ---------------------------------------------------------- portfolio */

async function renderPortfolio(ctx: MiniAppContext): Promise<string> {
  let view: PortfolioView | null = null;
  let viewError: string | null = null;
  try {
    view = await portfolioView(ctx.supabase, ctx.session.userId);
  } catch (error) {
    viewError = errorNotice(error);
  }
  if (!view) {
    return `<section class="panel"><p class="muted">${esc(viewError ?? "Portfolio unavailable.")}</p><p class="muted">If live mode is on, check the key in Settings — or switch to paper.</p></section>`;
  }
  const rows = view.balances
    .map(
      (holding) => `<tr><td><strong>${esc(holding.asset)}</strong></td><td class="nowrap">${esc(
        qty(holding.qty),
      )}</td><td class="nowrap">${esc(
        holding.priceUsd ? `$${qty(holding.priceUsd)}` : "—",
      )}</td><td class="nowrap">${esc(money(holding.valueUsd))}</td></tr>`,
    )
    .join("");
  return `<section class="panel"><div class="row" style="justify-content:space-between"><h2>Portfolio</h2>${modeChip(
    view.mode,
    view.connected,
  )}</div><h3 style="font-size:1.9rem;margin:0.2rem 0 0.8rem">${esc(
    money(view.totalUsd),
  )}</h3><div class="tablewrap"><table><thead><tr><th>Asset</th><th>Qty</th><th>Price</th><th>Value</th></tr></thead><tbody>${
    rows || '<tr><td colspan="4" class="muted">No balances yet.</td></tr>'
  }</tbody></table></div><p class="muted" style="font-size:0.8rem">Balances are read-only views. Nothing here moves money without an approval.</p></section>`;
}

/* -------------------------------------------------------------- trade */

const TRADE_DECISION_KINDS = [
  "trade_order",
  "trade_cancel",
  "trade_settings",
] as const;
type TradeDecisionKind = (typeof TRADE_DECISION_KINDS)[number];

interface PendingApproval {
  decisionId: string;
  kind: TradeDecisionKind;
  label: string;
  summary: string;
  estimated: Record<string, unknown>;
  expiresAt: string | null;
  mode: string;
}

async function pendingApproval(ctx: MiniAppContext): Promise<PendingApproval | null> {
  const { data } = await ctx.supabase
    .from("decisions")
    .select("id, kind, ref, label, payload")
    .eq("user_id", ctx.session.userId)
    .in("kind", [...TRADE_DECISION_KINDS])
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1);
  const row = data?.[0];
  if (!row) return null;
  const payload = (row.payload ?? {}) as Record<string, unknown>;
  const order = (payload["order"] ?? {}) as Record<string, unknown>;
  return {
    decisionId: row.id as string,
    kind: row.kind as TradeDecisionKind,
    label: (row.label as string) ?? "",
    summary: `${order["side"] ?? ""} ${order["productId"] ?? ""}`,
    estimated: payload,
    expiresAt: typeof payload["expires_at"] === "string" ? payload["expires_at"] : null,
    mode: typeof payload["mode"] === "string" ? payload["mode"] : "paper",
  };
}

function approvalBlock(pending: PendingApproval): string {
  const est = pending.estimated;
  const heading =
    pending.kind === "trade_order"
      ? "Approve this exact order"
      : pending.kind === "trade_cancel"
        ? "Approve this cancellation"
        : "Approve these cap changes";
  const approveCta =
    pending.kind === "trade_order"
      ? "Approve — place it"
      : pending.kind === "trade_cancel"
        ? "Approve — cancel it"
        : "Approve — apply caps";
  const denyLabel = pending.kind === "trade_order" ? "Deny" : "Keep as-is";
  const detailRows =
    pending.kind === "trade_order"
      ? [
          `<table><tbody>`,
          `<tr><td class="nowrap">Est. price</td><td class="nowrap">${esc(String(est["estimated_price"] ?? "—"))}</td></tr>`,
          `<tr><td class="nowrap">Est. fill</td><td class="nowrap">${esc(String(est["estimated_fill"] ?? "—"))}</td></tr>`,
          `<tr><td class="nowrap">Fee</td><td class="nowrap">${esc(String(est["fee"] ?? "—"))}</td></tr>`,
          `<tr><td class="nowrap">Total</td><td class="nowrap"><strong>${esc(String(est["total"] ?? "—"))} ${esc(String(est["currency"] ?? ""))}</strong></td></tr>`,
          `</tbody></table>`,
        ].join("")
      : "";
  const lines = [
    `<div class="card" style="border-style:dashed"><strong>${heading}</strong><p style="font-size:1.05rem;margin:0.35rem 0">${esc(
      pending.label,
    )}</p>`,
    detailRows,
    `<p class="when" style="margin-top:0.4rem;white-space:normal">${esc(pending.mode)}${pending.expiresAt ? ` · approval expires ${esc(new Date(pending.expiresAt).toLocaleTimeString())}` : ""}</p>`,
    `<div class="row actions">`,
    `<form method="post"><input type="hidden" name="action" value="resolve"><input type="hidden" name="tab" value="trade"><input type="hidden" name="decision" value="${esc(
      pending.decisionId,
    )}"><input type="hidden" name="choice" value="approve"><button>${approveCta}</button></form>`,
    `<form method="post"><input type="hidden" name="action" value="resolve"><input type="hidden" name="tab" value="trade"><input type="hidden" name="decision" value="${esc(
      pending.decisionId,
    )}"><input type="hidden" name="choice" value="dismiss"><button class="ghost">${denyLabel}</button></form>`,
    `</div></div>`,
  ];
  return lines.join("");
}

/** The review block after Preview — the exact signed order + token, carried
 *  forward inside hidden fields so propose re-binds byte-for-byte (T2). */
function reviewBlock(result: {
  order: TradeOrder;
  previewToken: string;
  summary: string;
  expiresAt: string;
  preview: { estimatedPrice: string | null; estimatedFill: string | null; fee: string | null; total: string | null; currency: string | null };
}): string {
  const order = result.order;
  const fields = [
    `<input type="hidden" name="product" value="${esc(order.productId)}">`,
    `<input type="hidden" name="side" value="${esc(order.side)}">`,
    `<input type="hidden" name="type" value="${esc(order.type)}">`,
    order.baseSize ? `<input type="hidden" name="base_size" value="${esc(order.baseSize)}">` : "",
    order.quoteSize ? `<input type="hidden" name="quote_size" value="${esc(order.quoteSize)}">` : "",
    order.limitPrice ? `<input type="hidden" name="limit_price" value="${esc(order.limitPrice)}">` : "",
    order.stopPrice ? `<input type="hidden" name="stop_price" value="${esc(order.stopPrice)}">` : "",
    order.stopDirection ? `<input type="hidden" name="stop_direction" value="${esc(order.stopDirection)}">` : "",
    `<input type="hidden" name="preview_token" value="${esc(result.previewToken)}">`,
  ].join("");
  const rows = [
    `<tr><td class="nowrap">Order</td><td><strong>${esc(result.summary)}</strong></td></tr>`,
    `<tr><td class="nowrap">Est. price</td><td class="nowrap">${esc(result.preview.estimatedPrice ?? "—")}</td></tr>`,
    `<tr><td class="nowrap">Est. fill</td><td class="nowrap">${esc(result.preview.estimatedFill ?? "—")}</td></tr>`,
    `<tr><td class="nowrap">Fee</td><td class="nowrap">${esc(result.preview.fee ?? "—")}</td></tr>`,
    `<tr><td class="nowrap">Total</td><td class="nowrap"><strong>${esc(result.preview.total ?? "—")} ${esc(result.preview.currency ?? "")}</strong></td></tr>`,
  ].join("");
  return `<div class="card" style="border-style:dashed"><strong>Review the exact order</strong><table><tbody>${rows}</tbody></table><p class="when" style="white-space:normal">Preview expires ${esc(
    new Date(result.expiresAt).toLocaleTimeString(),
  )} — approving after that does nothing.</p><div class="row actions"><form method="post">${fields}<input type="hidden" name="action" value="propose"><input type="hidden" name="tab" value="trade"><button>Send to approval</button></form><a class="navlink ghost" style="font-size:0.6rem" href="?tab=trade">Discard</a></div></div>`;
}

function ticketForm(products: { productId: string }[]): string {
  const options = products
    .slice(0, 60)
    .map((p) => `<option value="${esc(p.productId)}">`)
    .join("");
  return `<form method="post" class="stack"><input type="hidden" name="action" value="preview"><input type="hidden" name="tab" value="trade">
  <div class="row"><input type="text" name="product" list="trade-products" placeholder="BTC-USD" autocomplete="off" required><datalist id="trade-products">${options}</datalist></div>
  <div class="row"><select name="side"><option value="BUY">Buy</option><option value="SELL">Sell</option></select><select name="type"><option value="market">Market</option><option value="limit">Limit</option><option value="stop_limit">Stop-limit</option></select></div>
  <div class="row"><input type="text" name="size" inputmode="decimal" placeholder="50" autocomplete="off" required><select name="size_unit"><option value="quote">$ quote</option><option value="base">base</option></select></div>
  <div class="row"><input type="text" name="limit_price" inputmode="decimal" placeholder="limit price (limit/stop-limit)" autocomplete="off"><input type="text" name="stop_price" inputmode="decimal" placeholder="stop price (stop-limit)" autocomplete="off"></div>
  <div class="row"><select name="stop_direction"><option value="">stop dir (stop-limit)</option><option value="up">up</option><option value="down">down</option></select><button>Preview exact order</button></div></form>`;
}

async function renderTradeTab(
  ctx: MiniAppContext,
  review: Parameters<typeof reviewBlock>[0] | null,
): Promise<string> {
  const pending = await pendingApproval(ctx);
  const { mode, connection } = await tradeMode(ctx.supabase, ctx.session.userId);
  const { venue } = await venueFor(ctx.supabase, ctx.session.userId);
  let products: { productId: string }[] = [];
  try {
    products = (await venue.listProducts("USD", 60)).map((p) => ({
      productId: p.productId,
    }));
  } catch {
    products = [];
  }
  const connectHint =
    mode === "paper" && !connection
      ? `<p class="muted">Paper mode — simulated fills at real prices. Connect Coinbase in Settings to trade for real.</p>`
      : "";
  return `<section class="panel">${pending ? approvalBlock(pending) : ""}${review ? reviewBlock(review) : pending ? "" : ticketForm(products)}${connectHint}</section>`;
}

/* ------------------------------------------------------------- orders */

async function renderOrders(ctx: MiniAppContext): Promise<string> {
  let open: TradeOrderRecord[] = [];
  let recent: TradeOrderRecord[] = [];
  let ordersError: string | null = null;
  try {
    open = await listTradeOrders(ctx.supabase, ctx.session.userId, "open");
    recent = await listTradeOrders(ctx.supabase, ctx.session.userId, "recent");
  } catch (error) {
    ordersError = errorNotice(error);
  }
  const { data: local } = await ctx.supabase
    .from("trade_orders")
    .select("id, product_id, side, order_type, state, error_code, created_at, mode")
    .eq("user_id", ctx.session.userId)
    .order("created_at", { ascending: false })
    .limit(20);
  const localRows = ((local ?? []) as Record<string, unknown>[])
    .map(
      (row) =>
        `<tr><td class="nowrap">${esc(
          new Date(String(row["created_at"])).toLocaleDateString(),
        )}</td><td>${esc(String(row["side"]))} ${esc(String(row["product_id"]))}</td><td class="nowrap">${esc(
          String(row["order_type"]),
        )}</td><td class="nowrap">${esc(String(row["state"]))}${
          row["error_code"] ? ` <span class="chip">${esc(String(row["error_code"]))}</span>` : ""
        }</td><td class="nowrap">${esc(String(row["mode"]))}</td></tr>`,
    )
    .join("");
  const openRows = open
    .map(
      (order) =>
        `<div class="item"><div class="grow">${esc(order.side)} ${esc(order.productId)} ${esc(
          order.sizeLabel,
        )}<div class="when">${esc(order.status.toLowerCase())}</div></div><form method="post"><input type="hidden" name="action" value="cancel"><input type="hidden" name="tab" value="orders"><input type="hidden" name="ref" value="${esc(
          order.orderId,
        )}"><button class="ghost">Cancel</button></form></div>`,
    )
    .join("");
  return `<section class="panel"><h2>Open orders</h2>${
    ordersError ? `<p class="muted">${esc(ordersError)}</p>` : openRows || '<p class="muted">Nothing open.</p>'
  }<h2>Order ledger</h2><div class="tablewrap"><table><thead><tr><th>Date</th><th>Order</th><th>Type</th><th>State</th><th>Mode</th></tr></thead><tbody>${
    localRows || '<tr><td colspan="5" class="muted">No orders yet.</td></tr>'
  }</tbody></table></div><h2>Venue history</h2><div class="tablewrap"><table><thead><tr><th>Order</th><th>Status</th><th>Filled</th><th>Fee</th></tr></thead><tbody>${recent
    .slice(0, 15)
    .map(
      (order) =>
        `<tr><td>${esc(order.side)} ${esc(order.productId)} ${esc(order.sizeLabel)}</td><td class="nowrap">${esc(
          order.status.toLowerCase(),
        )}</td><td class="nowrap">${esc(order.filledValue ?? "—")}</td><td class="nowrap">${esc(order.fee ?? "—")}</td></tr>`,
    )
    .join("")}</tbody></table></div></section>`;
}

/* -------------------------------------------------------------- watch */

async function renderWatch(ctx: MiniAppContext): Promise<string> {
  let items: TradeWatchlistItem[] = [];
  try {
    items = await listWatches(ctx.supabase, ctx.session.userId);
  } catch (error) {
    return `<section class="panel"><p class="muted">${esc(errorNotice(error))}</p><p class="muted">Watch alerts need your agent's computer awake; a stopped box pauses them.</p></section>`;
  }
  const rows = items
    .map(
      (item) =>
        `<div class="item${item.state === "fired" ? " pending" : ""}"><div class="grow">${esc(
          item.symbol,
        )} ${item.op} $${esc(item.price)}<div class="when">${item.state}</div></div><form method="post"><input type="hidden" name="action" value="unwatch"><input type="hidden" name="tab" value="watch"><input type="hidden" name="symbol" value="${esc(
          item.symbol,
        )}"><button class="ghost">Remove</button></form></div>`,
    )
    .join("");
  return `<section class="panel"><h2>Price watches</h2>${rows || '<p class="muted">No watches yet — set one and get an iMessage when it crosses.</p>'}<form method="post" class="addrow"><input type="hidden" name="action" value="watch"><input type="hidden" name="tab" value="watch"><input type="text" name="symbol" placeholder="SOL" maxlength="8" style="max-width:6rem"><select name="op"><option value=">">&gt;</option><option value="<">&lt;</option></select><input type="text" name="price" inputmode="decimal" placeholder="200"><button>Watch</button></form><p class="muted" style="font-size:0.8rem;margin-top:0.7rem">Checks run while your agent's computer is awake (once a minute).</p></section>`;
}

/* ----------------------------------------------------------- settings */

async function renderSettings(ctx: MiniAppContext): Promise<string> {
  const { mode, connection } = await tradeMode(ctx.supabase, ctx.session.userId);
  const conn = connection;
  const linked = conn?.status === "connected";
  const keyHint = conn?.key_id_hint ? `·${conn.key_id_hint}` : "";
  const statusChip =
    conn?.status === "connected"
      ? `<span class="chip on">connected ${esc(keyHint)}</span>`
      : conn?.status === "error"
        ? `<span class="chip">key error</span>`
        : `<span class="chip">not connected</span>`;
  const modeButtons = `<div class="row"><form method="post"><input type="hidden" name="action" value="mode"><input type="hidden" name="tab" value="settings"><input type="hidden" name="mode" value="paper"><button class="${mode === "paper" ? "" : "ghost"}">Paper</button></form><form method="post"><input type="hidden" name="action" value="mode"><input type="hidden" name="tab" value="settings"><input type="hidden" name="mode" value="live"><button class="${mode === "live" ? "" : "ghost"}">Live</button></form></div>`;
  // minmax(0,1fr) — stack's implicit auto column would size to the inputs'
  // max-content and spill past the panel.
  const caps = `<form method="post" class="stack" style="grid-template-columns:minmax(0,1fr)"><input type="hidden" name="action" value="caps"><input type="hidden" name="tab" value="settings"><div class="row"><input type="text" name="per_order" inputmode="decimal" placeholder="per-order $" value="${esc(
    String(conn?.per_order_usd_cap ?? 250),
  )}"><input type="text" name="daily" inputmode="decimal" placeholder="daily $" value="${esc(
    String(conn?.daily_usd_cap ?? 1000),
  )}"></div><button class="ghost">Update caps</button><p class="when" style="white-space:normal">Lowering caps applies now. Raising them files a Needs-you approval.</p></form>`;
  const connect = `<details${linked ? "" : " open"}><summary>Coinbase key (BYOK)</summary><p class="muted" style="font-size:0.85rem">Create an Advanced Trade API key at <strong>portal.coinbase.com</strong> with spot trading permission. Paste it once — it's sealed and never shown again. Rotating means re-entering both fields.</p><form method="post" class="stack"><input type="hidden" name="action" value="connect"><input type="hidden" name="tab" value="settings"><input type="text" name="key_id" placeholder="Key name / id" autocomplete="off" required><input type="password" name="key_secret" placeholder="Key secret" autocomplete="off" required><input type="text" name="portfolio_uuid" placeholder="Portfolio UUID (optional)" autocomplete="off"><button>${linked ? "Replace key" : "Connect Coinbase"}</button></form>${
    linked
      ? `<form method="post" style="margin-top:0.6rem"><input type="hidden" name="action" value="disconnect"><input type="hidden" name="tab" value="settings"><button class="ghost">Disconnect &amp; delete key</button></form>`
      : ""
  }</details>`;
  return `<section class="panel"><h2>Trading mode</h2>${modeButtons}<h2 style="margin-top:1rem">Coinbase</h2>${statusChip}${connect}<h2 style="margin-top:1rem">Caps</h2>${caps}</section>`;
}

/* ------------------------------------------------------------- module */

async function renderPage(
  ctx: MiniAppContext,
  notice: string | null,
  review: Parameters<typeof reviewBlock>[0] | null = null,
): Promise<NextResponse> {
  const tab = tabFor(ctx);
  let body = "";
  if (tab === "portfolio") body = await renderPortfolio(ctx);
  else if (tab === "trade") body = await renderTradeTab(ctx, review);
  else if (tab === "orders") body = await renderOrders(ctx);
  else if (tab === "watch") body = await renderWatch(ctx);
  else body = await renderSettings(ctx);
  const full = `${tabNav(ctx, tab)}${body}<section class="panel" style="padding-top:0.6rem">${promptBar(
    "Ask your agent — e.g. buy $50 of BTC, what's my portfolio…",
  )}</section>`;
  return shellHtml(
    renderShell({
      title: "Trade",
      kicker: "Trading",
      body: full,
      notice,
      lite: ctx.session.via === "card",
      headline: false,
    }),
  );
}

function orderFromForm(form: FormData): Record<string, unknown> {
  const type = String(form.get("type") ?? "market");
  const side = String(form.get("side") ?? "BUY");
  const size = String(form.get("size") ?? "");
  const order: Record<string, unknown> = {
    productId: String(form.get("product") ?? ""),
    side,
    type,
  };
  if (size) {
    if (type === "market" && side === "BUY") {
      order["quoteSize"] = size;
    } else if (type === "market" && side === "SELL") {
      order["baseSize"] = size;
    } else {
      order["baseSize"] = size; // limit and stop-limit size in base units
    }
  }
  const limit = String(form.get("limit_price") ?? "");
  const stop = String(form.get("stop_price") ?? "");
  const stopDir = String(form.get("stop_direction") ?? "");
  if (limit) order["limitPrice"] = limit;
  if (stop) order["stopPrice"] = stop;
  if (stopDir === "up" || stopDir === "down") order["stopDirection"] = stopDir;
  return order;
}

export const trade: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("Trade is owner-only.");
    }
    return renderPage(ctx, null);
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("Trade is owner-only.");
    }
    const action = String(form.get("action") ?? "");
    const userId = ctx.session.userId;

    if (action === "prompt") {
      try {
        await runPrompt(ctx, String(form.get("text") ?? ""));
      } catch (error) {
        if (error instanceof StartLimitError) {
          return renderPage(ctx, "Your agent's computer can't start right now — try again in a few minutes.");
        }
        throw error;
      }
      return renderPage(ctx, "Sent to your agent.");
    }

    if (action === "preview") {
      try {
        const result = await previewTrade(
          ctx.supabase,
          userId,
          orderFromForm(form),
          "miniapp",
        );
        return renderPage(ctx, null, {
          order: result.order,
          previewToken: result.previewToken,
          summary: result.summary,
          expiresAt: result.expiresAt,
          preview: result.preview,
        });
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "propose") {
      // Hidden fields re-compose the canonical order; the token binds it.
      const orderInput: Record<string, unknown> = {
        productId: String(form.get("product") ?? ""),
        side: String(form.get("side") ?? ""),
        type: String(form.get("type") ?? ""),
      };
      for (const [key, field] of [
        ["baseSize", "base_size"],
        ["quoteSize", "quote_size"],
        ["limitPrice", "limit_price"],
        ["stopPrice", "stop_price"],
        ["stopDirection", "stop_direction"],
      ] as const) {
        const value = String(form.get(field) ?? "");
        if (value) orderInput[key] = value;
      }
      try {
        const parsed = tradeOrderSchema.safeParse(orderInput);
        if (!parsed.success) {
          return renderPage(ctx, "The order fields changed — preview again.");
        }
        const result = await proposeTrade(ctx.supabase, userId, {
          order: parsed.data,
          previewToken: String(form.get("preview_token") ?? ""),
        });
        return renderPage(ctx, `Approval filed — ${result.summary}. Approve below or in Needs you.`);
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "resolve") {
      const decisionId = String(form.get("decision") ?? "");
      const choice = String(form.get("choice") ?? "dismiss");
      const { data: decision } = await ctx.supabase
        .from("decisions")
        .select("id, kind, ref, status, label, payload")
        .eq("id", decisionId)
        .eq("user_id", userId)
        .eq("status", "pending")
        .maybeSingle();
      if (
        !decision ||
        !TRADE_DECISION_KINDS.includes(decision.kind as TradeDecisionKind)
      ) {
        return renderPage(ctx, "That approval is no longer pending.");
      }
      try {
        const outcome = await resolveHostedDecision(
          ctx.supabase,
          userId,
          decision as HostedDecision,
          choice === "approve" ? "approve" : "dismiss",
        );
        const trade = (outcome as { trade?: { state: string; detail: string } }).trade;
        if (choice === "approve") {
          const msg =
            trade?.state === "rejected"
              ? `Rejected by the venue — ${trade.detail}`
              : trade?.state === "filled" || trade?.state === "submitted"
                ? `Done — ${trade?.detail ?? "order submitted"}.`
                : "Approved.";
          return renderPage(ctx, msg);
        }
        return renderPage(
          ctx,
          decision.kind === "trade_order"
            ? "Denied — nothing was placed."
            : "Kept as-is.",
        );
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "cancel") {
      const ref = String(form.get("ref") ?? "");
      try {
        const result = await proposeTradeCancel(ctx.supabase, userId, ref);
        await deliverTradeApproval(
          ctx.supabase,
          userId,
          result.decisionId,
          result.label,
        );
        return renderPage(ctx, `${result.label} — approve the cancel in Needs you or the card.`);
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "watch") {
      try {
        const { item } = await addWatch(ctx.supabase, userId, {
          symbol: form.get("symbol"),
          op: form.get("op"),
          price: form.get("price"),
        });
        return renderPage(ctx, `Watching ${item.symbol} ${item.op} $${item.price}.`);
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "unwatch") {
      try {
        await removeWatch(ctx.supabase, userId, String(form.get("symbol") ?? ""));
        return renderPage(ctx, "Removed.");
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "mode") {
      const mode = String(form.get("mode") ?? "paper");
      if (mode !== "paper" && mode !== "live") return forbidden("bad mode");
      try {
        await setTradeMode(ctx.supabase, userId, mode);
        return renderPage(
          ctx,
          mode === "paper"
            ? "Paper trading on — simulated fills at real prices."
            : "Live trading on — every order still needs your approval.",
        );
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "connect") {
      try {
        const result = await connectCoinbase(ctx.supabase, userId, {
          keyId: form.get("key_id"),
          keySecret: form.get("key_secret"),
          portfolioUuid: form.get("portfolio_uuid"),
        });
        return renderPage(
          ctx,
          result.mode === "live"
            ? `Coinbase connected${result.portfolioName ? ` (${result.portfolioName})` : ""} — you're live.`
            : "Coinbase connected — still in paper mode (flip to Live when you're ready).",
        );
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "disconnect") {
      try {
        await disconnectCoinbase(ctx.supabase, userId);
        return renderPage(ctx, "Disconnected — the key is deleted and you're back on paper.");
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    if (action === "caps") {
      try {
        const result = await updateTradeCaps(ctx.supabase, userId, {
          perOrderUsdCap: Number(String(form.get("per_order") ?? "")),
          dailyUsdCap: Number(String(form.get("daily") ?? "")),
        });
        return renderPage(
          ctx,
          result.applied
            ? "Caps updated."
            : "Raising caps needs your approval — it's in Needs you.",
        );
      } catch (error) {
        return renderPage(ctx, errorNotice(error));
      }
    }

    return notFound();
  },
};
