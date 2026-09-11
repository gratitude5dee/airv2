"use client";

/**
 * Calm launch surface. It reads summary data and routes into the existing
 * Calendar and Needs You implementations, which remain the source of truth.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Orb } from "@/components/orb/Orb";
import { AppTile } from "./app-tile";
import { CalendarPanel } from "./calendar-panel";
import type { Decision } from "./panels/needs-panel";
import type { Section } from "./nav";

interface HomeApp {
  slug: string;
  name: string;
  description?: string;
  icon_url?: string | null;
  status?: string;
  installed?: boolean;
}

interface HomeEvent {
  id: string;
  title: string;
  starts_at: string;
  ends_at?: string;
  all_day?: boolean;
}

interface HomeSchedule {
  id: string;
  name: string;
  next_run_at?: string | null;
  status?: string;
}

function eventTime(iso: string, allDay = false): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Soon";
  if (allDay) return date.toLocaleDateString([], { month: "short", day: "numeric" });
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function eventTimestamp(iso: string): number {
  const value = new Date(iso).getTime();
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

/** When an event stops being current: its end, else end of day (all-day) or start + 1h. */
function eventEndsAt(event: HomeEvent): number {
  const end = event.ends_at ? new Date(event.ends_at).getTime() : Number.NaN;
  if (!Number.isNaN(end)) return end;
  const start = new Date(event.starts_at);
  if (Number.isNaN(start.getTime())) return Number.MAX_SAFE_INTEGER;
  if (event.all_day) {
    start.setHours(23, 59, 59, 999);
    return start.getTime();
  }
  return start.getTime() + 60 * 60 * 1000;
}

export function HomeDashboard({
  active,
  needsCount,
  onPendingCount,
  onNavigate,
  onOpenApp,
  onAgentRun,
  calendarPrefill,
  onPrefillConsumed,
}: {
  active: boolean;
  needsCount: number;
  onPendingCount: (count: number) => void;
  onNavigate: (next: Section) => void;
  onOpenApp: (slug: string) => void;
  onAgentRun: (prompt: string) => void;
  calendarPrefill: { name: string; prompt: string } | null;
  onPrefillConsumed: () => void;
}) {
  const [apps, setApps] = useState<HomeApp[]>([]);
  const [events, setEvents] = useState<HomeEvent[]>([]);
  const [schedules, setSchedules] = useState<HomeSchedule[]>([]);
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [loading, setLoading] = useState(true);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const calendarDialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = calendarDialogRef.current;
    if (!dialog) return;
    if (calendarOpen && !dialog.open) dialog.showModal();
    else if (!calendarOpen && dialog.open) dialog.close();
  }, [calendarOpen]);

  useEffect(() => {
    if (!active) return;
    let stale = false;
    setLoading(true);
    // Independent chains: one slow or failed summary must not hold back the
    // others. `?peek=1` keeps the preview read-only — an ambient Home open
    // never wakes a stopped box.
    const jobs = [
      fetch("/api/mini/apps")
        .then((response) =>
          response.ok ? (response.json() as Promise<{ apps?: HomeApp[] }>) : { apps: [] }
        )
        .then((data) => {
          if (!stale) setApps(data.apps ?? []);
        })
        .catch(() => undefined),
      fetch("/api/calendar?peek=1")
        .then((response) =>
          response.ok
            ? (response.json() as Promise<{ events?: HomeEvent[]; schedules?: HomeSchedule[] }>)
            : { events: [], schedules: [] }
        )
        .then((data) => {
          if (stale) return;
          setEvents(data.events ?? []);
          setSchedules(data.schedules ?? []);
        })
        .catch(() => undefined),
      fetch("/api/decisions")
        .then((response) =>
          response.ok
            ? (response.json() as Promise<{ decisions?: Decision[] }>)
            : Promise.reject(new Error(`decisions ${response.status}`))
        )
        .then((data) => {
          if (stale) return;
          const nextDecisions = data.decisions ?? [];
          setDecisions(nextDecisions);
          onPendingCount(nextDecisions.length);
        })
        // A failed read keeps the last queue and count rather than reporting
        // an empty one (NeedsPanel does the same).
        .catch(() => undefined),
    ];
    void Promise.allSettled(jobs).then(() => {
      if (!stale) setLoading(false);
    });
    return () => {
      stale = true;
    };
  }, [active, onPendingCount]);

  const upcoming = useMemo(() => {
    const now = Date.now();
    const eventRows = events
      .filter((event) => eventEndsAt(event) >= now)
      .map((event) => ({
        id: `event-${event.id}`,
        title: event.title,
        time: eventTime(event.starts_at, event.all_day),
        kind: "Calendar",
        timestamp: eventTimestamp(event.starts_at),
      }));
    const scheduleRows = schedules
      .filter((schedule) => schedule.status !== "deleted" && schedule.next_run_at)
      .map((schedule) => ({
        id: `schedule-${schedule.id}`,
        title: schedule.name,
        time: eventTime(schedule.next_run_at ?? ""),
        kind: "Routine",
        timestamp: eventTimestamp(schedule.next_run_at ?? ""),
      }));
    return [...eventRows, ...scheduleRows]
      .sort((a, b) => a.timestamp - b.timestamp)
      .slice(0, 3);
  }, [events, schedules]);

  // The shelf is the owner's toolkit — only apps they installed, never the
  // whole published catalog.
  const featuredApps = apps
    .filter((app) => app.installed && app.slug !== "home")
    .slice(0, 6);
  const needsPreview = decisions.slice(0, 3);

  return (
    <>
      <div
        className={
          "wabi-home-dashboard grid flex-1 content-start gap-4 overflow-y-auto" +
          (active ? "" : " hidden")
        }
        aria-hidden={!active}
      >
        <header className="wabi-home-hero">
          <div>
            <p className="wabi-eyebrow">Good to see you</p>
            <h2 className="wabi-home-title">A softer way to get things done.</h2>
            <p className="wabi-home-copy">
              Your agent, your approvals, and the next useful thing in one quiet place.
            </p>
          </div>
          <Orb size={54} label="air" />
        </header>

        <div className="grid gap-4 md:grid-cols-[1.15fr_0.85fr]">
          <section className="wabi-home-card">
            <div className="wabi-card-heading">
              <div>
                <p className="wabi-eyebrow">Next on your day</p>
                <h3>Calendar</h3>
              </div>
              <button className="wabi-link-button" onClick={() => setCalendarOpen(true)}>
                Expand ↗
              </button>
            </div>
            {loading ? (
              <p className="wabi-muted">Gathering the next few moments…</p>
            ) : upcoming.length > 0 ? (
              <div className="wabi-event-list">
                {upcoming.map((item) => (
                  <button key={item.id} className="wabi-event-row" onClick={() => setCalendarOpen(true)}>
                    <span className="wabi-event-dot" aria-hidden="true" />
                    <span className="min-w-0 flex-1 text-left">
                      <strong className="block truncate">{item.title}</strong>
                      <span className="wabi-muted">{item.kind} · {item.time}</span>
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="wabi-empty-state">
                <span>No plans are waiting for you.</span>
                <button className="wabi-text-button" onClick={() => setCalendarOpen(true)}>
                  Open calendar
                </button>
              </div>
            )}
          </section>

          <section className="wabi-home-card">
            <div className="wabi-card-heading">
              <div>
                <p className="wabi-eyebrow">A small nudge</p>
                <h3>Needs You</h3>
              </div>
              <span className="wabi-count">{needsCount}</span>
            </div>
            {needsPreview.length > 0 ? (
              <div className="wabi-needs-list">
                {needsPreview.map((decision) => (
                  <button
                    key={decision.id}
                    className="wabi-need-row"
                    onClick={() => onNavigate("personal.needs")}
                  >
                    <span className="wabi-need-mark" aria-hidden="true">•</span>
                    <span className="min-w-0 flex-1 truncate text-left">
                      {decision.label || decision.kind.replaceAll("_", " ")}
                    </span>
                    <span aria-hidden="true">›</span>
                  </button>
                ))}
              </div>
            ) : (
              <p className="wabi-muted">Nothing is waiting for approval.</p>
            )}
            <button className="wabi-primary-button" onClick={() => onNavigate("personal.needs")}>
              Review queue
            </button>
          </section>
        </div>

        <section className="wabi-home-card">
          <div className="wabi-card-heading">
            <div>
              <p className="wabi-eyebrow">Your little toolkit</p>
              <h3>Apps</h3>
            </div>
            <button className="wabi-link-button" onClick={() => onNavigate("apps.store")}>
              App Store ↗
            </button>
          </div>
          {featuredApps.length > 0 ? (
            <div className="wabi-app-shelf">
              {featuredApps.map((app) => (
                <button
                  key={app.slug}
                  className="wabi-app-item"
                  onClick={() => onOpenApp(app.slug)}
                  title={app.description || app.name}
                >
                  <AppTile slug={app.slug} name={app.name} iconUrl={app.icon_url} size={52} radius={16} />
                  <span>{app.name || app.slug}</span>
                </button>
              ))}
            </div>
          ) : (
            <div className="wabi-empty-state">
              <span>{loading ? "Loading apps…" : "Your apps will appear here."}</span>
              <button className="wabi-text-button" onClick={() => onNavigate("apps.store")}>
                Browse the store
              </button>
            </div>
          )}
        </section>
      </div>

      {active && calendarOpen ? (
        <dialog
          ref={calendarDialogRef}
          className="wabi-calendar-dialog"
          aria-label="Expanded calendar"
          onClick={(event) => {
            if (event.target === event.currentTarget) setCalendarOpen(false);
          }}
          onCancel={(event) => {
            event.preventDefault();
            setCalendarOpen(false);
          }}
        >
          <div className="wabi-calendar-dialog-head">
            <div>
              <p className="wabi-eyebrow">Expanded view</p>
              <h2>Calendar</h2>
            </div>
            <button className="wabi-link-button" onClick={() => setCalendarOpen(false)}>
              Close
            </button>
          </div>
          <div className="wabi-calendar-dialog-body">
            <CalendarPanel
              prefill={calendarPrefill}
              onPrefillConsumed={onPrefillConsumed}
              onAgentRun={(prompt) => {
                setCalendarOpen(false);
                onAgentRun(prompt);
              }}
            />
          </div>
        </dialog>
      ) : null}
    </>
  );
}
