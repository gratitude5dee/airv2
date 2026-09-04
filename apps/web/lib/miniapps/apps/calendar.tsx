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
import { publicUrl } from "@/lib/storage/r2";
import {
  createBookingLink,
  createCalendarEvent,
  getCalendarFreeBusy,
  rsvpCalendarEvent,
  type FreeBusySlot,
} from "@/lib/agentmail/calendar";
import { externalOrigin } from "../gates";
import { env } from "@/lib/env";
import { esc, withBaseHeaders } from "../html";
import { renderShell, shellHtml } from "../shell";
import { promptBar, runPrompt } from "../promptBar";
import { timedFetch } from "../timing";
import type { MiniAppContext, MiniAppModule } from "./types";
import {
  coverFor,
  stickersFor,
  stripRowFor,
  subCopy,
  tiltFor,
} from "./calendar-mosaic";

interface InviteDecision {
  id: string;
  label: string | null;
  sender: string | null;
}

/** The agent's primary AgentMail inbox — the identity its hosted calendar
 * (events, RSVP, free/busy, booking page) lives at. */
async function agentInboxId(
  ctx: MiniAppContext
): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("agent_addresses")
    .select("agentmail_inbox_id")
    .eq("user_id", ctx.session.userId)
    .eq("is_primary", true)
    .is("retired_at", null)
    .maybeSingle();
  return (data?.agentmail_inbox_id as string | undefined) ?? null;
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
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const BOOKING_URL_RE = /^https:\/\/[\w.-]+(?::\d+)?\/[\w~/#?&=.%-]*$/;
const COLOR_RE = /^#[0-9a-f]{6}$/i;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_RE = /^\d{4}-\d{2}$/;
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
  day?: string,
  month?: string,
  flags?: { new?: boolean; edit?: string }
): string {
  const params = new URLSearchParams();
  if (view !== "agenda") params.set("view", view);
  if (persona) params.set("persona", persona);
  if (day) params.set("day", day);
  if (month) params.set("month", month);
  if (flags?.edit) params.set("edit", flags.edit);
  if (flags?.new) params.set("new", "1");
  const query = params.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function dock(
  basePath: string,
  active: CalendarView,
  persona: string | null,
  isOwner: boolean,
  monthKey: string,
  todayKey: string
): string {
  const glyphs: Record<string, string> = {
    agenda:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    month:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 5h4v4H5zM10 5h4v4h-4zM15 5h4v4h-4zM5 10h4v4H5zM10 10h4v4h-4zM15 10h4v4h-4zM5 15h4v4H5zM10 15h4v4h-4zM15 15h4v4h-4z"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    persona:
      '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="7"/><path d="M12 5a7 7 0 0 1 0 14"/></svg>',
    ask: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 1.7 6.3L20 11l-6.3 1.7L12 19l-1.7-6.3L4 11l6.3-1.7z"/></svg>',
  };
  const item = (
    label: string,
    href: string,
    key: string,
    current = false
  ): string =>
    `<a class="mo-dock-item${current ? " on" : ""}" href="${esc(href)}"${current ? ' aria-current="page"' : ""} aria-label="${esc(label)}">${glyphs[key]}<span class="mo-dock-label">${esc(label)}</span></a>`;
  const personaHref =
    active === "month"
      ? `${viewHref(basePath, "month", null, undefined, monthKey)}#personas`
      : `${viewHref(basePath, "agenda", persona)}#personas`;
  const addHref =
    active === "month"
      ? `${viewHref(basePath, "month", persona, todayKey, undefined, { new: true })}#new`
      : `${viewHref(basePath, active, persona, undefined, undefined, { new: true })}#new`;
  return `<nav class="mo-dock" aria-label="Calendar">${item("Agenda", viewHref(basePath, "agenda", persona), "agenda", active === "agenda" || active === "timeline")}${item("Month", viewHref(basePath, "month", persona), "month", active === "month")}${isOwner ? item("Add event", addHref, "plus") : ""}${item("Personas", personaHref, "persona")}${isOwner ? item("Ask", "#prompt", "ask") : ""}</nav>`;
}

/** Add/edit form for a local event. Owner-only; agent edits go via sync.py. */
function eventForm(
  view: CalendarView,
  persona: string | null,
  day: string | null,
  event?: CalendarEvent,
  open = false
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
  return `<details id="new"${editing || open ? " open" : ""} style="margin-top:0.6rem"><summary class="when" style="cursor:pointer">${editing ? "Edit event" : "+ New event"}</summary>
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
${editing ? "" : '<input type="text" name="attendees" placeholder="Invite by email — comma-separated (optional)" maxlength="600" inputmode="email" autocapitalize="off">'}
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
      ? `<div class="row" id="personas" style="margin-bottom:0.8rem">${tab("All", null)}${personas.map((p) => tab(p, p)).join("")}</div>`
      : "";

  const inviteRows = invites
    .map(
      (invite) =>
        `<div class="card pending">${esc(invite.label ?? "Calendar invite")}${
          invite.sender ? `<div class="when">${esc(invite.sender)}</div>` : ""
        }<div class="row" style="margin-top:0.4rem"><form method="post"><input type="hidden" name="action" value="approve"><input type="hidden" name="decision" value="${esc(invite.id)}"><button>✓ Accept</button></form><form method="post"><input type="hidden" name="action" value="dismiss"><input type="hidden" name="decision" value="${esc(invite.id)}"><button class="ghost">Decline</button></form></div></div>`
    )
    .join("");
  const invitesSection = inviteRows
    ? `<div class="day">Invites — one tap replies for you</div>${inviteRows}`
    : "";

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
              ? viewHref(basePath, "agenda", activePersona, undefined, undefined, {
                  edit: event.id,
                })
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

  return `${tabs}${invitesSection}${days}${empty}${sourcesSection}<p class="when" style="margin-top:0.6rem"><a href="${esc(viewHref(basePath, "timeline", activePersona))}">Next 30 days →</a></p>`;
}

/** Free/busy strip: the agent's next 7 days as day columns over an
 * 8:00–20:00 window; busy intervals paint as filled blocks. */
function freeBusyStrip(slots: FreeBusySlot[]): string {
  const WINDOW_START = 8;
  const WINDOW_HOURS = 12;
  const columns: string[] = [];
  const today = new Date();
  for (let i = 0; i < 7; i += 1) {
    const day = new Date(
      today.getFullYear(),
      today.getMonth(),
      today.getDate() + i
    );
    const windowStart =
      new Date(day).setHours(WINDOW_START, 0, 0, 0);
    const windowEnd = windowStart + WINDOW_HOURS * 60 * 60 * 1000;
    const blocks = slots
      .flatMap((slot) => {
        const start = Date.parse(slot.start);
        const end = Date.parse(slot.end);
        if (!Number.isFinite(start) || !Number.isFinite(end)) return [];
        const from = Math.max(start, windowStart);
        const to = Math.min(end, windowEnd);
        if (to <= from) return [];
        const top = ((from - windowStart) / (windowEnd - windowStart)) * 100;
        const height = ((to - from) / (windowEnd - windowStart)) * 100;
        return [
          `<span style="position:absolute;left:15%;right:15%;top:${top.toFixed(1)}%;height:${Math.max(height, 4).toFixed(1)}%;border-radius:3px;background:var(--accent);opacity:0.85"></span>`,
        ];
      })
      .join("");
    const label = day.toLocaleDateString([], { weekday: "narrow" });
    const isToday = i === 0;
    columns.push(
      `<div style="min-width:0"><div class="when" style="text-align:center;margin-bottom:3px${isToday ? ";color:var(--accent)" : ""}">${esc(label)}</div><div style="position:relative;height:56px;border:1px solid var(--ring);border-radius:8px;background:var(--well-bg);overflow:hidden">${blocks}</div></div>`
    );
  }
  return `<div class="day">Free / busy — 8am to 8pm</div><div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">${columns.join("")}</div>`;
}

/** Booking-link card: enable with one tap; once minted, copy or open. The
 * URL round-trips through the redirect query and is validated before it is
 * reflected — https only, no quotes/spaces, AgentMail-shaped path. */
function bookingSection(
  view: CalendarView,
  persona: string | null,
  bookingUrl: string | null
): string {
  if (bookingUrl) {
    return `<div class="day">Booking page</div><div class="card prompt" data-prompt="${esc(bookingUrl)}"><div class="when" style="white-space:normal;word-break:break-all">${esc(bookingUrl)}</div><div class="row" style="margin-top:0.5rem"><button type="button" data-copy>Copy link</button><a href="${esc(bookingUrl)}" target="_blank" rel="noopener noreferrer" style="text-decoration:none"><button type="button" class="ghost">Open</button></a></div></div>`;
  }
  return `<div class="day">Booking page</div><form method="post"><input type="hidden" name="action" value="booking"><input type="hidden" name="view" value="${esc(view)}">${persona ? `<input type="hidden" name="persona" value="${esc(persona)}">` : ""}<button class="ghost">Get shareable booking link</button></form><p class="when" style="white-space:normal">Anyone with the link can pick a free slot — it lands on your agent's calendar.</p>`;
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

function monthPersonas(
  basePath: string,
  providerMeta: Map<string, { persona: string; color: string }>,
  personaColors: Map<string, string>,
  activePersona: string | null,
  monthKey: string,
  selectedDay: string | null
): string {
  const personas = [...new Set([...providerMeta.values()].map((m) => m.persona))].sort();
  if (personas.length <= 1 && activePersona === null) return "";
  const chip = (label: string, value: string | null, color?: string): string => {
    const active = value === activePersona;
    const href = viewHref(
      basePath,
      "month",
      value,
      selectedDay ?? undefined,
      monthKey
    );
    return `<a class="mo-persona${active ? " on" : ""}" href="${esc(href)}"${active ? ' aria-current="page"' : ""}>${color ? `<span class="mo-pdot" style="background:${esc(color)}"></span>` : ""}${esc(label)}</a>`;
  };
  return `<nav class="mo-personas" id="personas" aria-label="Personas" data-noswipe>${chip("All", null)}${personas
    .map((persona) => {
      const color = personaColors.get(persona) ?? ditherColor(persona);
      return chip(persona, persona, color);
    })
    .join("")}</nav>`;
}

function mosaicChips(
  basePath: string,
  day: string,
  dayEvents: CalendarEvent[],
  providerMeta: Map<string, { persona: string; color: string }>,
  avatars: Map<string, CrmAvatar>,
  isOwner: boolean,
  persona: string | null,
  moreLimit = 12
): string {
  const ordered = [...dayEvents].sort(
    (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)
  );
  const visible = ordered.slice(0, moreLimit);
  const chips = visible
    .map((event) => {
      const eventColorValue = eventColor(event, providerMeta);
      const attendees = [...new Set((event.attendees ?? []).map((email) => email.toLowerCase()))].slice(0, 3);
      const avatarsHtml = attendees.length
        ? `<span class="mo-avs">${attendees
            .map((email) => {
              const avatar = avatars.get(email);
              const photoKey = avatar?.photoKey;
              if (photoKey) {
                return `<img class="mo-av" src="${esc(publicUrl(photoKey))}" alt="" width="20" height="20" loading="lazy" decoding="async">`;
              }
              return `<span class="mo-av" style="background:${esc(avatar?.color ?? ditherColor(email))}">${esc(avatar?.initials ?? initialsFor(email))}</span>`;
            })
            .join("")}</span>`
        : `<span class="mo-pdot" style="background:${esc(eventColorValue)}"></span>`;
      const body = `${avatarsHtml}<span class="mo-time">${esc(timeLabel(event))}</span> <span class="mo-ttl">${esc(event.title)}</span>${event.location ? `<span class="mo-loc">${esc(event.location)}</span>` : ""}`;
      const chipClass = `mo-chip${event.status === "pending" ? " pending" : ""}${event.source === "local" ? " local" : ""}`;
      const content =
        isOwner && LOCAL_ID_RE.test(event.id)
          ? `<a href="${esc(viewHref(basePath, "month", persona, day, undefined, { edit: event.id }))}">${body}</a>`
          : body;
      return `<li class="${chipClass}" style="--persona:${esc(eventColorValue)}">${content}</li>`;
    })
    .join("");
  const more =
    dayEvents.length > moreLimit
      ? `<li class="mo-chip more"><a href="${esc(viewHref(basePath, "agenda", persona))}">+${dayEvents.length - moreLimit} more · Agenda</a></li>`
      : "";
  return `${chips}${more}`;
}

function coverMarkup(
  cover: ReturnType<typeof coverFor>
): string {
  if (cover.kind === "photos") {
    const count = Math.min(cover.urls.length, 4);
    return `<span class="mo-cover n${count}">${cover.urls
      .map(
        (url) =>
          `<img src="${esc(url)}" alt="" width="96" height="96" loading="lazy" decoding="async">`
      )
      .join("")}</span>`;
  }
  return `<span class="mo-cover mo-plate" style="--persona:${esc(cover.color)}"><span class="mo-plate-txt">${esc(cover.initial || String(cover.count))}</span></span>`;
}

/** Month: a mosaic grid with an in-place server-rendered day strip. */
function monthBody(
  basePath: string,
  events: CalendarEvent[],
  sources: SourceRow[],
  avatars: Map<string, CrmAvatar>,
  isOwner: boolean,
  persona: string | null,
  selectedDay: string | null,
  editEvent: CalendarEvent | undefined,
  monthStart: Date,
  wantNew: boolean
): string {
  const providerMeta = personaByProvider(sources);
  const personaColors = new Map<string, string>();
  for (const meta of providerMeta.values()) {
    if (!personaColors.has(meta.persona)) personaColors.set(meta.persona, meta.color);
  }
  if (!personaColors.has("personal")) personaColors.set("personal", LOCAL_COLOR);
  const allByDay = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const t = Date.parse(event.starts_at);
    if (!Number.isFinite(t)) continue;
    const key = dayKey(new Date(t));
    allByDay.set(key, [...(allByDay.get(key) ?? []), event]);
  }
  const personaOf = (event: CalendarEvent): string =>
    event.source === "local"
      ? "personal"
      : (providerMeta.get(event.source)?.persona ?? "personal");
  const visibleEvents = (dayEvents: CalendarEvent[]): CalendarEvent[] =>
    persona ? dayEvents.filter((event) => personaOf(event) === persona) : dayEvents;
  const year = monthStart.getFullYear();
  const month = monthStart.getMonth();
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthKey = `${year}-${String(month + 1).padStart(2, "0")}`;
  const todayKey = dayKey(new Date());
  const currentYear = new Date().getFullYear();
  const monthTitle = first.toLocaleDateString([], { month: "long" });
  const title = year === currentYear ? monthTitle : `${monthTitle} ${year}`;
  const monthEvents = [...allByDay.values()].flatMap(visibleEvents);
  const people = new Set(
    monthEvents.flatMap((event) => (event.attendees ?? []).map((email) => email.toLowerCase()))
  ).size;
  const counts = {
    events: monthEvents.length,
    people,
    pending: monthEvents.filter((event) => event.status === "pending").length,
  };
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);
  const prevKey = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, "0")}`;
  const nextKey = `${next.getFullYear()}-${String(next.getMonth() + 1).padStart(2, "0")}`;
  const dayLabel = (key: string): string =>
    new Date(`${key}T12:00:00`).toLocaleDateString([], {
      weekday: "long",
      month: "long",
      day: "numeric",
    });
  const header = `<header class="mo-head"><a class="mo-nav" href="${esc(viewHref(basePath, "month", persona, undefined, prevKey))}" aria-label="${esc(new Date(`${prevKey}-01T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" }))}">‹</a><h2 class="mo-title">${esc(title)}</h2><a class="mo-nav" href="${esc(viewHref(basePath, "month", persona, undefined, nextKey))}" aria-label="${esc(new Date(`${nextKey}-01T12:00:00`).toLocaleDateString([], { month: "long", year: "numeric" }))}">›</a><p class="mo-sub">${esc(subCopy(counts))}</p>${monthPersonas(basePath, providerMeta, personaColors, persona, monthKey, selectedDay)}</header>`;
  const leading = first.getDay();
  const rowCount = Math.ceil((leading + daysInMonth) / 7);
  const rows: string[] = [];
  for (let row = 0; row < rowCount; row += 1) {
    const cells: string[] = [];
    for (let column = 0; column < 7; column += 1) {
      const number = row * 7 + column - leading + 1;
      if (number < 1 || number > daysInMonth) {
        cells.push('<span class="mo-cell mo-blank" aria-hidden="true"></span>');
        continue;
      }
      const key = `${monthKey}-${String(number).padStart(2, "0")}`;
      const allDayEvents = (allByDay.get(key) ?? []).sort(
        (a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at)
      );
      const dayEvents = visibleEvents(allDayEvents);
      const isToday = key === todayKey;
      const isOpen = key === selectedDay;
      if (allDayEvents.length === 0) {
        if (isOwner && isToday) {
          cells.push(`<a class="mo-cell mo-add" data-day="${esc(key)}" href="${esc(viewHref(basePath, "month", persona, key, undefined, { new: true }))}#new" aria-label="Today — add an event">+</a>`);
        } else {
          cells.push(`<span class="mo-cell mo-dot${isToday ? " is-today" : ""}" data-day="${esc(key)}" aria-label="${esc(dayLabel(key))} — no events"></span>`);
        }
        continue;
      }
      const personas = [...new Set(allDayEvents.map(personaOf))].join(" ");
      const dominant = allDayEvents.reduce(
        (best, event) => {
          const value = personaOf(event);
          const count = (best.counts.get(value) ?? 0) + 1;
          best.counts.set(value, count);
          if (count > best.max) {
            best.max = count;
            best.value = value;
          }
          return best;
        },
        { counts: new Map<string, number>(), max: 0, value: personaOf(allDayEvents[0]!) }
      ).value;
      const color = personaColors.get(dominant) ?? ditherColor(dominant);
      const names = dayEvents.map((event) => event.title).join(", ");
      const countText = `${dayEvents.length} event${dayEvents.length === 1 ? "" : "s"}`;
      const label = `${dayLabel(key)} — ${countText}: ${names}`;
      const muted = persona !== null && dayEvents.length === 0;
      const href = isOpen
        ? viewHref(basePath, "month", persona, undefined, monthKey)
        : viewHref(basePath, "month", persona, key, undefined);
      const stickers = isOpen
        ? '<span class="mo-x" aria-hidden="true">×</span>'
        : stickersFor(dayEvents)
            .map((sticker) =>
              sticker.kind === "pending"
                ? '<span class="mo-sticker pend" aria-hidden="true">?</span>'
                : sticker.kind === "loc"
                  ? `<span class="mo-sticker loc" title="${esc(sticker.full)}">${esc(sticker.text)}</span>`
                  : '<span class="mo-sticker allday">all day</span>'
            )
            .join("");
      const cover = isOpen
        ? ""
        : coverMarkup(
            coverFor(
              dayEvents,
              avatars,
              publicUrl,
              color
            )
          );
      cells.push(`<a class="mo-cell mo-tile${isOpen ? " is-open" : ""}${isToday ? " is-today" : ""}${muted ? " is-muted" : ""}${dayEvents.some((event) => event.status === "pending") ? " is-pending" : ""}" data-day="${esc(key)}" data-count="${dayEvents.length}" data-personas="${esc(personas.toLowerCase())}" href="${esc(href)}" aria-label="${esc(isOpen ? `Close ${dayLabel(key)}` : label)}"${isOpen ? ' aria-expanded="true"' : ""}${muted ? ' aria-hidden="true" tabindex="-1"' : ""} style="--tilt:${isOpen ? "0" : tiltFor(key)}deg;--persona:${esc(color)}"><span class="mo-face">${cover}${stickers}</span></a>`);
    }
    rows.push(`<li class="mo-week">${cells.join("")}</li>`);
  }
  if (selectedDay) {
    const rowOfDay = Math.floor((leading + Number(selectedDay.slice(-2)) - 1) / 7);
    const stripEvents = visibleEvents(allByDay.get(selectedDay) ?? []);
    const stripContent = stripEvents.length
      ? `<ul class="mo-chips" data-noswipe>${mosaicChips(basePath, selectedDay, stripEvents, providerMeta, avatars, isOwner, persona)}</ul>`
      : `<p class="mo-empty">Nothing on this day</p>${isOwner ? `<a class="mo-addlink" href="${esc(viewHref(basePath, "month", persona, selectedDay, undefined, { new: true }))}#new">+ Add</a>` : ""}`;
    rows.splice(stripRowFor(rowOfDay, rowCount), 0, `<li class="mo-strip" role="region" aria-label="${esc(dayLabel(selectedDay))}" data-for="${esc(selectedDay)}"><a class="mo-close" href="${esc(viewHref(basePath, "month", persona, undefined, monthKey))}" aria-label="Close day">×</a>${stripContent}</li>`);
  }
  const templates = [...allByDay.entries()]
    .map(
      ([day, list]) =>
        `<template class="mo-day" data-day="${esc(day)}"><ul class="mo-chips" data-noswipe>${mosaicChips(basePath, day, list, providerMeta, avatars, isOwner, persona)}</ul></template>`
    )
    .join("");
  const form = isOwner
    ? eventForm("month", persona, selectedDay, editEvent, wantNew)
    : "";
  return `${header}<ol class="mo-grid" aria-label="${esc(first.toLocaleDateString([], { month: "long", year: "numeric" }))}">${rows.join("")}</ol>${templates}${form}`;
}

const CALENDAR_CSS = `
.panel.mosaic{margin-bottom:4.5rem;padding-inline:clamp(.5rem,2.5vw,1.1rem)}
.mo-head{display:grid;grid-template-columns:44px 1fr 44px;align-items:center;text-align:center}
.mo-title{grid-column:2;margin:0;font:600 1.15rem var(--font-ui);color:var(--ink)}
.mo-nav{width:44px;height:44px;display:grid;place-items:center;color:var(--ink);font-size:1.8rem;text-decoration:none}
.mo-head>.mo-nav:first-child{grid-column:1;grid-row:1}.mo-head>.mo-nav:last-of-type{grid-column:3;grid-row:1}
.mo-sub{grid-column:1/-1;margin:.15rem 0 .55rem;color:var(--ink-muted);font:500 .68rem var(--font-ui)}
.mo-personas{grid-column:1/-1;display:flex;gap:.35rem;overflow-x:auto;list-style:none;margin:0 0 .75rem;padding:.1rem 0;scrollbar-width:none}
.mo-personas::-webkit-scrollbar{display:none}
.mo-persona{flex:0 0 auto;display:inline-flex;align-items:center;gap:.3rem;padding:.35rem .6rem;border:1px solid var(--ring);border-radius:var(--radius-pill);color:var(--ink);text-decoration:none;font:500 .65rem var(--font-ui)}
.mo-persona.on{background:var(--accent);color:var(--on-accent)}
.mo-grid,.mo-week{min-width:0}.mo-grid{display:grid;gap:8px;list-style:none;margin:0;padding:0}
.mo-week{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:8px;align-items:center;justify-items:center}
.mo-cell{aspect-ratio:1;width:100%;min-width:0}.mo-blank{display:block}
.mo-dot{display:block;width:6px;height:6px;border-radius:50%;background:var(--ink-muted);opacity:.55;align-self:center;justify-self:center}
.mo-dot.is-today{box-shadow:0 0 0 2px var(--accent)}
.mo-tile{display:block;color:var(--ink);text-decoration:none;transition:opacity .22s,transform .3s}
.mo-tile .mo-face{position:relative;display:block;width:100%;height:100%;border-radius:28%;overflow:hidden;transform:rotate(var(--tilt,0deg));background:var(--persona,var(--accent));box-shadow:var(--shadow),inset 0 0 0 1px rgba(255,255,255,.28);transition:opacity .22s,transform .3s}
.mo-cover{display:grid;width:100%;height:100%;overflow:hidden}.mo-cover img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 30%}
.mo-cover.n2{grid-template-columns:1fr 1fr}.mo-cover.n3{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}.mo-cover.n3 img:first-child{grid-row:1/3}.mo-cover.n4{grid-template-columns:1fr 1fr;grid-template-rows:1fr 1fr}
.mo-plate{place-items:center;background:var(--persona,var(--accent))}.mo-plate-txt{font:600 .78rem var(--font-ui);color:var(--on-accent)}
.mo-sticker{position:absolute;left:6px;bottom:6px;z-index:1;font:600 .55rem var(--font-ui);padding:2px 6px;border-radius:var(--radius-pill);background:var(--panel-bg);color:var(--ink);max-width:calc(100% - 12px);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.mo-sticker.pend{left:auto;right:6px;top:6px;bottom:auto;background:var(--accent);color:var(--on-accent)}.mo-sticker+.mo-sticker{bottom:26px}
.mo-tile.is-today .mo-face{outline:2px solid var(--accent);outline-offset:2px}.mo-tile.is-pending .mo-face{box-shadow:inset 0 0 0 2px var(--accent);border:2px dashed var(--accent)}
.mo-tile.is-open .mo-face{background:var(--well-bg);display:grid;place-items:center;transform:none}.mo-x{font:400 1.5rem var(--font-ui);color:var(--ink-muted)}
.is-filtered .mo-tile.is-muted{opacity:.28;filter:saturate(.4);pointer-events:none}.mosaic.is-dim .mo-tile:not(.is-open){opacity:.35}
.mo-strip{grid-column:1/-1;background:var(--well-bg);border:1px solid var(--ring);border-radius:var(--radius-well);box-shadow:var(--shadow);padding:.55rem;position:relative;backdrop-filter:var(--blur)}
.mo-chips{display:flex;gap:.5rem;overflow-x:auto;scroll-snap-type:x mandatory;list-style:none;margin:0;padding:0 .2rem}.mo-chip{scroll-snap-align:start;flex:0 0 auto;min-width:11rem;max-width:78%;display:flex;align-items:center;gap:.4rem;padding:.35rem .6rem;border-radius:var(--radius-pill);background:rgba(255,255,255,.08);border:1px solid var(--ring);color:var(--ink);text-decoration:none;font:500 .68rem var(--font-ui)}.mo-chip.pending{border-style:dashed}.mo-chip .mo-ttl{max-width:12rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.mo-time,.mo-loc{color:var(--ink-muted);white-space:nowrap}.mo-loc{overflow:hidden;text-overflow:ellipsis;max-width:8rem}
.mo-avs{display:inline-flex;flex:0 0 auto}.mo-av{display:block;width:20px;height:20px;border-radius:50%;object-fit:cover;font:600 .55rem var(--font-ui);color:var(--on-accent);text-align:center;line-height:20px}.mo-av+.mo-av{margin-left:-5px}.mo-pdot{display:inline-block;width:8px;height:8px;border-radius:50%;flex:none}
.mo-close{position:absolute;top:.3rem;right:.4rem;color:var(--ink-muted);text-decoration:none;font-size:1.2rem}.mo-empty{margin:.2rem 2rem .2rem 0;color:var(--ink-muted);font:500 .7rem var(--font-ui)}.mo-addlink{font:500 .7rem var(--font-ui);color:var(--ink);text-decoration:underline}
.mo-add{border-radius:28%;border:1.5px dashed var(--ring);color:var(--ink-muted);display:grid;place-items:center;font-size:1.4rem;text-decoration:none}
.mo-dock{position:sticky;bottom:.75rem;margin:.75rem auto 0;display:flex;gap:.25rem;padding:.3rem;border:1px solid var(--ring);border-radius:var(--radius-pill);background:var(--panel-bg);box-shadow:var(--shadow);backdrop-filter:var(--blur);width:max-content;max-width:100%;z-index:2}.mo-dock-item{min-width:44px;min-height:44px;display:grid;place-items:center;border-radius:var(--radius-pill);color:var(--ink);text-decoration:none;font:500 .6rem var(--font-ui)}.mo-dock-item svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:1.75}.mo-dock-item.on{background:rgba(255,255,255,.14)}.mo-dock-label{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(prefers-reduced-motion:reduce){.mo-tile .mo-face{transform:none!important}.mo-strip,.mo-dock{backdrop-filter:none;-webkit-backdrop-filter:none}.mo-tile,.mo-tile .mo-face{transition:opacity .15s}}
`;

const CALENDAR_LITE_CSS = `
.mo-strip,.mo-dock{backdrop-filter:none;-webkit-backdrop-filter:none}.mo-tile .mo-face{transform:none}.mo-tile,.mo-tile .mo-face{transition:none}
`;

function calendarHtml(body: string): NextResponse {
  const response = shellHtml(body);
  const csp = response.headers.get("Content-Security-Policy");
  if (csp) {
    response.headers.set(
      "Content-Security-Policy",
      csp.replace(
        /img-src ([^;]+)/,
        (_, value: string) => `img-src ${value} ${env.r2PublicBaseUrl()}`
      )
    );
  }
  return response;
}

const unavailable = (lite: boolean) =>
  calendarHtml(
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
      const store = await timedFetch("calendar", "box people", () =>
        readPeople(box.boxId)
      );
      const { data: bucket } = await ctx.supabase
        .from("user_buckets")
        .select("prefix")
        .eq("user_id", ctx.session.userId)
        .maybeSingle();
      const prefix =
        typeof bucket?.prefix === "string" ? bucket.prefix : undefined;
      avatars = avatarIndex(store, prefix);
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
    const monthParam = params.get("month");
    const monthAnchor = selectedDay
      ? new Date(`${selectedDay}T12:00:00`)
      : monthParam && MONTH_RE.test(monthParam)
        ? new Date(`${monthParam}-01T12:00:00`)
        : new Date();
    const editParam = params.get("edit");
    const isOwner = ctx.session.role === "owner";
    const wantNew = isOwner && params.get("new") === "1";
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
      if (isOwner) {
        body += eventForm("timeline", activePersona, null, editEvent, wantNew);
      }
    } else if (view === "month") {
      title = monthAnchor.toLocaleDateString([], {
        month: "long",
        year: "numeric",
      });
      body = monthBody(
        ctx.basePath,
        events,
        sources,
        avatars,
        isOwner,
        activePersona,
        selectedDay,
        editEvent,
        monthAnchor,
        wantNew
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
        body += eventForm("agenda", activePersona, null, editEvent, wantNew);
      } else if (isOwner) {
        body += eventForm("agenda", activePersona, null, undefined, wantNew);
      }
      if (isOwner) {
        // Agent-calendar extras (free/busy, booking) are best-effort: the
        // agenda never breaks because the hosted calendar is unreachable.
        const inboxId = await agentInboxId(ctx);
        if (inboxId) {
          try {
            const start = new Date();
            const end = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
            const slots = await timedFetch("calendar", "free-busy", () =>
              getCalendarFreeBusy(
                inboxId,
                start.toISOString(),
                end.toISOString()
              )
            );
            body += freeBusyStrip(slots);
          } catch {
            // Free/busy is decoration; the agenda stands without it.
          }
          const bookingParam = params.get("booking") ?? "";
          const bookingUrl =
            bookingParam.length <= 300 && BOOKING_URL_RE.test(bookingParam)
              ? bookingParam
              : null;
          body += bookingSection("agenda", activePersona, bookingUrl);
          if (bookingUrl) {
            body += '<script src="/creator-os/prompt-copy.js" defer></script>';
          }
        }
      }
    }

    // Swipe left/right walks the Agenda → Timeline → Month deck, exactly
    // like the onboarding slides.
    const order: CalendarView[] = ["agenda", "timeline", "month"];
    const at = order.indexOf(view);
    const prevView = order[at - 1];
    const nextView = order[at + 1];
    const monthKey = `${monthAnchor.getFullYear()}-${String(monthAnchor.getMonth() + 1).padStart(2, "0")}`;
    const todayKey = dayKey(new Date());
    const panelClass =
      view === "month"
        ? `panel mosaic${activePersona ? " is-filtered" : ""}${selectedDay ? " is-dim" : ""}`
        : "panel";
    const panelAttrs =
      view === "month"
        ? ` data-month="${esc(monthKey)}" data-today="${esc(todayKey)}"${selectedDay ? ` data-open="${esc(selectedDay)}"` : ""}`
        : "";
    const full = `<style>${CALENDAR_CSS}${ctx.session.via === "card" ? CALENDAR_LITE_CSS : ""}</style><section class="${panelClass}"${panelAttrs}>${body}
${isOwner ? `<div id="prompt">${promptBar("Ask your agent — e.g. block focus time tomorrow morning…")}</div>` : ""}</section>${dock(ctx.basePath, view, activePersona, isOwner, monthKey, todayKey)}${view === "month" && ctx.session.via !== "card" ? '<script src="/creator-os/calendar-month.js" defer></script>' : ""}`;
    return calendarHtml(
      renderShell({
        title,
        kicker: "Schedule",
        body: full,
        lite: ctx.session.via === "card",
        ...(view === "month" ? { headline: false } : {}),
        swipe: {
          ...(prevView
            ? { prev: viewHref(ctx.basePath, prevView, activePersona) }
            : {}),
          ...(nextView
            ? { next: viewHref(ctx.basePath, nextView, activePersona) }
            : {}),
        },
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
          // Attendee emails ride the hosted-calendar event (below), which
          // mails each one a normal .ics invite from the agent's address.
          const attendees = String(form.get("attendees") ?? "")
            .split(",")
            .map((email) => email.trim().toLowerCase())
            .filter((email) => email.length <= 320 && EMAIL_RE.test(email))
            .slice(0, 10);
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
            if (attendees.length > 0 && !LOCAL_ID_RE.test(idValue)) {
              const inboxId = await agentInboxId(ctx);
              if (inboxId) {
                try {
                  await createCalendarEvent(inboxId, {
                    summary: title,
                    start: allDay ? startsAt.slice(0, 10) : startsAt,
                    end: allDay
                      ? (endsAt ?? startsAt).slice(0, 10)
                      : (endsAt ?? startsAt),
                    attendees: attendees.map((email) => ({ email })),
                  });
                } catch (error) {
                  console.error(
                    JSON.stringify({
                      msg: "agent calendar event create failed",
                      error:
                        error instanceof Error
                          ? error.message
                          : String(error),
                    })
                  );
                }
              }
            }
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
    if (action === "booking" && ctx.session.role === "owner") {
      // Enable (idempotently) the agent's public booking page; the URL
      // rides the redirect query so the re-render can offer copy/share.
      const inboxId = await agentInboxId(ctx);
      if (inboxId) {
        try {
          const url = await createBookingLink(inboxId);
          const target = new URL(
            viewHref(ctx.basePath, view, persona, day),
            externalOrigin(ctx.request)
          );
          target.searchParams.set("booking", url);
          return withBaseHeaders(NextResponse.redirect(target, 303));
        } catch (error) {
          console.error(
            JSON.stringify({
              msg: "booking link create failed",
              error: error instanceof Error ? error.message : String(error),
            })
          );
        }
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
        .select("id, kind, ref, status, payload")
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
          // Also answer the organizer: RSVP the hosted-calendar event when
          // the invite carried a VEVENT UID. Best-effort — the box-side
          // resolution above is the source of truth either way.
          const eventUid = (
            decision.payload as { event_uid?: string } | null
          )?.event_uid;
          if (eventUid) {
            const inboxId = await agentInboxId(ctx);
            if (inboxId) {
              await rsvpCalendarEvent(
                inboxId,
                eventUid,
                action === "approve" ? "accepted" : "declined"
              ).catch((error) =>
                console.error(
                  JSON.stringify({
                    msg: "calendar rsvp failed",
                    error:
                      error instanceof Error ? error.message : String(error),
                  })
                )
              );
            }
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
