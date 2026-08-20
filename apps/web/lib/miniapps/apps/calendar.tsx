/**
 * Calendar mini-app renderer (extracted from the M7.5 monolith, MA1).
 * MA6 #6: persona tabs + source colors (metadata on calendar_accounts;
 * the persona filter is pure view-state — the event spine, dedupe, and
 * sync are untouched) and CRM avatars for known attendees, resolved from
 * the owner's own box store only.
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
import { esc, html, page, withBaseHeaders } from "../html";
import { promptBar, runPrompt } from "../promptBar";
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

const PERSONA_RE = /^[a-z0-9 _-]{1,24}$/i;
const COLOR_RE = /^#[0-9a-f]{6}$/i;

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

/** Agenda: next 7 days from the box store + pending invite approvals. */
function renderCalendar(
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
    providerMeta.get(event.source)?.persona ?? "personal";
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
    const href =
      persona === null
        ? esc(basePath)
        : `${esc(basePath)}?persona=${encodeURIComponent(persona)}`;
    const color =
      persona === null
        ? ""
        : `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${esc([...providerMeta.values()].find((m) => m.persona === persona)?.color ?? ditherColor(persona))};margin-right:4px"></span>`;
    return `<a href="${href}" style="text-decoration:none"><button class="${active ? "" : "ghost"}" style="margin-right:4px">${color}${esc(label)}</button></a>`;
  };
  const tabs =
    personas.length > 1 || activePersona !== null
      ? `<div style="margin-bottom:12px">${tab("All", null)}${personas.map((p) => tab(p, p)).join("")}</div>`
      : "";

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
          const meta = providerMeta.get(event.source);
          const dot = `<span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${esc(meta?.color ?? ditherColor(personaOf(event)))};flex:none"></span>`;
          return `<div class="item${event.status === "pending" ? " pending" : ""}">${dot}<span style="flex:1">${esc(event.title)}</span>${attendeeChips(event, avatars)}<span class="when">${esc(when)} \u00b7 ${esc(event.source)}</span></div>`;
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

  const sourceRows = sources
    .map(
      (source) =>
        `<div class="item"><span style="display:inline-block;width:8px;height:8px;border-radius:999px;background:${esc(source.color ?? ditherColor(source.persona ?? "personal"))};flex:none"></span><span style="flex:1">${esc(source.label ?? source.provider)}</span><form method="post" style="margin:0;display:flex;gap:4px"><input type="hidden" name="action" value="set_source"><input type="hidden" name="source" value="${esc(source.id)}"><input type="text" name="persona" value="${esc(source.persona ?? "personal")}" style="max-width:90px"><input type="text" name="color" value="${esc(source.color ?? "")}" placeholder="#2b7fff" style="max-width:80px"><button class="ghost">Save</button></form></div>`
    )
    .join("");
  const sourcesSection = sourceRows
    ? `<div class="day">Sources</div>${sourceRows}`
    : "";

  return page(
    "Calendar",
    `<h1>Next 7 days</h1>${tabs}${inviteRows}${days}${empty}${sourcesSection}
${isOwner ? promptBar("Ask your agent — e.g. block focus time tomorrow morning…") : ""}`
  );
}

export const calendar: MiniAppModule = {
  async render(ctx: MiniAppContext): Promise<NextResponse> {
    // Invite approvals come from Postgres metadata (instant); event rows
    // need the box store, so a sleeping box degrades to invites-only.
    const [{ data: decisionRows }, { data: sourceRows }] = await Promise.all([
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
    ]);
    let events: CalendarEvent[] = [];
    let avatars = new Map<string, CrmAvatar>();
    let boxAwake = true;
    try {
      const box = await ensureBoxAwake(ctx.supabase, ctx.session.userId);
      events = await readEventsStore(box.boxId);
      // Attendee avatars come from the owner's OWN box store, read inside
      // this owner-scoped session — no cross-owner resolution can exist.
      avatars = avatarIndex(await readPeople(box.boxId));
    } catch {
      boxAwake = false;
    } finally {
      await armStopAfter(ctx.supabase, ctx.session.userId).catch(
        () => undefined
      );
    }
    const personaParam = ctx.request.nextUrl.searchParams.get("persona");
    const activePersona =
      personaParam && PERSONA_RE.test(personaParam) ? personaParam : null;
    return html(
      renderCalendar(
        ctx.basePath,
        events,
        (decisionRows ?? []) as InviteDecision[],
        boxAwake,
        (sourceRows ?? []) as SourceRow[],
        activePersona,
        avatars,
        ctx.session.role === "owner"
      )
    );
  },

  async action(ctx: MiniAppContext, form: FormData): Promise<NextResponse> {
    // Inline calendar_add resolution — same effect as the Needs-you queue:
    // approve confirms the pending event box-side, dismiss tombstones it.
    const action = String(form.get("action") ?? "");
    if (action === "prompt") {
      try {
        await runPrompt(ctx, String(form.get("text") ?? ""));
      } catch (error) {
        if (error instanceof StartLimitError) {
          return html(
            page(
              "Calendar",
              "<h1>Calendar</h1><p>Your agent's computer can't start right now — try again in a few minutes.</p>"
            )
          );
        }
        throw error;
      }
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(ctx.basePath, externalOrigin(ctx.request)),
          303
        )
      );
    }
    if (action === "set_source" && ctx.session.role === "owner") {
      // Persona/color are calendar_accounts metadata only — the event
      // spine and sync are untouched (pure view-state filter).
      const sourceId = String(form.get("source") ?? "");
      const persona = String(form.get("persona") ?? "").trim();
      const color = String(form.get("color") ?? "").trim();
      if (sourceId && PERSONA_RE.test(persona)) {
        await ctx.supabase
          .from("calendar_accounts")
          .update({
            persona,
            color: COLOR_RE.test(color) ? color.toLowerCase() : null,
          })
          .eq("id", sourceId)
          .eq("user_id", ctx.session.userId);
      }
      return withBaseHeaders(
        NextResponse.redirect(
          new URL(ctx.basePath, externalOrigin(ctx.request)),
          303
        )
      );
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
        new URL(ctx.basePath, externalOrigin(ctx.request)),
        303
      )
    );
  },
};
