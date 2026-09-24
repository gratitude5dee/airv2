"use client";

/**
 * V13 §5.2 — the progress screen the card opens. One job, live:
 *
 *   [pill]  Building | Live | Stuck | Cancelled | Replaced | Failed
 *   ────── percent bar ──────
 *   one-line detail
 *   Brief ✓ → Code ✓ → Build • → Check → Publish      (with timings)
 *   [Cancel]
 *
 * Terminal live → the dev link + screenshot + Open / Copy / Share /
 * Make a change / Ship it. Stuck or failed → the plain issue + Try again
 * (a fresh job, round 0) + Describe a fix. Rule ids never render.
 *
 * Transport (§5.3): `live-token` mints the WS url + token; the token is
 * the socket's first message. Polls `/api/create/jobs/<id>` every 3 s as
 * the fallback and re-subscribes on visibilitychange.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { postJson, type Reply } from "./panes";

export interface JobSnapshot {
  id: string;
  state: "queued" | "running" | "live" | "stuck" | "cancelled" | "superseded" | "failed";
  step: string | null;
  percent: number;
  round: number;
  detail: string;
  dev_url?: string | undefined;
  shot_url?: string | undefined;
}

interface JobRowView {
  id: string;
  state: JobSnapshot["state"];
  step: string | null;
  step_started_at: string | null;
  percent: number;
  round: number;
  dev_url: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
}

const POLL_MS = 3_000;
const STEPS = ["brief", "code", "build", "check", "publish"] as const;
const STEP_LABEL: Record<string, string> = {
  admit: "Starting",
  brief: "Brief",
  code: "Code",
  build: "Build",
  check: "Check",
  fix: "Fix",
  publish: "Publish",
  notify: "Publish",
};

type Pill = "Building" | "Live" | "Stuck" | "Cancelled" | "Replaced" | "Failed";

function pillFor(state: JobSnapshot["state"]): Pill {
  switch (state) {
    case "live":
      return "Live";
    case "stuck":
      return "Stuck";
    case "cancelled":
      return "Cancelled";
    case "superseded":
      return "Replaced";
    case "failed":
      return "Failed";
    default:
      return "Building";
  }
}

function stepIndex(step: string | null): number {
  if (step === null) return -1;
  if (step === "fix") return STEPS.indexOf("check"); // a fix re-arms check
  if (step === "admit" || step === "notify") return step === "admit" ? -1 : STEPS.length - 1;
  return STEPS.indexOf(step as (typeof STEPS)[number]);
}

function elapsed(from: string | null): string | null {
  if (from === null) return null;
  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(from)) / 1000));
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

export function JobView({
  jobId,
  onChanged,
}: {
  jobId: string;
  /** The job reached a terminal state — the studio re-reads the app. */
  onChanged?: () => void;
}) {
  const [snap, setSnap] = useState<JobSnapshot | null>(null);
  const [row, setRow] = useState<JobRowView | null>(null);
  const [liveFailed, setLiveFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [fixText, setFixText] = useState("");
  const [fixOpen, setFixOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const terminalRef = useRef(false);
  // Client-side step clock: the WS payload has no timestamps, so the first
  // sighting of a step starts its entry's timer (the row poll's
  // step_started_at takes over on the next tick).
  const stepClock = useRef<Record<string, number>>({});

  const applySnap = useCallback((next: JobSnapshot, stepStartedAt?: string | null) => {
    setSnap((prev) => {
      if (next.step !== prev?.step) {
        stepClock.current = {};
      }
      return next;
    });
    if (stepStartedAt !== undefined) {
      setRow((prev) =>
        prev ? { ...prev, step: next.step, step_started_at: stepStartedAt, percent: next.percent, round: next.round, state: next.state, dev_url: next.dev_url ?? prev.dev_url } : prev,
      );
    }
  }, []);

  // §5.3: live-token → WebSocket, token is the first message. Anything the
  // socket path throws at us flips to polling permanently for this mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`/api/create/jobs/${jobId}/live-token`, {
        method: "POST",
      }).catch(() => null);
      if (res === null || !res.ok || cancelled) {
        setLiveFailed(true);
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | { url?: string; token?: string }
        | null;
      if (!data?.url || !data.token || cancelled) {
        setLiveFailed(true);
        return;
      }
      try {
        const ws = new WebSocket(data.url);
        wsRef.current = ws;
        ws.onopen = () => ws.send(data.token!);
        ws.onmessage = (event) => {
          try {
            const payload = JSON.parse(String(event.data)) as JobSnapshot;
            applySnap({ ...payload, id: jobId });
          } catch {
            /* CF5 payloads are small jsons; anything else is noise */
          }
        };
        ws.onclose = (event) => {
          if (event.code === 4401 || event.code === 4403 || event.code === 4000) {
            setLiveFailed(true);
          }
        };
        ws.onerror = () => setLiveFailed(true);
      } catch {
        setLiveFailed(true);
      }
    })().catch(() => setLiveFailed(true));
    return () => {
      cancelled = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [jobId, applySnap]);

  // Poll fallback (also the row view's source — step_started_at lives only
  // on the row). Runs whenever the tab is visible.
  useEffect(() => {
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible" || stopped) return;
      const res = await fetch(`/api/create/jobs/${jobId}`).catch(() => null);
      if (res === null || !res.ok || stopped) return;
      const data = (await res.json().catch(() => null)) as Reply<{ job: JobRowView }> | null;
      if (!data?.job || stopped) return;
      const job = data.job;
      setRow(job);
      // The row is the fallback channel too — keep `snap` honest when the
      // WS is down.
      setSnap((prev) =>
        prev && prev.percent >= job.percent && prev.state === job.state
          ? prev
          : {
              id: job.id,
              state: job.state,
              step: job.step,
              percent: job.percent,
              round: job.round,
              detail: prev?.detail ?? "",
              dev_url: job.dev_url ?? undefined,
            },
      );
      const terminal = !["queued", "running"].includes(job.state);
      if (terminal && !terminalRef.current) {
        terminalRef.current = true;
        onChanged?.();
      }
    };
    void tick();
    const id = setInterval(() => void tick(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [jobId, onChanged]);

  const state = snap?.state ?? row?.state ?? "queued";
  const percent = Math.min(100, Math.max(0, snap?.percent ?? row?.percent ?? 0));
  const step = snap?.step ?? row?.step ?? null;
  const detail = snap?.detail ?? "";
  const pill = pillFor(state);
  const open = state === "queued" || state === "running";
  const devUrl = snap?.dev_url ?? row?.dev_url ?? null;
  const activeIndex = stepIndex(step);
  const stepStartedAt = row?.step_started_at ?? null;
  const shot = snap?.shot_url ?? null;

  async function run(action: () => Promise<void>) {
    setBusy(true);
    setMessage(null);
    try {
      await action();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "something went wrong");
    } finally {
      setBusy(false);
    }
  }

  async function cancel() {
    await run(async () => {
      const data = await postJson(`/api/create/jobs/${jobId}/cancel`, {});
      if (data.error) throw new Error(data.error);
    });
  }

  async function retry() {
    await run(async () => {
      const data = await postJson(`/api/create/jobs/${jobId}/retry`, {});
      if (data.error) throw new Error(data.error);
      terminalRef.current = false;
    });
  }

  async function sendFix() {
    const text = fixText.trim();
    if (text === "") return;
    await run(async () => {
      const data = await postJson<{ change_file: string }>(`/api/create/jobs/${jobId}/request`, { text });
      if (data.error || typeof data.change_file !== "string") {
        throw new Error(data.error ?? "could not file the fix");
      }
      setFixText("");
      setFixOpen(false);
      setMessage("Filed — Try again applies it.");
    });
  }

  async function share() {
    if (!devUrl) return;
    if (typeof navigator.share === "function") {
      await navigator.share({ url: devUrl }).catch(() => undefined);
    } else {
      await navigator.clipboard?.writeText(devUrl).catch(() => undefined);
      setMessage("Link copied");
    }
  }

  return (
    <div className="flex flex-col gap-3 text-[12px]" aria-label="Job progress">
      <div className="flex flex-wrap items-center gap-2">
        <strong className="text-[13px]">{pill}</strong>
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] ${
            open ? "border-current" : "border-current/20 text-muted"
          }`}
        >
          {open ? "running" : state}
        </span>
        {liveFailed ? (
          <span className="text-[10px] text-muted">live updates off — polling</span>
        ) : null}
        {snap && snap.round > 0 ? (
          <span className="ml-auto text-[10px] text-muted">fix round {snap.round}</span>
        ) : null}
      </div>

      <div
        className="h-2 w-full overflow-hidden rounded bg-current/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
      >
        <div className="h-full bg-current transition-[width]" style={{ width: `${percent}%` }} />
      </div>

      {detail ? <p className="m-0 text-muted">{detail}</p> : null}
      {message ? <p className="m-0 text-muted">{message}</p> : null}

      <ol className="m-0 flex list-none flex-wrap gap-x-3 gap-y-1 p-0">
        {STEPS.map((name, index) => {
          const done = index < activeIndex || state === "live";
          const active = index === activeIndex && open;
          const timing =
            active && stepStartedAt ? elapsed(stepStartedAt) : null;
          return (
            <li
              key={name}
              className={`flex items-center gap-1 ${done ? "" : "text-muted"}`}
              data-step={name}
              data-done={done || undefined}
            >
              <span aria-hidden>{done ? "✓" : active ? "•" : "○"}</span>
              <span>{STEP_LABEL[name]}</span>
              {timing ? <span className="text-muted">{timing}</span> : null}
            </li>
          );
        })}
      </ol>

      {open ? (
        <div>
          <button
            type="button"
            className="btn-ghost text-[11px]"
            disabled={busy}
            onClick={() => void cancel()}
          >
            Cancel
          </button>
        </div>
      ) : null}

      {state === "live" && devUrl ? (
        <div className="flex flex-col gap-2">
          {shot ? (
            // eslint-disable-next-line @next/next/no-img-element -- remote screenshot
            <img src={shot} alt="App screenshot" className="w-full max-w-xs rounded border border-current/20" />
          ) : null}
          <code className="break-all text-[11px]">{devUrl}</code>
          <div className="flex flex-wrap gap-2">
            <a className="btn text-[11px]" href={devUrl} target="_blank" rel="noreferrer">
              Open
            </a>
            <button
              type="button"
              className="btn-ghost text-[11px]"
              onClick={() => void navigator.clipboard?.writeText(devUrl).then(() => setMessage("Link copied"))}
            >
              Copy
            </button>
            <button type="button" className="btn-ghost text-[11px]" onClick={() => void share()}>
              Share
            </button>
            <button
              type="button"
              className="btn-ghost text-[11px]"
              disabled={busy}
              onClick={() => setFixOpen((v) => !v)}
            >
              Make a change
            </button>
            <a className="btn-ghost text-[11px]" href="#release">
              Ship it
            </a>
          </div>
        </div>
      ) : null}

      {(state === "stuck" || state === "failed") && (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn text-[11px]"
              disabled={busy}
              onClick={() => void retry()}
            >
              Try again
            </button>
            <button
              type="button"
              className="btn-ghost text-[11px]"
              onClick={() => setFixOpen((v) => !v)}
            >
              Describe a fix
            </button>
          </div>
        </div>
      )}

      {fixOpen ? (
        <div className="flex flex-col gap-2">
          <textarea
            className="min-h-16 w-full rounded border border-current/20 bg-transparent p-2 text-[12px]"
            placeholder="Tell me what to change"
            value={fixText}
            onChange={(event) => setFixText(event.currentTarget.value)}
          />
          <button
            type="button"
            className="btn self-start text-[11px]"
            disabled={busy || fixText.trim() === ""}
            onClick={() => void sendFix()}
          >
            Send
          </button>
        </div>
      ) : null}
    </div>
  );
}
