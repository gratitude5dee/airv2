"use client";

/**
 * V7 Bots tab. Roster renders instantly from Postgres metadata (no box
 * wake); presence/previews arrive only when the box is already awake —
 * the Vault-tab lock discipline. Each bot is a Hermes profile on the same
 * box; all traffic goes through profile-aware server routes, so no bot key
 * or box URL ever reaches this component.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { Orb } from "@/components/orb/Orb";

interface BotEntry {
  name: string;
  title: string | null;
  description: string | null;
  avatar_kind: "geometric" | "image" | "generated" | "pet";
  avatar_ref: string | null;
  model_tier: "fast" | "balanced" | "deep" | null;
  status: "provisioning" | "ready" | "error" | "deleted";
  group_label: string | null;
  created_at: string;
  presence?: "active" | "idle";
  preview?: string;
}

interface Routine {
  id: string;
  name: string;
  schedule: string;
  prompt: string;
  paused: boolean;
  next_run_at: string | null;
  last_run_at: string | null;
}

interface Room {
  id: string;
  name: string;
  members: string[];
}

interface RoomMessage {
  from: string;
  text: string;
}

interface BotChatMessage {
  role: "user" | "agent";
  text: string;
}

const BUSY_NOTE =
  "Your agent's computer is busy starting up — try again in a minute.";
const NAME_RE = /^[a-z0-9-]{2,32}$/;
const TIERS = ["fast", "balanced", "deep"] as const;

function BotAvatar({ bot, size }: { bot: BotEntry; size: number }) {
  if (bot.avatar_kind === "image" && bot.avatar_ref) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/bots/${bot.name}/avatar`}
        alt={`${bot.name} avatar`}
        width={size}
        height={size}
        className="rounded-md object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return <DitherAvatar name={bot.name} size={size} />;
}

function errorLine(status: number, fallback: string): string {
  if (status === 429) return BUSY_NOTE;
  return fallback;
}

export function BotsPanel({ active }: { active: boolean }) {
  const [bots, setBots] = useState<BotEntry[] | null>(null);
  const [boxAwake, setBoxAwake] = useState(false);
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [openRoom, setOpenRoom] = useState<Room | null>(null);
  const loadedOnce = useRef(false);

  const loadRoster = useCallback(async () => {
    try {
      const [botsRes, roomsRes] = await Promise.all([
        fetch("/api/bots"),
        fetch("/api/bots/rooms"),
      ]);
      if (botsRes.ok) {
        const payload = (await botsRes.json()) as {
          bots: BotEntry[];
          box_awake?: boolean;
        };
        setBots(payload.bots);
        setBoxAwake(Boolean(payload.box_awake));
      }
      if (roomsRes.ok) {
        const payload = (await roomsRes.json()) as { rooms: Room[] };
        setRooms(payload.rooms);
      }
    } catch {
      setNote("Couldn't load your bots — try again in a minute.");
    }
  }, []);

  useEffect(() => {
    if (active && !loadedOnce.current) {
      loadedOnce.current = true;
      void loadRoster();
    }
  }, [active, loadRoster]);

  const selectedBot = bots?.find((b) => b.name === selected) ?? null;

  return (
    <div className="flex flex-col gap-3">
      {note ? <p className="muted m-0 text-[12px]">{note}</p> : null}
      {selectedBot ? (
        <BotDetail
          bot={selectedBot}
          onBack={() => {
            setSelected(null);
            void loadRoster();
          }}
          onChanged={loadRoster}
        />
      ) : openRoom ? (
        <RoomView
          room={openRoom}
          bots={bots ?? []}
          onBack={() => setOpenRoom(null)}
        />
      ) : (
        <Roster
          bots={bots}
          boxAwake={boxAwake}
          rooms={rooms}
          onOpen={setSelected}
          onOpenRoom={setOpenRoom}
          onChanged={loadRoster}
        />
      )}
    </div>
  );
}

/* ── Roster ────────────────────────────────────────────────────────────── */

function Roster({
  bots,
  boxAwake,
  rooms,
  onOpen,
  onOpenRoom,
  onChanged,
}: {
  bots: BotEntry[] | null;
  boxAwake: boolean;
  rooms: Room[] | null;
  onOpen: (name: string) => void;
  onOpenRoom: (room: Room) => void;
  onChanged: () => Promise<void>;
}) {
  const [sheetOpen, setSheetOpen] = useState(false);
  const groups = new Map<string, BotEntry[]>();
  for (const bot of bots ?? []) {
    const key = bot.group_label ?? "";
    const list = groups.get(key) ?? [];
    list.push(bot);
    groups.set(key, list);
  }
  const orderedGroups = [...groups.entries()].sort(([a], [b]) =>
    a === "" ? -1 : b === "" ? 1 : a.localeCompare(b)
  );

  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <p className="muted m-0 text-[12px]">
          {bots === null
            ? "Loading your bots…"
            : boxAwake
              ? "Live previews from your agent's computer."
              : "Your agent's computer is asleep — previews return after it wakes."}
        </p>
        <button className="seg" onClick={() => setSheetOpen((v) => !v)}>
          {sheetOpen ? "Close" : "New bot"}
        </button>
      </div>
      {sheetOpen ? (
        <NewBotSheet
          bots={bots ?? []}
          onCreated={async () => {
            setSheetOpen(false);
            await onChanged();
          }}
        />
      ) : null}
      {bots !== null && bots.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Orb size={28} label="bots" />
          <p className="muted m-0 text-[13px]">
            Give your agent teammates — each bot is its own isolated profile
            with its own memory, skills, and chat.
          </p>
        </div>
      ) : null}
      {orderedGroups.map(([label, members]) => (
        <div key={label || "~ungrouped"} className="flex flex-col gap-2">
          {label ? (
            <p className="muted m-0 text-[11px] font-medium uppercase tracking-wide">
              {label}
            </p>
          ) : null}
          {members.map((bot) => (
            <button
              key={bot.name}
              className="flex items-center gap-3 rounded-xl bg-surface p-3 text-left shadow-[0_0_0_0.5px_var(--ring)]"
              onClick={() => onOpen(bot.name)}
            >
              <BotAvatar bot={bot} size={36} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-[13px] font-medium">@{bot.name}</span>
                  {bot.presence ? (
                    <span
                      title={bot.presence}
                      className={
                        "inline-block h-1.5 w-1.5 rounded-full " +
                        (bot.presence === "active"
                          ? "bg-emerald-500"
                          : "bg-[var(--ring)]")
                      }
                    />
                  ) : null}
                  {bot.status !== "ready" ? (
                    <span className="muted text-[11px]">({bot.status})</span>
                  ) : null}
                  {bot.model_tier ? (
                    <span className="muted text-[11px]">{bot.model_tier}</span>
                  ) : null}
                </div>
                <p className="muted m-0 truncate text-[12px]">
                  {bot.preview ?? bot.title ?? bot.description ?? "—"}
                </p>
              </div>
            </button>
          ))}
        </div>
      ))}
      <RoomsSection
        rooms={rooms}
        bots={bots ?? []}
        onOpenRoom={onOpenRoom}
        onChanged={onChanged}
      />
    </>
  );
}

/* ── New Bot sheet ─────────────────────────────────────────────────────── */

function NewBotSheet({
  bots,
  onCreated,
}: {
  bots: BotEntry[];
  onCreated: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [title, setTitle] = useState("");
  const [advanced, setAdvanced] = useState(false);
  const [description, setDescription] = useState("");
  const [cloneFrom, setCloneFrom] = useState("");
  const [tier, setTier] = useState("");
  const [groupLabel, setGroupLabel] = useState("");
  const [skills, setSkills] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const trimmed = name.trim().toLowerCase();
    if (!NAME_RE.test(trimmed) || trimmed === "default") {
      setError("Names are 2–32 lowercase letters, digits, or dashes.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: trimmed,
          title: title.trim() || undefined,
          description: advanced ? description.trim() || undefined : undefined,
          clone_from: advanced ? cloneFrom || undefined : undefined,
          model_tier: advanced ? tier || undefined : undefined,
          group_label: advanced ? groupLabel.trim() || undefined : undefined,
          skills: advanced
            ? skills
                .split(",")
                .map((s) => s.trim())
                .filter(Boolean)
            : undefined,
        }),
      });
      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setError(errorLine(res.status, payload.error ?? "Creation failed."));
        setBusy(false);
        return;
      }
      await onCreated();
    } catch {
      setError("Creation failed — try again.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-[0_0_0_0.5px_var(--ring)]">
      <div className="flex items-center gap-2">
        <DitherAvatar name={name.trim() || "new-bot"} size={28} />
        <input
          className="input flex-1"
          placeholder="name (e.g. researcher)"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <input
        className="input"
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <button
        className="seg self-start text-[12px]"
        onClick={() => setAdvanced((v) => !v)}
      >
        {advanced ? "Hide advanced" : "Advanced…"}
      </button>
      {advanced ? (
        <>
          <textarea
            className="input"
            rows={2}
            placeholder="What is this bot for?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
          <label className="muted flex items-center gap-2 text-[12px]">
            Clone from
            <select
              className="input flex-1"
              value={cloneFrom}
              onChange={(e) => setCloneFrom(e.target.value)}
            >
              <option value="">Fresh profile</option>
              <option value="default">Your main agent</option>
              {bots
                .filter((b) => b.status === "ready")
                .map((b) => (
                  <option key={b.name} value={b.name}>
                    @{b.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="muted flex items-center gap-2 text-[12px]">
            Speed
            <select
              className="input flex-1"
              value={tier}
              onChange={(e) => setTier(e.target.value)}
            >
              <option value="">Default</option>
              {TIERS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <input
            className="input"
            placeholder="Group label (optional)"
            value={groupLabel}
            onChange={(e) => setGroupLabel(e.target.value)}
          />
          <input
            className="input"
            placeholder="Skills to enable, comma-separated (optional)"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
          />
        </>
      ) : null}
      {error ? <p className="m-0 text-[12px] text-red-500">{error}</p> : null}
      <button className="seg pill-active self-end" disabled={busy} onClick={() => void submit()}>
        {busy ? "Creating…" : "Create bot"}
      </button>
      {busy ? (
        <p className="muted m-0 text-[11px]">
          Setting up the profile on your agent&apos;s computer — this can
          take a minute.
        </p>
      ) : null}
    </div>
  );
}

/* ── Per-bot screen ────────────────────────────────────────────────────── */

function BotDetail({
  bot,
  onBack,
  onChanged,
}: {
  bot: BotEntry;
  onBack: () => void;
  onChanged: () => Promise<void>;
}) {
  const [messages, setMessages] = useState<BotChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const historyLoaded = useRef(false);

  useEffect(() => {
    if (historyLoaded.current) return;
    historyLoaded.current = true;
    void (async () => {
      try {
        const res = await fetch(`/api/bots/${bot.name}/chat`);
        if (!res.ok) return;
        const payload = (await res.json()) as {
          messages: { role: string; content: string }[];
          box_asleep?: boolean;
        };
        if (payload.box_asleep) {
          setNote("History returns after your agent's computer wakes.");
          return;
        }
        setMessages(
          payload.messages
            .filter((m) => m.role === "user" || m.role === "assistant")
            .map((m) => ({
              role: m.role === "user" ? ("user" as const) : ("agent" as const),
              text: m.content,
            }))
        );
      } catch {
        // metadata-only view is fine
      }
    })();
  }, [bot.name]);

  function followRun(runId: string) {
    const events = new EventSource(
      `/api/bots/${bot.name}/chat/${runId}/events`
    );
    let acc = "";
    const fillEmpty = (fallback: string) => {
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last && last.role === "agent" && !last.text) {
          return [...m.slice(0, -1), { role: "agent" as const, text: fallback }];
        }
        return m;
      });
    };
    events.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as {
          event?: string;
          delta?: string;
          output?: string;
        };
        if (parsed.event === "message.delta" && parsed.delta) {
          acc += parsed.delta;
          setMessages((m) => [...m.slice(0, -1), { role: "agent", text: acc }]);
        }
        if (parsed.event === "run.completed") {
          if (!acc && parsed.output) {
            setMessages((m) => [
              ...m.slice(0, -1),
              { role: "agent", text: parsed.output ?? "" },
            ]);
          } else if (!acc) {
            fillEmpty("(no reply)");
          }
          events.close();
          setBusy(false);
        }
        if (parsed.event === "run.failed") {
          fillEmpty("Something went wrong.");
          events.close();
          setBusy(false);
        }
      } catch {
        // keepalive
      }
    };
    events.onerror = () => {
      fillEmpty("Connection lost — try again.");
      events.close();
      setBusy(false);
    };
  }

  async function send(action?: "compact") {
    const text = action === "compact" ? "Compact context" : input.trim();
    if (!text || busy) return;
    setBusy(true);
    setNote(null);
    if (!action) setInput("");
    setMessages((m) => [
      ...m,
      { role: "user", text },
      { role: "agent", text: "" },
    ]);
    try {
      const res = await fetch(`/api/bots/${bot.name}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(action ? { action } : { input: text }),
      });
      if (!res.ok) {
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: "agent", text: errorLine(res.status, "Something went wrong.") },
        ]);
        setBusy(false);
        return;
      }
      const payload = (await res.json()) as { run_id?: string };
      if (!payload.run_id) {
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: "agent", text: "Something went wrong." },
        ]);
        setBusy(false);
        return;
      }
      followRun(payload.run_id);
    } catch {
      setMessages((m) => m.slice(0, -2));
      setNote("Couldn't reach your agent's computer — try again in a minute.");
      setBusy(false);
    }
  }

  async function remove() {
    const res = await fetch("/api/bots", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: bot.name }),
    });
    if (!res.ok) {
      setNote(errorLine(res.status, "Delete failed — try again."));
      setConfirmDelete(false);
      return;
    }
    onBack();
  }

  async function duplicate() {
    const copy = `${bot.name}-copy`.slice(0, 32);
    setNote(`Creating @${copy}…`);
    const res = await fetch("/api/bots", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: copy,
        title: bot.title ?? undefined,
        clone_from: bot.name,
        model_tier: bot.model_tier ?? undefined,
        group_label: bot.group_label ?? undefined,
      }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setNote(errorLine(res.status, payload.error ?? "Duplicate failed."));
      return;
    }
    setNote(`@${copy} is ready.`);
    await onChanged();
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button className="seg" onClick={onBack}>
          ← Bots
        </button>
        <BotAvatar bot={bot} size={36} />
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[14px] font-medium">@{bot.name}</p>
          <p className="muted m-0 truncate text-[12px]">
            {bot.title ?? bot.description ?? "Bot Chat"}
          </p>
        </div>
        <button className="seg" onClick={() => setEditing((v) => !v)}>
          Edit
        </button>
        <button className="seg" onClick={() => void duplicate()}>
          Duplicate
        </button>
        {confirmDelete ? (
          <>
            <button className="seg text-red-500" onClick={() => void remove()}>
              Really delete?
            </button>
            <button className="seg" onClick={() => setConfirmDelete(false)}>
              Keep
            </button>
          </>
        ) : (
          <button className="seg" onClick={() => setConfirmDelete(true)}>
            Delete
          </button>
        )}
      </div>
      {note ? <p className="muted m-0 text-[12px]">{note}</p> : null}
      {editing ? (
        <EditBotForm
          bot={bot}
          onSaved={async () => {
            setEditing(false);
            await onChanged();
          }}
        />
      ) : null}

      <div className="grid gap-2 rounded-xl bg-surface p-3 shadow-[0_0_0_0.5px_var(--ring)]">
        <div className="flex items-center justify-between">
          <p className="m-0 text-[12px] font-medium">Bot Chat</p>
          <button
            className="seg text-[12px]"
            disabled={busy}
            onClick={() => void send("compact")}
            title="Compress this chat's context on the box"
          >
            Compact context
          </button>
        </div>
        <div className="grid max-h-96 gap-2 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="muted m-0 py-6 text-center text-[12px]">
              One persistent chat — @{bot.name} remembers this conversation.
            </p>
          ) : (
            messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              const streaming = busy && isLast && m.role === "agent";
              if (streaming && !m.text) {
                return (
                  <div key={i} className="justify-self-start">
                    <Orb pill label="Thinking…" />
                  </div>
                );
              }
              return (
                <div
                  key={i}
                  className={
                    "max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed " +
                    (m.role === "user"
                      ? "justify-self-end bg-[var(--text)] text-[var(--bg)]"
                      : "justify-self-start shadow-[0_0_0_0.5px_var(--ring)]")
                  }
                >
                  {m.text}
                </div>
              );
            })
          )}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder={`Message @${bot.name}…`}
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
          />
          <button className="seg pill-active" disabled={busy} onClick={() => void send()}>
            Send
          </button>
        </div>
      </div>

      <RoutinesSection bot={bot} />
    </div>
  );
}

function EditBotForm({
  bot,
  onSaved,
}: {
  bot: BotEntry;
  onSaved: () => Promise<void>;
}) {
  const [title, setTitle] = useState(bot.title ?? "");
  const [description, setDescription] = useState(bot.description ?? "");
  const [groupLabel, setGroupLabel] = useState(bot.group_label ?? "");
  const [tier, setTier] = useState(bot.model_tier ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/bots", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: bot.name,
        title: title.trim() || null,
        description: description.trim() || null,
        group_label: groupLabel.trim() || null,
        ...(tier !== (bot.model_tier ?? "") ? { model_tier: tier || null } : {}),
      }),
    });
    if (!res.ok) {
      setError(errorLine(res.status, "Save failed — try again."));
      setBusy(false);
      return;
    }
    setBusy(false);
    await onSaved();
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-surface p-3 shadow-[0_0_0_0.5px_var(--ring)]">
      <input
        className="input"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />
      <textarea
        className="input"
        rows={2}
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />
      <input
        className="input"
        placeholder="Group label"
        value={groupLabel}
        onChange={(e) => setGroupLabel(e.target.value)}
      />
      <label className="muted flex items-center gap-2 text-[12px]">
        Speed
        <select
          className="input flex-1"
          value={tier}
          onChange={(e) => setTier(e.target.value)}
        >
          <option value="">Default</option>
          {TIERS.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      {error ? <p className="m-0 text-[12px] text-red-500">{error}</p> : null}
      <button className="seg pill-active self-end" disabled={busy} onClick={() => void save()}>
        {busy ? "Saving…" : "Save"}
      </button>
    </div>
  );
}

/* ── Routines ──────────────────────────────────────────────────────────── */

function RoutinesSection({ bot }: { bot: BotEntry }) {
  const [routines, setRoutines] = useState<Routine[] | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [schedule, setSchedule] = useState("");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/bots/${bot.name}/routines`);
      if (!res.ok) {
        setNote(errorLine(res.status, "Couldn't load routines."));
        return;
      }
      const payload = (await res.json()) as {
        routines: Routine[];
        box_asleep?: boolean;
      };
      if (payload.box_asleep) {
        setNote("Routines return after your agent's computer wakes.");
        setRoutines([]);
        return;
      }
      setNote(null);
      setRoutines(payload.routines);
    } catch {
      setNote("Couldn't load routines.");
    }
  }, [bot.name]);

  useEffect(() => {
    void load();
  }, [load]);

  async function create() {
    if (!name.trim() || !schedule.trim() || !prompt.trim() || busy) return;
    setBusy(true);
    const res = await fetch(`/api/bots/${bot.name}/routines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: name.trim(),
        schedule: schedule.trim(),
        prompt: prompt.trim(),
      }),
    });
    if (res.ok) {
      setName("");
      setSchedule("");
      setPrompt("");
      await load();
    } else {
      setNote(errorLine(res.status, "Couldn't create the routine."));
    }
    setBusy(false);
  }

  async function act(id: string, action: "pause" | "resume" | "run") {
    await fetch(`/api/bots/${bot.name}/routines`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, id }),
    });
    await load();
  }

  async function remove(id: string) {
    await fetch(`/api/bots/${bot.name}/routines`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await load();
  }

  return (
    <div className="grid gap-2 rounded-xl bg-surface p-3 shadow-[0_0_0_0.5px_var(--ring)]">
      <p className="m-0 text-[12px] font-medium">Routines</p>
      {note ? <p className="muted m-0 text-[12px]">{note}</p> : null}
      {routines === null ? (
        <p className="muted m-0 text-[12px]">Loading…</p>
      ) : routines.length === 0 ? (
        <p className="muted m-0 text-[12px]">
          Scheduled work lands in this bot&apos;s own chat — it flags anything
          that needs you.
        </p>
      ) : (
        routines.map((r) => (
          <div
            key={r.id}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 shadow-[0_0_0_0.5px_var(--ring)]"
          >
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[12px] font-medium">{r.name}</p>
              <p className="muted m-0 text-[11px]">
                {r.schedule}
                {r.next_run_at ? ` · next ${r.next_run_at}` : ""}
                {r.paused ? " · paused" : ""}
              </p>
            </div>
            <button className="seg text-[11px]" onClick={() => void act(r.id, "run")}>
              Run
            </button>
            <button
              className="seg text-[11px]"
              onClick={() => void act(r.id, r.paused ? "resume" : "pause")}
            >
              {r.paused ? "Resume" : "Pause"}
            </button>
            <button className="seg text-[11px]" onClick={() => void remove(r.id)}>
              Delete
            </button>
          </div>
        ))
      )}
      <div className="grid gap-1.5">
        <div className="flex gap-1.5">
          <input
            className="input flex-1"
            placeholder="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="input flex-1"
            placeholder="Schedule (e.g. 0 9 * * *)"
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
          />
        </div>
        <textarea
          className="input"
          rows={2}
          placeholder="What should this routine do?"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
        />
        <button
          className="seg self-end text-[12px]"
          disabled={busy}
          onClick={() => void create()}
        >
          Add routine
        </button>
      </div>
    </div>
  );
}

/* ── Rooms ─────────────────────────────────────────────────────────────── */

function RoomsSection({
  rooms,
  bots,
  onOpenRoom,
  onChanged,
}: {
  rooms: Room[] | null;
  bots: BotEntry[];
  onOpenRoom: (room: Room) => void;
  onChanged: () => Promise<void>;
}) {
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState("");
  const [members, setMembers] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const ready = bots.filter((b) => b.status === "ready");

  async function create() {
    setError(null);
    const res = await fetch("/api/bots/rooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), members }),
    });
    if (!res.ok) {
      const payload = (await res.json().catch(() => ({}))) as { error?: string };
      setError(payload.error ?? "Couldn't create the room.");
      return;
    }
    setCreating(false);
    setName("");
    setMembers([]);
    await onChanged();
  }

  async function remove(id: string) {
    await fetch("/api/bots/rooms", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    await onChanged();
  }

  return (
    <div className="grid gap-2 rounded-xl bg-surface p-3 shadow-[0_0_0_0.5px_var(--ring)]">
      <div className="flex items-center justify-between">
        <p className="m-0 text-[12px] font-medium">Rooms</p>
        <button className="seg text-[12px]" onClick={() => setCreating((v) => !v)}>
          {creating ? "Close" : "New room"}
        </button>
      </div>
      {creating ? (
        <div className="grid gap-1.5">
          <input
            className="input"
            placeholder="Room name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="flex flex-wrap gap-1.5">
            {ready.map((b) => {
              const on = members.includes(b.name);
              return (
                <button
                  key={b.name}
                  className={"seg text-[12px]" + (on ? " pill-active" : "")}
                  onClick={() =>
                    setMembers((m) =>
                      on ? m.filter((n) => n !== b.name) : [...m, b.name]
                    )
                  }
                >
                  @{b.name}
                </button>
              );
            })}
          </div>
          <p className="muted m-0 text-[11px]">Pick 2–6 bots.</p>
          {error ? <p className="m-0 text-[12px] text-red-500">{error}</p> : null}
          <button className="seg self-end text-[12px]" onClick={() => void create()}>
            Create room
          </button>
        </div>
      ) : null}
      {(rooms ?? []).length === 0 && !creating ? (
        <p className="muted m-0 text-[12px]">
          Rooms let a few bots work a question together — you moderate.
        </p>
      ) : null}
      {(rooms ?? []).map((room) => (
        <div
          key={room.id}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 shadow-[0_0_0_0.5px_var(--ring)]"
        >
          <button
            className="min-w-0 flex-1 text-left"
            onClick={() => onOpenRoom(room)}
          >
            <p className="m-0 text-[12px] font-medium">{room.name}</p>
            <p className="muted m-0 truncate text-[11px]">
              {room.members.map((m) => `@${m}`).join(", ")}
            </p>
          </button>
          <button className="seg text-[11px]" onClick={() => void remove(room.id)}>
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function RoomView({
  room,
  bots,
  onBack,
}: {
  room: Room;
  bots: BotEntry[];
  onBack: () => void;
}) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  async function send() {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setNote(null);
    setInput("");
    setMessages((m) => [...m, { from: "you", text }]);
    try {
      const res = await fetch(`/api/bots/rooms/${room.id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
      });
      if (!res.ok) {
        setNote(errorLine(res.status, "The room couldn't answer — try again."));
        setBusy(false);
        return;
      }
      const payload = (await res.json()) as {
        messages: { from: string; text: string }[];
        stopped?: string;
      };
      setMessages((m) => [...m, ...payload.messages]);
      if (payload.stopped === "budget") {
        setNote("The room stopped early to protect your monthly budget.");
      } else if (payload.stopped === "needs_user") {
        setNote("A bot needs you — check the Needs-you tab.");
      }
    } catch {
      setNote("The room couldn't answer — try again.");
    }
    setBusy(false);
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <button className="seg" onClick={onBack}>
          ← Bots
        </button>
        <div className="min-w-0 flex-1">
          <p className="m-0 text-[14px] font-medium">Group: {room.name}</p>
          <p className="muted m-0 truncate text-[12px]">
            {room.members.map((m) => `@${m}`).join(", ")}
          </p>
        </div>
      </div>
      {note ? <p className="muted m-0 text-[12px]">{note}</p> : null}
      <div className="grid gap-2 rounded-xl bg-surface p-3 shadow-[0_0_0_0.5px_var(--ring)]">
        <div className="grid max-h-96 gap-2 overflow-y-auto">
          {messages.length === 0 ? (
            <p className="muted m-0 py-6 text-center text-[12px]">
              Ask the group — members answer in turns and may pass.
            </p>
          ) : (
            messages.map((m, i) => {
              const bot = bots.find((b) => b.name === m.from);
              return (
                <div
                  key={i}
                  className={
                    "max-w-[80%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed " +
                    (m.from === "you"
                      ? "justify-self-end bg-[var(--text)] text-[var(--bg)]"
                      : "justify-self-start shadow-[0_0_0_0.5px_var(--ring)]")
                  }
                >
                  {m.from !== "you" ? (
                    <div className="mb-1 flex items-center gap-1.5">
                      {bot ? (
                        <BotAvatar bot={bot} size={16} />
                      ) : (
                        <DitherAvatar name={m.from} size={16} />
                      )}
                      <span className="muted text-[11px] font-medium">
                        @{m.from}
                      </span>
                    </div>
                  ) : null}
                  {m.text}
                </div>
              );
            })
          )}
          {busy ? (
            <div className="justify-self-start">
              <Orb pill label="The room is talking…" />
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <input
            className="input flex-1"
            placeholder="Ask the group…"
            value={input}
            disabled={busy}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void send();
            }}
          />
          <button className="seg pill-active" disabled={busy} onClick={() => void send()}>
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
