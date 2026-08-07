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

const APPS = new Set(["kanban", "todo"]);

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
body{font-family:-apple-system,system-ui,sans-serif;background:#0b0b0f;color:#eee;margin:0;padding:16px}
h1{font-size:18px;margin:0 0 12px}
.cols{display:flex;gap:8px;align-items:flex-start}
.col{flex:1;background:#17171d;border-radius:10px;padding:8px;min-width:0}
.col h2{font-size:13px;margin:2px 4px 8px;color:#9a9aa5;text-transform:uppercase}
.card{background:#24242e;border-radius:8px;padding:8px;margin-bottom:8px;font-size:14px}
.card form{margin-top:6px;display:flex;gap:4px;flex-wrap:wrap}
button{background:#2f6fed;color:#fff;border:0;border-radius:6px;padding:4px 8px;font-size:12px}
button.ghost{background:#33333d}
input[type=text]{background:#101014;color:#eee;border:1px solid #33333d;border-radius:6px;padding:6px;flex:1;font-size:14px}
.item{display:flex;align-items:center;gap:8px;background:#17171d;border-radius:8px;padding:10px;margin-bottom:8px;font-size:15px}
.done{text-decoration:line-through;color:#77777f}
.addrow{display:flex;gap:6px;margin-top:10px}
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
  const session = sessionFromCookie(request, app);
  if (!session) return forbidden("no session");
  const supabase = serviceClient();
  const form = await request.formData();
  const action = String(form.get("action") ?? "");

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
