"use client";

/**
 * AIR computer dock (spec §4): one 3-state card — expanded / minimized strip /
 * hidden — that absorbs the old Computer tab, the inline chat iframe, and the
 * boot banner. The desktop iframe stays keyed on computerEpoch so wake/token
 * rotation always remounts it; Screen/Browser subtabs, ScreenExtras,
 * Open-in-new-tab and VNC survive unchanged.
 */
import { useState } from "react";
import { Orb } from "@/components/orb/Orb";
import { ScreenExtras } from "../screen-extras";
import { BrowserHeader, BrowserPanels, useBrowserPanel } from "../browser-panel";

export type ComputerDockState = "expanded" | "minimized" | "hidden";

function stateLabel(boxState: string | null): string {
  return boxState === "ready" || boxState === "idle"
    ? "Your agent’s computer is on."
    : boxState === "starting"
      ? "Powering on…"
      : boxState === "stopping"
        ? "Powering off…"
        : boxState === "stopped"
          ? "Your agent’s computer is off."
          : "Checking power state…";
}

function StatusDot({ boxState }: { boxState: string | null }) {
  return (
    <span
      aria-hidden
      className={
        "inline-block h-2 w-2 rounded-full " +
        (boxState === "ready" || boxState === "idle"
          ? "bg-[var(--success)]"
          : boxState === "starting" || boxState === "stopping"
            ? "animate-pulse bg-[var(--warning)]"
            : "bg-[var(--muted)]")
      }
    />
  );
}

export function ComputerCard({
  dock,
  onDockChange,
  boxState,
  powerBusy,
  powerNote,
  onPowerOn,
  onPowerOff,
  computerEpoch,
  onSchedule,
}: {
  dock: ComputerDockState;
  onDockChange: (next: ComputerDockState) => void;
  boxState: string | null;
  powerBusy: boolean;
  powerNote: string | null;
  onPowerOn: (keepAwakeMinutes?: number) => void;
  onPowerOff: () => void;
  computerEpoch: number;
  /** Browser → Calendar prefill channel (playbook scheduling). */
  onSchedule: (playbook: string) => void;
}) {
  // V5: Computer splits into Screen/Browser subtabs. The desktop iframe is
  // owned by the card (not the subtab), so switching never remounts it.
  const [computerView, setComputerView] = useState<"screen" | "browser">(
    "screen"
  );
  const browser = useBrowserPanel(
    dock === "expanded" && computerView === "browser"
  );
  const transitioning = boxState === "starting" || boxState === "stopping";

  if (dock === "hidden") {
    // Hidden still surfaces power transitions (the old boot banner).
    if (!transitioning) return null;
    return (
      <div className="mb-2 flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-[var(--muted-2)]">
        <StatusDot boxState={boxState} />
        {boxState === "starting"
          ? "Your agent’s computer is booting — replies may take a little longer."
          : "Powering off…"}
        <button
          className="btn-ghost ml-auto cursor-pointer text-[12px]"
          onClick={() => onDockChange("minimized")}
        >
          Show
        </button>
      </div>
    );
  }

  if (dock === "minimized") {
    return (
      <div className="mb-2 flex h-8 items-center gap-2 rounded-xl bg-surface px-3 text-[12px] shadow-[0_0_0_0.5px_var(--ring)]">
        <StatusDot boxState={boxState} />
        <span className="muted truncate">{stateLabel(boxState)}</span>
        <div className="ml-auto flex shrink-0 items-center gap-1">
          <button
            className="btn-ghost cursor-pointer text-[12px]"
            onClick={() => onDockChange("expanded")}
          >
            Expand
          </button>
          <button
            className="btn-ghost cursor-pointer text-[12px]"
            onClick={() => onDockChange("hidden")}
          >
            Hide
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-2 flex min-h-0 flex-col gap-2 overflow-y-auto rounded-xl bg-surface p-2 shadow-[0_0_0_0.5px_var(--ring)]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          {(["screen", "browser"] as const).map((view) => (
            <button
              key={view}
              className={
                "seg !px-3 !py-1 !text-[12px]" +
                (computerView === view ? " pill-active" : "")
              }
              aria-current={computerView === view ? "page" : undefined}
              onClick={() => setComputerView(view)}
            >
              {view === "screen" ? "Screen" : "Browser"}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1">
          <button
            className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
            onClick={() => onDockChange("minimized")}
          >
            Minimize
          </button>
          <button
            className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
            onClick={() => onDockChange("hidden")}
          >
            Hide
          </button>
        </div>
      </div>
      {computerView === "screen" ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="muted m-0 flex items-center gap-2 text-[13px]">
            <StatusDot boxState={boxState} />
            {stateLabel(boxState)}
          </p>
          <div className="flex items-center gap-2">
            {boxState === "stopped" ? (
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={powerBusy}
                onClick={() => onPowerOn()}
              >
                {powerBusy ? "Powering on…" : "Power on"}
              </button>
            ) : null}
            {boxState === "ready" || boxState === "idle" ? (
              <>
                <button
                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                  disabled={powerBusy}
                  onClick={() => onPowerOn(60)}
                  title="Keep the computer awake for the next hour"
                >
                  Keep awake 1h
                </button>
                <button
                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                  disabled={powerBusy}
                  onClick={onPowerOff}
                >
                  {powerBusy ? "Powering off…" : "Power off"}
                </button>
                <a
                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                  href="/api/box/desktop"
                  target="_blank"
                  rel="noreferrer noopener"
                >
                  Open in new tab
                </a>
                <a
                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                  href="/api/box/desktop?vnc=1"
                  target="_blank"
                  rel="noreferrer noopener"
                  title="HTTPS-tunneled viewer for restrictive networks; opens as its own page"
                >
                  Use VNC
                </a>
              </>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          <BrowserHeader browser={browser} />
          {browser.note ? (
            <p className="muted m-0 text-[12px]">{browser.note}</p>
          ) : null}
        </>
      )}
      {powerNote ? <p className="muted m-0 text-[12px]">{powerNote}</p> : null}
      {boxState === "ready" || boxState === "idle" ? (
        <iframe
          key={computerEpoch}
          src="/api/box/desktop"
          title="Your agent's computer"
          className="h-[360px] w-full rounded-xl border-0 bg-black"
          allow="clipboard-read; clipboard-write"
        />
      ) : (
        <div className="flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-xl bg-surface-2 text-center">
          <Orb size={28} label="air" />
          <p className="muted m-0 text-[13px]">
            {boxState === "starting"
              ? "Powering on — the live view will appear when it’s ready."
              : boxState === "stopping"
                ? "Powering off…"
                : "The computer is asleep. Power it on to see the live view."}
          </p>
        </div>
      )}
      {computerView === "screen" ? (
        <ScreenExtras boxOn={boxState === "ready" || boxState === "idle"} />
      ) : null}
      {computerView === "browser" ? (
        <BrowserPanels browser={browser} onSchedule={onSchedule} />
      ) : null}
    </div>
  );
}
