/**
 * Vault mini-app renderer (extracted from the M7.5 monolith, MA1). Metadata
 * from the Postgres mirror only — the page renders without a box wake and
 * its HTML never contains a secret value (C18). No guest actions: the vault
 * is the canonical owner-only surface (MA4).
 */
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  armStopAfter,
  ensureBoxAwake,
  StartLimitError,
} from "@/lib/orchestrator/boxes";
import {
  applyBatch,
  reveal as revealVaultField,
  VaultCliError,
  type VaultItemMetadata,
} from "@/lib/vault/client";
import { resolvePurchaseReview } from "@/lib/vault/purchase";
import { esc, forbidden, html, page, withBaseHeaders } from "../html";
import type { MiniAppContext, MiniAppModule } from "./types";

// V2 (C18/C20): card values never render on this reduced-trust surface —
// card-field reveal is web-tab (full session) only. Logins may reveal here.
const MINI_REVEAL_BLOCKED_FIELDS = new Set(["number", "cvv"]);

interface PurchaseReviewRow {
  id: string;
  label: string | null;
  payload: unknown;
}

/** V6: the purchase_review live card — site, order summary, amount band,
 * and masked card only (C18); approve/deny resolve in place. */
function renderPurchaseReviews(reviews: PurchaseReviewRow[]): string {
  return reviews
    .map((review) => {
      const payload = review.payload as {
        host?: unknown;
        summary?: unknown;
        amount_band?: unknown;
        card_name?: unknown;
        card_masked?: unknown;
      } | null;
      const host = typeof payload?.host === "string" ? payload.host : "";
      const summary =
        typeof payload?.summary === "string" ? payload.summary : "";
      const band =
        typeof payload?.amount_band === "string" ? payload.amount_band : "";
      const card = [
        typeof payload?.card_name === "string" ? payload.card_name : "",
        typeof payload?.card_masked === "string" ? payload.card_masked : "",
      ]
        .filter(Boolean)
        .join(" ");
      return `<div class="card pending"><strong>Fill ${esc(card || "your card")} on ${esc(host)}?</strong><div class="when" style="white-space:normal;margin-top:4px">${esc(summary)}</div><div class="when" style="margin-top:4px">${esc(band)}</div><div style="display:flex;gap:4px;margin-top:8px"><form method="post" style="margin:0"><input type="hidden" name="action" value="approve_purchase"><input type="hidden" name="decision" value="${esc(review.id)}"><button>Fill card</button></form><form method="post" style="margin:0"><input type="hidden" name="action" value="deny_purchase"><input type="hidden" name="decision" value="${esc(review.id)}"><button class="ghost">Not now</button></form></div><div class="when" style="white-space:normal;margin-top:6px">You always click the final Place order button yourself.</div></div>`;
    })
    .join("");
}

function renderVault(
  items: VaultItemMetadata[],
  revealed: { id: string; field: string; value: string } | null,
  notice: string | null,
  reviews: PurchaseReviewRow[] = []
): string {
  const sections: [string, string, string][] = [
    ["login", "LOGINS", "Add a login…"],
    ["card", "CARDS", ""],
    ["api_key", "API KEYS", ""],
    ["note", "NOTES", ""],
  ];
  const fieldsByKind: Record<string, [string, string][]> = {
    login: [
      ["username", "Username"],
      ["password", "Password"],
      ["site_url", "Site URL"],
    ],
    card: [],
    api_key: [["value", "Key"]],
    note: [["note", "Note"]],
  };
  const body = sections
    .map(([kind, header]) => {
      const rows = items
        .filter((item) => item.kind === kind)
        .map((item) => {
          const fieldRows = (fieldsByKind[kind] ?? [])
            .map(([field, label]) => {
              const isRevealed =
                revealed !== null &&
                revealed.id === item.id &&
                revealed.field === field;
              return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span style="color:var(--muted);font-size:11px;width:72px">${esc(label)}</span><span style="font-family:ui-monospace,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis">${isRevealed ? esc(revealed.value) : "••••••••"}</span><form method="post" style="margin:0;margin-left:auto"><input type="hidden" name="action" value="${isRevealed ? "hide" : "reveal"}"><input type="hidden" name="id" value="${esc(item.id)}"><input type="hidden" name="field" value="${esc(field)}"><button class="ghost">${isRevealed ? "Hide" : "Reveal"}</button></form></div>`;
            })
            .join("");
          const cardNote =
            kind === "card"
              ? '<div style="color:var(--muted);font-size:11px;margin-top:6px">Card number and CVV reveal only in the full Vault tab.</div>'
              : "";
          return `<div class="card"><strong>${esc(item.name)}</strong>${item.masked ? ` <span style="color:var(--muted)">${esc(item.masked)}</span>` : ""}${fieldRows}${cardNote}</div>`;
        })
        .join("");
      const empty =
        rows === ""
          ? '<div class="card" style="border:1px dashed var(--ring);background:transparent;box-shadow:none;color:var(--muted)">Nothing here yet.</div>'
          : "";
      return `<h2 style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--muted);margin:14px 0 6px">${esc(header)}</h2>${rows}${empty}`;
    })
    .join("");
  const addLogin = `<details style="margin-top:14px"><summary style="cursor:pointer;font-size:13px">Add login</summary><p style="color:var(--muted);font-size:12px;margin:6px 0">Values are encrypted in your vault.</p><form method="post" style="display:grid;gap:6px"><input type="hidden" name="action" value="add_login"><input type="text" name="name" placeholder="e.g. &quot;Gmail&quot;, &quot;GitHub&quot;" maxlength="120"><input type="text" name="username" placeholder="Username" maxlength="200"><input type="text" name="password" placeholder="🔒 Password" maxlength="500" autocomplete="off"><button>Save</button></form></details>`;
  const addCard = `<details style="margin-top:8px"><summary style="cursor:pointer;font-size:13px">Add card</summary><p style="color:var(--muted);font-size:12px;margin:6px 0">Values are encrypted in your vault.</p><form method="post" style="display:grid;gap:6px"><input type="hidden" name="action" value="add_card"><input type="text" name="name" placeholder="e.g. &quot;Amex&quot;, &quot;Chase&quot;" maxlength="120"><input type="text" name="number" placeholder="🔒 Card number" inputmode="numeric" maxlength="23" autocomplete="off"><input type="text" name="expiry_month" placeholder="Expiry month" inputmode="numeric" maxlength="2"><input type="text" name="expiry_year" placeholder="Expiry year" inputmode="numeric" maxlength="4"><input type="text" name="cvv" placeholder="🔒 CVV" inputmode="numeric" maxlength="4" autocomplete="off"><input type="text" name="zip" placeholder="Billing ZIP" inputmode="numeric" maxlength="10"><button>Save</button></form></details>`;
  return page(
    "Vault",
    `<h1>Vault</h1>${notice ? `<p style="color:var(--muted);font-size:12px">${esc(notice)}</p>` : ""}${renderPurchaseReviews(reviews)}${body}${addLogin}${addCard}`
  );
}

async function vaultItems(
  supabase: SupabaseClient,
  userId: string
): Promise<VaultItemMetadata[]> {
  const { data } = await supabase
    .from("vault_items")
    .select(
      "id, kind, name, masked, env_var, totp_enabled, created_at, updated_at"
    )
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as VaultItemMetadata[];
}

export const vault: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    const [{ data }, { data: reviewRows }] = await Promise.all([
      ctx.supabase
        .from("vault_items")
        .select(
          "id, kind, name, masked, env_var, totp_enabled, created_at, updated_at"
        )
        .eq("user_id", ctx.session.userId)
        .is("deleted_at", null)
        .order("created_at", { ascending: true }),
      ctx.supabase
        .from("decisions")
        .select("id, label, payload")
        .eq("user_id", ctx.session.userId)
        .eq("kind", "purchase_review")
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10),
    ]);
    return html(
      renderVault(
        (data ?? []) as VaultItemMetadata[],
        null,
        null,
        (reviewRows ?? []) as PurchaseReviewRow[]
      )
    );
  },

  /**
   * Vault actions. Reveal renders the value into the POST response body only
   * (no-store, no redirect) so it never touches a URL; card fields are
   * refused outright on this surface (C18/C20).
   */
  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    const supabase = ctx.supabase;
    const userId = ctx.session.userId;
    const action = String(form.get("action") ?? "");
    const busyPage = () =>
      html(
        renderVault(
          [],
          null,
          "Your agent's computer is busy starting up — try again in a minute."
        )
      );

    if (action === "hide") {
      return html(renderVault(await vaultItems(supabase, userId), null, null));
    }

    if (action === "approve_purchase" || action === "deny_purchase") {
      // V6 (C20): the iMessage live-card resolution of a purchase_review —
      // same effect as the Needs-you queue. Approve mints + burns the fill
      // ticket; the human still clicks the final Place order button.
      const decisionId = String(form.get("decision") ?? "");
      const { data: decision } = await supabase
        .from("decisions")
        .select("id, kind, ref, status, payload")
        .eq("id", decisionId)
        .eq("user_id", userId)
        .maybeSingle();
      if (
        !decision ||
        decision.status !== "pending" ||
        decision.kind !== "purchase_review"
      ) {
        return forbidden("not found");
      }
      const approve = action === "approve_purchase";
      let notice: string | null = approve
        ? "Card fill approved — your agent is filling now. You click Place order."
        : "Okay — the checkout link still works if you want to finish manually.";
      try {
        // Denying needs no box: the owner must always be able to say no,
        // even while the box is start-limited.
        const box = approve
          ? await ensureBoxAwake(supabase, userId)
          : await ensureBoxAwake(supabase, userId).catch(() => null);
        await resolvePurchaseReview(
          supabase,
          userId,
          decision as { id: string; ref: string | null; payload: unknown },
          approve,
          box
        );
        await supabase
          .from("decisions")
          .update({
            status: approve ? "approved" : "dismissed",
            resolved_at: new Date().toISOString(),
          })
          .eq("id", decision.id)
          .eq("user_id", userId);
      } catch (error) {
        if (error instanceof StartLimitError) return busyPage();
        notice = "That didn't go through — try again from Needs you.";
      } finally {
        await armStopAfter(supabase, userId).catch(() => undefined);
      }
      return html(
        renderVault(await vaultItems(supabase, userId), null, notice)
      );
    }

    if (action === "reveal") {
      const id = String(form.get("id") ?? "");
      const field = String(form.get("field") ?? "");
      if (
        !/^[A-Za-z0-9._-]{1,64}$/.test(id) ||
        !/^[a-z_][a-z0-9_]*$/.test(field)
      ) {
        return forbidden("invalid request");
      }
      const items = await vaultItems(supabase, userId);
      const item = items.find((candidate) => candidate.id === id);
      if (!item) return forbidden("not found");
      if (item.kind === "card" || MINI_REVEAL_BLOCKED_FIELDS.has(field)) {
        return forbidden("card reveal is only available in the full Vault tab");
      }
      try {
        const box = await ensureBoxAwake(supabase, userId);
        let value: string;
        try {
          value = await revealVaultField(box.boxId, userId, id, field, "mini");
        } finally {
          await armStopAfter(supabase, userId).catch(() => undefined);
        }
        return html(renderVault(items, { id, field, value }, null));
      } catch (error) {
        if (error instanceof StartLimitError) return busyPage();
        if (error instanceof VaultCliError) {
          return html(renderVault(items, null, "reveal failed"));
        }
        console.error(
          JSON.stringify({
            msg: "vault mini reveal failed",
            user_id: userId,
            error: error instanceof Error ? error.message : "unknown",
          })
        );
        return html(renderVault(items, null, "reveal failed"));
      }
    }

    if (action === "add_login" || action === "add_card") {
      const name = String(form.get("name") ?? "").trim();
      if (name.length === 0 || name.length > 120) {
        return forbidden("name required");
      }
      const fields: Record<string, string> = {};
      if (action === "add_login") {
        const username = String(form.get("username") ?? "");
        const password = String(form.get("password") ?? "");
        if (username) fields.username = username;
        if (password) fields.password = password;
      } else {
        for (const key of [
          "number",
          "expiry_month",
          "expiry_year",
          "cvv",
          "zip",
        ]) {
          const digits = String(form.get(key) ?? "").replace(/\D/g, "");
          if (digits) fields[key] = digits;
        }
      }
      try {
        const box = await ensureBoxAwake(supabase, userId);
        try {
          await applyBatch(box.boxId, userId, [
            {
              op: "create",
              item: {
                kind: action === "add_login" ? "login" : "card",
                name,
                fields,
              },
            },
          ]);
        } finally {
          await armStopAfter(supabase, userId).catch(() => undefined);
        }
      } catch (error) {
        if (error instanceof StartLimitError) return busyPage();
        const items = await vaultItems(supabase, userId);
        return html(renderVault(items, null, "save failed"));
      }
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(ctx.basePath, ctx.request.nextUrl.origin),
          303
        )
      );
    }

    return forbidden("unknown action");
  },
};
