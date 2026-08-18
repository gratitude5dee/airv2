/**
 * Mini-app webviews (M7.5). One handler, three moves:
 *  - GET ?t=<token>: verify token.app === path.app, redeem the single-use
 *    token, exchange it for a short-lived HttpOnly cookie scoped to this
 *    app's path, and redirect with the token stripped from the URL (C15).
 *  - GET (cookie): render the view as plain server HTML — nothing is ever
 *    written to localStorage/sessionStorage (C17).
 *  - POST (cookie): apply one action (form post) and redirect back.
 * All state lives in the user's box; this origin shares no session with the
 * main app.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { mintToken, redeemOnce, verifyToken } from "@/lib/miniapps/tokens";
import { desktopStreamUrl, DesktopUnavailableError } from "@/lib/box/desktop";
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
import {
  addKanbanCard,
  getKanban,
  getTodos,
  moveKanbanCard,
  updateTodo,
  type KanbanBoard,
  type TodoList,
} from "@/lib/miniapps/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const APPS = new Set(["kanban", "todo", "computer", "vault"]);

// V2 (C18/C20): card values never render on this reduced-trust surface —
// card-field reveal is web-tab (full session) only. Logins may reveal here.
const MINI_REVEAL_BLOCKED_FIELDS = new Set(["number", "cvv"]);

const BASE_HEADERS: Record<string, string> = {
  "Referrer-Policy": "no-referrer",
  "X-Frame-Options": "SAMEORIGIN",
  "Content-Security-Policy":
    "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'",
  "Cache-Control": "no-store",
};

function esc(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function page(title: string, body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><title>${esc(title)}</title><style>
:root{--bg:#fafafa;--surface:#ffffff;--surface-2:#f4f4f5;--ring:rgba(0,0,0,0.08);--text:#1a1a1a;--muted:#a1a1a1;--shadow:0 0 0 0.5px rgba(0,0,0,0.08),0 1px 2px rgba(0,0,0,0.05),0 2px 4px rgba(0,0,0,0.02)}
@media(prefers-color-scheme:dark){:root{--bg:#101012;--surface:#1a1a1c;--surface-2:#232326;--ring:rgba(255,255,255,0.12);--text:#f5f5f5;--muted:#a3a3a3;--shadow:0 0 0 0.5px rgba(255,255,255,0.12),0 1px 2px rgba(0,0,0,0.4),0 2px 4px rgba(0,0,0,0.3)}}
body{font-family:"Inter",-apple-system,system-ui,sans-serif;background:var(--bg);color:var(--text);margin:0;padding:16px;letter-spacing:-0.12px;-webkit-font-smoothing:antialiased}
h1{font-size:17px;font-weight:600;letter-spacing:-0.02em;margin:0 0 12px}
.cols{display:flex;gap:10px;align-items:flex-start}
.col{flex:1;background:var(--surface-2);border-radius:12px;padding:8px;min-width:0}
.col h2{font-size:11px;font-weight:500;margin:4px 6px 8px;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em}
.card{background:var(--surface);border-radius:10px;box-shadow:var(--shadow);padding:9px 10px;margin-bottom:8px;font-size:13px;line-height:1.4}
.card form{margin-top:6px;display:flex;gap:4px;flex-wrap:wrap}
button{background:var(--text);color:var(--bg);border:0;border-radius:999px;padding:5px 10px;font-size:11px;font-weight:550;cursor:pointer}
button:hover{opacity:0.85}
button.ghost{background:transparent;color:var(--muted);box-shadow:0 0 0 0.5px var(--ring)}
button.ghost:hover{opacity:1;color:var(--text);background:var(--surface-2)}
input[type=text]{background:var(--surface);color:var(--text);border:0.5px solid var(--ring);border-radius:10px;padding:8px 10px;flex:1;font-size:13px;outline:none}
input[type=text]:focus{border-color:#2b7fff;box-shadow:0 0 0 3px rgba(43,127,255,0.12)}
input[type=text]::placeholder{color:var(--muted)}
.item{display:flex;align-items:center;gap:8px;background:var(--surface);border-radius:10px;box-shadow:var(--shadow);padding:10px 12px;margin-bottom:8px;font-size:13px}
.done{text-decoration:line-through;color:var(--muted)}
.addrow{display:flex;gap:6px;margin-top:12px}
</style></head><body>${body}</body></html>`;
}

function renderKanban(board: KanbanBoard, resourceId: string): string {
  const cols = board.columns
    .map((col) => {
      const cards = col.cards
        .map((card) => {
          const moves = board.columns
            .filter((c) => c.id !== col.id)
            .map(
              (c) =>
                `<form method="post"><input type="hidden" name="action" value="move"><input type="hidden" name="card" value="${esc(card.id)}"><input type="hidden" name="to" value="${esc(c.id)}"><button class="ghost">→ ${esc(c.name)}</button></form>`
            )
            .join("");
          return `<div class="card">${esc(card.text)}<div style="display:flex;gap:4px;margin-top:6px">${moves}</div></div>`;
        })
        .join("");
      return `<div class="col"><h2>${esc(col.name)}</h2>${cards}</div>`;
    })
    .join("");
  const firstCol = board.columns[0]?.id ?? "todo";
  return page(
    board.title,
    `<h1>${esc(board.title)}</h1><div class="cols">${cols}</div>
<form method="post" class="addrow"><input type="hidden" name="action" value="add"><input type="hidden" name="column" value="${esc(firstCol)}"><input type="text" name="text" placeholder="Add a card…" maxlength="200"><button>Add</button></form>
<!-- resource: ${esc(resourceId)} -->`
  );
}

function renderVault(
  items: VaultItemMetadata[],
  revealed: { id: string; field: string; value: string } | null,
  notice: string | null
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
              return `<div style="display:flex;align-items:center;gap:8px;margin-top:6px"><span style="color:var(--muted);font-size:11px;width:72px">${esc(label)}</span><span style="font-family:ui-monospace,monospace;font-size:12px;overflow:hidden;text-overflow:ellipsis">${isRevealed ? esc(revealed.value) : "••••••••"}</span><form method="post" style="margin:0;margin-left:auto"><input type="hidden" name="action" value="reveal"><input type="hidden" name="id" value="${esc(item.id)}"><input type="hidden" name="field" value="${esc(field)}"><button class="ghost">${isRevealed ? "Hide" : "Reveal"}</button></form></div>`;
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
    `<h1>Vault</h1>${notice ? `<p style="color:var(--muted);font-size:12px">${esc(notice)}</p>` : ""}${body}${addLogin}${addCard}`
  );
}

function renderTodo(list: TodoList, resourceId: string): string {
  const items = list.items
    .map(
      (item) =>
        `<div class="item"><form method="post" style="margin:0"><input type="hidden" name="action" value="toggle"><input type="hidden" name="id" value="${esc(item.id)}"><button class="ghost">${item.done ? "☑" : "☐"}</button></form><span class="${item.done ? "done" : ""}">${esc(item.text)}</span></div>`
    )
    .join("");
  return page(
    list.title,
    `<h1>${esc(list.title)}</h1>${items}
<form method="post" class="addrow"><input type="hidden" name="action" value="add"><input type="text" name="text" placeholder="Add a task…" maxlength="200"><button>Add</button></form>
<!-- resource: ${esc(resourceId)} -->`
  );
}

function html(body: string, extra?: Record<string, string>): NextResponse {
  return new NextResponse(body, {
    status: 200,
    headers: {
      ...BASE_HEADERS,
      ...extra,
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

function forbidden(message: string): NextResponse {
  return new NextResponse(message, { status: 403, headers: BASE_HEADERS });
}

function cookieName(app: string): string {
  return `mini_${app}`;
}

function sessionFromCookie(
  request: NextRequest,
  app: string
): { userId: string; resourceId: string } | null {
  const raw = request.cookies.get(cookieName(app))?.value;
  if (!raw) return null;
  const claims = verifyToken(raw, app);
  if (!claims) return null;
  return { userId: claims.userId, resourceId: claims.resourceId };
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ app: string }> }
): Promise<NextResponse> {
  const { app } = await context.params;
  if (!APPS.has(app)) {
    return new NextResponse("not found", { status: 404, headers: BASE_HEADERS });
  }
  const supabase = serviceClient();
  const token = request.nextUrl.searchParams.get("t");

  if (token) {
    // token.app === path.app — the path is a routing hint, never authz.
    const claims = verifyToken(token, app);
    if (!claims) return forbidden("invalid or expired link");
    if (!(await redeemOnce(supabase, claims))) {
      return forbidden("this link was already used");
    }
    console.log(
      JSON.stringify({ msg: "miniapp opened", user_id: claims.userId, app })
    );
    const response = NextResponse.redirect(
      new URL(`/mini/${app}`, request.nextUrl.origin),
      303
    );
    for (const [key, value] of Object.entries(BASE_HEADERS)) {
      response.headers.set(key, value);
    }
    response.cookies.set(
      cookieName(app),
      mintToken(claims.userId, app, claims.resourceId, 15),
      {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: `/mini/${app}`,
        maxAge: 15 * 60,
      }
    );
    return response;
  }

  const session = sessionFromCookie(request, app);
  if (!session) return forbidden("no session — open this from your card");

  if (app === "computer") {
    // The desktop stream is WebRTC and cannot be re-streamed through this
    // origin; the owner's browser is redirected to a freshly-fetched stream
    // URL behind the single-use token exchange above. no-referrer keeps the
    // URL out of Referer headers; nothing is stored client-side (C17).
    try {
      const url = await desktopStreamUrl(supabase, session.userId);
      await armStopAfter(supabase, session.userId);
      const response = NextResponse.redirect(url, 302);
      response.headers.set("Referrer-Policy", "no-referrer");
      response.headers.set("Cache-Control", "no-store");
      return response;
    } catch (error) {
      if (error instanceof StartLimitError) {
        return html(
          page(
            "Computer",
            "<h1>Computer</h1><p>Your agent's computer can't start right now — try again in a few minutes.</p>"
          )
        );
      }
      if (error instanceof DesktopUnavailableError) {
        return html(
          page(
            "Computer",
            "<h1>Computer</h1><p>Your agent's screen isn't available yet — it may still be waking up. Pull to refresh in a moment.</p>"
          )
        );
      }
      const message = error instanceof Error ? error.message : "unknown error";
      console.error(
        JSON.stringify({
          msg: "computer mini-app failed",
          user_id: session.userId,
          error: message,
        })
      );
      return html(
        page(
          "Computer",
          "<h1>Computer</h1><p>Couldn't reach your agent's computer — try again shortly.</p>"
        )
      );
    }
  }

  if (app === "vault") {
    // Metadata from the Postgres mirror only — the page renders without a
    // box wake and its HTML never contains a secret value (C18).
    const { data } = await supabase
      .from("vault_items")
      .select(
        "id, kind, name, masked, env_var, totp_enabled, created_at, updated_at"
      )
      .eq("user_id", session.userId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true });
    return html(
      renderVault((data ?? []) as VaultItemMetadata[], null, null)
    );
  }

  if (app === "kanban") {
    const board = await getKanban(supabase, session.userId, session.resourceId);
    return html(renderKanban(board, session.resourceId));
  }
  const list = await getTodos(supabase, session.userId, session.resourceId);
  return html(renderTodo(list, session.resourceId));
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ app: string }> }
): Promise<NextResponse> {
  const { app } = await context.params;
  if (!APPS.has(app)) {
    return new NextResponse("not found", { status: 404, headers: BASE_HEADERS });
  }
  if (app === "computer") {
    return new NextResponse("not found", { status: 404, headers: BASE_HEADERS });
  }
  const session = sessionFromCookie(request, app);
  if (!session) return forbidden("no session");
  const supabase = serviceClient();
  const form = await request.formData();
  const action = String(form.get("action") ?? "");

  if (app === "vault") {
    return vaultPost(
      supabase,
      session.userId,
      form,
      action,
      request.nextUrl.origin
    );
  }

  if (app === "kanban") {
    if (action === "move") {
      await moveKanbanCard(
        supabase,
        session.userId,
        session.resourceId,
        String(form.get("card") ?? ""),
        String(form.get("to") ?? "")
      );
    } else if (action === "add") {
      await addKanbanCard(
        supabase,
        session.userId,
        session.resourceId,
        String(form.get("column") ?? ""),
        String(form.get("text") ?? "")
      );
    }
  } else if (app === "todo") {
    if (action === "add") {
      await updateTodo(supabase, session.userId, session.resourceId, {
        kind: "add",
        text: String(form.get("text") ?? ""),
      });
    } else if (action === "toggle") {
      await updateTodo(supabase, session.userId, session.resourceId, {
        kind: "toggle",
        id: String(form.get("id") ?? ""),
      });
    }
  }

  const response = NextResponse.redirect(
    new URL(`/mini/${app}`, request.nextUrl.origin),
    303
  );
  for (const [key, value] of Object.entries(BASE_HEADERS)) {
    response.headers.set(key, value);
  }
  return response;
}

async function vaultItems(
  supabase: ReturnType<typeof serviceClient>,
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

/**
 * Vault mini-app actions. Reveal renders the value into the POST response
 * body only (no-store, no redirect) so it never touches a URL; card fields
 * are refused outright on this surface (C18/C20).
 */
async function vaultPost(
  supabase: ReturnType<typeof serviceClient>,
  userId: string,
  form: FormData,
  action: string,
  origin: string
): Promise<NextResponse> {
  const busyPage = () =>
    html(
      renderVault(
        [],
        null,
        "Your agent's computer is busy starting up — try again in a minute."
      )
    );

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
      return forbidden(
        "card reveal is only available in the full Vault tab"
      );
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
    const response = NextResponse.redirect(new URL("/mini/vault", origin), 303);
    for (const [key, value] of Object.entries(BASE_HEADERS)) {
      response.headers.set(key, value);
    }
    return response;
  }

  return forbidden("unknown action");
}
