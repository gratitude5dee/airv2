"use client";

/**
 * /home shell (redesign phase 1, spec §2–§6): grouped rail with URL-driven
 * state (?s=air.chat…), the AIR chat column with the 3-state computer dock
 * and in-chat mini-app dock, self-contained panels/*.tsx for every old tab
 * body, chat threads on top of the shared air-main session, and Bots as an
 * AIR drawer. Hard constraints (§8) — box poll cadence, 429-vs-502 copy,
 * computerEpoch-keyed iframe, cross-surface prefills, composer contracts —
 * all survive here.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { Orb } from "@/components/orb/Orb";
import { PromptInput } from "@/components/prompt-input/PromptInput";
import { AdsPanel } from "./ads-panel";
import { VaultPanel } from "./vault-panel";
import { BotsPanel } from "./bots-panel";
import { AppsPanel } from "./apps-panel";
import { CalendarPanel } from "./calendar-panel";
import { launchMiniApp } from "./launch";
import { MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES } from "@/lib/chat/attachments";
import { HomeNav, parseSection, type Section, type ThreadItem } from "./nav";
import { ComputerCard, type ComputerDockState } from "./air/computer-card";
import { SpeedCard } from "./rail/speed-card";
import { AppsGrid } from "./rail/apps-grid";
import { NeedsPanel } from "./panels/needs-panel";
import { PeoplePanel } from "./panels/people-panel";
import { ConnectorsPanel } from "./panels/connectors-panel";
import { HistoryPanel } from "./panels/history-panel";
import { SkillsPanel } from "./panels/skills-panel";
import { WalletPanel } from "./panels/wallet-panel";
import { ProfilePanel } from "./panels/profile-panel";
import { pickList } from "./lib";

interface Me {
  user: { id: string; username: string | null; wallet_address: string | null };
  entitlement: {
    plan: string;
    speed_tier: string;
    tier_models?: { fast: string; balanced: string; deep: string };
    monthly_cap_usd: number;
    spend_mtd_usd: number;
  } | null;
  lines: { phone: string; platform: string }[];
  addresses: { address: string; is_primary: boolean }[];
}

interface ChatMessage {
  role: "user" | "agent";
  text: string;
  /** M16: inline creative media, delivered via a short-lived signed URL. */
  media?: { kind: "image" | "video"; url: string };
  /** V7: set when an @mention delegated this reply to a bot. */
  bot?: string;
}

/** V8: a chat upload staged in the composer; path is the box inbox path. */
interface StagedAttachment {
  name: string;
  path?: string;
  mime?: string;
  uploading?: boolean;
}

/** Tool names that mean the agent is driving its own browser/desktop, so the
 * live computer view should surface inline in Chat. */
function isComputerTool(name: string | undefined): boolean {
  return (
    typeof name === "string" &&
    (name.startsWith("browser") || name.startsWith("computer"))
  );
}

/** Chat threads (spec §3): additive Hermes sessions next to the shared
 * air-main. Same shape the API validates. */
const THREAD_ID_RE = /^air-[a-z0-9-]{1,32}$/;

function parseThread(raw: string | null): string {
  return raw && THREAD_ID_RE.test(raw) ? raw : "air-main";
}

function parseDock(raw: string | null): ComputerDockState {
  if (raw === "x") return "expanded";
  if (raw === "hid") return "hidden";
  return "minimized";
}

const DOCK_PARAM: Record<ComputerDockState, string | null> = {
  expanded: "x",
  minimized: null, // the default keeps the URL clean
  hidden: "hid",
};

export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomeShell />
    </Suspense>
  );
}

function HomeShell() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // D5/D1: nav state lives in the URL — deep links, refresh, and Back all
  // work; imperative jumps push a new query string.
  const section = parseSection(searchParams.get("s"));
  const thread = parseThread(searchParams.get("t"));
  const dock = parseDock(searchParams.get("c"));

  const setParams = useCallback(
    (updates: Record<string, string | null>, replace = false) => {
      const params = new URLSearchParams(window.location.search);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key);
        else params.set(key, value);
      }
      const qs = params.toString();
      const url = qs ? `/home?${qs}` : "/home";
      if (replace) window.history.replaceState(null, "", url);
      else window.history.pushState(null, "", url);
    },
    []
  );

  const navigate = useCallback(
    (next: Section) => setParams({ s: next === "air.chat" ? null : next }),
    [setParams]
  );
  const setDock = useCallback(
    (next: ComputerDockState) => setParams({ c: DOCK_PARAM[next] }, true),
    [setParams]
  );

  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tier, setTier] = useState("balanced");
  const [computerEpoch, setComputerEpoch] = useState(0);
  const [calendarPrefill, setCalendarPrefill] = useState<{
    name: string;
    prompt: string;
  } | null>(null);
  // Once the user closes the dock mid-run, don't pop it back open until the
  // next run starts using the computer again.
  const computerAutoOpenedRef = useRef(false);
  const computerDismissedRef = useRef(false);
  const dockRef = useRef(dock);
  useEffect(() => {
    dockRef.current = dock;
  }, [dock]);
  // True when any mic transcription landed in the composer since the last
  // send — those runs record agent_runs.trigger = 'voice' (M13).
  const voiceUsedRef = useRef(false);
  const [historyLoading, setHistoryLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [boxState, setBoxState] = useState<string | null>(null);
  const [powerBusy, setPowerBusy] = useState(false);
  const [powerNote, setPowerNote] = useState<string | null>(null);
  // V8 Chat: staged uploads, the streaming run (for stop), per-message copy,
  // and the ready-bot roster for the @mention palette.
  const [staged, setStaged] = useState<StagedAttachment[]>([]);
  const stagedCountRef = useRef(0);
  useEffect(() => {
    stagedCountRef.current = staged.length;
  }, [staged]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [botNames, setBotNames] = useState<string[]>([]);
  // Needs You badge on the rail — globally reachable (spec §8).
  const [needsCount, setNeedsCount] = useState(0);
  // Bots mounts as a drawer inside AIR (spec §2).
  const [botsOpen, setBotsOpen] = useState(false);
  // In-chat mini-app dock (spec §5): a signed link in an iframe.
  const [dockedApp, setDockedApp] = useState<{
    slug: string;
    url: string;
  } | null>(null);
  const [dockedAppNote, setDockedAppNote] = useState<string | null>(null);
  // Threads created this visit that the box doesn't list yet.
  const [localThreads, setLocalThreads] = useState<ThreadItem[]>([]);
  const [boxThreads, setBoxThreads] = useState<ThreadItem[]>([]);
  const eventsRef = useRef<EventSource | null>(null);
  const threadRef = useRef(thread);

  // Poll the box power state — quickly through transitions so the boot
  // banner and Computer controls track reality, slowly at rest.
  useEffect(() => {
    let stale = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const tick = async () => {
      try {
        const res = await fetch("/api/box/status");
        if (res.ok) {
          const data = (await res.json()) as { state?: string };
          if (!stale && typeof data.state === "string") setBoxState(data.state);
        }
      } catch {
        // transient; keep polling
      }
      if (!stale) {
        const fast =
          boxStateRef.current === "starting" ||
          boxStateRef.current === "stopping" ||
          boxStateRef.current === "provisioning";
        timer = setTimeout(tick, fast ? 3_000 : 15_000);
      }
    };
    void tick();
    return () => {
      stale = true;
      if (timer) clearTimeout(timer);
    };
  }, []);
  const boxStateRef = useRef<string | null>(null);
  useEffect(() => {
    boxStateRef.current = boxState;
  }, [boxState]);

  async function powerOn(keepAwakeMinutes?: number) {
    setPowerBusy(true);
    setPowerNote(null);
    setBoxState("starting");
    try {
      const res = await fetch("/api/box/wake", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          keepAwakeMinutes ? { keep_awake_minutes: keepAwakeMinutes } : {}
        ),
      });
      if (res.ok) {
        setBoxState("ready");
        if (keepAwakeMinutes) {
          setPowerNote(`Staying awake for ${Math.round(keepAwakeMinutes / 60)}h.`);
        }
        // Remount the desktop iframe: the stream token rotates on resume.
        setComputerEpoch((n) => n + 1);
      } else if (res.status === 429) {
        setPowerNote("Start limit reached — try again in a minute.");
        setBoxState("stopped");
      } else {
        setPowerNote("Couldn't power on — try again shortly.");
        setBoxState("stopped");
      }
    } catch {
      setPowerNote("Couldn't power on — try again shortly.");
    } finally {
      setPowerBusy(false);
    }
  }

  async function powerOff() {
    setPowerBusy(true);
    setPowerNote(null);
    try {
      const res = await fetch("/api/box/stop", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (res.ok) {
        setBoxState("stopped");
      } else if (data.error === "run_active") {
        setPowerNote("Your agent is mid-task — wait for it to finish first.");
      } else if (data.error === "stop_refused") {
        setPowerNote("The computer refused to stop — it stays on. Try again shortly.");
      } else {
        setPowerNote("Couldn't power off — try again shortly.");
      }
    } catch {
      setPowerNote("Couldn't power off — try again shortly.");
    } finally {
      setPowerBusy(false);
    }
  }

  useEffect(() => {
    fetch("/api/me").then(async (res) => {
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json()) as Me;
      setMe(data);
      if (data.entitlement) setTier(data.entitlement.speed_tier);
      // Pre-warm the box so the first message / panel load doesn't wait on
      // a cold resume. Best-effort: every consumer handles a sleeping box.
      fetch("/api/box/wake", { method: "POST" }).catch(() => {});
    });
    // Ready bots feed the composer's @mention palette (V8); best-effort.
    fetch("/api/bots")
      .then(async (res) => {
        if (!res.ok) return;
        const data = (await res.json()) as {
          bots?: { name: string; status: string }[];
        };
        setBotNames(
          (data.bots ?? [])
            .filter((b) => b.status === "ready")
            .map((b) => b.name)
        );
      })
      .catch(() => {});
  }, [router]);

  // Rail badge: pending Needs You count, refreshed on load and once a minute
  // (the panel's own loads sync it too).
  useEffect(() => {
    let stale = false;
    const load = async () => {
      try {
        const res = await fetch("/api/decisions");
        if (res.ok) {
          const data = (await res.json()) as { decisions?: unknown[] };
          if (!stale) setNeedsCount((data.decisions ?? []).length);
        }
      } catch {
        // badge is a nicety
      }
    };
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => {
      stale = true;
      clearInterval(timer);
    };
  }, []);

  // Thread list (spec §3): web threads are Hermes sessions named air-*;
  // air-main stays the shared web+iMessage conversation. Best-effort.
  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const res = await fetch("/api/box/api/sessions?limit=30");
        if (!res.ok) return;
        const list = pickList<{
          session_id?: string;
          id?: string;
          title?: string;
        }>(await res.json(), ["sessions", "data", "items"]);
        if (stale) return;
        setBoxThreads(
          list
            .map((s) => ({ id: s.session_id ?? s.id ?? "", title: s.title ?? "" }))
            .filter((t) => THREAD_ID_RE.test(t.id) && t.id !== "air-main")
            .map((t) => ({ id: t.id, title: t.title || t.id }))
        );
      } catch {
        // the thread list is a nicety; Main always works
      }
    })();
    return () => {
      stale = true;
    };
  }, []);

  const threads: ThreadItem[] = [
    ...localThreads.filter((t) => !boxThreads.some((b) => b.id === t.id)),
    ...boxThreads,
  ];

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // One conversation across every client: seed the pane with the active
  // thread's transcript (air-main includes iMessage turns). First load may
  // wake the box, so this stays best-effort and non-blocking. Re-runs when
  // the thread changes; a still-streaming run from the old thread is closed.
  useEffect(() => {
    if (threadRef.current !== thread) {
      threadRef.current = thread;
      eventsRef.current?.close();
      eventsRef.current = null;
      setBusy(false);
      setActiveRunId(null);
    }
    let stale = false;
    setMessages([]);
    setHistoryLoading(true);
    (async () => {
      try {
        const res = await fetch(
          `/api/box/api/sessions/${encodeURIComponent(thread)}/messages`
        );
        if (!res.ok) return;
        const data = (await res.json()) as {
          data?: Array<{ role?: string; content?: string }>;
        };
        const transcript = (data.data ?? [])
          .filter(
            (m) =>
              (m.role === "user" || m.role === "assistant") &&
              typeof m.content === "string" &&
              m.content.trim() !== ""
          )
          .map((m) => ({
            role: m.role === "user" ? ("user" as const) : ("agent" as const),
            text: (m.content ?? "").trim(),
          }));
        if (!stale && transcript.length > 0) {
          setMessages((current) => (current.length === 0 ? transcript : current));
        }
      } catch {
        // history is a nicety; chat works without it
      } finally {
        if (!stale) setHistoryLoading(false);
      }
    })();
    return () => {
      stale = true;
    };
  }, [thread]);

  // M16: follow a creative job's SSE stream and land the media inline.
  const followCreativeJob = useCallback((jobId: string) => {
    const events = new EventSource(`/api/creative/${jobId}/events`);
    eventsRef.current = events;
    const finish = (message: ChatMessage) => {
      setMessages((m) => [...m.slice(0, -1), message]);
      events.close();
      setBusy(false);
    };
    events.onmessage = (event) => {
      try {
        const parsed = JSON.parse(event.data) as {
          event?: string;
          phase?: string;
          kind?: string;
          url?: string;
          line?: string;
        };
        if (parsed.event === "creative.status") {
          const label =
            parsed.phase === "generating" ? "Generating…" : "On it…";
          setMessages((m) => [...m.slice(0, -1), { role: "agent", text: label }]);
        }
        if (parsed.event === "creative.done" && parsed.url) {
          finish({
            role: "agent",
            text: parsed.line ?? "",
            media: {
              kind: parsed.kind === "video" ? "video" : "image",
              url: parsed.url,
            },
          });
        }
        if (parsed.event === "creative.refused" || parsed.event === "creative.failed") {
          finish({
            role: "agent",
            text: parsed.line ?? "that one didn't come out. try again?",
          });
        }
      } catch {
        // non-JSON keepalive
      }
    };
    events.onerror = () => {
      finish({ role: "agent", text: "Connection lost — try again." });
    };
  }, []);

  const send = useCallback(async (textOverride?: string) => {
    const text = (textOverride ?? input).trim();
    // Staged uploads only ride the ordinary composer path, never overrides
    // (calendar/ads prefills).
    const attachments = textOverride
      ? []
      : staged.filter(
          (a): a is StagedAttachment & { path: string } =>
            typeof a.path === "string" && !a.uploading
        );
    if ((!text && attachments.length === 0) || busy) return;
    const viaVoice = voiceUsedRef.current;
    voiceUsedRef.current = false;
    setBusy(true);
    setInput("");
    if (!textOverride) setStaged([]);
    setActiveRunId(null);
    computerDismissedRef.current = false;
    // Re-arm the refresh guard so this run's first computer tool remounts the
    // iframe even if the dock was left open — the stream URL goes stale when
    // the box sleeps between runs (the token rotates on resume).
    computerAutoOpenedRef.current = false;
    const shownText =
      attachments.length > 0
        ? [text, ...attachments.map((a) => `\u{1F4CE} ${a.name}`)]
            .filter(Boolean)
            .join("\n")
        : text;
    setMessages((m) => [
      ...m,
      { role: "user", text: shownText },
      { role: "agent", text: "" },
    ]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: text,
          // Threads (spec §3): non-main threads name their Hermes session;
          // the main path stays byte-identical to before.
          ...(threadRef.current !== "air-main"
            ? { session: threadRef.current }
            : {}),
          ...(viaVoice ? { via: "voice" } : {}),
          ...(attachments.length > 0
            ? {
                attachments: attachments.map((a) => ({
                  path: a.path,
                  mime: a.mime,
                })),
              }
            : {}),
        }),
      });
      if (!res.ok) {
        const status = res.status;
        setMessages((m) => [
          ...m.slice(0, -1),
          {
            role: "agent",
            text:
              status === 429
                ? "My computer is busy starting up — try again in a minute."
                : status >= 500
                  ? "I couldn't reach my computer — it may still be waking up. Try again in a minute."
                  : "Something went wrong.",
          },
        ]);
        setBusy(false);
        return;
      }
      const payload = (await res.json()) as {
        run_id?: string;
        creative_job_id?: string;
        creative_line?: string;
        bot?: { name: string };
      };
      if (payload.creative_line) {
        // Deterministic clarification (e.g. mixed /imagine + /zap) — no run.
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: "agent", text: payload.creative_line ?? "" },
        ]);
        setBusy(false);
        return;
      }
      if (payload.creative_job_id) {
        followCreativeJob(payload.creative_job_id);
        return;
      }
      if (!payload.run_id) {
        setMessages((m) => [
          ...m.slice(0, -1),
          { role: "agent", text: "Something went wrong." },
        ]);
        setBusy(false);
        return;
      }
      const run_id = payload.run_id;
      // A delegated @mention run lives in the bot's profile; its events
      // stream through the profile-aware route with the bot's own key.
      const botName = payload.bot?.name;
      // Stop is wired for default-agent runs only — the stop relay
      // authenticates against the box's default profile.
      setActiveRunId(botName ? null : run_id);
      const events = new EventSource(
        botName
          ? `/api/bots/${botName}/chat/${run_id}/events`
          : `/api/chat/${run_id}/events`
      );
      eventsRef.current = events;
      let acc = "";
      // Replace a still-empty placeholder so a failed or empty run never
      // leaves a blank bubble behind.
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
            tool?: string;
          };
          if (parsed.event === "tool.started" && isComputerTool(parsed.tool)) {
            // The agent is driving its browser/desktop — expand the dock so
            // the user can watch or take over (logins, approvals) without
            // leaving Chat.
            if (!computerDismissedRef.current && !computerAutoOpenedRef.current) {
              computerAutoOpenedRef.current = true;
              // Fresh mount re-runs the authenticated redirect and picks up
              // a fresh stream URL (the token rotates with the box).
              setComputerEpoch((n) => n + 1);
              setDock("expanded");
            }
          }
          if (parsed.event === "message.delta" && parsed.delta) {
            acc += parsed.delta;
            setMessages((m) => [
              ...m.slice(0, -1),
              { role: "agent", text: acc, bot: botName },
            ]);
          }
          if (parsed.event === "run.completed") {
            if (!acc && parsed.output) {
              setMessages((m) => [
                ...m.slice(0, -1),
                { role: "agent", text: parsed.output ?? "", bot: botName },
              ]);
            } else if (!acc) {
              fillEmpty("(no reply)");
            }
            events.close();
            setBusy(false);
            setActiveRunId(null);
          }
          if (parsed.event === "run.failed") {
            fillEmpty("Something went wrong.");
            events.close();
            setBusy(false);
            setActiveRunId(null);
          }
        } catch {
          // non-JSON keepalive
        }
      };
      events.onerror = () => {
        fillEmpty("Connection lost — try again.");
        events.close();
        setBusy(false);
        setActiveRunId(null);
      };
    } catch {
      setMessages((m) => {
        const last = m[m.length - 1];
        if (last && last.role === "agent" && !last.text) {
          return [
            ...m.slice(0, -1),
            { role: "agent" as const, text: "Something went wrong." },
          ];
        }
        return m;
      });
      setBusy(false);
    }
  }, [input, busy, staged, followCreativeJob, setDock]);

  // V8: upload picked files into the box inbox; the send references them by
  // path (never bytes through Postgres).
  async function pickFiles(files: File[]) {
    // The 5-file cap is per message: /api/chat mints markers for at most 5.
    const room = Math.max(0, 5 - stagedCountRef.current);
    if (files.length > room) {
      setMessages((m) => [
        ...m,
        {
          role: "agent",
          text: "You can attach up to 5 files per message — the extras weren't added.",
        },
      ]);
    }
    for (const file of files.slice(0, room)) {
      const entry: StagedAttachment = { name: file.name, uploading: true };
      setStaged((s) => [...s, entry]);
      try {
        if (file.size === 0 || file.size > MAX_UPLOAD_BYTES) {
          throw new Error("too large");
        }
        // Chunked so each request stays under the platform body limit; the
        // route reassembles in the box inbox and answers with the final path.
        const total = Math.max(1, Math.ceil(file.size / UPLOAD_CHUNK_BYTES));
        let key = "";
        let data: { key?: string; path?: string } = {};
        for (let i = 0; i < total; i++) {
          const form = new FormData();
          form.append(
            "file",
            file.slice(
              i * UPLOAD_CHUNK_BYTES,
              (i + 1) * UPLOAD_CHUNK_BYTES,
              file.type
            ),
            file.name
          );
          form.append("index", String(i));
          form.append("total", String(total));
          if (i > 0) form.append("key", key);
          const res = await fetch("/api/chat/upload", {
            method: "POST",
            body: form,
          });
          if (!res.ok) throw new Error(String(res.status));
          data = (await res.json()) as { key?: string; path?: string };
          if (data.key) key = data.key;
        }
        setStaged((s) =>
          s.map((a) =>
            a === entry
              ? {
                  name: file.name,
                  path: data.path,
                  mime: file.type || "application/octet-stream",
                }
              : a
          )
        );
      } catch {
        setStaged((s) => s.filter((a) => a !== entry));
        setMessages((m) => [
          ...m,
          {
            role: "agent",
            text: `Couldn't upload ${file.name} — it may be too large (100 MB max) or the computer is still waking up.`,
          },
        ]);
      }
    }
  }

  // V8: relay the composer's stop to Hermes POST /v1/runs/{id}/stop.
  async function stopActiveRun() {
    if (!activeRunId) return;
    try {
      await fetch(`/api/chat/${activeRunId}/stop`, { method: "POST" });
    } catch {
      // The SSE stream ends (or errors) either way.
    }
    setActiveRunId(null);
  }

  async function copyMessage(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIdx(index);
      setTimeout(() => setCopiedIdx((c) => (c === index ? null : c)), 1500);
    } catch {
      // clipboard unavailable; text stays selectable
    }
  }

  async function saveTier(next: string) {
    setTier(next);
    await fetch("/api/settings/speed", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speed_tier: next }),
    });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  function newThread() {
    const id = `air-w${Date.now().toString(36)}`;
    setLocalThreads((t) => [{ id, title: "New thread" }, ...t]);
    setParams({ s: null, t: id });
  }

  function selectThread(id: string) {
    setParams({ s: null, t: id === "air-main" ? null : id });
  }

  // Spec §5: dock a mini-app in-chat via a signed link; fall back to a new
  // tab (shared launcher) when the mint fails.
  async function openAppInChat(slug: string) {
    setDockedAppNote(null);
    try {
      const res = await fetch("/api/mini/link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ app: slug }),
      });
      const data = res.ok
        ? ((await res.json().catch(() => ({}))) as { url?: string })
        : {};
      if (data.url) {
        setDockedApp({ slug, url: data.url });
        if (section !== "air.chat") navigate("air.chat");
        return;
      }
    } catch {
      // fall through to the new-tab fallback
    }
    const ok = await launchMiniApp({ app: slug });
    if (!ok) setDockedAppNote("Couldn't open that app.");
  }

  const onChat = section === "air.chat";

  return (
    <main className="mx-auto w-full max-w-[1100px] px-4 pb-8">
      <header className="flex flex-wrap items-center justify-between gap-3 py-4">
        <div className="flex items-center gap-2.5">
          <Orb size={22} label="air" />
          <h1 className="m-0 text-[19px] font-semibold tracking-[-0.02em]">air</h1>
        </div>
        <button className="btn btn-ghost !px-3 !py-1.5 !text-[12px]" onClick={logout}>
          Sign out
        </button>
      </header>

      <div className="grid gap-4 md:grid-cols-[150px_1fr_280px]">
        <HomeNav
          section={section}
          onNavigate={navigate}
          needsCount={needsCount}
          threads={threads}
          activeThread={thread}
          onSelectThread={selectThread}
          onNewThread={newThread}
          botsOpen={botsOpen}
          onToggleBots={() => setBotsOpen((open) => !open)}
        />

        <section className="panel relative flex h-[72vh] flex-col !p-4">
          <NeedsPanel
            active={section === "personal.needs"}
            onPendingCount={setNeedsCount}
          />
          <PeoplePanel active={section === "personal.people"} />
          <ConnectorsPanel active={section === "settings.connectors"} />
          <HistoryPanel active={section === "personal.history"} />
          <SkillsPanel active={section === "settings.skills"} />
          <WalletPanel
            active={section === "bank.wallet"}
            onOpenNeeds={() => navigate("personal.needs")}
          />
          <ProfilePanel
            active={section === "settings.profile"}
            me={me}
            onOpenWallet={() => navigate("bank.wallet")}
          />
          {section === "bank.vault" ? <VaultPanel active /> : null}
          {section === "apps.installed" ? <AppsPanel active /> : null}
          {section === "personal.calendar" ? (
            <CalendarPanel
              active
              prefill={calendarPrefill}
              onPrefillConsumed={() => setCalendarPrefill(null)}
              onAgentRun={(prompt) => {
                navigate("air.chat");
                if (busy) {
                  // A run is already streaming — stage the prompt instead.
                  setInput(prompt);
                } else {
                  void send(prompt);
                }
              }}
            />
          ) : null}
          {section === "apps.ads" ? (
            <AdsPanel
              active
              onAskAgent={(prefill) => {
                navigate("air.chat");
                setInput(prefill);
              }}
              onOpenQueue={() => navigate("personal.needs")}
            />
          ) : null}
          {onChat ? (
            <>
              <ComputerCard
                dock={dock}
                onDockChange={(next) => {
                  if (next !== "expanded") computerDismissedRef.current = true;
                  setDock(next);
                }}
                boxState={boxState}
                powerBusy={powerBusy}
                powerNote={powerNote}
                onPowerOn={(minutes) => void powerOn(minutes)}
                onPowerOff={() => void powerOff()}
                computerEpoch={computerEpoch}
                onSchedule={(playbook) => {
                  setCalendarPrefill({
                    name: playbook,
                    prompt: `Run the ${playbook} playbook: read and follow the ${playbook} skill.`,
                  });
                  navigate("personal.calendar");
                }}
              />
              <div
                ref={scrollRef}
                className="grid flex-1 content-start gap-2 overflow-y-auto pb-2"
              >
                {messages.length === 0 ? (
                  <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-center">
                    <Orb size={28} label="air" />
                    <p className="muted m-0 text-[13px]">
                      {historyLoading
                        ? "Syncing your conversation…"
                        : thread === "air-main"
                          ? "Talk to your agent — same one as on iMessage."
                          : "A fresh thread — same agent, separate conversation."}
                    </p>
                  </div>
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
                            : "justify-self-start bg-surface shadow-[0_0_0_0.5px_var(--ring)]")
                        }
                      >
                        {m.bot ? (
                          <div className="mb-1 flex items-center gap-1.5">
                            <DitherAvatar name={m.bot} size={16} />
                            <span className="muted text-[11px] font-medium">
                              @{m.bot}
                            </span>
                          </div>
                        ) : null}
                        {m.media ? (
                          <div className="mb-1.5 overflow-hidden rounded-lg">
                            {m.media.kind === "video" ? (
                              <video
                                src={m.media.url}
                                controls
                                playsInline
                                className="block max-h-80 w-full"
                              />
                            ) : (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={m.media.url}
                                alt="Generated image"
                                className="block max-h-80 w-full object-contain"
                              />
                            )}
                          </div>
                        ) : null}
                        {m.text}
                        {streaming ? (
                          <Orb
                            size={14}
                            label="Streaming…"
                            className="ml-1.5 align-middle"
                          />
                        ) : null}
                        {!streaming && m.text ? (
                          <button
                            type="button"
                            className={
                              "mt-1 block cursor-pointer border-0 bg-transparent p-0 text-[11px] underline decoration-dotted underline-offset-2 " +
                              (m.role === "user" ? "opacity-70" : "text-[var(--muted)]")
                            }
                            onClick={() => void copyMessage(i, m.text)}
                          >
                            {copiedIdx === i ? "Copied" : "Copy"}
                          </button>
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
              {dockedAppNote ? (
                <p className="muted m-0 mb-1 text-[12px]">{dockedAppNote}</p>
              ) : null}
              {dockedApp ? (
                <div className="mb-2 flex flex-col gap-2 rounded-xl bg-surface p-2 shadow-[0_0_0_0.5px_var(--ring)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="muted m-0 text-[12px]">{dockedApp.slug}</p>
                    <div className="flex shrink-0 items-center gap-1">
                      <button
                        className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                        onClick={() => void launchMiniApp({ app: dockedApp.slug })}
                      >
                        Open in new tab
                      </button>
                      <button
                        className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                        onClick={() => setDockedApp(null)}
                      >
                        Close
                      </button>
                    </div>
                  </div>
                  <iframe
                    src={dockedApp.url}
                    title={dockedApp.slug}
                    className="h-[320px] w-full rounded-lg border-0 bg-white"
                  />
                </div>
              ) : null}
              <PromptInput
                value={input}
                onChange={setInput}
                onSend={() => void send()}
                busy={busy}
                tier={tier}
                onTierChange={(next) => void saveTier(next)}
                tierModels={me?.entitlement?.tier_models}
                onVoiceTranscript={() => {
                  voiceUsedRef.current = true;
                }}
                botNames={botNames}
                attachments={staged}
                onPickFiles={(files) => void pickFiles(files)}
                onRemoveAttachment={(index) =>
                  setStaged((s) => s.filter((_, j) => j !== index))
                }
                stoppable={busy && activeRunId !== null}
                onStop={() => void stopActiveRun()}
              />
            </>
          ) : null}
          {botsOpen ? (
            <div className="absolute inset-y-0 right-0 z-10 flex w-full max-w-[420px] flex-col overflow-y-auto rounded-r-[inherit] bg-[var(--bg)] p-4 shadow-[-8px_0_24px_rgba(0,0,0,0.15),0_0_0_0.5px_var(--ring)]">
              <div className="mb-2 flex items-center justify-between">
                <h3 className="m-0 text-[15px] font-semibold">Bots</h3>
                <button
                  className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                  onClick={() => setBotsOpen(false)}
                >
                  Close
                </button>
              </div>
              <BotsPanel active={botsOpen} />
            </div>
          ) : null}
        </section>

        <aside className="grid content-start gap-4">
          <SpeedCard
            tier={tier}
            onTierChange={(next) => void saveTier(next)}
            entitlement={me?.entitlement ?? null}
          />
          <AppsGrid
            onOpenInChat={(slug) => void openAppInChat(slug)}
            onOpenAppsPanel={() => navigate("apps.installed")}
          />
        </aside>
      </div>
    </main>
  );
}
