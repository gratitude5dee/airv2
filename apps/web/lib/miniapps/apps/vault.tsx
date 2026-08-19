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
import {
  disableManager,
  enableManager,
  listManagers,
  ManagerInputError,
  type ManagerId,
  type ManagerStatus,
} from "@/lib/vault/managers";
import { normalizeHost, setSiteGrant } from "@/lib/browser/grants";
import { externalOrigin } from "../gates";
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

/** Mirror row with the MA5 default-card flag (metadata only, never a value). */
type VaultItemRow = VaultItemMetadata & { default_for_purchases?: boolean };

const ITEM_COLUMNS =
  "id, kind, name, masked, env_var, totp_enabled, default_for_purchases, created_at, updated_at";

interface GrantEventRow {
  item_id: string | null;
  action: string;
  context: string | null;
  created_at: string;
}

/**
 * Current per-site grants, folded from the grant_site/revoke_site event
 * ledger (MA5 #2): the latest event per (item, host) wins. The box grant
 * file stays authoritative for fills; this surface mirrors the audit trail.
 */
function foldSiteGrants(events: GrantEventRow[]): Map<string, string[]> {
  const latest = new Map<string, { allow: boolean; itemId: string; host: string }>();
  for (const event of events) {
    if (!event.item_id || !event.context) continue;
    const key = `${event.item_id}\u0000${event.context}`;
    if (!latest.has(key)) {
      latest.set(key, {
        allow: event.action === "grant_site",
        itemId: event.item_id,
        host: event.context,
      });
    }
  }
  const byItem = new Map<string, string[]>();
  for (const { allow, itemId, host } of latest.values()) {
    if (!allow) continue;
    const hosts = byItem.get(itemId) ?? [];
    hosts.push(host);
    byItem.set(itemId, hosts.sort());
  }
  return byItem;
}

const MANAGER_LABELS: Record<ManagerId, string> = {
  bitwarden: "Bitwarden",
  onepassword: "1Password",
  command: "Command helper",
};

/** Manager choice surfaced in the vault, not only Settings (MA5 #2). Status
 * labels and counts only — never a token or a secret value (C18). */
function renderManagers(managers: ManagerStatus[]): string {
  const rows = managers
    .map((m) => {
      const label = MANAGER_LABELS[m.manager];
      const status = m.enabled
        ? `${m.status}${m.provenance_count !== null ? ` · ${m.provenance_count} secrets` : ""}`
        : "off";
      const toggle = m.enabled
        ? `<form method="post" style="margin:0"><input type="hidden" name="action" value="disable_manager"><input type="hidden" name="manager" value="${esc(m.manager)}"><button class="ghost">Disable</button></form>`
        : "";
      const warning = m.warnings
        ? `<div style="color:var(--muted);font-size:11px;margin-top:2px">${esc(m.warnings)}</div>`
        : "";
      return `<div class="item"><span style="flex:1">${esc(label)} <span style="color:var(--muted);font-size:11px">${esc(status)}</span>${warning}</span>${toggle}</div>`;
    })
    .join("");
  const enable = `<details style="margin-top:6px"><summary style="cursor:pointer;font-size:13px">Bring your own manager</summary><form method="post" style="display:grid;gap:6px;margin-top:6px"><input type="hidden" name="action" value="enable_manager"><select name="manager" style="background:var(--surface);color:var(--text);border:0.5px solid var(--ring);border-radius:10px;padding:8px 10px;font-size:13px"><option value="bitwarden">Bitwarden (machine-account token)</option><option value="onepassword">1Password (service-account token)</option></select><input type="password" name="token" placeholder="Access token" maxlength="512" autocomplete="off"><button>Enable</button></form><p style="color:var(--muted);font-size:11px;margin:4px 0 0">The token goes straight to your agent's computer — never stored on the platform, never shown again.</p></details>`;
  return `<h2 style="font-size:11px;font-weight:600;letter-spacing:0.08em;color:var(--muted);margin:14px 0 6px">SECRET MANAGERS</h2>${rows}${enable}`;
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
  items: VaultItemRow[],
  revealed: { id: string; field: string; value: string } | null,
  notice: string | null,
  reviews: PurchaseReviewRow[] = [],
  managers: ManagerStatus[] = [],
  siteGrants: Map<string, string[]> = new Map()
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
          const defaultChip =
            kind === "card"
              ? item.default_for_purchases
                ? ' <span style="color:var(--muted);font-size:11px">· default for purchases</span>'
                : `<form method="post" style="margin:0;display:inline;margin-left:6px"><input type="hidden" name="action" value="set_default_card"><input type="hidden" name="id" value="${esc(item.id)}"><button class="ghost">Make default</button></form>`
              : "";
          const hosts = siteGrants.get(item.id) ?? [];
          const grantRows =
            kind === "login" && hosts.length > 0
              ? `<div style="color:var(--muted);font-size:11px;margin-top:6px">Site access:${hosts
                  .map(
                    (host) =>
                      ` <span style="white-space:nowrap">${esc(host)} <form method="post" style="margin:0;display:inline"><input type="hidden" name="action" value="revoke_site"><input type="hidden" name="id" value="${esc(item.id)}"><input type="hidden" name="host" value="${esc(host)}"><button class="ghost">Revoke</button></form></span>`
                  )
                  .join("")}</div>`
              : "";
          return `<div class="card"><strong>${esc(item.name)}</strong>${item.masked ? ` <span style="color:var(--muted)">${esc(item.masked)}</span>` : ""}${defaultChip}${fieldRows}${grantRows}${cardNote}</div>`;
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
    `<h1>Vault</h1>${notice ? `<p style="color:var(--muted);font-size:12px">${esc(notice)}</p>` : ""}${renderPurchaseReviews(reviews)}${body}${addLogin}${addCard}${renderManagers(managers)}`
  );
}

async function vaultItems(
  supabase: SupabaseClient,
  userId: string
): Promise<VaultItemRow[]> {
  const { data } = await supabase
    .from("vault_items")
    .select(ITEM_COLUMNS)
    .eq("user_id", userId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  return (data ?? []) as VaultItemRow[];
}

async function vaultContext(
  supabase: SupabaseClient,
  userId: string
): Promise<{ managers: ManagerStatus[]; siteGrants: Map<string, string[]> }> {
  const eventQuery = (action: "grant_site" | "revoke_site") =>
    supabase
      .from("vault_events")
      .select("item_id, action, context, created_at")
      .eq("user_id", userId)
      .eq("action", action)
      .order("created_at", { ascending: false })
      .limit(250);
  const [managers, { data: grants }, { data: revokes }] = await Promise.all([
    listManagers(supabase, userId).catch(() => [] as ManagerStatus[]),
    eventQuery("grant_site"),
    eventQuery("revoke_site"),
  ]);
  const events = [
    ...((grants ?? []) as GrantEventRow[]),
    ...((revokes ?? []) as GrantEventRow[]),
  ].sort((a, b) => b.created_at.localeCompare(a.created_at));
  return { managers, siteGrants: foldSiteGrants(events) };
}

/** Full page reload used by action responses (managers + grants included). */
async function vaultPage(
  supabase: SupabaseClient,
  userId: string,
  revealed: { id: string; field: string; value: string } | null,
  notice: string | null
): Promise<NextResponse> {
  const [items, context] = await Promise.all([
    vaultItems(supabase, userId),
    vaultContext(supabase, userId),
  ]);
  return html(
    renderVault(items, revealed, notice, [], context.managers, context.siteGrants)
  );
}

export const vault: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    const [{ data }, { data: reviewRows }, context] = await Promise.all([
      ctx.supabase
        .from("vault_items")
        .select(ITEM_COLUMNS)
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
      vaultContext(ctx.supabase, ctx.session.userId),
    ]);
    return html(
      renderVault(
        (data ?? []) as VaultItemRow[],
        null,
        null,
        (reviewRows ?? []) as PurchaseReviewRow[],
        context.managers,
        context.siteGrants
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
      return vaultPage(supabase, userId, null, null);
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
      return vaultPage(supabase, userId, null, notice);
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
        return vaultPage(supabase, userId, { id, field, value }, null);
      } catch (error) {
        if (error instanceof StartLimitError) return busyPage();
        if (error instanceof VaultCliError) {
          return vaultPage(supabase, userId, null, "reveal failed");
        }
        console.error(
          JSON.stringify({
            msg: "vault mini reveal failed",
            user_id: userId,
            error: error instanceof Error ? error.message : "unknown",
          })
        );
        return vaultPage(supabase, userId, null, "reveal failed");
      }
    }

    if (action === "set_default_card") {
      // MA5 #2 default-card affordance: a metadata flag on the mirror row.
      // Purchase proposers may read it; approval gates are untouched.
      const id = String(form.get("id") ?? "");
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(id)) {
        return forbidden("invalid request");
      }
      const { data: card } = await supabase
        .from("vault_items")
        .select("id")
        .eq("user_id", userId)
        .eq("id", id)
        .eq("kind", "card")
        .is("deleted_at", null)
        .maybeSingle();
      if (!card) return forbidden("not found");
      await supabase
        .from("vault_items")
        .update({ default_for_purchases: false })
        .eq("user_id", userId)
        .eq("kind", "card");
      await supabase
        .from("vault_items")
        .update({ default_for_purchases: true })
        .eq("user_id", userId)
        .eq("id", id);
      return vaultPage(supabase, userId, null, "Default purchase card set.");
    }

    if (action === "revoke_site") {
      // Same path as the browser surface's grant action: ownership check on
      // the mirror, box grant file write, then the audit event.
      const id = String(form.get("id") ?? "");
      const host = normalizeHost(String(form.get("host") ?? ""));
      if (!/^[A-Za-z0-9._-]{1,64}$/.test(id) || !host) {
        return forbidden("invalid request");
      }
      const { data: item } = await supabase
        .from("vault_items")
        .select("id")
        .eq("user_id", userId)
        .eq("id", id)
        .eq("kind", "login")
        .is("deleted_at", null)
        .maybeSingle();
      if (!item) return forbidden("not found");
      try {
        const box = await ensureBoxAwake(supabase, userId);
        try {
          await setSiteGrant(box.boxId, id, host, false);
        } finally {
          await armStopAfter(supabase, userId).catch(() => undefined);
        }
        await supabase.from("vault_events").insert({
          user_id: userId,
          item_id: id,
          action: "revoke_site",
          context: host,
        });
      } catch (error) {
        if (error instanceof StartLimitError) return busyPage();
        return vaultPage(supabase, userId, null, "revoke failed — try again");
      }
      return vaultPage(supabase, userId, null, `Access to ${host} revoked.`);
    }

    if (action === "enable_manager") {
      const manager = String(form.get("manager") ?? "");
      if (manager !== "bitwarden" && manager !== "onepassword") {
        return forbidden("unknown manager");
      }
      const token = String(form.get("token") ?? "");
      try {
        const box = await ensureBoxAwake(supabase, userId);
        try {
          await enableManager(supabase, userId, box.boxId, { manager, token });
        } finally {
          await armStopAfter(supabase, userId).catch(() => undefined);
        }
      } catch (error) {
        if (error instanceof StartLimitError) return busyPage();
        if (error instanceof ManagerInputError) {
          return vaultPage(supabase, userId, null, error.message);
        }
        return vaultPage(
          supabase,
          userId,
          null,
          "enabling the manager failed — try again"
        );
      }
      return vaultPage(supabase, userId, null, "Manager enabled.");
    }

    if (action === "disable_manager") {
      const manager = String(form.get("manager") ?? "");
      if (
        manager !== "bitwarden" &&
        manager !== "onepassword" &&
        manager !== "command"
      ) {
        return forbidden("unknown manager");
      }
      try {
        const box = await ensureBoxAwake(supabase, userId);
        try {
          await disableManager(supabase, userId, box.boxId, manager);
        } finally {
          await armStopAfter(supabase, userId).catch(() => undefined);
        }
      } catch (error) {
        if (error instanceof StartLimitError) return busyPage();
        return vaultPage(
          supabase,
          userId,
          null,
          "disabling the manager failed — try again"
        );
      }
      return vaultPage(supabase, userId, null, "Manager disabled.");
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
        return vaultPage(supabase, userId, null, "save failed");
      }
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(ctx.basePath, externalOrigin(ctx.request)),
          303
        )
      );
    }

    return forbidden("unknown action");
  },
};
