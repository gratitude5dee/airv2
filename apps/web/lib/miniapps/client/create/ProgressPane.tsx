/**
 * V12 §5.4 Progress pane. Polls `GET /api/create/progress?app=` every 2 s
 * while the intake is confirmed / building / qa / testing and renders the
 * same `{percent, stage, detail}` triple the iMessage card shows (§8.2) as a
 * bar, with the build log tail and the findings the studio already fetches
 * beneath it (passed in as `children`, so this file never imports the
 * studio). When the polled stage differs from the intake the studio holds,
 * `onStage` asks it to re-read the intake — that is how the pane learns the
 * dev build went live.
 */
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  clampPercent,
  isProgressStage,
  logTail,
  progressCaption,
  type IntakeStage,
  type IntakeStatus,
  type ProgressReply,
} from "./panes";

export const PROGRESS_POLL_MS = 2_000;

export interface ProgressPaneProps {
  appname: string;
  intake: IntakeStatus | null;
  log: readonly string[];
  qaScore: number | null;
  /** The polled stage moved away from the intake's; re-read the intake. */
  onStage: (stage: IntakeStage) => void;
  /** Findings list (the studio's `Findings`), rendered under the log. */
  children?: ReactNode;
}

export function ProgressPane({
  appname,
  intake,
  log,
  qaScore,
  onStage,
  children,
}: ProgressPaneProps) {
  const [progress, setProgress] = useState<ProgressReply | null>(null);
  const stage = intake?.stage ?? null;
  const polling = isProgressStage(stage);
  const seenStage = useRef<IntakeStage | null>(stage);
  seenStage.current = stage;

  useEffect(() => {
    if (!appname) return;
    let stopped = false;
    const tick = async () => {
      if (document.visibilityState !== "visible") return;
      const res = await fetch(
        `/api/create/progress?app=${encodeURIComponent(appname)}`,
      );
      if (!res.ok || stopped) return;
      const next = (await res.json()) as ProgressReply;
      if (stopped) return;
      setProgress(next);
      if (next.stage && next.stage !== seenStage.current) onStage(next.stage);
    };
    void tick().catch(() => undefined);
    if (!polling) return () => {
      stopped = true;
    };
    const id = setInterval(() => void tick().catch(() => undefined), PROGRESS_POLL_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [appname, polling, onStage]);

  const percent = clampPercent(progress?.percent);
  const shownStage = progress?.stage ?? stage;
  const tail = logTail(log);

  return (
    <div className="flex flex-col gap-3 text-[12px]" aria-label="Progress">
      {!intake && !progress ? (
        <p className="m-0 text-muted">No build yet. Confirm a plan first.</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            <strong className="text-[13px]" data-test="progress-caption">
              {progressCaption(shownStage, percent)}
            </strong>
            {polling ? (
              <span className="text-[10px] text-muted">updates every 2 s</span>
            ) : null}
            {qaScore !== null ? (
              <span className="ml-auto rounded-full border border-current/20 px-2 text-[10px] text-muted">
                QA {qaScore}
              </span>
            ) : null}
          </div>
          <div
            className="h-2 w-full overflow-hidden rounded bg-current/10"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={percent}
          >
            <div
              className="h-full bg-current transition-[width]"
              style={{ width: `${percent}%` }}
            />
          </div>
          <p className="m-0 text-muted" data-test="progress-detail">
            {progress?.detail ?? (shownStage === "failed" ? "needs you" : "waiting")}
          </p>
        </>
      )}

      <div className="border-t border-current/10 pt-2">
        <span className="text-muted">Build log</span>
        <pre className="m-0 mt-1 max-h-32 overflow-auto rounded bg-current/5 p-2 text-[10px] leading-snug">
          {tail.length ? tail.join("\n") : "no builds yet"}
        </pre>
      </div>

      <div className="border-t border-current/10 pt-2">
        <span className="text-muted">Findings</span>
        <div className="mt-1">{children}</div>
      </div>
    </div>
  );
}
