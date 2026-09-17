/**
 * V12 §5.4 Plan pane. The questions (§5.2) as a form while the intake is
 * `asking`, then the plan's stage, version and revision count with
 * **Build this** (= "yes", event `confirm`) and **Ask for changes** (event
 * `revise`). The plan text itself lives in the workspace and the owner's
 * thread — the control plane never holds it (CR21), so the pane points at
 * the attachment instead of rendering it. Free-text answers and change notes
 * ride the next Create turn through `onAnswer`; only the stage event and the
 * template id go to `/api/create/intake`.
 */
import { useState, type FormEvent } from "react";
import {
  INTAKE_TEMPLATES,
  canConfirm,
  planVersionLabel,
  postJson,
  revisionsLabel,
  stageLabel,
  type IntakeStatus,
  type IntakeTemplate,
} from "./panes";

export interface PlanPaneProps {
  appname: string;
  intake: IntakeStatus | null;
  busy: boolean;
  run: (action: () => Promise<void>) => void;
  /** Re-read the intake after an event lands. */
  onAdvanced: () => Promise<void>;
  /** Send free text to the Planner as a Create turn (the studio's `send`). */
  onAnswer?: (text: string) => void;
}

const FIELD =
  "min-h-[44px] w-full rounded border border-current/20 bg-transparent px-3 py-2 text-[13px]";

export function PlanPane({
  appname,
  intake,
  busy,
  run,
  onAdvanced,
  onAnswer,
}: PlanPaneProps) {
  const [template, setTemplate] = useState<IntakeTemplate | "">("");
  const [content, setContent] = useState("");
  const [taste, setTaste] = useState("");
  const [note, setNote] = useState("");
  const stage = intake?.stage ?? null;

  function post(body: Record<string, unknown>) {
    return postJson("/api/create/intake", { appname, ...body });
  }

  function answer(event: FormEvent) {
    event.preventDefault();
    const lines = [
      template ? `template: ${template}` : "template: you pick",
      `content: ${content.trim() || "you pick"}`,
      `taste: ${taste.trim() || "you pick"}`,
    ];
    run(async () => {
      await post({
        event: "owner_reply",
        ...(template ? { template } : {}),
      });
      onAnswer?.(lines.join("\n"));
      setContent("");
      setTaste("");
      await onAdvanced();
    });
  }

  function confirm() {
    run(async () => {
      await post({ event: "confirm" });
      await onAdvanced();
    });
  }

  function revise(event: FormEvent) {
    event.preventDefault();
    const text = note.trim();
    if (!text) return;
    run(async () => {
      await post({ event: "revise" });
      onAnswer?.(text);
      setNote("");
      await onAdvanced();
    });
  }

  function open() {
    run(async () => {
      await post({ source: "web" });
      await onAdvanced();
    });
  }

  return (
    <div className="flex flex-col gap-3 text-[12px]" aria-label="Plan">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-current px-2 py-0.5 text-[10px]">
          {stageLabel(stage)}
        </span>
        <span className="text-muted">{planVersionLabel(intake?.plan_version)}</span>
        <span className="text-muted">·</span>
        <span className="text-muted">{revisionsLabel(intake?.revisions)}</span>
      </div>

      {!intake ? (
        <>
          <p className="m-0 text-muted">
            No plan yet. Describe the app in Chat, or start the questions here.
          </p>
          <button
            type="button"
            className="btn min-h-[44px] text-[12px]"
            disabled={busy || !appname}
            onClick={open}
          >
            Start the plan
          </button>
        </>
      ) : null}

      {stage === "asking" ? (
        <form className="flex flex-col gap-2" onSubmit={answer}>
          <p className="m-0 text-muted">
            Up to three questions. Leave a field empty to say you pick.
          </p>
          <label className="flex flex-col gap-1">
            <span className="text-muted">Template</span>
            <select
              className={FIELD}
              value={template}
              onChange={(event) =>
                setTemplate(event.currentTarget.value as IntakeTemplate | "")
              }
            >
              <option value="">you pick</option>
              {INTAKE_TEMPLATES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted">Content</span>
            <input
              className={FIELD}
              placeholder="the date, the link, the name…"
              value={content}
              onChange={(event) => setContent(event.currentTarget.value)}
            />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-muted">Taste</span>
            <input
              className={FIELD}
              placeholder="dark and cinematic, or bright and simple"
              value={taste}
              onChange={(event) => setTaste(event.currentTarget.value)}
            />
          </label>
          <button
            type="submit"
            className="btn min-h-[44px] text-[12px]"
            disabled={busy}
          >
            Send answers
          </button>
        </form>
      ) : null}

      {stage === "planning" ? (
        <p className="m-0 text-muted">Writing the plan.</p>
      ) : null}

      {canConfirm(stage) ? (
        <>
          <p className="m-0 text-muted">
            The plan is in your thread as{" "}
            <code className="text-[11px]">{appname}-plan.md</code>. Build it
            as is, or ask for changes.
          </p>
          <button
            type="button"
            className="btn min-h-[44px] text-[12px]"
            disabled={busy}
            onClick={confirm}
          >
            Build this
          </button>
          <form className="flex flex-col gap-2" onSubmit={revise}>
            <label className="flex flex-col gap-1">
              <span className="text-muted">What to change</span>
              <textarea
                className={`${FIELD} min-h-[66px]`}
                rows={2}
                placeholder="make the hero darker, drop the map…"
                value={note}
                onChange={(event) => setNote(event.currentTarget.value)}
              />
            </label>
            <button
              type="submit"
              className="btn btn-ghost min-h-[44px] text-[12px]"
              disabled={busy || !note.trim()}
            >
              Ask for changes
            </button>
          </form>
        </>
      ) : null}

      {stage === "confirmed" ||
      stage === "building" ||
      stage === "qa" ||
      stage === "testing" ? (
        <p className="m-0 text-muted">
          Plan confirmed. The build is under way in Progress.
        </p>
      ) : null}

      {stage === "dev_ready" ||
      stage === "finalizing" ||
      stage === "decision_sent" ||
      stage === "production" ? (
        <p className="m-0 text-muted">
          Plan built. More edits start a new dev cycle from Chat.
        </p>
      ) : null}

      {stage === "failed" ? (
        <p className="m-0 text-muted">
          The build needs you. Look at Progress, or say try again in Chat.
        </p>
      ) : null}

      {stage === "abandoned" ? (
        <p className="m-0 text-muted">
          This plan was set aside. Start again from Chat.
        </p>
      ) : null}
    </div>
  );
}
