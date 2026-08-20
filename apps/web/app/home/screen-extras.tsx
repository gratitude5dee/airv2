"use client";

/**
 * V8 Computer ▸ Screen extras: a server-fetched screenshot thumbnail (a real
 * capture from inside the box — never a stream frame), the 48h power-state
 * sparkline, and keep-awake scheduling (agent_schedules rows with
 * deliver 'none'). All data flows through authenticated server routes.
 */
import { useCallback, useEffect, useRef, useState } from "react";

interface KeepAwakeSchedule {
  id: string;
  name: string;
  cron: string;
  timezone: string;
  status: string;
  next_run_at: string;
}

interface PowerEvent {
  state: "ready" | "stopped";
  created_at: string;
}

const HISTORY_HOURS = 48;

/** Awake intervals over the sparkline window from the transition edges. */
export function awakeIntervals(
  events: PowerEvent[],
  currentOn: boolean,
  now: number
): Array<{ from: number; to: number }> {
  const start = now - HISTORY_HOURS * 3600_000;
  const intervals: Array<{ from: number; to: number }> = [];
  let openedAt: number | null = null;
  for (const event of events) {
    const at = Date.parse(event.created_at);
    if (!Number.isFinite(at)) continue;
    if (event.state === "ready") {
      if (openedAt === null) openedAt = Math.max(at, start);
    } else if (openedAt !== null) {
      intervals.push({ from: openedAt, to: Math.max(at, openedAt) });
      openedAt = null;
    } else if (at > start) {
      // Stopped with no recorded wake: it was on since before the window.
      intervals.push({ from: start, to: at });
    }
  }
  if (openedAt !== null) {
    intervals.push({ from: openedAt, to: now });
  } else if (currentOn && intervals.length === 0 && events.length === 0) {
    // On now with no recorded transitions: show the current stretch only.
    intervals.push({ from: now - 60_000, to: now });
  }
  return intervals;
}

function Sparkline({
  events,
  currentOn,
}: {
  events: PowerEvent[];
  currentOn: boolean;
}) {
  const now = Date.now();
  const start = now - HISTORY_HOURS * 3600_000;
  const spans = awakeIntervals(events, currentOn, now);
  return (
    <svg
      viewBox="0 0 480 16"
      preserveAspectRatio="none"
      className="h-4 w-full rounded bg-surface-2"
      role="img"
      aria-label={`Power history, last ${HISTORY_HOURS} hours`}
    >
      {spans.map((span) => {
        const x = ((span.from - start) / (now - start)) * 480;
        const w = Math.max(((span.to - span.from) / (now - start)) * 480, 1.5);
        return (
          <rect
            key={span.from}
            x={x}
            y={2}
            width={w}
            height={12}
            rx={2}
            fill="var(--success)"
          />
        );
      })}
    </svg>
  );
}

export function ScreenExtras({ boxOn }: { boxOn: boolean }) {
  const [snapshotUrl, setSnapshotUrl] = useState<string | null>(null);
  const [snapshotAt, setSnapshotAt] = useState<string | null>(null);
  const [snapshotNote, setSnapshotNote] = useState<string | null>(null);
  const [snapshotBusy, setSnapshotBusy] = useState(false);
  const snapshotUrlRef = useRef<string | null>(null);

  const [events, setEvents] = useState<PowerEvent[] | null>(null);
  const [schedules, setSchedules] = useState<KeepAwakeSchedule[] | null>(null);
  const [scheduleNote, setScheduleNote] = useState<string | null>(null);
  const [scheduleBusy, setScheduleBusy] = useState(false);
  const [formTime, setFormTime] = useState("09:00");
  const [formMinutes, setFormMinutes] = useState(60);

  useEffect(
    () => () => {
      if (snapshotUrlRef.current) URL.revokeObjectURL(snapshotUrlRef.current);
    },
    []
  );

  const loadHistory = useCallback(async () => {
    try {
      const res = await fetch("/api/computer/history");
      if (res.ok) {
        const data = (await res.json()) as { events?: PowerEvent[] };
        setEvents(data.events ?? []);
      }
    } catch {
      // sparkline is decorative; leave empty on failure
    }
  }, []);

  const loadSchedules = useCallback(async () => {
    try {
      const res = await fetch("/api/computer/keepawake");
      if (res.ok) {
        const data = (await res.json()) as { schedules?: KeepAwakeSchedule[] };
        setSchedules(data.schedules ?? []);
      }
    } catch {
      setSchedules([]);
    }
  }, []);

  useEffect(() => {
    void loadHistory();
    void loadSchedules();
  }, [loadHistory, loadSchedules]);

  async function takeSnapshot() {
    setSnapshotBusy(true);
    setSnapshotNote(null);
    try {
      const res = await fetch("/api/computer/screenshot");
      if (res.ok) {
        const blob = await res.blob();
        if (snapshotUrlRef.current) {
          URL.revokeObjectURL(snapshotUrlRef.current);
        }
        const url = URL.createObjectURL(blob);
        snapshotUrlRef.current = url;
        setSnapshotUrl(url);
        setSnapshotAt(new Date().toLocaleTimeString());
      } else if (res.status === 409) {
        setSnapshotNote("The computer is asleep — no snapshot without waking it.");
      } else if (res.status === 501) {
        setSnapshotNote("This computer has no screenshot tool installed.");
      } else {
        setSnapshotNote("Couldn't take a snapshot — try again shortly.");
      }
    } catch {
      setSnapshotNote("Couldn't take a snapshot — try again shortly.");
    } finally {
      setSnapshotBusy(false);
    }
  }

  async function createSchedule() {
    const [hours, minutes] = formTime.split(":").map((v) => Number(v));
    if (!Number.isInteger(hours) || !Number.isInteger(minutes)) {
      setScheduleNote("Pick a valid time.");
      return;
    }
    setScheduleBusy(true);
    setScheduleNote(null);
    try {
      const timezone =
        Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
      const res = await fetch("/api/computer/keepawake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cron: `${minutes} ${hours} * * *`,
          timezone,
          minutes: formMinutes,
        }),
      });
      if (res.ok) {
        await loadSchedules();
      } else if (res.status === 429) {
        setScheduleNote(
          "Your agent's computer is busy starting up — try again in a minute."
        );
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setScheduleNote(data.error ?? "Couldn't create the schedule.");
      }
    } catch {
      setScheduleNote("Couldn't create the schedule — try again shortly.");
    } finally {
      setScheduleBusy(false);
    }
  }

  async function deleteSchedule(id: string) {
    setScheduleBusy(true);
    try {
      const res = await fetch("/api/computer/keepawake", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (res.ok) await loadSchedules();
    } finally {
      setScheduleBusy(false);
    }
  }

  return (
    <div className="grid gap-2">
      <div className="panel !p-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <strong className="text-[13px]">Snapshot</strong>
            <p className="muted m-0 mt-0.5 text-[12px]">
              {snapshotAt
                ? `Captured at ${snapshotAt} — a real screenshot, not the live stream.`
                : "A server-fetched screenshot from inside the computer."}
            </p>
          </div>
          <button
            className="btn !px-3 !py-1.5 !text-[12px]"
            disabled={snapshotBusy || !boxOn}
            onClick={() => void takeSnapshot()}
            title={boxOn ? undefined : "Power on to take a snapshot"}
          >
            {snapshotBusy ? "Capturing…" : "Take snapshot"}
          </button>
        </div>
        {snapshotNote ? (
          <p className="muted m-0 mt-2 text-[12px]">{snapshotNote}</p>
        ) : null}
        {snapshotUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={snapshotUrl}
            alt="Screenshot of your agent's computer"
            className="mt-2 w-full max-w-md rounded-lg border border-[var(--ring)]"
          />
        ) : null}
      </div>

      <div className="panel !p-3">
        <strong className="text-[13px]">Power history</strong>
        <p className="muted m-0 mt-0.5 text-[12px]">Last {HISTORY_HOURS} hours</p>
        <div className="mt-2">
          <Sparkline events={events ?? []} currentOn={boxOn} />
        </div>
      </div>

      <div className="panel !p-3">
        <strong className="text-[13px]">Keep-awake schedule</strong>
        <p className="muted m-0 mt-0.5 text-[12px]">
          Wake the computer on a schedule and hold it awake — silently, no
          messages.
        </p>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <input
            type="time"
            className="input !w-auto !py-1.5 !text-[13px]"
            value={formTime}
            onChange={(e) => setFormTime(e.target.value)}
            aria-label="Wake time"
          />
          <select
            className="input !w-auto !py-1.5 !text-[13px]"
            value={formMinutes}
            onChange={(e) => setFormMinutes(Number(e.target.value))}
            aria-label="Stay awake for"
          >
            <option value={30}>30 min</option>
            <option value={60}>1 hour</option>
            <option value={120}>2 hours</option>
            <option value={240}>4 hours</option>
          </select>
          <span className="muted text-[12px]">daily</span>
          <button
            className="btn !px-3 !py-1.5 !text-[12px]"
            disabled={scheduleBusy}
            onClick={() => void createSchedule()}
          >
            {scheduleBusy ? "Saving…" : "Add"}
          </button>
        </div>
        {scheduleNote ? (
          <p className="muted m-0 mt-2 text-[12px]">{scheduleNote}</p>
        ) : null}
        <div className="mt-2 grid gap-1.5">
          {(schedules ?? []).map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-2 rounded-lg bg-surface-2 px-2.5 py-1.5"
            >
              <div className="min-w-0">
                <span className="text-[12px]">{s.name}</span>
                <p className="muted m-0 text-[11px]">
                  {s.status === "paused"
                    ? "Paused"
                    : `Next: ${new Date(s.next_run_at).toLocaleString()}`}
                </p>
              </div>
              <button
                className="btn btn-ghost shrink-0 !px-2.5 !py-1 !text-[12px]"
                disabled={scheduleBusy}
                onClick={() => void deleteSchedule(s.id)}
              >
                Remove
              </button>
            </div>
          ))}
          {schedules !== null && schedules.length === 0 ? (
            <p className="muted m-0 text-[12px]">No keep-awake schedules yet.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
