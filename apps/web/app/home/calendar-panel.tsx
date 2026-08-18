"use client";

/**
 * V4 Calendar tab: month/week/agenda over three toggleable layers —
 * external events (box store via /api/calendar), agent schedules
 * (agent_schedules metadata, rendered instantly from Postgres), and bot
 * routines (post-V7, `source: 'bots'` rows). Event content only ever
 * arrives from the box feed; nothing here mirrors titles into Postgres.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { Orb } from "@/components/orb/Orb";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { parseNaturalSchedule } from "@/lib/calendar/nl";
import { cronOccurrences } from "@/lib/calendar/occurrences";

interface CalEvent {
  id: string;
  source: "google" | "apple_ics" | "calcom" | "email";
  source_ref: string;
  title: string;
  starts_at: string;
  ends_at: string;
  all_day: boolean;
  location?: string;
  attendees_count?: number;
  url?: string;
  status?: "pending" | "confirmed";
}

interface Schedule {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  deliver: "imessage" | "email" | "none";
  source: string;
  status: string;
  next_run_at: string;
  one_shot?: boolean;
}

interface Account {
  id: string;
  provider: "google" | "apple_ics" | "calcom" | "email";
  label: string | null;
  status: string;
  last_synced_at: string | null;
}

type CalView = "month" | "week" | "agenda";
type Layer = "events" | "schedules" | "bots";

interface GridItem {
  key: string;
  layer: Layer;
  at: Date;
  title: string;
  pending?: boolean;
  event?: CalEvent;
  schedule?: Schedule;
}

const PROVIDER_COLORS: Record<CalEvent["source"], string> = {
  google: "var(--accent)",
  apple_ics: "var(--muted)",
  calcom: "var(--success)",
  email: "var(--warning)",
};

const PROVIDER_LABELS: Record<CalEvent["source"], string> = {
  google: "Google",
  apple_ics: "Apple",
  calcom: "cal.com",
  email: "Email",
};

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Calendar arithmetic (not fixed 24h steps) so grids survive DST shifts. */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function sameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function fmtTime(date: Date): string {
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

function fmtDay(date: Date): string {
  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function boxNote(status: number): string {
  if (status === 429)
    return "Your agent's computer is busy starting up — retry in a minute.";
  if (status >= 500)
    return "Couldn't reach your agent's computer — it may still be waking up.";
  return "Couldn't load the calendar — try again shortly.";
}

export function CalendarPanel({
  active,
  onAgentRun,
  prefill,
  onPrefillConsumed,
}: {
  active: boolean;
  /** Dispatch a chat run (Prep me / reschedule draft) in the Chat tab. */
  onAgentRun: (prompt: string) => void;
  /** V5 deep-link: open the new-schedule sheet prefilled (Browser ▸ Schedule). */
  prefill?: { name: string; prompt: string } | null;
  onPrefillConsumed?: () => void;
}) {
  const timezone =
    typeof Intl !== "undefined"
      ? Intl.DateTimeFormat().resolvedOptions().timeZone
      : "UTC";

  const [events, setEvents] = useState<CalEvent[] | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [accounts, setAccounts] = useState<Account[] | null>(null);
  const [boxAwake, setBoxAwake] = useState(true);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [view, setView] = useState<CalView>(() =>
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 768px)").matches
      ? "agenda"
      : "month"
  );
  const [cursor, setCursor] = useState(() => startOfDay(new Date()));
  const [layers, setLayers] = useState<Record<Layer, boolean>>({
    events: true,
    schedules: true,
    bots: true,
  });

  const [detail, setDetail] = useState<CalEvent | null>(null);
  const [remindMinutes, setRemindMinutes] = useState(30);
  const [remindNote, setRemindNote] = useState<string | null>(null);
  const [remindBusy, setRemindBusy] = useState(false);

  interface SheetState {
    mode: "create" | "edit";
    schedule?: Schedule;
    name: string;
    when: string;
    prompt: string;
    deliver: "imessage" | "email" | "none";
  }
  const [sheet, setSheet] = useState<SheetState | null>(null);
  const [sheetNote, setSheetNote] = useState<string | null>(null);
  const [sheetBusy, setSheetBusy] = useState(false);
  const [scheduleBusy, setScheduleBusy] = useState<string | null>(null);

  const [srcNote, setSrcNote] = useState<string | null>(null);
  const [srcBusy, setSrcBusy] = useState(false);
  const [appleUrl, setAppleUrl] = useState("");
  const [calcomKey, setCalcomKey] = useState("");
  const [calcomSecret, setCalcomSecret] = useState<{
    secret: string;
    url: string;
  } | null>(null);

  const loadCalendar = useCallback(async () => {
    setLoading(true);
    setNote(null);
    try {
      const res = await fetch("/api/calendar");
      if (res.ok) {
        const data = (await res.json()) as {
          events?: CalEvent[];
          schedules?: Schedule[];
          box_awake?: boolean;
        };
        setEvents(data.events ?? []);
        setSchedules(data.schedules ?? []);
        setBoxAwake(data.box_awake !== false);
      } else {
        setNote(boxNote(res.status));
      }
    } catch {
      setNote("Couldn't load the calendar — try again shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAccounts = useCallback(async () => {
    try {
      const res = await fetch("/api/calendar/accounts");
      if (res.ok) {
        const data = (await res.json()) as { accounts?: Account[] };
        setAccounts(data.accounts ?? []);
      }
    } catch {
      // sources list is secondary; the grid still renders
    }
  }, []);

  useEffect(() => {
    if (active && !loaded) {
      setLoaded(true);
      void loadCalendar();
      void loadAccounts();
    }
  }, [active, loaded, loadCalendar, loadAccounts]);

  // Visible range for the current view.
  const range = useMemo((): { start: Date; end: Date } => {
    if (view === "month") {
      const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
      const start = addDays(first, -first.getDay());
      return { start, end: addDays(start, 42) };
    }
    if (view === "week") {
      const start = addDays(cursor, -cursor.getDay());
      return { start, end: addDays(start, 7) };
    }
    const start = startOfDay(new Date());
    return { start, end: addDays(start, 30) };
  }, [view, cursor]);

  const items = useMemo((): GridItem[] => {
    const out: GridItem[] = [];
    if (layers.events) {
      for (const event of events ?? []) {
        const at = new Date(event.starts_at);
        if (Number.isNaN(at.getTime())) continue;
        if (at < range.start || at >= range.end) continue;
        out.push({
          key: `e-${event.id}`,
          layer: "events",
          at,
          title: event.title,
          pending: event.status === "pending",
          event,
        });
      }
    }
    for (const schedule of schedules) {
      if (schedule.status === "deleted") continue;
      const layer: Layer = schedule.source === "bots" ? "bots" : "schedules";
      if (!layers[layer]) continue;
      if (schedule.one_shot) {
        const at = new Date(schedule.next_run_at);
        if (at >= range.start && at < range.end) {
          out.push({
            key: `s-${schedule.id}`,
            layer,
            at,
            title: schedule.name,
            schedule,
          });
        }
        continue;
      }
      const occurrences = cronOccurrences(
        schedule.cron,
        schedule.timezone,
        range.start,
        range.end
      );
      for (const at of occurrences) {
        out.push({
          key: `s-${schedule.id}-${at.getTime()}`,
          layer,
          at,
          title: schedule.name,
          schedule,
        });
      }
    }
    return out.sort((a, b) => a.at.getTime() - b.at.getTime());
  }, [events, schedules, layers, range]);

  function itemsForDay(day: Date): GridItem[] {
    return items.filter((item) => sameDay(item.at, day));
  }

  function openCreate(date?: Date) {
    setSheetNote(null);
    setSheet({
      mode: "create",
      name: "",
      // Seed a sensible cadence when the sheet opens from a grid slot.
      when: date
        ? `every ${date.toLocaleDateString([], { weekday: "long" }).toLowerCase()} at 9am`
        : "",
      prompt: "",
      deliver: "imessage",
    });
  }

  // Browser ▸ Automations "Schedule" lands here with the sheet prefilled.
  useEffect(() => {
    if (!active || !prefill) return;
    setSheetNote(null);
    setSheet({
      mode: "create",
      name: prefill.name,
      when: "every day at 9am",
      prompt: prefill.prompt,
      deliver: "imessage",
    });
    onPrefillConsumed?.();
  }, [active, prefill, onPrefillConsumed]);

  function openEdit(schedule: Schedule) {
    setSheetNote(null);
    setSheet({
      mode: "edit",
      schedule,
      name: schedule.name,
      when: schedule.cron,
      prompt: "",
      deliver: schedule.deliver,
    });
  }

  async function saveSheet() {
    if (!sheet) return;
    const parsed = parseNaturalSchedule(sheet.when);
    if (!parsed.cron) {
      setSheetNote(parsed.error ?? "Describe when it should run.");
      return;
    }
    if (!sheet.name.trim()) {
      setSheetNote("Give it a name.");
      return;
    }
    if (sheet.mode === "create" && !sheet.prompt.trim()) {
      setSheetNote("Describe what the agent should do.");
      return;
    }
    setSheetBusy(true);
    setSheetNote(null);
    try {
      const isCreate = sheet.mode === "create";
      const res = await fetch("/api/calendar/schedule", {
        method: isCreate ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isCreate
            ? {
                name: sheet.name.trim(),
                cron: parsed.cron,
                timezone,
                prompt: sheet.prompt.trim(),
                deliver: sheet.deliver,
              }
            : {
                id: sheet.schedule?.id,
                name: sheet.name.trim(),
                cron: parsed.cron,
                timezone,
                deliver: sheet.deliver,
                ...(sheet.prompt.trim() ? { prompt: sheet.prompt.trim() } : {}),
              }
        ),
      });
      if (res.ok) {
        setSheet(null);
        await loadCalendar();
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setSheetNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — retry in a minute."
            : (data.error ?? "Couldn't save — try again shortly.")
        );
      }
    } catch {
      setSheetNote("Couldn't save — try again shortly.");
    } finally {
      setSheetBusy(false);
    }
  }

  async function patchSchedule(id: string, body: Record<string, unknown>) {
    setScheduleBusy(id);
    try {
      await fetch("/api/calendar/schedule", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, ...body }),
      });
      await loadCalendar();
    } finally {
      setScheduleBusy(null);
    }
  }

  async function deleteSchedule(id: string) {
    setScheduleBusy(id);
    try {
      await fetch("/api/calendar/schedule", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      setSheet(null);
      await loadCalendar();
    } finally {
      setScheduleBusy(null);
    }
  }

  async function remindMe(event: CalEvent) {
    setRemindBusy(true);
    setRemindNote(null);
    try {
      const res = await fetch("/api/calendar/remind", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: event.title,
          starts_at: event.starts_at,
          minutes_before: remindMinutes,
          timezone,
        }),
      });
      if (res.ok) {
        setRemindNote(`Reminder set — ${remindMinutes} minutes before.`);
        await loadCalendar();
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setRemindNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — retry in a minute."
            : (data.error ?? "Couldn't set the reminder — try again shortly.")
        );
      }
    } catch {
      setRemindNote("Couldn't set the reminder — try again shortly.");
    } finally {
      setRemindBusy(false);
    }
  }

  async function connectSource(
    provider: Account["provider"],
    body: Record<string, unknown> = {}
  ) {
    setSrcBusy(true);
    setSrcNote(null);
    setCalcomSecret(null);
    try {
      const res = await fetch("/api/calendar/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider, ...body }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        webhook_secret?: string;
        webhook_url?: string;
      };
      if (res.ok) {
        if (data.webhook_secret && data.webhook_url) {
          setCalcomSecret({ secret: data.webhook_secret, url: data.webhook_url });
        }
        setAppleUrl("");
        setCalcomKey("");
        await loadAccounts();
        void loadCalendar();
      } else if (res.status === 429) {
        setSrcNote("Your agent's computer is busy starting up — retry in a minute.");
      } else {
        setSrcNote(data.error ?? "Couldn't connect — try again shortly.");
      }
    } catch {
      setSrcNote("Couldn't connect — try again shortly.");
    } finally {
      setSrcBusy(false);
    }
  }

  async function disconnectSource(id: string) {
    setSrcBusy(true);
    setSrcNote(null);
    try {
      await fetch("/api/calendar/accounts", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      await loadAccounts();
    } finally {
      setSrcBusy(false);
    }
  }

  const parsed = sheet ? parseNaturalSchedule(sheet.when) : null;
  const today = startOfDay(new Date());

  function renderPill(item: GridItem, compact = false) {
    const base =
      "flex w-full items-center gap-1.5 rounded-lg px-1.5 py-1 text-left text-[11px] leading-tight";
    if (item.layer === "events" && item.event) {
      const event = item.event;
      return (
        <button
          key={item.key}
          className={
            base +
            " bg-surface " +
            (item.pending
              ? "border border-dashed border-[var(--muted)]"
              : "shadow-[0_0_0_0.5px_var(--ring)]")
          }
          onClick={() => {
            setRemindNote(null);
            setDetail(event);
          }}
          title={event.title}
        >
          <span
            aria-hidden
            className="inline-block h-2 w-2 shrink-0 rounded-full"
            style={{ background: PROVIDER_COLORS[event.source] }}
          />
          <span className="truncate">
            {!compact && !event.all_day ? `${fmtTime(item.at)} ` : ""}
            {event.title}
          </span>
        </button>
      );
    }
    if (item.layer === "bots" && item.schedule) {
      return (
        <button
          key={item.key}
          className={base + " bg-surface-2"}
          onClick={() => openEdit(item.schedule as Schedule)}
          title={item.title}
        >
          <span className="h-3.5 w-3.5 shrink-0 overflow-hidden rounded-full">
            <DitherAvatar name={item.title} size={14} />
          </span>
          <span className="truncate">{item.title}</span>
        </button>
      );
    }
    return (
      <button
        key={item.key}
        className={base + " bg-surface-2"}
        onClick={() => item.schedule && openEdit(item.schedule)}
        title={item.title}
      >
        <Orb size={10} label="" className="shrink-0" />
        <span className="truncate">
          {!compact ? `${fmtTime(item.at)} ` : ""}
          {item.title}
        </span>
      </button>
    );
  }

  const userSchedules = schedules.filter(
    (s) => s.source !== "bots" && s.status !== "deleted"
  );

  return (
    <div className="grid flex-1 content-start gap-3 overflow-y-auto">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="m-0 text-[15px] font-semibold">Calendar</h3>
        <div className="flex flex-wrap items-center gap-1.5">
          {(["month", "week", "agenda"] as const).map((v) => (
            <button
              key={v}
              className={
                "seg !px-3 !py-1 !text-[12px] rounded-lg" +
                (view === v ? " pill-active" : " shadow-[0_0_0_0.5px_var(--ring)]")
              }
              onClick={() => setView(v)}
            >
              {v === "month" ? "Month" : v === "week" ? "Week" : "Agenda"}
            </button>
          ))}
          <button
            className="btn !px-3 !py-1.5 !text-[12px]"
            onClick={() => openCreate()}
          >
            + New schedule
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {view !== "agenda" ? (
            <>
              <button
                className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                aria-label="Previous"
                onClick={() =>
                  setCursor((c) =>
                    view === "month"
                      ? new Date(c.getFullYear(), c.getMonth() - 1, 1)
                      : addDays(c, -7)
                  )
                }
              >
                ←
              </button>
              <button
                className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                onClick={() => setCursor(startOfDay(new Date()))}
              >
                Today
              </button>
              <button
                className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                aria-label="Next"
                onClick={() =>
                  setCursor((c) =>
                    view === "month"
                      ? new Date(c.getFullYear(), c.getMonth() + 1, 1)
                      : addDays(c, 7)
                  )
                }
              >
                →
              </button>
              <span className="text-[13px] font-medium">
                {view === "month"
                  ? cursor.toLocaleDateString([], {
                      month: "long",
                      year: "numeric",
                    })
                  : `${fmtDay(range.start)} – ${fmtDay(addDays(range.end, -1))}`}
              </span>
            </>
          ) : (
            <span className="text-[13px] font-medium">Next 30 days</span>
          )}
        </div>
        <div className="flex items-center gap-1.5" aria-label="Layers">
          {(
            [
              ["events", "Events"],
              ["schedules", "Agent schedule"],
              ["bots", "Bot routines"],
            ] as [Layer, string][]
          ).map(([layer, label]) => (
            <button
              key={layer}
              aria-pressed={layers[layer]}
              className={
                "seg !px-2.5 !py-1 !text-[11px] rounded-lg" +
                (layers[layer]
                  ? " pill-active"
                  : " shadow-[0_0_0_0.5px_var(--ring)] opacity-60")
              }
              onClick={() =>
                setLayers((l) => ({ ...l, [layer]: !l[layer] }))
              }
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {note ? (
        <div className="flex items-center gap-2">
          <p className="muted m-0 text-[12px]">{note}</p>
          <button
            className="btn !px-3 !py-1.5 !text-[12px]"
            onClick={() => void loadCalendar()}
          >
            Retry
          </button>
        </div>
      ) : null}
      {!note && !boxAwake ? (
        <p className="muted m-0 text-[12px]">
          Your agent&apos;s computer is waking up — schedules are shown;
          external events will appear when it&apos;s ready.{" "}
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 underline decoration-dotted underline-offset-2"
            onClick={() => void loadCalendar()}
          >
            Refresh
          </button>
        </p>
      ) : null}
      {loading && events === null ? (
        <div className="py-1">
          <Orb pill label="Loading your calendar…" />
        </div>
      ) : null}

      {view === "month" ? (
        <div>
          <div className="grid grid-cols-7 gap-1">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="muted px-1 text-[11px] font-medium">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {Array.from({ length: 42 }, (_, i) => {
              const day = addDays(range.start, i);
              const inMonth = day.getMonth() === cursor.getMonth();
              const dayItems = itemsForDay(day);
              const isToday = sameDay(day, today);
              return (
                <div
                  key={day.toISOString()}
                  className={
                    "min-h-[76px] rounded-lg p-1 " +
                    (isToday
                      ? "bg-[var(--accent-soft)] shadow-[0_0_0_0.5px_var(--accent)]"
                      : "bg-surface-2") +
                    (inMonth ? "" : " opacity-45")
                  }
                >
                  <button
                    className="muted block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-[11px]"
                    title="New schedule"
                    onClick={() => openCreate(day)}
                  >
                    {day.getDate()}
                  </button>
                  <div className="mt-0.5 grid gap-0.5">
                    {dayItems.slice(0, 3).map((item) => renderPill(item, true))}
                    {dayItems.length > 3 ? (
                      <span className="muted text-[10px]">
                        +{dayItems.length - 3} more
                      </span>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === "week" ? (
        <div className="grid grid-cols-2 gap-1 sm:grid-cols-7">
          {Array.from({ length: 7 }, (_, i) => {
            const day = addDays(range.start, i);
            const dayItems = itemsForDay(day);
            const isToday = sameDay(day, today);
            return (
              <div
                key={day.toISOString()}
                className={
                  "min-h-[120px] rounded-lg p-1.5 " +
                  (isToday
                    ? "bg-[var(--accent-soft)] shadow-[0_0_0_0.5px_var(--accent)]"
                    : "bg-surface-2")
                }
              >
                <button
                  className="muted block w-full cursor-pointer border-0 bg-transparent p-0 text-left text-[11px] font-medium"
                  title="New schedule"
                  onClick={() => openCreate(day)}
                >
                  {fmtDay(day)}
                </button>
                <div className="mt-1 grid gap-1">
                  {dayItems.map((item) => renderPill(item))}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-1.5">
          {Array.from({ length: 30 }, (_, i) => {
            const day = addDays(range.start, i);
            const dayItems = itemsForDay(day);
            if (dayItems.length === 0) return null;
            return (
              <div key={day.toISOString()}>
                <p
                  className={
                    "m-0 mb-1 text-[12px] font-medium " +
                    (sameDay(day, today) ? "text-[var(--accent)]" : "muted")
                  }
                >
                  {sameDay(day, today) ? "Today" : fmtDay(day)}
                </p>
                <div className="grid gap-1">
                  {dayItems.map((item) => renderPill(item))}
                </div>
              </div>
            );
          })}
          {items.length === 0 && events !== null ? (
            <p className="muted m-0 text-[13px]">
              Nothing coming up — connect a source below or schedule your
              agent.
            </p>
          ) : null}
        </div>
      )}

      <h4 className="m-0 mt-1 text-[13px] font-semibold">Scheduled work</h4>
      {userSchedules.map((schedule) => (
        <div
          key={schedule.id}
          className="panel rise-in flex flex-wrap items-center justify-between gap-2 !p-3"
        >
          <div className="flex min-w-0 items-center gap-2">
            <Orb size={16} label="" className="shrink-0" />
            <div className="min-w-0">
              <strong className="block truncate text-[13px]">
                {schedule.name}
              </strong>
              <p className="muted m-0 mt-0.5 text-[11px]">
                {schedule.cron} · {schedule.timezone} ·{" "}
                {schedule.deliver === "none"
                  ? "silent"
                  : schedule.deliver === "imessage"
                    ? "iMessage"
                    : "email"}
                {schedule.status === "paused" ? " · paused" : ""}
                {schedule.one_shot ? " · one-shot" : ""}
                {" · next "}
                {new Date(schedule.next_run_at).toLocaleString([], {
                  weekday: "short",
                  hour: "numeric",
                  minute: "2-digit",
                })}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-1.5">
            <button
              className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
              disabled={scheduleBusy !== null}
              onClick={() => openEdit(schedule)}
            >
              Edit
            </button>
            <button
              className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
              disabled={scheduleBusy !== null}
              onClick={() =>
                void patchSchedule(schedule.id, {
                  status: schedule.status === "paused" ? "active" : "paused",
                })
              }
            >
              {scheduleBusy === schedule.id
                ? "Working…"
                : schedule.status === "paused"
                  ? "Resume"
                  : "Pause"}
            </button>
            <button
              className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
              disabled={scheduleBusy !== null}
              onClick={() => void deleteSchedule(schedule.id)}
            >
              Delete
            </button>
          </div>
        </div>
      ))}
      {userSchedules.length === 0 ? (
        <p className="muted m-0 text-[12px]">
          No scheduled work yet — try &quot;weekdays at 8am, text me my
          day&quot;.
        </p>
      ) : null}

      <h4 className="m-0 mt-1 text-[13px] font-semibold">Sources</h4>
      {srcNote ? <p className="muted m-0 text-[12px]">{srcNote}</p> : null}
      {calcomSecret ? (
        <div className="panel !p-3">
          <p className="m-0 text-[12px]">
            Register this webhook at cal.com — the secret is shown once:
          </p>
          <p className="m-0 mt-1 break-all font-mono text-[11px]">
            {calcomSecret.url}
          </p>
          <p className="m-0 mt-1 break-all font-mono text-[11px]">
            secret: {calcomSecret.secret}
          </p>
        </div>
      ) : null}
      {(["google", "apple_ics", "calcom", "email"] as const).map((provider) => {
        const account = (accounts ?? []).find(
          (a) => a.provider === provider && a.status !== "revoked"
        );
        return (
          <div
            key={provider}
            className="panel rise-in flex flex-wrap items-center justify-between gap-2 !p-3"
          >
            <div className="flex items-center gap-2">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: PROVIDER_COLORS[provider] }}
              />
              <div>
                <strong className="text-[13px]">
                  {provider === "google"
                    ? "Google Calendar"
                    : provider === "apple_ics"
                      ? "Apple Calendar (ICS)"
                      : provider === "calcom"
                        ? "cal.com"
                        : "Email invites"}
                </strong>
                <p className="muted m-0 mt-0.5 text-[11px]">
                  {account
                    ? `${account.status}${
                        account.last_synced_at
                          ? ` · synced ${new Date(account.last_synced_at).toLocaleString([], { hour: "numeric", minute: "2-digit", month: "short", day: "numeric" })}`
                          : " · not synced yet"
                      }`
                    : "not connected"}
                </p>
              </div>
            </div>
            {account ? (
              <button
                className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                disabled={srcBusy}
                onClick={() => void disconnectSource(account.id)}
              >
                Disconnect
              </button>
            ) : provider === "apple_ics" ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:min-w-[280px]">
                <input
                  className="input !py-1.5 !text-[12px]"
                  placeholder="webcal:// or https:// subscription URL"
                  value={appleUrl}
                  onChange={(e) => setAppleUrl(e.target.value)}
                />
                <button
                  className="btn !px-3 !py-1.5 !text-[12px]"
                  disabled={srcBusy || !appleUrl.trim()}
                  onClick={() =>
                    void connectSource("apple_ics", { ics_url: appleUrl.trim() })
                  }
                >
                  Connect
                </button>
              </div>
            ) : provider === "calcom" ? (
              <div className="flex min-w-0 flex-1 items-center justify-end gap-1.5 sm:min-w-[280px]">
                <input
                  className="input !py-1.5 !text-[12px]"
                  placeholder="cal.com API key"
                  type="password"
                  value={calcomKey}
                  onChange={(e) => setCalcomKey(e.target.value)}
                />
                <button
                  className="btn !px-3 !py-1.5 !text-[12px]"
                  disabled={srcBusy || !calcomKey.trim()}
                  onClick={() =>
                    void connectSource("calcom", { api_key: calcomKey.trim() })
                  }
                >
                  Connect
                </button>
              </div>
            ) : (
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={srcBusy}
                onClick={() => void connectSource(provider)}
              >
                Connect
              </button>
            )}
          </div>
        );
      })}
      <p className="muted m-0 text-[11px]">
        Google connects through Connectors (Composio). Apple ICS URLs and
        cal.com keys go straight to your agent&apos;s computer — they never
        touch our database.
      </p>

      {detail ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setDetail(null)}
        >
          <div
            className="panel w-full max-w-[440px] !p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="m-0 truncate text-[15px] font-semibold">
                  {detail.title}
                </h3>
                <p className="muted m-0 mt-1 text-[12px]">
                  {detail.all_day
                    ? new Date(detail.starts_at).toLocaleDateString([], {
                        weekday: "long",
                        month: "long",
                        day: "numeric",
                      }) + " · all day"
                    : `${new Date(detail.starts_at).toLocaleString([], {
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })} – ${fmtTime(new Date(detail.ends_at))}`}
                </p>
              </div>
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                style={{
                  background: "var(--accent-soft)",
                  color: PROVIDER_COLORS[detail.source],
                }}
              >
                {PROVIDER_LABELS[detail.source]}
                {detail.status === "pending" ? " · pending" : ""}
              </span>
            </div>
            {detail.location ? (
              <p className="m-0 mt-2 text-[12px]">{detail.location}</p>
            ) : null}
            {detail.url ? (
              <p className="m-0 mt-1 break-all text-[12px]">
                <a href={detail.url} target="_blank" rel="noreferrer noopener">
                  {detail.url}
                </a>
              </p>
            ) : null}
            {typeof detail.attendees_count === "number" ? (
              <p className="muted m-0 mt-1 text-[12px]">
                {detail.attendees_count} attendee
                {detail.attendees_count === 1 ? "" : "s"}
              </p>
            ) : null}

            <div className="mt-3 grid gap-2">
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                onClick={() => {
                  const when = detail.all_day
                    ? new Date(detail.starts_at).toLocaleDateString()
                    : new Date(detail.starts_at).toLocaleString();
                  onAgentRun(
                    `Brief me for "${detail.title}" (${when}${
                      detail.location ? `, at ${detail.location}` : ""
                    }) — who's involved, anything relevant from my email, and what I should prepare.`
                  );
                  setDetail(null);
                }}
              >
                Prep me
              </button>
              <div className="flex items-center gap-1.5">
                <select
                  className="input !w-auto !py-1.5 !text-[12px]"
                  aria-label="Minutes before"
                  value={remindMinutes}
                  onChange={(e) => setRemindMinutes(Number(e.target.value))}
                >
                  {[10, 30, 60, 120].map((m) => (
                    <option key={m} value={m}>
                      {m >= 60 ? `${m / 60}h` : `${m}m`} before
                    </option>
                  ))}
                </select>
                <button
                  className="btn !px-3 !py-1.5 !text-[12px]"
                  disabled={remindBusy}
                  onClick={() => void remindMe(detail)}
                >
                  {remindBusy ? "Setting…" : "Remind me"}
                </button>
              </div>
              {detail.source === "email" ? (
                <button
                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                  onClick={() => {
                    onAgentRun(
                      `Draft a reschedule email for "${detail.title}" (${new Date(
                        detail.starts_at
                      ).toLocaleString()}) to the organizer — propose two alternative times this week. Save it as a draft for my approval; do not send it.`
                    );
                    setDetail(null);
                  }}
                >
                  Draft a reschedule email
                </button>
              ) : null}
              {remindNote ? (
                <p className="muted m-0 text-[12px]">{remindNote}</p>
              ) : null}
              <button
                className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                onClick={() => setDetail(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {sheet ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal="true"
          onClick={() => setSheet(null)}
        >
          <div
            className="panel w-full max-w-[440px] !p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="m-0 text-[15px] font-semibold">
              {sheet.mode === "create" ? "New schedule" : "Edit schedule"}
            </h3>
            <div className="mt-3 grid gap-2">
              <input
                className="input"
                placeholder="Name — e.g. Morning brief"
                value={sheet.name}
                onChange={(e) =>
                  setSheet((s) => (s ? { ...s, name: e.target.value } : s))
                }
              />
              <input
                className="input"
                placeholder='When — e.g. "weekdays at 8am"'
                value={sheet.when}
                onChange={(e) =>
                  setSheet((s) => (s ? { ...s, when: e.target.value } : s))
                }
              />
              {sheet.when.trim() ? (
                parsed?.cron ? (
                  <p className="muted m-0 text-[11px]">
                    {parsed.description} · cron{" "}
                    <span className="font-mono">{parsed.cron}</span> ·{" "}
                    {timezone}
                  </p>
                ) : (
                  <p className="m-0 text-[11px] text-[var(--warning)]">
                    {parsed?.error}
                  </p>
                )
              ) : null}
              <textarea
                className="input min-h-[84px]"
                placeholder={
                  sheet.mode === "edit"
                    ? "Prompt — leave blank to keep the current one (it lives on your agent's computer)"
                    : "Prompt — what should your agent do when this fires?"
                }
                value={sheet.prompt}
                onChange={(e) =>
                  setSheet((s) => (s ? { ...s, prompt: e.target.value } : s))
                }
              />
              <div className="flex gap-1.5">
                {(
                  [
                    ["imessage", "iMessage"],
                    ["email", "Email"],
                    ["none", "Silent"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    className={
                      "seg !px-3 !py-1 !text-[12px] rounded-lg" +
                      (sheet.deliver === id
                        ? " pill-active"
                        : " shadow-[0_0_0_0.5px_var(--ring)]")
                    }
                    onClick={() =>
                      setSheet((s) => (s ? { ...s, deliver: id } : s))
                    }
                  >
                    {label}
                  </button>
                ))}
              </div>
              {sheetNote ? (
                <p className="m-0 text-[12px] text-[var(--warning)]">
                  {sheetNote}
                </p>
              ) : null}
              <div className="flex justify-between gap-2">
                {sheet.mode === "edit" && sheet.schedule ? (
                  <button
                    className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                    disabled={sheetBusy || scheduleBusy !== null}
                    onClick={() =>
                      void deleteSchedule((sheet.schedule as Schedule).id)
                    }
                  >
                    Delete
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                    onClick={() => setSheet(null)}
                  >
                    Cancel
                  </button>
                  <button
                    className="btn !px-3 !py-1.5 !text-[12px]"
                    disabled={sheetBusy}
                    onClick={() => void saveSheet()}
                  >
                    {sheetBusy ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
