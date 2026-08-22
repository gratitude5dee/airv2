/** Analytics mini-app renderer (V9 MA7 #10). Strictly read-only: the module
 * defines no `action`, so the loader 404s every POST; each panel is a
 * filtered read of its source ledger and exports as CSV via `?csv=<panel>`.
 * Renders with a stopped box — nothing here touches the box at all. */
import { NextResponse } from "next/server";
import {
  agentActivityPanel,
  adsPanel,
  allPanels,
  conversionsPanel,
  panelToCsv,
  spendPanel,
  storefrontPanel,
  storePanel,
  windowStart,
  WINDOW_DAYS,
  type Panel,
} from "../analytics";
import { baseHeaders, esc } from "../html";
import { renderShell, shellHtml } from "../shell";
import type { MiniAppContext, MiniAppModule } from "./types";

function renderPanel(panel: Panel, basePath: string): string {
  const header = panel.columns.map((column) => `<th>${esc(column)}</th>`).join("");
  const body = panel.rows
    .map(
      (row) =>
        `<tr>${row.map((cell) => `<td>${esc(String(cell))}</td>`).join("")}</tr>`
    )
    .join("");
  return `<div class="card">
<h2>${esc(panel.title)} <a href="${esc(basePath)}?csv=${esc(panel.key)}">csv</a></h2>
${panel.note ? `<div class="muted">${esc(panel.note)}</div>` : ""}
${
  panel.rows.length
    ? `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table>`
    : `<div class="muted">no rows in the last ${WINDOW_DAYS} days.</div>`
}
</div>`;
}

async function csvResponse(
  ctx: MiniAppContext,
  key: string
): Promise<NextResponse> {
  const since = windowStart();
  const userId = ctx.session.userId;
  let panel: Panel | null = null;
  if (key === "agent") panel = await agentActivityPanel(ctx.supabase, userId, since);
  else if (key === "ads") panel = await adsPanel(ctx.supabase, userId, since);
  else if (key === "conversions")
    panel = await conversionsPanel(ctx.supabase, userId, since);
  else if (key === "store") panel = await storePanel(ctx.supabase, userId, since);
  else if (key === "storefront")
    panel = await storefrontPanel(ctx.supabase, userId, since);
  else if (key === "spend") panel = await spendPanel(ctx.supabase, userId, since);
  if (!panel) {
    return new NextResponse("unknown panel", { status: 404, headers: baseHeaders() });
  }
  return new NextResponse(panelToCsv(panel), {
    status: 200,
    headers: {
      ...baseHeaders(),
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${panel.key}.csv"`,
    },
  });
}

export const analytics: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    const url = new URL(ctx.request.url);
    const csv = url.searchParams.get("csv");
    if (csv) {
      return csvResponse(ctx, csv);
    }
    const panels = await allPanels(ctx.supabase, ctx.session.userId);
    return shellHtml(
      renderShell({
        title: "Analytics",
        kicker: "Numbers",
        body: `<section class="panel"><p class="muted">last ${WINDOW_DAYS} days</p>
${panels.map((panel) => renderPanel(panel, ctx.basePath)).join("")}</section>`,
        lite: ctx.session.via === "card",
      })
    );
  },
  // Read-only by design (MA7 #10): no action, so every POST is a loader 404.
};
