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
import { BASE_HEADERS, esc, html, page } from "../html";
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
<h2 style="font-size:13px;margin:0 0 6px">${esc(panel.title)} <a href="${esc(basePath)}?csv=${esc(panel.key)}" style="font-weight:400;font-size:11px">csv</a></h2>
${panel.note ? `<div class="when" style="white-space:normal;margin-bottom:6px">${esc(panel.note)}</div>` : ""}
${
  panel.rows.length
    ? `<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr style="text-align:left;color:var(--muted)">${header}</tr></thead><tbody>${body}</tbody></table>`
    : `<div class="when" style="white-space:normal">no rows in the last ${WINDOW_DAYS} days.</div>`
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
  else if (key === "storefront") panel = storefrontPanel();
  else if (key === "spend") panel = await spendPanel(ctx.supabase, userId, since);
  if (!panel) {
    return new NextResponse("unknown panel", { status: 404, headers: BASE_HEADERS });
  }
  return new NextResponse(panelToCsv(panel), {
    status: 200,
    headers: {
      ...BASE_HEADERS,
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
    return html(
      page(
        "Analytics",
        `<h1>Analytics <span class="when">last ${WINDOW_DAYS} days</span></h1>
${panels.map((panel) => renderPanel(panel, ctx.basePath)).join("")}`
      )
    );
  },
  // Read-only by design (MA7 #10): no action, so every POST is a loader 404.
};
