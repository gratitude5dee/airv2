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
  approveInboxEvent,
  dismissInboxEvent,
  readEventsStore,
  type CalendarEvent,
} from "@/lib/calendar/store";
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

const APPS = new Set(["kanban", "todo", "computer", "calendar"]);

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
.day{font-size:11px;font-weight:500;margin:14px 2px 6px;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em}
.pending{box-shadow:none;border:1px dashed var(--muted)}
.when{color:var(--muted);font-size:12px;white-space:nowrap}
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

interface InviteDecision {
  id: string;
  label: string | null;
  sender: string | null;
}

/** Agenda: next 7 days from the box store + pending invite approvals. */
function renderCalendar(
  events: CalendarEvent[],
  invites: InviteDecision[],
  boxAwake: boolean
): string {
  const now = Date.now();
  const horizon = now + 7 * 24 * 60 * 60 * 1000;
  const upcoming = events
    .filter((event) => {
      const t = Date.parse(event.starts_at);
      return Number.isFinite(t) && t >= now - 60 * 60 * 1000 && t <= horizon;
    })
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  const inviteRows = invites
    .map(
      (invite) =>
        `<div class="card pending">${esc(invite.label ?? "Calendar invite")}${
          invite.sender ? `<div class="when">${esc(invite.sender)}</div>` : ""
        }<div style="display:flex;gap:4px;margin-top:6px"><form method="post" style="margin:0"><input type="hidden" name="action" value="approve"><input type="hidden" name="decision" value="${esc(invite.id)}"><button>Add to calendar</button></form><form method="post" style="margin:0"><input type="hidden" name="action" value="dismiss"><input type="hidden" name="decision" value="${esc(invite.id)}"><button class="ghost">Dismiss</button></form></div></div>`
    )
    .join("");

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of upcoming) {
    const day = new Date(event.starts_at).toDateString();
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  const days = [...byDay.entries()]
    .map(([day, list]) => {
      const rows = list
        .map((event) => {
          const when = event.all_day
            ? "all day"
            : new Date(event.starts_at).toLocaleTimeString([], {
                hour: "numeric",
                minute: "2-digit",
              });
          return `<div class="item${event.status === "pending" ? " pending" : ""}"><span style="flex:1">${esc(event.title)}</span><span class="when">${esc(when)} \u00b7 ${esc(event.source)}</span></div>`;
        })
        .join("");
      return `<div class="day">${esc(day)}</div>${rows}`;
    })
    .join("");

  const empty =
    upcoming.length === 0
      ? boxAwake
        ? `<p class="when">Nothing on the calendar for the next 7 days.</p>`
        : `<p class="when">Your agent's computer is waking up \u2014 pull to refresh in a minute to see events.</p>`
      : "";

  return page(
    "Calendar",
    `<h1>Next 7 days</h1>${inviteRows}${days}${empty}`
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

  if (app === "kanban") {
    const board = await getKanban(supabase, session.userId, session.resourceId);
    return html(renderKanban(board, session.resourceId));
  }

  if (app === "calendar") {
    // Invite approvals come from Postgres metadata (instant); event rows
    // need the box store, so a sleeping box degrades to invites-only.
    const { data: decisionRows } = await supabase
      .from("decisions")
      .select("id, label, sender")
      .eq("user_id", session.userId)
      .eq("kind", "calendar_add")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    let events: CalendarEvent[] = [];
    let boxAwake = true;
    try {
      const box = await ensureBoxAwake(supabase, session.userId);
      events = await readEventsStore(box.boxId);
    } catch {
      boxAwake = false;
    } finally {
      await armStopAfter(supabase, session.userId).catch(() => undefined);
    }
    return html(
      renderCalendar(
        events,
        (decisionRows ?? []) as InviteDecision[],
        boxAwake
      )
    );
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
  } else if (app === "calendar") {
    // Inline calendar_add resolution — same effect as the Needs-you queue:
    // approve confirms the pending event box-side, dismiss tombstones it.
    const decisionId = String(form.get("decision") ?? "");
    if ((action === "approve" || action === "dismiss") && decisionId) {
      const { data: decision } = await supabase
        .from("decisions")
        .select("id, kind, ref, status")
        .eq("id", decisionId)
        .eq("user_id", session.userId)
        .maybeSingle();
      if (
        decision &&
        decision.status === "pending" &&
        decision.kind === "calendar_add" &&
        decision.ref
      ) {
        try {
          const box = await ensureBoxAwake(supabase, session.userId);
          if (action === "approve") {
            await approveInboxEvent(box.boxId, decision.ref as string);
          } else {
            await dismissInboxEvent(box.boxId, decision.ref as string);
          }
          await supabase
            .from("decisions")
            .update({
              status: action === "approve" ? "approved" : "dismissed",
              resolved_at: new Date().toISOString(),
            })
            .eq("id", decision.id)
            .eq("user_id", session.userId);
        } catch (error) {
          if (error instanceof StartLimitError) {
            return html(
              page(
                "Calendar",
                "<h1>Calendar</h1><p>Your agent's computer can't start right now \u2014 try again in a few minutes.</p>"
              )
            );
          }
          throw error;
        } finally {
          await armStopAfter(supabase, session.userId).catch(() => undefined);
        }
      }
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
