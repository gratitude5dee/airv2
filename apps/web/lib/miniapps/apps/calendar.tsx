/**
 * Calendar mini-app renderer (extracted from the M7.5 monolith, MA1).
 * Three tabs, all pure view-state over the same box event spine:
 *   - Agenda: the original next-7-days view (persona tabs, invites, sources)
 *   - Timeline: a vertical 30-day timeline across all calendars
 *   - Month: a 30-day grid with a tappable day detail
 * Editing: the owner (and the agent, via `sync.py upsert/remove` on the box)
 * can create, edit, and delete `local:` events. Synced sources (google,
 * apple_ics, calcom, email) stay read-only here — changing them goes through
 * the agent prompt bar so the source of truth is never forked.
 */
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
  removeLocalEvent,
  upsertLocalEvent,
  type CalendarEvent,
} from "@/lib/calendar/store";
import {
  avatarIndex,
  ditherColor,
  initialsFor,
  readPeople,
  type CrmAvatar,
} from "@/lib/crm/store";
import { externalOrigin } from "../gates";
import { esc, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import { timedFetch } from "../timing";
import type { MiniAppContext, MiniAppModule } from "./types";

interface InviteDecision {
  id: string;
  label: string | null;
  sender: string | null;
}

interface SourceRow {
  id: string;
  provider: string;
  label: string | null;
  persona: string | null;
  color: string | null;
  status: string;
}

type CalendarView = "agenda" | "timeline" | "month";

const PERSONA_RE = /^[a-z0-9 _-]{1,24}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const LOCAL_ID_RE = /^local:[a-f0-9]{16}$/;
const LOCAL_COLOR = "#8b5cf6";

/** provider → persona/color, from the owner's sources. Stored events carry
 * only a provider (no per-account ref), so persona is effectively
 * PER-PROVIDER: with two accounts from the same provider, the first active
 * source names the persona for all of that provider's events. Per-account
 * personas need an account discriminator on the event spine first. */
function personaByProvider(
  sources: SourceRow[]
): Map<string, { persona: string; color: string }> {
  const map = new Map<string, { persona: string; color: string }>();
  for (const source of sources) {
    if (source.status !== "active" || map.has(source.provider)) continue;
    const persona = source.persona?.trim() || "personal";
    map.set(source.provider, {
      persona,
      color: source.color ?? ditherColor(persona),
    });
  }
  return map;
}

function eventColor(
  event: CalendarEvent,
  providerMeta: Map<string, { persona: string; color: string }>
): string {
  if (event.source === "local") return LOCAL_COLOR;
  return (
    providerMeta.get(event.source)?.color ??
    ditherColor(providerMeta.get(event.source)?.persona ?? event.source)
  );
}

function attendeeChips(
  event: CalendarEvent,
  avatars: Map<string, CrmAvatar>
): string {
  const chips = (event.attendees ?? [])
    .slice(0, 5)
    .map((email) => {
      const known = avatars.get(email.toLowerCase());
      const initials = known ? known.initials : initialsFor(email);
      const color = known ? known.color : ditherColor(email.toLowerCase());
      const title = known ? known.name : email;
      return `<span title="${esc(title)}" style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:999px;background:${esc(color)};color:#fff;font-size:8px;font-weight:600">${esc(initials)}</span>`;
    })
    .join("");
  return chips ? `<span style="display:inline-flex;gap:2px">${chips}</span>` : "";
}

function timeLabel(event: CalendarEvent): string {
  return event.all_day
    ? "all day"
    : new Date(event.starts_at).toLocaleTimeString([], {
        hour: "numeric",
        minute: "2-digit",
      });
}

function dayKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function viewHref(
  basePath: string,
  view: CalendarView,
  persona: string | null,
  day?: string
): string {
  const params = new URLSearchParams();
  if (view !== "agenda") params.set("view", view);
  if (persona) params.set("persona", persona);
  if (day) params.set("day", day);
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

/** Top-level view tabs: Agenda / Timeline / Month. */
function viewTabs(
  basePath: string,
  active: CalendarView,
  persona: string | null
): string {
  const tab = (view: CalendarView, label: string): string => {
    const current = view === active;
    return `<a href="${esc(viewHref(basePath, view, persona))}" style="text-decoration:none;flex:1"><button class="${current ? "" : "ghost"}" style="width:100%">${esc(label)}</button></a>`;
  };
  return `<div class="row" style="display:flex;gap:6px;margin-bottom:0.9rem">${tab(
    "agenda",
    "Agenda"
  )}${tab("timeline", "Timeline")}${tab("month", "Month")}</div>`;
}

/** Add/edit form for a local event. Owner-only; agent edits go via sync.py. */
function eventForm(
  view: CalendarView,
  persona: string | null,
  day: string | null,
  event?: CalendarEvent
): string {
  const editing = event !== undefined;
  const startsLocal = editing
    ? event.all_day
      ? `${event.starts_at.slice(0, 10)}T09:00`
      : event.starts_at.slice(0, 16)
    : `${day ?? dayKey(new Date())}T09:00`;
  const endsLocal = editing
    ? event.all_day
      ? `${event.ends_at.slice(0, 10)}T10:00`
      : event.ends_at.slice(0, 16)
    : `${day ?? dayKey(new Date())}T10:00`;
  return `<details${editing ? " open" : ""} style="margin-top:0.6rem"><summary class="when" style="cursor:pointer">${editing ? "Edit event" : "+ New event"}</summary>
<form method="post" style="display:flex;flex-direction:column;gap:0.5rem;margin-top:0.5rem">
<input type="hidden" name="action" value="save_event">
${editing ? `<input type="hidden" name="event" value="${esc(event.id)}">` : ""}
<input type="hidden" name="view" value="${esc(view)}">
${persona ? `<input type="hidden" name="persona" value="${esc(persona)}">` : ""}
${day ? `<input type="hidden" name="day" value="${esc(day)}">` : ""}
<input type="text" name="title" placeholder="Title" required maxlength="200" value="${editing ? esc(event.title) : ""}">
<label class="when">Starts <input type="datetime-local" name="starts_at" required value="${esc(startsLocal)}"></label>
<label class="when">Ends <input type="datetime-local" name="ends_at" value="${esc(endsLocal)}"></label>
<label class="when" style="display:flex;align-items:center;gap:0.4rem"><input type="checkbox" name="all_day" value="1"${editing && event.all_day ? " checked" : ""}> All day</label>
<input type="text" name="location" placeholder="Location (optional)" maxlength="200" value="${editing && event.location ? esc(event.location) : ""}">
<div class="row" style="display:flex;gap:6px"><button>${editing ? "Save changes" : "Add event"}</button>${
    editing
      ? `</div></form><form method="post"><input type="hidden" name="action" value="delete_event"><input type="hidden" name="event" value="${esc(event.id)}"><input type="hidden" name="view" value="${esc(view)}">${persona ? `<input type="hidden" name="persona" value="${esc(persona)}">` : ""}${day ? `<input type="hidden" name="day" value="${esc(day)}">` : ""}<button class="ghost">Delete</button></form>`
      : "</div></form>"
  }</details>`;
}

function eventRow(
  event: CalendarEvent,
  providerMeta: Map<string, { persona: string; color: string }>,
  avatars: Map<string, CrmAvatar>,
  editHref: string | null
): string {
  const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${esc(eventColor(event, providerMeta))};flex:none"></span>`;
  const edit = editHref
    ? `<a href="${esc(editHref)}" class="when" style="text-decoration:underline">edit</a>`
    : "";
  return `<div class="item${event.status === "pending" ? " pending" : ""}">${dot}<span class="grow">${esc(event.title)}</span>${attendeeChips(event, avatars)}<span class="when">${esc(timeLabel(event))} \u00b7 ${esc(event.source)}</span>${edit}</div>`;
}

/** Agenda: next 7 days from the box store + pending invite approvals. */
function agendaBody(
  basePath: string,
  events: CalendarEvent[],
  invites: InviteDecision[],
  boxAwake: boolean,
  sources: SourceRow[],
  activePersona: string | null,
  avatars: Map<string, CrmAvatar>,
  isOwner: boolean
): string {
  const providerMeta = personaByProvider(sources);
  const personaOf = (event: CalendarEvent): string =>
    event.source === "local"
      ? "personal"
      : (providerMeta.get(event.source)?.persona ?? "personal");
  const now = Date.now();
  const horizon = now + 7 * 24 * 60 * 60 * 1000;
  const upcoming = events
    .filter((event) => {
      const t = Date.parse(event.starts_at);
      return Number.isFinite(t) && t >= now - 60 * 60 * 1000 && t <= horizon;
    })
    // Persona tabs are pure view-state: filtering happens here at render
    // time only — the stored spine is never forked.
    .filter(
      (event) => activePersona === null || personaOf(event) === activePersona
    )
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  const personas = [
    ...new Set([...providerMeta.values()].map((meta) => meta.persona)),
  ].sort();
  const tab = (label: string, persona: string | null): string => {
    const active = persona === activePersona;
    const href = esc(viewHref(basePath, "agenda", persona));
    const color =
      persona === null
        ? ""
        : `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${esc([...providerMeta.values()].find((m) => m.persona === persona)?.color ?? ditherColor(persona))};margin-right:4px"></span>`;
    return `<a href="${href}" style="text-decoration:none"><button class="${active ? "" : "ghost"}" style="margin-right:4px">${color}${esc(label)}</button></a>`;
  };
  const tabs =
    personas.length > 1 || activePersona !== null
      ? `<div class="row" style="margin-bottom:0.8rem">${tab("All", null)}${personas.map((p) => tab(p, p)).join("")}</div>`
      : "";

  const inviteRows = invites
    .map(
      (invite) =>
        `<div class="card pending">${esc(invite.label ?? "Calendar invite")}${
          invite.sender ? `<div class="when">${esc(invite.sender)}</div>` : ""
        }<div class="row" style="margin-top:0.4rem"><form method="post"><input type="hidden" name="action" value="approve"><input type="hidden" name="decision" value="${esc(invite.id)}"><button>Add to calendar</button></form><form method="post"><input type="hidden" name="action" value="dismiss"><input type="hidden" name="decision" value="${esc(invite.id)}"><button class="ghost">Dismiss</button></form></div></div>`
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
        .map((event) =>
          eventRow(
            event,
            providerMeta,
            avatars,
            isOwner && LOCAL_ID_RE.test(event.id)
              ? `${viewHref(basePath, "agenda", activePersona)}${activePersona ? "&" : "?"}edit=${encodeURIComponent(event.id)}`
              : null
          )
        )
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

  const sourceRows = sources
    .map(
      (source) =>
        `<div class="item"><span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${esc(source.color ?? ditherColor(source.persona ?? "personal"))};flex:none"></span><span class="grow">${esc(source.label ?? source.provider)}</span><form method="post" style="display:flex;gap:0.4rem"><input type="hidden" name="action" value="set_source"><input type="hidden" name="source" value="${esc(source.id)}"><input type="text" name="persona" value="${esc(source.persona ?? "personal")}" style="max-width:90px"><input type="text" name="color" value="${esc(source.color ?? "")}" placeholder="#2b7fff" style="max-width:80px"><button class="ghost">Save</button></form></div>`
    )
    .join("");
  const sourcesSection = sourceRows
    ? `<div class="day">Sources</div>${sourceRows}`
    : "";

  return `${tabs}${inviteRows}${days}${empty}${sourcesSection}`;
}

/** Timeline: a vertical spine of the next 30 days across all calendars. */
function timelineBody(
  events: CalendarEvent[],
  boxAwake: boolean,
  sources: SourceRow[],
  avatars: Map<string, CrmAvatar>
): string {
  const providerMeta = personaByProvider(sources);
  const now = Date.now();
  const horizon = now + 30 * 24 * 60 * 60 * 1000;
  const upcoming = events
    .filter((event) => {
      const t = Date.parse(event.starts_at);
      return Number.isFinite(t) && t >= now - 60 * 60 * 1000 && t <= horizon;
    })
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  if (upcoming.length === 0) {
    return boxAwake
      ? `<p class="when">Nothing on any calendar for the next 30 days.</p>`
      : `<p class="when">Your agent's computer is waking up \u2014 pull to refresh in a minute to see events.</p>`;
  }

  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of upcoming) {
    const day = new Date(event.starts_at).toDateString();
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  const sections = [...byDay.entries()]
    .map(([day, list]) => {
      const rows = list
        .map((event) => {
          const color = eventColor(event, providerMeta);
          const location = event.location
            ? `<div class="when">${esc(event.location)}</div>`
            : "";
          return `<div style="position:relative;padding:0.45rem 0 0.45rem 1.1rem"><span style="position:absolute;left:-5px;top:0.85rem;width:10px;height:10px;border-radius:999px;background:${esc(color)};border:2px solid rgba(255,255,255,0.25)"></span><div style="display:flex;align-items:center;gap:0.5rem"><span class="grow">${esc(event.title)}${event.status === "pending" ? ' <span class="when">(pending)</span>' : ""}</span>${attendeeChips(event, avatars)}</div><div class="when">${esc(timeLabel(event))} \u00b7 ${esc(event.source)}</div>${location}</div>`;
        })
        .join("");
      return `<div class="day" style="margin-left:1.1rem">${esc(day)}</div><div style="border-left:2px solid rgba(255,255,255,0.15);margin-left:0.4rem">${rows}</div>`;
    })
    .join("");
  return sections;
}

/** Month: a calendar grid of the current month, tappable day detail. */
function monthBody(
  basePath: string,
  events: CalendarEvent[],
  sources: SourceRow[],
  avatars: Map<string, CrmAvatar>,
  isOwner: boolean,
  persona: string | null,
  selectedDay: string | null,
  editEvent: CalendarEvent | undefined,
  monthStart: Date
): string {
  const providerMeta = personaByProvider(sources);
  const byDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const t = Date.parse(event.starts_at);
    if (!Number.isFinite(t)) continue;
    const key = dayKey(new Date(t));
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leading = first.getDay();
  const todayKey = dayKey(new Date());

  const headers = ["S", "M", "T", "W", "T", "F", "S"]
    .map(
      (d) =>
        `<div class="when" style="text-align:center;padding:0.2rem 0">${d}</div>`
    )
    .join("");
  const cells: string[] = [];
  for (let i = 0; i < leading; i += 1) cells.push("<div></div>");
  for (let day = 1; day <= daysInMonth; day += 1) {
    const key = dayKey(new Date(year, month, day));
    const list = (byDay.get(key) ?? []).slice(0, 4);
    const dots = list
      .map(
        (event) =>
          `<span style="display:inline-block;width:5px;height:5px;border-radius:999px;background:${esc(eventColor(event, providerMeta))}"></span>`
      )
      .join("");
    const isToday = key === todayKey;
    const isSelected = key === selectedDay;
    cells.push(
      `<a href="${esc(viewHref(basePath, "month", persona, key))}" style="text-decoration:none;color:inherit"><div style="min-height:44px;border-radius:10px;padding:0.25rem;text-align:center;${isSelected ? "background:rgba(255,255,255,0.18);" : isToday ? "background:rgba(255,255,255,0.08);" : ""}${isToday ? "font-weight:700;" : ""}"><div>${day}</div><div style="display:flex;gap:2px;justify-content:center;margin-top:2px">${dots}</div></div></a>`
    );
  }
  const monthName = first.toLocaleDateString([], {
    month: "long",
    year: "numeric",
  });
  const grid = `<div class="day">${esc(monthName)}</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:2px">${headers}${cells.join("")}</div>`;

  let detail = "";
  if (selectedDay) {
    const list = (byDay.get(selectedDay) ?? []).sort(
      (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)
    );
    const rows = list
      .map((event) =>
        eventRow(
          event,
          providerMeta,
          avatars,
          isOwner && LOCAL_ID_RE.test(event.id)
            ? `${viewHref(basePath, "month", persona, selectedDay)}&edit=${encodeURIComponent(event.id)}`
            : null
        )
      )
      .join("");
    const dayName = new Date(`${selectedDay}T12:00:00`).toDateString();
    detail = `<div class="day" style="margin-top:0.8rem">${esc(dayName)}</div>${rows || '<p class="when">No events.</p>'}${isOwner ? eventForm("month", persona, selectedDay, editEvent) : ""}`;
  } else if (isOwner) {
    detail = eventForm("month", persona, null, editEvent);
  }
  return `${grid}${detail}`;
}

const unavailable = (lite: boolean) =>
  shellHtml(
    renderShell({
      title: "Calendar",
      kicker: "Schedule",
      body: '<section class="panel"><p>Your agent\'s computer can\'t start right now — try again in a few minutes.</p></section>',
      lite,
    })
  );

function parseView(value: string | null): CalendarView {
  return value === "timeline" || value === "month" ? value : "agenda";
}

/** Local datetime-local input → ISO string; undefined when malformed. */
function parseLocalInput(value: string): string | undefined {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return undefined;
  const t = Date.parse(value);
  return Number.isFinite(t) ? `${value}:00` : undefined;
}

export const calendar: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    // Invite approvals come from Postgres metadata (instant); event rows
    // need the box store, so a sleeping box degrades to invites-only.
    const [{ data: decisionRows }, { data: sourceRows }] = await timedFetch(
      "calendar",
      "decisions+accounts",
      () =>
        Promise.all([
          ctx.supabase
            .from("decisions")
            .select("id, label, sender")
            .eq("user_id", ctx.session.userId)
            .eq("kind", "calendar_add")
            .eq("status", "pending")
            .order("created_at", { ascending: false })
            .limit(20),
          ctx.supabase
            .from("calendar_accounts")
            .select("id, provider, label, persona, color, status")
            .eq("user_id", ctx.session.userId)
            .neq("status", "revoked")
            .order("created_at", { ascending: true }),
        ])
    );
    let events: CalendarEvent[] = [];
    let avatars = new Map<string, CrmAvatar>();
    let boxAwake = true;
    try {
      const box = await timedFetch("calendar", "box wake", () =>
        ensureBoxAwake(ctx.supabase, ctx.session.userId)
      );
      events = await timedFetch("calendar", "box events", () =>
        readEventsStore(box.boxId)
      );
      // Attendee avatars come from the owner's OWN box store, read inside
      // this owner-scoped session — no cross-owner resolution can exist.
      avatars = avatarIndex(
        await timedFetch("calendar", "box people", () => readPeople(box.boxId))
      );
    } catch {
      boxAwake = false;
    } finally {
      await armStopAfter(ctx.supabase, ctx.session.userId).catch(
        () => undefined
      );
    }
    const params = ctx.request.nextUrl.searchParams;
    const personaParam = params.get("persona");
    const activePersona =
      personaParam && PERSONA_RE.test(personaParam) ? personaParam : null;
    const view = parseView(params.get("view"));
    const dayParam = params.get("day");
    const selectedDay =
      dayParam && DAY_RE.test(dayParam) ? dayParam : null;
    const editParam = params.get("edit");
    const isOwner = ctx.session.role === "owner";
    const editEvent =
      isOwner && editParam && LOCAL_ID_RE.test(editParam)
        ? events.find((event) => event.id === editParam)
        : undefined;

    const sources = (sourceRows ?? []) as SourceRow[];
    let body: string;
    let title: string;
    if (view === "timeline") {
      title = "Timeline";
      body = timelineBody(events, boxAwake, sources, avatars);
    } else if (view === "month") {
      title = "This month";
      const monthAnchor = selectedDay
        ? new Date(`${selectedDay}T12:00:00`)
        : new Date();
      body = monthBody(
        ctx.basePath,
        events,
        sources,
        avatars,
        isOwner,
        activePersona,
        selectedDay,
        editEvent,
        monthAnchor
      );
    } else {
      title = "Next 7 days";
      body = agendaBody(
        ctx.basePath,
        events,
        (decisionRows ?? []) as InviteDecision[],
        boxAwake,
        sources,
        activePersona,
        avatars,
        isOwner
      );
      if (isOwner && editEvent) {
        body += eventForm("agenda", activePersona, null, editEvent);
      } else if (isOwner) {
        body += eventForm("agenda", activePersona, null);
      }
    }

    const full = `<section class="panel">${viewTabs(ctx.basePath, view, activePersona)}${body}
${isOwner ? promptBar("Ask your agent — e.g. block focus time tomorrow morning…") : ""}</section>`;
    return shellHtml(
      renderShell({
        title,
        kicker: "Schedule",
        body: full,
        lite: ctx.session.via === "card",
      })
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    // Inline calendar_add resolution — same effect as the Needs-you queue:
    // approve confirms the pending event box-side, dismiss tombstones it.
    const action = String(form.get("action") ?? "");
    const view = parseView(String(form.get("view") ?? "") || null);
    const personaValue = String(form.get("persona") ?? "");
    const persona = PERSONA_RE.test(personaValue) ? personaValue : null;
    const dayValue = String(form.get("day") ?? "");
    const day = DAY_RE.test(dayValue) ? dayValue : undefined;
    const back = () =>
      withBaseHeaders(
        NextResponse.redirect(
          new URL(
            viewHref(ctx.basePath, view, persona, day),
            externalOrigin(ctx.request)
          ),
          303
        )
      );
    if (action === "prompt") {
      try {
        await runPrompt(ctx, String(form.get("text") ?? ""));
      } catch (error) {
        if (error instanceof StartLimitError) {
          return unavailable(ctx.session.via === "card");
        }
        throw error;
      }
      return back();
    }
    if (
      (action === "save_event" || action === "delete_event") &&
      ctx.session.role === "owner"
    ) {
      try {
        const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
        if (action === "delete_event") {
          const eventId = String(form.get("event") ?? "");
          if (LOCAL_ID_RE.test(eventId)) {
            await removeLocalEvent(box.boxId, eventId);
          }
        } else {
          const title = String(form.get("title") ?? "").trim().slice(0, 200);
          const startsAt = parseLocalInput(
            String(form.get("starts_at") ?? "")
          );
          const endsAt = parseLocalInput(String(form.get("ends_at") ?? ""));
          const allDay = form.get("all_day") === "1";
          const location = String(form.get("location") ?? "")
            .trim()
            .slice(0, 200);
          const idValue = String(form.get("event") ?? "");
          if (title && startsAt) {
            await upsertLocalEvent(box.boxId, {
              ...(LOCAL_ID_RE.test(idValue) ? { id: idValue } : {}),
              title,
              starts_at: allDay ? startsAt.slice(0, 10) : startsAt,
              ...(endsAt
                ? { ends_at: allDay ? endsAt.slice(0, 10) : endsAt }
                : {}),
              all_day: allDay,
              ...(location ? { location } : {}),
            });
          }
        }
      } catch (error) {
        if (error instanceof StartLimitError) {
          return unavailable(ctx.session.via === "card");
        }
        throw error;
      } finally {
        await armStopAfter(ctx.supabase, ctx.session.userId).catch(
          () => undefined
        );
      }
      return back();
    }
    if (action === "set_source" && ctx.session.role === "owner") {
      // Persona/color are calendar_accounts metadata only — the event
      // spine and sync are untouched (pure view-state filter).
      const sourceId = String(form.get("source") ?? "");
      const personaField = String(form.get("persona") ?? "").trim();
      const color = String(form.get("color") ?? "").trim();
      if (sourceId && PERSONA_RE.test(personaField)) {
        await ctx.supabase
          .from("calendar_accounts")
          .update({
            persona: personaField,
            color: COLOR_RE.test(color) ? color.toLowerCase() : null,
          })
          .eq("id", sourceId)
          .eq("user_id", ctx.session.userId);
      }
      return back();
    }
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
            return unavailable(ctx.session.via === "card");
          }
          throw error;
        } finally {
          await armStopAfter(ctx.supabase, ctx.session.userId).catch(
            () => undefined
          );
        }
      }
    }
    return back();
  },
};
