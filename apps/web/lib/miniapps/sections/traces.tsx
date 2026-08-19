/**
 * MA9.3 — Settings "Traces" section, self-contained for Session D to mount:
 *
 *   render: `await renderTracesSection(ctx)` → HTML fragment (owner only).
 *
 * Shows the most recent receipts (metadata only, straight from the per-user
 * ledgers) and links the export endpoint. The export links hit
 * /api/me/traces/export, which authenticates via the owner's web session —
 * they work on the main origin where Settings is opened from the app shell.
 */
import { esc } from "../html";
import { fetchReceipts } from "@/lib/traces/receipts";
import type { MiniAppContext } from "../apps/types";

const RECENT = 50;

export async function renderTracesSection(
  ctx: MiniAppContext
): Promise<string> {
  if (ctx.session.role !== "owner") {
    return `<h2>Traces</h2><p class="muted">Owner only.</p>`;
  }
  const receipts = await fetchReceipts(
    ctx.supabase,
    ctx.session.userId,
    {},
    RECENT * 10
  );
  const recent = receipts.slice(-RECENT).reverse();
  const rows = recent
    .map(
      (row) =>
        `<tr><td>${esc(String(row.ts ?? ""))}</td><td>${esc(String(row.kind ?? ""))}</td><td>${esc(String(row.label ?? ""))}</td><td>${esc(String(row.status ?? ""))}</td></tr>`
    )
    .join("");
  return `<h2>Traces</h2>
<p class="muted">Receipts of what your agent did — runs, decisions, vault access, mini-app gates, creative jobs. Metadata only; transcripts stay on your computer unless you export them below.</p>
<table><thead><tr><th>When</th><th>Kind</th><th>What</th><th>Status</th></tr></thead>
<tbody>${rows || `<tr><td colspan="4" class="muted">No activity yet.</td></tr>`}</tbody></table>
<p>
<a href="/api/me/traces/export?format=csv" download>Export CSV</a> ·
<a href="/api/me/traces/export?format=jsonl" download>Export JSONL</a> ·
<a href="/api/me/traces/export?format=jsonl&amp;include=transcripts" download>Export JSONL + transcripts</a>
</p>`;
}
