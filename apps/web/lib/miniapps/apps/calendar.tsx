/** Calendar mini-app renderer (extracted from the M7.5 monolith, MA1). */
import { NextResponse } from "next/server";
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
import { esc, html, page, withBaseHeaders } from "../html";
import type { MiniAppContext, MiniAppModule } from "./types";

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

  return page("Calendar", `<h1>Next 7 days</h1>${inviteRows}${days}${empty}`);
}

export const calendar: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    // Invite approvals come from Postgres metadata (instant); event rows
    // need the box store, so a sleeping box degrades to invites-only.
    const { data: decisionRows } = await ctx.supabase
      .from("decisions")
      .select("id, label, sender")
      .eq("user_id", ctx.session.userId)
      .eq("kind", "calendar_add")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(20);
    let events: CalendarEvent[] = [];
    let boxAwake = true;
    try {
      const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
      events = await readEventsStore(box.boxId);
    } catch {
      boxAwake = false;
    } finally {
      await armStopAfter(ctx.supabase, ctx.session.userId).catch(
        () => undefined
      );
    }
    return html(
      renderCalendar(events, (decisionRows ?? []) as InviteDecision[], boxAwake)
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    // Inline calendar_add resolution — same effect as the Needs-you queue:
    // approve confirms the pending event box-side, dismiss tombstones it.
    const action = String(form.get("action") ?? "");
    const decisionId = String(form.get("decision") ?? "");
    if ((action === "approve" || action === "dismiss") && decisionId) {
      const { data: decision } = await ctx.supabase
        .from("decisions")
        .select("id, kind, ref, status")
        .eq("id", decisionId)
        .eq("user_id", ctx.session.userId)
        .maybeSingle();
      if (
        decision &&
        decision.status === "pending" &&
        decision.kind === "calendar_add" &&
        decision.ref
      ) {
        try {
          const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
          if (action === "approve") {
            await approveInboxEvent(box.boxId, decision.ref as string);
          } else {
            await dismissInboxEvent(box.boxId, decision.ref as string);
          }
          await ctx.supabase
            .from("decisions")
            .update({
              status: action === "approve" ? "approved" : "dismissed",
              resolved_at: new Date().toISOString(),
            })
            .eq("id", decision.id)
            .eq("user_id", ctx.session.userId);
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
          await armStopAfter(ctx.supabase, ctx.session.userId).catch(
            () => undefined
          );
        }
      }
    }
    return withBaseHeaders(
      NextResponse.redirect(
        new URL(ctx.basePath, ctx.request.nextUrl.origin),
        303
      )
    );
  },
};
