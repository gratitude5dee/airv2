"use client";

/**
 * PERSONAL → Context (spec §5): "what your agent knows" — one screen, three
 * cards, all riding existing owner-session APIs. Memory (MEMORY.md read-only
 * + USER.md edit + clear-with-confirm via /api/me/memory; bytes flow box →
 * response only), trace receipts (/api/me/traces list + the MA9.3 export
 * links), and the Onairos persona (/api/onairos status/resync/disconnect).
 * The mini-app Settings surface keeps its own mounts; this is the /home
 * re-home, not a second data path.
 */
import { useCallback, useEffect, useState } from "react";
import { DitherButton } from "@/components/dither-kit/button";
import { PixelIcon } from "@/components/dither-kit/icon";
import { nextMessageId } from "../lib";

const BUSY_NOTE = "Your agent's computer is busy starting up — try again in a minute.";

interface MemoryState {
  memory: string | null;
  user: string | null;
  user_char_limit: number;
  /** Fingerprint of `user` as served; echoed on save so an agent rewrite
   * in between surfaces as a conflict instead of being overwritten. */
  user_revision: string;
}

interface TraceReceipt {
  ts: string | number | null;
  kind: string | number | null;
  status: string | number | null;
  label: string | number | null;
  cost_usd: string | number | null;
}

/** D11: receipts get a stable per-visit id — the list never keys by index. */
type KeyedTraceReceipt = TraceReceipt & { id: string };

interface OnairosState {
  configured: boolean;
  status: string;
  connected_at: string | null;
}

function CardHeader({
  glyph,
  title,
  sub,
}: {
  glyph: "chip" | "clock" | "people";
  title: string;
  sub: string;
}) {
  return (
    <div className="mb-3 flex items-baseline gap-2">
      <PixelIcon glyph={glyph} size={13} className="self-center" />
      <h3 className="chrome m-0 !text-[12px]">{title}</h3>
      <span className="muted text-[11px]">{sub}</span>
    </div>
  );
}

function MemoryCard() {
  const [state, setState] = useState<MemoryState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [userDraft, setUserDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [deepOffer, setDeepOffer] = useState(false);

  const load = useCallback(async () => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/me/memory");
      if (res.status === 503) {
        setNote(BUSY_NOTE);
        return;
      }
      if (!res.ok) {
        setNote("Couldn't read memory.");
        return;
      }
      const data = (await res.json()) as MemoryState;
      setState(data);
      setUserDraft(data.user ?? "");
      setLoaded(true);
    } catch {
      setNote("Couldn't read memory.");
    } finally {
      setBusy(false);
    }
  }, []);

  async function saveUser() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/me/memory", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user: userDraft,
          base_revision: state?.user_revision,
        }),
      });
      if (res.status === 503) setNote(BUSY_NOTE);
      else if (res.status === 409) {
        // Keep the draft; refresh the base so a second save is an informed
        // overwrite of whatever the agent wrote in between.
        const fresh = await fetch("/api/me/memory");
        if (fresh.ok) setState((await fresh.json()) as MemoryState);
        setNote(
          "Your agent updated your profile while you were editing. Save again to overwrite it with your version."
        );
      } else if (!res.ok) setNote("Couldn't save your profile.");
      else {
        const data = (await res.json()) as { user_revision?: string };
        if (data.user_revision) {
          setState((prev) =>
            prev
              ? { ...prev, user: userDraft, user_revision: data.user_revision! }
              : prev
          );
        }
        setNote("Saved.");
      }
    } catch {
      setNote("Couldn't save your profile.");
    } finally {
      setBusy(false);
    }
  }

  async function clear(target: "memory" | "user" | "both") {
    const label =
      target === "memory"
        ? "agent memory"
        : target === "user"
          ? "your profile"
          : "agent memory and your profile";
    if (!window.confirm(`Clear ${label}? This is irreversible.`)) return;
    setBusy(true);
    setNote(null);
    setDeepOffer(false);
    try {
      const res = await fetch("/api/me/memory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", target, confirm: true }),
      });
      if (res.status === 503) setNote(BUSY_NOTE);
      else if (!res.ok) setNote("Clear failed.");
      else {
        const data = (await res.json()) as { deep_memory_offer?: boolean };
        setDeepOffer(data.deep_memory_offer === true);
        void load();
      }
    } catch {
      setNote("Clear failed.");
    } finally {
      setBusy(false);
    }
  }

  /** The files route only offers this; the wipe itself rides the deep
   * memory route, confirm-gated by the owner's click here. */
  async function clearDeep() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/me/memory/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", scope: "all", confirm: true }),
      });
      if (res.status === 503) setNote(BUSY_NOTE);
      else if (!res.ok) setNote("Deep memory clear failed.");
      else {
        setDeepOffer(false);
        setNote("Deep memory cleared.");
      }
    } catch {
      setNote("Deep memory clear failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel !p-4">
      <CardHeader glyph="chip" title="Memory" sub="MEMORY.md + USER.md, on your box" />
      {note ? <p className="muted m-0 mb-2 text-[12px]">{note}</p> : null}
      {!loaded ? (
        <DitherButton color="blue" disabled={busy} onClick={() => void load()}>
          {busy ? "Waking box…" : "Load memory"}
        </DitherButton>
      ) : state ? (
        <div className="grid gap-3">
          <div>
            <p className="chrome-2 m-0 mb-1">MEMORY.md — agent-authored</p>
            <pre className="m-0 max-h-48 overflow-y-auto whitespace-pre-wrap rounded-[7px] border border-[var(--ring)] bg-surface-2 p-2 font-mono text-[11px]">
              {state.memory || "(empty)"}
            </pre>
          </div>
          <div>
            <p className="chrome-2 m-0 mb-1">
              USER.md — yours to edit ({userDraft.length}/{state.user_char_limit})
            </p>
            <textarea
              className="input min-h-24 font-mono !text-[12px]"
              value={userDraft}
              maxLength={state.user_char_limit}
              onChange={(e) => setUserDraft(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <DitherButton color="blue" disabled={busy} onClick={() => void saveUser()}>
              Save profile
            </DitherButton>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void load()}>
              Refresh
            </button>
            <button
              className="btn btn-ghost !text-danger"
              disabled={busy}
              onClick={() => void clear("memory")}
            >
              Clear memory
            </button>
            <button
              className="btn btn-ghost !text-danger"
              disabled={busy}
              onClick={() => void clear("user")}
            >
              Clear profile
            </button>
            <button
              className="btn btn-ghost !text-danger"
              disabled={busy}
              onClick={() => void clear("both")}
            >
              Clear both
            </button>
          </div>
          {deepOffer ? (
            <div
              className="grid gap-2 rounded-[7px] border border-[var(--ring)] bg-surface-2 p-2"
              role="group"
              aria-label="Also clear deep memory"
            >
              <p className="m-0 text-[12px]">
                Memory files cleared. Deep memory — imported context and learned
                memories on your box — is still there. Clear it too for a fresh
                start?
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-ghost !text-danger"
                  disabled={busy}
                  onClick={() => void clearDeep()}
                >
                  {busy ? "Clearing…" : "Clear deep memory too"}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setDeepOffer(false)}
                >
                  Keep it
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

interface DeepMemoryState {
  healthy: boolean;
  resources: number;
  workspace_bytes: number;
  pending: number | null;
}

type DeepClearScope = "resources" | "memories" | "all";

const DEEP_CLEAR_SCOPES: { scope: DeepClearScope; label: string }[] = [
  { scope: "resources", label: "Imported context" },
  { scope: "memories", label: "Learned memories" },
  { scope: "all", label: "Everything" },
];

/** Deep memory (docs/memory-upgrade.md): live status of the box-local
 * semantic store + owner-triggered reindex and clear-with-confirm. Metadata
 * only — the contents stay on the box and surface through chat recall, not
 * here. A status check never wakes a sleeping box by itself; the owner opts
 * into the wake with a second click. */
function DeepMemoryCard() {
  const [state, setState] = useState<DeepMemoryState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [asleep, setAsleep] = useState(false);
  const [clearScope, setClearScope] = useState<DeepClearScope | null>(null);

  const load = useCallback(async (wake = false) => {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch(wake ? "/api/me/memory/deep?wake=1" : "/api/me/memory/deep");
      if (res.status === 503) {
        setNote(BUSY_NOTE);
        return;
      }
      if (!res.ok) {
        setNote("Couldn't read deep memory status.");
        return;
      }
      const body = (await res.json()) as DeepMemoryState | { asleep: true };
      if ("asleep" in body) {
        setAsleep(true);
        return;
      }
      setAsleep(false);
      setState(body);
      setLoaded(true);
    } catch {
      setNote("Couldn't read deep memory status.");
    } finally {
      setBusy(false);
    }
  }, []);

  async function reindex() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/me/memory/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reindex" }),
      });
      if (res.status === 503) setNote(BUSY_NOTE);
      else if (!res.ok) setNote("Reindex failed.");
      else {
        await load();
        setNote("Reindex queued. Refresh to check progress.");
      }
    } catch {
      setNote("Reindex failed.");
    } finally {
      setBusy(false);
    }
  }

  async function clear(scope: DeepClearScope) {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/me/memory/deep", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "clear", scope, confirm: true }),
      });
      if (res.status === 503) setNote(BUSY_NOTE);
      else if (!res.ok) setNote("Clear failed.");
      else {
        setClearScope(null);
        await load();
        setNote("Deep memory cleared.");
      }
    } catch {
      setNote("Clear failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel !p-4">
      <CardHeader
        glyph="chip"
        title="Deep memory"
        sub="semantic recall over your imported context, on your box"
      />
      {note ? <p className="muted m-0 mb-2 text-[12px]">{note}</p> : null}
      {!loaded ? (
        asleep ? (
          <div className="grid gap-2">
            <p className="m-0 text-[12px]" role="status">
              Your agent&apos;s computer is asleep. It wakes with your next
              message, or you can wake it now to read deep memory status.
            </p>
            <DitherButton color="blue" disabled={busy} onClick={() => void load(true)}>
              {busy ? "Waking box…" : "Wake and check"}
            </DitherButton>
          </div>
        ) : (
          <DitherButton color="blue" disabled={busy} onClick={() => void load()}>
            {busy ? "Checking…" : "Check status"}
          </DitherButton>
        )
      ) : state ? (
        <div className="grid gap-3">
          <p className="m-0 text-[12px]">
            {state.healthy ? "Running" : "Not running — recall degraded"} ·{" "}
            {state.resources} indexed{" "}
            {state.resources === 1 ? "resource" : "resources"}
          </p>
          <p className="m-0 text-[12px]" role="status">
            {state.pending == null
              ? "Indexing progress unavailable."
              : state.pending > 0
                ? `${state.pending} ${state.pending === 1 ? "resource" : "resources"} awaiting indexing. Recall may be incomplete; unfinished work retries automatically.`
                : "No indexing work pending."}
          </p>
          <div className="flex flex-wrap gap-2">
            <DitherButton color="blue" disabled={busy} onClick={() => void reindex()}>
              Reindex imported context
            </DitherButton>
            <button className="btn btn-ghost" disabled={busy} onClick={() => void load()}>
              Refresh
            </button>
            {clearScope === null ? (
              <button
                className="btn btn-ghost !text-danger"
                disabled={busy}
                onClick={() => setClearScope("all")}
              >
                Clear deep memory
              </button>
            ) : null}
          </div>
          {clearScope !== null ? (
            <div
              className="grid gap-2 rounded-[7px] border border-[var(--ring)] bg-surface-2 p-2"
              role="group"
              aria-label="Clear deep memory"
            >
              <p className="m-0 text-[12px]">
                Clear deep memory? This is irreversible — recall over what you
                clear stops until it is imported or learned again.
              </p>
              <div className="flex flex-wrap gap-2">
                {DEEP_CLEAR_SCOPES.map(({ scope, label }) => (
                  <label key={scope} className="flex items-center gap-1 text-[12px]">
                    <input
                      type="radio"
                      name="deep-clear-scope"
                      value={scope}
                      checked={clearScope === scope}
                      disabled={busy}
                      onChange={() => setClearScope(scope)}
                    />
                    {label}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  className="btn btn-ghost !text-danger"
                  disabled={busy}
                  onClick={() => void clear(clearScope)}
                >
                  {busy ? "Clearing…" : "Confirm"}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={busy}
                  onClick={() => setClearScope(null)}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function TracesCard({ active }: { active: boolean }) {
  const [receipts, setReceipts] = useState<KeyedTraceReceipt[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!active || receipts !== null) return;
    let stale = false;
    (async () => {
      try {
        const res = await fetch("/api/me/traces");
        if (!res.ok) {
          if (!stale) setError("Couldn't load receipts.");
          return;
        }
        const data = (await res.json()) as { receipts: TraceReceipt[] };
        if (!stale) {
          setReceipts(data.receipts.map((r) => ({ ...r, id: nextMessageId() })));
        }
      } catch {
        if (!stale) setError("Couldn't load receipts.");
      }
    })();
    return () => {
      stale = true;
    };
  }, [active, receipts]);

  return (
    <section className="panel !p-4">
      <CardHeader glyph="clock" title="Traces" sub="receipts of what your agent did" />
      {error ? <p className="muted m-0 text-[12px]">{error}</p> : null}
      {receipts === null && !error ? (
        <p className="muted m-0 text-[12px]">Loading…</p>
      ) : null}
      {receipts && receipts.length === 0 ? (
        <p className="muted m-0 text-[12px]">No receipts in the last 30 days.</p>
      ) : null}
      {receipts && receipts.length > 0 ? (
        <div className="max-h-56 overflow-y-auto">
          {receipts.map((r) => (
            <div
              key={r.id}
              className="flex items-baseline gap-2 border-b border-[var(--ring)] py-1.5 last:border-b-0"
            >
              <span className="chrome-2 w-16 flex-none">{String(r.kind ?? "")}</span>
              <span className="min-w-0 flex-1 truncate text-[12px]">
                {String(r.label ?? "")}
              </span>
              <span className="muted flex-none text-[10px]">
                {String(r.status ?? "")}
              </span>
              <span className="muted flex-none font-mono text-[10px]">
                {r.ts ? String(r.ts).slice(0, 10) : ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <a className="btn btn-ghost" href="/api/me/traces/export?format=csv" download>
          Export CSV
        </a>
        <a className="btn btn-ghost" href="/api/me/traces/export?format=jsonl" download>
          Export JSONL
        </a>
        <a
          className="btn btn-ghost"
          href="/api/me/traces/export?format=jsonl&include=transcripts"
          download
        >
          + transcripts
        </a>
      </div>
    </section>
  );
}

function OnairosCard({ active }: { active: boolean }) {
  const [state, setState] = useState<OnairosState | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/onairos");
      if (!res.ok) {
        setNote("Couldn't load Onairos status.");
        return;
      }
      setState((await res.json()) as OnairosState);
    } catch {
      setNote("Couldn't load Onairos status.");
    }
  }, []);

  useEffect(() => {
    if (active && state === null) void load();
  }, [active, state, load]);

  async function resync() {
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/onairos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resync: true }),
      });
      if (res.status === 503) setNote(BUSY_NOTE);
      else if (!res.ok) setNote("Re-sync failed.");
      else {
        setNote("Re-synced.");
        void load();
      }
    } catch {
      setNote("Re-sync failed.");
    } finally {
      setBusy(false);
    }
  }

  async function disconnect() {
    if (!window.confirm("Disconnect Onairos and delete the imported persona?"))
      return;
    setBusy(true);
    setNote(null);
    try {
      const res = await fetch("/api/onairos", { method: "DELETE" });
      if (!res.ok) setNote("Disconnect failed.");
      else void load();
    } catch {
      setNote("Disconnect failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="panel !p-4">
      <CardHeader glyph="people" title="Onairos persona" sub="imported personality data" />
      {note ? <p className="muted m-0 mb-2 text-[12px]">{note}</p> : null}
      {state === null ? (
        <p className="muted m-0 text-[12px]">Loading…</p>
      ) : (
        <div className="grid gap-2">
          <p className="m-0 text-[13px]">
            {state.status === "active" ? (
              <>
                Connected
                {state.connected_at
                  ? ` since ${state.connected_at.slice(0, 10)}`
                  : ""}
                — persona lives on your box, never in the shared database.
              </>
            ) : state.configured ? (
              "Not connected — connect from the Settings mini-app."
            ) : (
              "Onairos isn't configured on this deployment."
            )}
          </p>
          {state.status === "active" ? (
            <div className="flex gap-2">
              <DitherButton color="blue" disabled={busy} onClick={() => void resync()}>
                Re-sync
              </DitherButton>
              <button
                className="btn btn-ghost !text-danger"
                disabled={busy}
                onClick={() => void disconnect()}
              >
                Disconnect
              </button>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}

export function ContextPanel({ active }: { active: boolean }) {
  if (!active) return null;
  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      <div className="flex items-baseline gap-2">
        <h2 className="chrome m-0 !text-[12px]">Context</h2>
        <span className="muted text-[12px]">what your agent knows</span>
      </div>
      <MemoryCard />
      <DeepMemoryCard />
      <TracesCard active={active} />
      <OnairosCard active={active} />
    </div>
  );
}
