/**
 * MasterKey "Store" mini-app: the human-facing catalog of ~2,000 pay-per-use
 * x402 services the user's agent can also reach over MCP. Prices are
 * display-only — MasterKey pays the provider from the user's per-user wallet.
 * "Pay & run" never charges directly: it files a run_approval decision in
 * Needs you (same lane as wallet sends) and the approval executes the run
 * server-side through the /api/mcp/masterkey seam. Owner sessions only.
 */
import { NextResponse } from "next/server";
import { externalOrigin } from "../gates";
import { esc, forbidden, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import {
  fetchCatalog,
  fetchMasterkeyWallet,
  MasterkeyError,
  type Catalog,
  type CatalogEntry,
  type MasterkeyWallet,
} from "@/lib/masterkey/client";
import { createTransferRequest, shortAddress, WalletSendError } from "@/lib/wallet/send";
import {
  createRunRequest,
  listMasterkeyRuns,
  MasterkeyRunError,
  parseRunInput,
  type MasterkeyRun,
} from "@/lib/masterkey/runs";
import { StartLimitError } from "@/lib/orchestrator/boxes";
import { promptBar, runPrompt } from "../promptBar";
import type { MiniAppContext, MiniAppModule } from "./types";

const PAGE_SIZE = 60;

interface StoreQuery {
  q: string;
  category: string;
  page: number;
}

function matches(entry: CatalogEntry, q: string): boolean {
  if (!q) return true;
  const hay = [
    entry.name,
    entry.provider,
    entry.category,
    entry.subcategory,
    entry.description ?? "",
    ...entry.tags,
  ]
    .join(" ")
    .toLowerCase();
  return q
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((term) => hay.includes(term));
}

function entryCard(entry: CatalogEntry): string {
  const price = entry.price.display || "Varies";
  const description = entry.description ? `<div class="muted">${esc(entry.description)}</div>` : "";
  return `<div class="card"><div class="row"><strong>${esc(entry.name)}</strong> <span class="when">${esc(price)}</span></div>
<div class="muted">${esc(entry.category)} · ${esc(entry.subcategory)} · ${esc(entry.provider)}</div>${description}
<details><summary>Pay &amp; run</summary>
<form method="post"><input type="hidden" name="action" value="run"><input type="hidden" name="service_id" value="${esc(entry.id)}">
<textarea name="input" rows="3" placeholder='Input as JSON, e.g. {"prompt": "a red fox"}'></textarea>
<button>Pay &amp; run (${esc(price)})</button></form></details></div>`;
}

function runCard(run: MasterkeyRun): string {
  const cost = run.cost_usd !== null ? `$${Number(run.cost_usd).toFixed(4)}` : run.estimate_usd !== null ? `~$${Number(run.estimate_usd)}` : "";
  const result = run.result_text
    ? `<details><summary>Result</summary><pre style="white-space:pre-wrap;word-break:break-word;font-size:0.82rem">${esc(run.result_text)}</pre></details>`
    : "";
  const hint =
    run.status === "pending"
      ? '<div class="muted">Waiting for your approval in Needs you.</div>'
      : run.status === "failed" && run.error_code
        ? `<div class="muted">Failed: ${esc(run.error_code)}</div>`
        : "";
  return `<div class="card${run.status === "pending" ? " pending" : ""}"><div class="row"><strong>${esc(run.service_name ?? run.service_id)}</strong> <span class="when">${esc(run.status)}${cost ? ` · ${esc(cost)}` : ""}</span></div>${hint}${result}</div>`;
}

function walletCard(wallet: MasterkeyWallet | null): string {
  if (!wallet?.baseAddress) {
    return '<div class="card"><strong>Service wallet</strong><div class="muted">Not provisioned yet — it is created the first time your agent connects.</div></div>';
  }
  const balance = wallet.usdcBase !== null ? `${esc(wallet.usdcBase)} USDC` : "balance unavailable";
  return `<div class="card"><div class="row"><strong>Service wallet</strong> <span class="when">${balance} on Base</span></div>
<div class="muted">Runs are paid from this wallet (${esc(shortAddress(wallet.baseAddress))}). Top-ups move USDC from your wallet and need your approval.</div>
<form method="post" class="addrow"><input type="hidden" name="action" value="topup">
<input type="text" name="amount" inputmode="decimal" placeholder="Amount (USDC)" maxlength="20"><button>Top up</button></form></div>`;
}

function pageLink(basePath: string, query: StoreQuery, page: number, label: string): string {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("cat", query.category);
  if (page > 1) params.set("page", String(page));
  const qs = params.toString();
  return `<a class="navlink" href="${esc(basePath + (qs ? `?${qs}` : ""))}">${esc(label)}</a>`;
}

function renderStore(
  catalog: Catalog | null,
  runs: MasterkeyRun[],
  wallet: MasterkeyWallet | null,
  query: StoreQuery,
  basePath: string,
  note: string | null,
  lite: boolean
): string {
  const entries = catalog
    ? catalog.entries.filter(
        (entry) => (!query.category || entry.category === query.category) && matches(entry, query.q)
      )
    : [];
  const pages = Math.max(1, Math.ceil(entries.length / PAGE_SIZE));
  const page = Math.min(Math.max(1, query.page), pages);
  const slice = entries.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const categories = catalog
    ? catalog.categories
        .map(
          (category) =>
            `<option value="${esc(category.slug)}"${category.slug === query.category ? " selected" : ""}>${esc(category.name)} (${category.count})</option>`
        )
        .join("")
    : "";
  const active = runs.filter((run) => run.status === "pending" || run.status === "approved");
  const history = runs.filter((run) => run.status !== "pending" && run.status !== "approved");
  const nav =
    pages > 1
      ? `<div class="row actions">${page > 1 ? pageLink(basePath, query, page - 1, "← Previous") : ""}<span class="when">Page ${page} of ${pages}</span>${page < pages ? pageLink(basePath, query, page + 1, "Next →") : ""}</div>`
      : "";
  const body = `<section class="panel">
<div class="day">Wallet</div>${walletCard(wallet)}
${active.length > 0 ? `<div class="day">Your runs</div>${active.map(runCard).join("")}` : ""}
<div class="day">Catalog${catalog ? ` · ${catalog.entries.length} services` : ""}</div>
<form method="get" class="addrow"><input type="text" name="q" value="${esc(query.q)}" placeholder="Search services…" maxlength="80"><select name="cat"><option value="">All categories</option>${categories}</select><button>Search</button></form>
${
  catalog
    ? slice.length > 0
      ? `<p class="muted">${entries.length} match${entries.length === 1 ? "" : "es"}. Prices are what MasterKey pays the provider from your wallet.</p>${slice.map(entryCard).join("")}${nav}`
      : '<p class="muted">No services match.</p>'
    : '<p class="muted">The catalog is unavailable right now — try again shortly.</p>'
}
${history.length > 0 ? `<div class="day">History</div>${history.slice(0, 10).map(runCard).join("")}` : ""}
${promptBar("Ask your agent — e.g. use MasterKey to generate an image of…")}</section>`;
  return renderShell({ title: "Store", kicker: "MasterKey", body, notice: note, lite });
}

function readQuery(ctx: MiniAppContext): StoreQuery {
  const params = ctx.request.nextUrl.searchParams;
  const page = Number.parseInt(params.get("page") ?? "1", 10);
  return {
    q: (params.get("q") ?? "").slice(0, 80),
    category: (params.get("cat") ?? "").slice(0, 80),
    page: Number.isFinite(page) && page > 0 ? page : 1,
  };
}

export const masterkey: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    if (ctx.session.role !== "owner") {
      return forbidden("this view is owner-only");
    }
    const [catalog, runs, wallet] = await Promise.all([
      fetchCatalog().catch((error: unknown) => {
        console.error(
          JSON.stringify({
            msg: "masterkey catalog fetch failed",
            error: error instanceof Error ? error.message : "unknown",
          })
        );
        return null;
      }),
      listMasterkeyRuns(ctx.supabase, ctx.session.userId),
      fetchMasterkeyWallet(ctx.supabase, ctx.session.userId).catch(() => null),
    ]);
    const note = ctx.request.nextUrl.searchParams.get("note");
    return shellHtml(
      renderStore(
        catalog,
        runs,
        wallet,
        readQuery(ctx),
        ctx.basePath,
        note,
        ctx.session.via === "card"
      )
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
            note ? `${ctx.basePath}?note=${encodeURIComponent(note)}` : ctx.basePath,
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
      if (action === "topup") {
        const wallet = await fetchMasterkeyWallet(ctx.supabase, ctx.session.userId);
        if (!wallet?.baseAddress) return back("no service wallet to fund yet");
        await createTransferRequest(
          ctx.supabase,
          ctx.session.userId,
          wallet.baseAddress,
          String(form.get("amount") ?? ""),
          "usdc"
        );
        return back("approve the top-up in Needs you");
      }
      if (action === "run") {
        const serviceId = String(form.get("service_id") ?? "").trim();
        if (!serviceId) return back("pick a service first");
        const input = parseRunInput(String(form.get("input") ?? ""));
        await createRunRequest(ctx.supabase, ctx.session.userId, {
          serviceId,
          operation: String(form.get("operation") ?? "").trim() || null,
          input,
        });
        return back("approve the run in Needs you — it pays from your wallet");
      }
    } catch (error) {
      if (
        error instanceof MasterkeyRunError ||
        error instanceof MasterkeyError ||
        error instanceof WalletSendError
      ) {
        return back(error.message);
      }
      if (error instanceof StartLimitError) {
        return back("your agent's computer can't start right now — try again in a few minutes");
      }
      throw error;
    }
    return back();
  },
};
