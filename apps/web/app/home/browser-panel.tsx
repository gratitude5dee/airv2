"use client";

/**
 * V5 Computer ▸ Browser subtab. Everything rendered here is metadata from
 * /api/browser — page URLs, session names, rule counters, value-free vault
 * event receipts. No vault value and no box URL ever reaches this component
 * (C16/C19); the live view is the same /api/box/desktop iframe the Screen
 * subtab streams, owned by the parent so subtab switches never remount it.
 */

import { useCallback, useEffect, useState } from "react";

interface BrowserProbe {
  running: boolean;
  pages: { title: string; url: string }[];
  currentUrl: string | null;
}

interface LoginRow {
  id: string;
  name: string;
  masked: string | null;
  totp_enabled: boolean;
  hosts: string[];
  last_used: { action: string; at: string } | null;
}

interface RuleRow {
  id: string;
  playbook: string;
  platform: string;
  enabled: boolean;
  daily_cap: number;
  used_today: number;
}

interface ActivityRow {
  id: string;
  label: string | null;
  trigger: string | null;
  started_at: string;
  ended_at: string | null;
  outcome: string | null;
}

interface RecordingRow {
  name: string;
  bytes: number;
  modified_at: string | null;
}

interface BrowserState {
  box_awake: boolean;
  browser: BrowserProbe;
  sessions: string[];
  logins: LoginRow[];
  rules: RuleRow[];
  rule_options: { playbooks: string[]; platforms: string[] };
  activity: ActivityRow[];
  recordings: RecordingRow[];
}

/** Same prefix heuristic Chat uses to surface the live computer view. */
function isComputerTool(name: string | undefined): boolean {
  return (
    typeof name === "string" &&
    (name.startsWith("browser") || name.startsWith("computer"))
  );
}

function isBrowserActivity(label: string | null): boolean {
  return isComputerTool(label ?? undefined) || (label ?? "").startsWith("playbook:");
}

function timeAgo(iso: string | null): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const BUSY_NOTE =
  "Your agent's computer is busy starting up — try again in a minute.";

export interface BrowserController {
  state: BrowserState | null;
  note: string | null;
  loading: boolean;
  urlInput: string;
  setUrlInput: (v: string) => void;
  navigate: () => Promise<void>;
  focus: () => Promise<void>;
  runPlaybook: (playbook: string) => Promise<void>;
  toggleRule: (playbook: string, platform: string, enabled: boolean, cap: number) => Promise<void>;
  toggleGrant: (itemId: string, host: string, allow: boolean) => Promise<void>;
  refresh: () => Promise<void>;
  busy: string | null;
}

export function useBrowserPanel(active: boolean): BrowserController {
  const [state, setState] = useState<BrowserState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [urlInput, setUrlInput] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/browser");
      if (res.ok) {
        setState((await res.json()) as BrowserState);
        setNote(null);
      } else if (res.status === 429) {
        setNote(BUSY_NOTE);
      } else {
        setNote("Couldn't load the browser panel — try again shortly.");
      }
    } catch {
      setNote("Couldn't load the browser panel — try again shortly.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  const post = useCallback(
    async (label: string, body: Record<string, unknown>) => {
      setBusy(label);
      setNote(null);
      try {
        const res = await fetch("/api/browser", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          setNote(
            res.status === 429 ? BUSY_NOTE : "That didn't work — try again shortly."
          );
          return false;
        }
        return true;
      } catch {
        setNote("That didn't work — try again shortly.");
        return false;
      } finally {
        setBusy(null);
      }
    },
    []
  );

  const navigate = useCallback(async () => {
    const url = urlInput.trim();
    if (!url) return;
    if (await post("navigate", { action: "navigate", url })) {
      setUrlInput("");
      setNote("Asked the agent to open that page.");
    }
  }, [urlInput, post]);

  const focus = useCallback(async () => {
    await post("focus", { action: "focus" });
  }, [post]);

  const runPlaybook = useCallback(
    async (playbook: string) => {
      if (await post(`run:${playbook}`, { action: "run_playbook", playbook })) {
        setNote(`Started the ${playbook} playbook.`);
        await refresh();
      }
    },
    [post, refresh]
  );

  const toggleRule = useCallback(
    async (playbook: string, platform: string, enabled: boolean, cap: number) => {
      if (
        await post(`rule:${platform}`, {
          action: "rule",
          playbook,
          platform,
          enabled,
          daily_cap: cap,
        })
      ) {
        await refresh();
      }
    },
    [post, refresh]
  );

  const toggleGrant = useCallback(
    async (itemId: string, host: string, allow: boolean) => {
      if (
        await post(`grant:${itemId}`, { action: "grant", item_id: itemId, host, allow })
      ) {
        await refresh();
      }
    },
    [post, refresh]
  );

  return {
    state,
    note,
    loading,
    urlInput,
    setUrlInput,
    navigate,
    focus,
    runPlaybook,
    toggleRule,
    toggleGrant,
    refresh,
    busy,
  };
}

/** Header row: current URL, Open URL… input, named session pill, focus. */
export function BrowserHeader({ browser }: { browser: BrowserController }) {
  const { state } = browser;
  const currentUrl = state?.browser.currentUrl ?? null;
  const session = state?.sessions[0] ?? "default";
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span
        className="muted shrink-0 rounded-full border border-[var(--ring)] px-2 py-0.5 text-[11px]"
        title="Named browser session"
      >
        {session}
      </span>
      <p
        className="muted m-0 min-w-0 flex-1 truncate text-[13px]"
        title={currentUrl ?? undefined}
      >
        {currentUrl ??
          (state?.browser.running
            ? "No page open."
            : "The agent's browser isn't running.")}
      </p>
      <form
        className="flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          void browser.navigate();
        }}
      >
        <input
          className="input !py-1.5 !text-[12px]"
          placeholder="Open URL…"
          value={browser.urlInput}
          onChange={(e) => browser.setUrlInput(e.target.value)}
        />
        <button
          type="submit"
          className="btn !px-3 !py-1.5 !text-[12px]"
          disabled={browser.busy !== null || !browser.urlInput.trim()}
        >
          Open
        </button>
      </form>
      <button
        className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
        disabled={browser.busy !== null}
        onClick={() => void browser.focus()}
        title="Bring the browser window to the front of the agent's screen"
      >
        Focus browser
      </button>
    </div>
  );
}

/** The three panels under the live view: Automations, Site access, Activity. */
export function BrowserPanels({
  browser,
  onSchedule,
}: {
  browser: BrowserController;
  /** Deep-link into the Calendar tab's new-schedule sheet, prefilled. */
  onSchedule: (playbook: string) => void;
}) {
  const { state } = browser;
  const playbooks = state?.rule_options.playbooks ?? ["social-engage"];
  const platforms = state?.rule_options.platforms ?? [];
  const rules = state?.rules ?? [];
  const activity = (state?.activity ?? []).filter((run) =>
    isBrowserActivity(run.label)
  );

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <section className="grid content-start gap-2">
        <h3 className="m-0 text-[13px] font-semibold uppercase tracking-wide muted">
          Automations
        </h3>
        {playbooks.map((playbook) => (
          <div key={playbook} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 text-[13px] font-medium">{playbook}</p>
              <div className="flex items-center gap-1">
                <button
                  className="btn !px-2.5 !py-1 !text-[12px]"
                  disabled={browser.busy !== null}
                  onClick={() => void browser.runPlaybook(playbook)}
                >
                  Run
                </button>
                <button
                  className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                  onClick={() => onSchedule(playbook)}
                >
                  Schedule
                </button>
              </div>
            </div>
            <p className="muted m-0 mt-2 text-[12px]">
              Standing rules let it act without asking — likes only, capped per
              day, never during your quiet hours. Comments and posts always come
              to you first. Heads up: automated engagement can trip a platform&rsquo;s
              terms of service and get an account limited or banned.
            </p>
            <div className="mt-2 grid gap-1">
              {platforms.map((platform) => {
                const rule = rules.find(
                  (r) => r.playbook === playbook && r.platform === platform
                );
                const enabled = rule?.enabled === true;
                const cap = rule?.daily_cap ?? 25;
                return (
                  <label
                    key={platform}
                    className="flex items-center justify-between gap-2 text-[13px]"
                  >
                    <span className="capitalize">{platform}</span>
                    <span className="muted flex items-center gap-2 text-[12px]">
                      {enabled ? `${rule?.used_today ?? 0}/${cap} today` : null}
                      <input
                        type="checkbox"
                        checked={enabled}
                        disabled={browser.busy !== null}
                        onChange={(e) =>
                          void browser.toggleRule(
                            playbook,
                            platform,
                            e.target.checked,
                            cap
                          )
                        }
                      />
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <section className="grid content-start gap-2">
        <h3 className="m-0 text-[13px] font-semibold uppercase tracking-wide muted">
          Site access
        </h3>
        {(state?.logins ?? []).map((login) => (
          <div key={login.id} className="rounded-xl bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="m-0 truncate text-[13px] font-medium">{login.name}</p>
              {login.last_used ? (
                <span className="muted text-[11px]">
                  {login.last_used.action === "fill_approved"
                    ? "used"
                    : "refused"}{" "}
                  {timeAgo(login.last_used.at)}
                </span>
              ) : null}
            </div>
            {login.hosts.length > 0 ? (
              <div className="mt-1 grid gap-1">
                {login.hosts.map((host) => (
                  <label
                    key={host}
                    className="flex items-center justify-between gap-2 text-[12px]"
                  >
                    <span className="truncate">{host}</span>
                    <span className="muted flex items-center gap-2">
                      Allow agent sign-in
                      <input
                        type="checkbox"
                        checked
                        disabled={browser.busy !== null}
                        onChange={() =>
                          void browser.toggleGrant(login.id, host, false)
                        }
                      />
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="muted m-0 mt-1 text-[12px]">
                No sites allowed yet — the agent can&rsquo;t sign in with this login.
              </p>
            )}
            <GrantAdder
              disabled={browser.busy !== null}
              onAdd={(host) => void browser.toggleGrant(login.id, host, true)}
            />
          </div>
        ))}
        {state && state.logins.length === 0 ? (
          <p className="muted m-0 text-[13px]">
            No logins in the vault yet — add one in the Vault tab.
          </p>
        ) : null}
      </section>

      <section className="grid content-start gap-2">
        <h3 className="m-0 text-[13px] font-semibold uppercase tracking-wide muted">
          Activity
        </h3>
        {activity.map((run) => (
          <div
            key={run.id}
            className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2"
          >
            <span className="truncate text-[13px]">{run.label}</span>
            <span className="muted shrink-0 text-[11px]">
              {run.ended_at
                ? (run.outcome ?? "done") + " · " + timeAgo(run.started_at)
                : "running…"}
            </span>
          </div>
        ))}
        {state && activity.length === 0 ? (
          <p className="muted m-0 text-[13px]">No browser activity yet.</p>
        ) : null}
        {state && state.recordings.length > 0 ? (
          <>
            <h3 className="m-0 mt-2 text-[13px] font-semibold uppercase tracking-wide muted">
              Recordings
            </h3>
            {state.recordings.map((rec) => (
              <div
                key={rec.name}
                className="flex items-center justify-between gap-2 rounded-xl bg-surface-2 px-3 py-2"
              >
                <span className="truncate text-[13px]">{rec.name}</span>
                <span className="muted shrink-0 text-[11px]">
                  {Math.max(1, Math.round(rec.bytes / 1024))} KB ·{" "}
                  {timeAgo(rec.modified_at)}
                </span>
              </div>
            ))}
          </>
        ) : null}
      </section>
    </div>
  );
}

function GrantAdder({
  disabled,
  onAdd,
}: {
  disabled: boolean;
  onAdd: (host: string) => void;
}) {
  const [host, setHost] = useState("");
  return (
    <form
      className="mt-2 flex items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const value = host.trim();
        if (!value) return;
        onAdd(value);
        setHost("");
      }}
    >
      <input
        className="input !py-1 !text-[12px]"
        placeholder="Allow a site (e.g. github.com)"
        value={host}
        onChange={(e) => setHost(e.target.value)}
      />
      <button
        type="submit"
        className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
        disabled={disabled || !host.trim()}
      >
        Allow
      </button>
    </form>
  );
}
