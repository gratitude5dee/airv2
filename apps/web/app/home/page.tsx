"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { Orb } from "@/components/orb/Orb";
import { PromptInput } from "@/components/prompt-input/PromptInput";
import { AdsPanel } from "./ads-panel";
import { ScreenExtras } from "./screen-extras";
import { VaultPanel } from "./vault-panel";
import { BotsPanel } from "./bots-panel";
import { CalendarPanel } from "./calendar-panel";
import {
  BrowserHeader,
  BrowserPanels,
  useBrowserPanel,
} from "./browser-panel";
import { MAX_UPLOAD_BYTES, UPLOAD_CHUNK_BYTES } from "@/lib/chat/attachments";

// Loaded on demand so the main route doesn't pay for thirdweb/react unless
// the user opens Fund (goal.md M15 bundle budget).
const FundWidget = dynamic(() => import("@/components/wallet/FundWidget"), {
  ssr: false,
});

const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

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

interface SessionSummary {
  session_id?: string;
  id?: string;
  title?: string;
  platform?: string;
  updated_at?: string;
  created_at?: string;
  message_count?: number;
}

interface SkillSummary {
  name?: string;
  description?: string;
  enabled?: boolean;
}

interface Decision {
  id: string;
  kind: string;
  platform: string | null;
  sender: string | null;
  label: string | null;
  status?: string;
  created_at: string;
  resolved_at?: string | null;
  /** social_post: the exact text + target the agent proposes to publish. */
  payload?: ({ text?: string; target?: string } & Record<string, unknown>) | null;
}

interface DecisionDetail {
  decision: Decision;
  /** email_draft: the held draft body, read from AgentMail at view time. */
  draft?: { subject?: string; text?: string; to?: string[] } | null;
}

interface Sender {
  id: string;
  platform: string;
  address: string;
  trust_tier: number;
  first_seen: string;
  run_count?: number;
  blocked_at?: string | null;
  tier_changed_at?: string | null;
}

interface Toolkit {
  slug: string;
  name: string;
  logo: string | null;
}

interface Connection {
  toolkit: string;
  status: string;
  connected_at: string | null;
}

/** V8: per-connection health + "used by" hint, derived server-side. */
interface ConnectionHealth {
  toolkit: string;
  status: string;
  last_ok_at: string | null;
  used_by: string | null;
}

interface HubSkill {
  name: string;
  identifier: string;
  source: string;
  trust_level: string;
  description: string;
}

interface SkillUpdate {
  name: string;
  status: "up_to_date" | "update_available" | "unavailable";
}

interface SkillDetail {
  name: string;
  source: string | null;
  trust_level: string | null;
  identifier: string | null;
  installed_at: string | null;
  readme: string | null;
}

interface SuggestedSkill {
  name: string;
  description: string;
}

/** Detail sheet body shared by installed and suggested skill cards. */
function SkillDetailSheet({ detail }: { detail: SkillDetail | null }) {
  return (
    <div className="mt-2 border-t border-[var(--ring)] pt-2">
      {detail === null ? (
        <p className="muted m-0 text-[12px]">Loading details…</p>
      ) : (
        <>
          <p className="muted m-0 text-[11px]">
            {[
              detail.source,
              detail.trust_level,
              detail.installed_at
                ? `Installed ${new Date(
                    detail.installed_at
                  ).toLocaleDateString()}`
                : null,
            ]
              .filter(Boolean)
              .join(" \u00b7 ") || "Bundled skill"}
          </p>
          {detail.readme ? (
            <pre className="m-0 mt-2 max-h-56 overflow-y-auto whitespace-pre-wrap rounded-lg bg-surface-2 p-2 text-[11px] leading-relaxed">
              {detail.readme}
            </pre>
          ) : (
            <p className="muted m-0 mt-2 text-[12px]">
              No description file for this skill.
            </p>
          )}
        </>
      )}
    </div>
  );
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

interface TranscriptMessage {
  role: string;
  content: string;
}

const DECISION_KIND_LABELS: Record<string, string> = {
  email_draft: "Email draft awaiting send",
  calendar_add: "Calendar invite",
  run_approval: "Agent action awaiting approval",
  ad_write: "Ad spend awaiting approval",
  content_plan: "Content plan proposed",
  reconnect: "Account needs reconnecting",
  revise: "Post needs a revision",
  spend_divergence: "Ad spend diverged from budget",
  spend_ceiling: "Spend ceiling reached",
  social_post: "Social post awaiting approval",
  purchase_review: "Card fill awaiting approval",
  new_contact: "New contact",
};

function decisionKindLabel(kind: string): string {
  return DECISION_KIND_LABELS[kind] ?? "New contact";
}

/** History channel chips (V8): each maps to session platform values. */
const HISTORY_CHANNELS = ["imessage", "web", "schedule", "bot"] as const;
type HistoryChannel = (typeof HISTORY_CHANNELS)[number] | "all";

interface WalletSummary {
  address: string | null;
  chain_id?: number;
  native?: { symbol: string; display: string } | null;
  tokens?: { symbol: string; name: string; display: string; usd: null }[];
  degraded?: boolean;
  receive_qr?: string | null;
  updated_at?: string;
}

interface WalletTx {
  hash: string;
  direction: "in" | "out";
  counterparty: string;
  value_display: string;
  timestamp: string;
  explorer_url: string;
}

/** V8: a send intent from the transfer ledger — every send goes through a
 * Needs-you approval before anything moves. */
interface WalletTransfer {
  id: string;
  to_address: string;
  amount_display: string;
  status: "pending" | "submitting" | "submitted" | "denied" | "failed";
  created_at: string;
}

type Tab =
  | "chat"
  | "history"
  | "skills"
  | "needs"
  | "people"
  | "connectors"
  | "calendar"
  | "ads"
  | "wallet"
  | "vault"
  | "bots"
  | "computer";

/** Tolerantly extract a list from an API payload that may be a bare array,
 * a keyed object ({sessions}/{skills}/{data}/{items}), or a keyed map. */
function pickList<T>(payload: unknown, keys: string[]): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const record = payload as Record<string, unknown>;
    for (const key of keys) {
      const value = record[key];
      if (Array.isArray(value)) return value as T[];
    }
    for (const key of keys) {
      const value = record[key];
      if (value && typeof value === "object") {
        return Object.values(value as Record<string, unknown>) as T[];
      }
    }
  }
  return [];
}

/** Tool names that mean the agent is driving its own browser/desktop, so the
 * live computer view should surface inline in Chat. */
function isComputerTool(name: string | undefined): boolean {
  return (
    typeof name === "string" &&
    (name.startsWith("browser") || name.startsWith("computer"))
  );
}

const TABS: [Tab, string][] = [
  ["chat", "Chat"],
  ["needs", "Needs you"],
  ["history", "History"],
  ["people", "People"],
  ["skills", "Skills"],
  ["wallet", "Wallet"],
  ["computer", "Computer"],
  ["connectors", "Connectors"],
  ["calendar", "Calendar"],
  ["vault", "Vault"],
  ["bots", "Bots"],
  ["ads", "Ads"],
];

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tier, setTier] = useState("balanced");
  const [username, setUsername] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("chat");
  const [computerEpoch, setComputerEpoch] = useState(0);
  // V5: Computer splits into Screen/Browser subtabs. The desktop iframe is
  // owned by the tab (not the subtab), so switching never remounts it.
  const [computerView, setComputerView] = useState<"screen" | "browser">(
    "screen"
  );
  const [calendarPrefill, setCalendarPrefill] = useState<{
    name: string;
    prompt: string;
  } | null>(null);
  const browser = useBrowserPanel(
    tab === "computer" && computerView === "browser"
  );
  const [chatComputerOpen, setChatComputerOpen] = useState(false);
  const chatComputerOpenRef = useRef(false);
  // Once the user closes the inline view mid-run, don't pop it back open
  // until the next run starts using the computer again.
  const chatComputerDismissed = useRef(false);
  // True when any mic transcription landed in the composer since the last
  // send — those runs record agent_runs.trigger = 'voice' (M13).
  const voiceUsedRef = useRef(false);
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [skills, setSkills] = useState<SkillSummary[] | null>(null);
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [people, setPeople] = useState<Sender[] | null>(null);
  const [toolkits, setToolkits] = useState<Toolkit[] | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connHealth, setConnHealth] = useState<ConnectionHealth[]>([]);
  const [connectorBusy, setConnectorBusy] = useState<string | null>(null);
  const [connectorNote, setConnectorNote] = useState<string | null>(null);
  const [connectorFilter, setConnectorFilter] = useState("");
  const [panelNote, setPanelNote] = useState<string | null>(null);
  const [panelFailed, setPanelFailed] = useState(false);
  const panelLoadId = useRef(0);
  const [skillQuery, setSkillQuery] = useState("");
  const [hubResults, setHubResults] = useState<HubSkill[] | null>(null);
  const [hubNote, setHubNote] = useState<string | null>(null);
  const [skillBusy, setSkillBusy] = useState<string | null>(null);
  const [suggested, setSuggested] = useState<SuggestedSkill[]>([]);
  const [skillUpdates, setSkillUpdates] = useState<SkillUpdate[] | null>(null);
  const [updatesNote, setUpdatesNote] = useState<string | null>(null);
  const [skillDetail, setSkillDetail] = useState<SkillDetail | null>(null);
  const [skillDetailFor, setSkillDetailFor] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<string | null>(null);
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [walletTxs, setWalletTxs] = useState<WalletTx[] | null>(null);
  const [walletNote, setWalletNote] = useState<string | null>(null);
  const [walletCopied, setWalletCopied] = useState(false);
  const [walletReceiveOpen, setWalletReceiveOpen] = useState(false);
  const [walletFundOpen, setWalletFundOpen] = useState(false);
  const [walletTransfers, setWalletTransfers] = useState<WalletTransfer[]>([]);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);
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
  // V8 Needs you: pending/resolved view, detail drawer, batch send.
  const [needsView, setNeedsView] = useState<"pending" | "resolved">("pending");
  const [resolved, setResolved] = useState<Decision[] | null>(null);
  const [detail, setDetail] = useState<DecisionDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [batchBusy, setBatchBusy] = useState(false);
  // V8 History: title search, channel chips, transcript view, delete.
  const [historySearch, setHistorySearch] = useState("");
  const [historyChannel, setHistoryChannel] = useState<HistoryChannel>("all");
  const [openSessionId, setOpenSessionId] = useState<string | null>(null);
  const transcriptLoadId = useRef(0);
  const [transcript, setTranscript] = useState<TranscriptMessage[] | null>(null);
  const [transcriptNote, setTranscriptNote] = useState<string | null>(null);
  const [sessionBusy, setSessionBusy] = useState<string | null>(null);
  // V8 People: expandable sender detail + block.
  const [openSenderId, setOpenSenderId] = useState<string | null>(null);
  const [senderBusy, setSenderBusy] = useState<string | null>(null);
  const [senderNote, setSenderNote] = useState<string | null>(null);

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
      if (data.user.username) setUsername(data.user.username);
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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  // One conversation across every client: seed the pane with the shared
  // session's transcript (iMessage turns included). First load may wake the
  // box, so this stays best-effort and non-blocking.
  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const res = await fetch("/api/box/api/sessions/air-main/messages");
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
          setMessages((current) =>
            current.length === 0 ? transcript : current
          );
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
  }, []);

  // M16: follow a creative job's SSE stream and land the media inline.
  const followCreativeJob = useCallback((jobId: string) => {
    const events = new EventSource(`/api/creative/${jobId}/events`);
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
    chatComputerDismissed.current = false;
    // Re-arm the refresh guard so this run's first computer tool remounts the
    // iframe even if the panel was left open — the stream URL goes stale when
    // the box sleeps between runs (the token rotates on resume).
    chatComputerOpenRef.current = false;
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
            // The agent is driving its browser/desktop — surface the live view
            // inline so the user can watch or take over (logins, approvals)
            // without leaving Chat.
            if (!chatComputerDismissed.current && !chatComputerOpenRef.current) {
              chatComputerOpenRef.current = true;
              // Fresh mount re-runs the authenticated redirect and picks up
              // a fresh stream URL (the token rotates with the box).
              setComputerEpoch((n) => n + 1);
              setChatComputerOpen(true);
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
  }, [input, busy, staged, followCreativeJob]);

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
            file.slice(i * UPLOAD_CHUNK_BYTES, (i + 1) * UPLOAD_CHUNK_BYTES),
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
        setNote(null);
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

  async function saveUsername() {
    setNote(null);
    const res = await fetch("/api/settings/username", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username }),
    });
    const data = (await res.json().catch(() => ({}))) as {
      error?: string;
      eligible?: string | null;
    };
    if (res.ok) setNote("Username saved.");
    else if (data.error === "cooldown")
      setNote(`You can change it again on ${data.eligible ?? "a later date"}.`);
    else if (data.error === "taken") setNote("That username is taken.");
    else setNote("Invalid username.");
  }

  async function loadDecisions() {
    const res = await fetch("/api/decisions");
    if (res.ok) {
      const data = (await res.json()) as { decisions?: Decision[] };
      setDecisions(data.decisions ?? []);
    }
  }

  async function resolveDecision(id: string, action: "approve" | "dismiss") {
    setDecisionBusy(id);
    setDecisionNote(null);
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setDecisionNote(data.error ?? "That didn't go through — try again.");
      }
    } finally {
      setDecisionBusy(null);
    }
    setDetail((d) => (d?.decision.id === id ? null : d));
    setResolved(null);
    await loadDecisions();
  }

  // V8: the last 30 days of resolved decisions — receipts stay findable.
  async function loadResolved() {
    const res = await fetch("/api/decisions?status=resolved");
    if (res.ok) {
      const data = (await res.json()) as { decisions?: Decision[] };
      setResolved(data.decisions ?? []);
    } else {
      setResolved([]);
    }
  }

  // V8: decision detail drawer — full payload, plus the held email draft
  // body read from AgentMail at view time.
  async function openDecision(id: string) {
    setDetailLoading(true);
    setDetail(null);
    try {
      const res = await fetch(`/api/decisions/${id}`);
      if (res.ok) {
        setDetail((await res.json()) as DecisionDetail);
      } else {
        setDecisionNote("Couldn't load that decision — try again.");
      }
    } catch {
      setDecisionNote("Couldn't load that decision — try again.");
    } finally {
      setDetailLoading(false);
    }
  }

  // V8: batch-approve pending email drafts (tier-1 senders only — the
  // server re-checks both kind and tier per decision).
  async function batchSendDrafts(ids: string[]) {
    if (ids.length === 0) return;
    setBatchBusy(true);
    setDecisionNote(null);
    try {
      const res = await fetch("/api/decisions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids, action: "approve" }),
      });
      if (res.ok) {
        const data = (await res.json()) as {
          approved?: string[];
          skipped?: { id: string; reason: string }[];
        };
        const sent = data.approved?.length ?? 0;
        const skippedRows = data.skipped ?? [];
        const overLimit = skippedRows.filter(
          (s) => s.reason === "batch limit reached"
        ).length;
        const otherSkipped = skippedRows.length - overLimit;
        const parts = [`Sent ${sent} draft${sent === 1 ? "" : "s"}`];
        if (overLimit > 0) {
          parts.push(
            `${overLimit} still pending (batches send 20 at a time — press again for the rest)`
          );
        }
        if (otherSkipped > 0) {
          parts.push(
            `${otherSkipped} skipped (unknown senders or already resolved stay one-at-a-time)`
          );
        }
        setDecisionNote(`${parts.join(" — ")}.`);
      } else {
        setDecisionNote("Batch send didn't go through — try again.");
      }
    } catch {
      setDecisionNote("Batch send didn't go through — try again.");
    } finally {
      setBatchBusy(false);
    }
    setResolved(null);
    await loadDecisions();
  }

  async function loadPeople() {
    const res = await fetch("/api/senders");
    if (res.ok) {
      const data = (await res.json()) as { senders?: Sender[] };
      setPeople(data.senders ?? []);
    }
  }

  async function setTrust(id: string, trustTier: number) {
    await fetch("/api/senders", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, trust_tier: trustTier }),
    });
    await loadPeople();
  }

  // V8: block an email sender — mirrored server-side to AgentMail's
  // receive-block list (the enforcement layer).
  async function setBlocked(id: string, blocked: boolean) {
    setSenderBusy(id);
    setSenderNote(null);
    try {
      const res = await fetch("/api/senders", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, blocked }),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setSenderNote(data.error ?? "That didn't go through — try again.");
      }
    } catch {
      setSenderNote("That didn't go through — try again.");
    } finally {
      setSenderBusy(null);
    }
    await loadPeople();
  }

  // V8 History: read-only transcript for one session, through the exact
  // allowlisted /api/box/api/sessions/{id}/messages path.
  async function openSession(id: string) {
    const loadId = ++transcriptLoadId.current;
    setOpenSessionId(id);
    setTranscript(null);
    setTranscriptNote("Loading transcript…");
    try {
      const res = await fetch(
        `/api/box/api/sessions/${encodeURIComponent(id)}/messages`
      );
      if (loadId !== transcriptLoadId.current) return;
      if (res.ok) {
        const list = pickList<{ role?: string; content?: string }>(
          await res.json(),
          ["data", "messages", "items"]
        );
        if (loadId !== transcriptLoadId.current) return;
        setTranscript(
          list
            .filter(
              (m) =>
                (m.role === "user" || m.role === "assistant") &&
                typeof m.content === "string" &&
                m.content.trim() !== ""
            )
            .map((m) => ({
              role: m.role === "user" ? "user" : "agent",
              content: (m.content ?? "").trim(),
            }))
        );
        setTranscriptNote(null);
      } else {
        setTranscriptNote(boxErrorNote(res.status, "the transcript"));
      }
    } catch {
      if (loadId !== transcriptLoadId.current) return;
      setTranscriptNote("Couldn't load the transcript — try again shortly.");
    }
  }

  async function deleteSession(id: string) {
    setSessionBusy(id);
    try {
      const res = await fetch(
        `/api/box/api/sessions/${encodeURIComponent(id)}`,
        { method: "DELETE" }
      );
      if (res.ok) {
        setSessions((s) =>
          (s ?? []).filter((row) => (row.session_id ?? row.id) !== id)
        );
        if (openSessionId === id) {
          setOpenSessionId(null);
          setTranscript(null);
        }
      } else {
        setPanelNote(boxErrorNote(res.status, "that conversation"));
      }
    } catch {
      setPanelNote("Couldn't delete — try again shortly.");
    } finally {
      setSessionBusy(null);
    }
  }

  async function loadConnectors() {
    const res = await fetch("/api/connectors");
    if (res.ok) {
      const data = (await res.json()) as {
        toolkits?: Toolkit[];
        connections?: Connection[];
        health?: ConnectionHealth[];
      };
      setToolkits(data.toolkits ?? []);
      setConnections(data.connections ?? []);
      setConnHealth(data.health ?? []);
    }
    // Sync statuses (picks up OAuth flows completed since last visit).
    const sync = await fetch("/api/connectors", { method: "PUT" });
    if (sync.ok) {
      const data = (await sync.json()) as { connections?: Connection[] };
      setConnections(data.connections ?? []);
    }
  }

  async function disconnectToolkit(toolkit: string) {
    setConnectorBusy(toolkit);
    setConnectorNote(null);
    try {
      const res = await fetch("/api/connectors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit }),
      });
      if (res.ok) {
        setConnections((rows) =>
          rows.map((c) =>
            c.toolkit === toolkit ? { ...c, status: "revoked" } : c
          )
        );
      } else {
        setConnectorNote("Couldn't disconnect — try again shortly.");
      }
    } catch {
      setConnectorNote("Couldn't disconnect — try again shortly.");
    } finally {
      setConnectorBusy(null);
    }
  }

  async function connectToolkit(slug: string) {
    const res = await fetch("/api/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolkit: slug }),
    });
    if (res.ok) {
      const data = (await res.json()) as { redirect_url?: string };
      if (data.redirect_url) window.location.href = data.redirect_url;
    }
  }

  function boxErrorNote(status: number, what: string): string {
    if (status === 429)
      return "Your agent's computer is busy starting up — retry in a minute.";
    if (status === 502)
      return "Couldn't reach your agent's computer — it may still be waking up.";
    return `Couldn't load ${what} — try again shortly.`;
  }

  async function loadWallet() {
    setWalletNote(null);
    try {
      const [summaryRes, activityRes] = await Promise.all([
        fetch("/api/wallet"),
        fetch("/api/wallet/activity"),
      ]);
      if (summaryRes.ok) {
        setWallet((await summaryRes.json()) as WalletSummary);
      } else {
        setWalletNote("Couldn't load your wallet — try again shortly.");
      }
      if (activityRes.ok) {
        const data = (await activityRes.json()) as {
          transactions?: WalletTx[];
          transfers?: WalletTransfer[];
        };
        setWalletTxs(data.transactions ?? []);
        setWalletTransfers(data.transfers ?? []);
      } else {
        setWalletTxs([]);
      }
    } catch {
      setWalletNote("Couldn't load your wallet — try again shortly.");
    }
  }

  async function submitSend() {
    const to = sendTo.trim();
    const amount = sendAmount.trim();
    if (!to || !amount) return;
    setSendBusy(true);
    setSendNote(null);
    try {
      const res = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, amount }),
      });
      if (res.ok) {
        setSendTo("");
        setSendAmount("");
        setSendNote(
          "Send requested — approve it in Needs you before anything moves."
        );
        await loadWallet();
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setSendNote(data.error ?? "Couldn't request the send — try again.");
      }
    } catch {
      setSendNote("Couldn't request the send — try again shortly.");
    } finally {
      setSendBusy(false);
    }
  }

  async function copyWalletAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setWalletCopied(true);
      setTimeout(() => setWalletCopied(false), 1500);
    } catch {
      // clipboard unavailable; the address is selectable text
    }
  }

  async function loadHistory() {
    const loadId = ++panelLoadId.current;
    setPanelFailed(false);
    setPanelNote("Waking your agent… this can take a minute if it was asleep.");
    try {
      const res = await fetch("/api/box/api/sessions?limit=30");
      if (res.ok) {
        const list = pickList<SessionSummary>(await res.json(), ["sessions", "data", "items"]);
        if (loadId !== panelLoadId.current) return;
        setSessions(list);
        setPanelNote(null);
      } else {
        if (loadId !== panelLoadId.current) return;
        setPanelNote(boxErrorNote(res.status, "history"));
        setPanelFailed(true);
      }
    } catch {
      if (loadId !== panelLoadId.current) return;
      setPanelNote("Couldn't load history — try again shortly.");
      setPanelFailed(true);
    }
  }

  async function loadInstalledSkills() {
    const loadId = ++panelLoadId.current;
    setPanelFailed(false);
    setPanelNote("Waking your agent… this can take a minute if it was asleep.");
    try {
      const res = await fetch("/api/box/v1/skills");
      if (res.ok) {
        const list = pickList<SkillSummary>(await res.json(), ["skills", "data", "items"]);
        if (loadId !== panelLoadId.current) return;
        setSkills(list);
        setPanelNote(null);
      } else {
        if (loadId !== panelLoadId.current) return;
        setPanelNote(boxErrorNote(res.status, "skills"));
        setPanelFailed(true);
      }
    } catch {
      if (loadId !== panelLoadId.current) return;
      setPanelNote("Couldn't load skills — try again shortly.");
      setPanelFailed(true);
    }
  }

  async function loadTab(next: Tab) {
    setTab(next);
    if (next === "computer") {
      // Remount the iframe so each visit re-runs the authenticated redirect
      // and picks up a fresh stream URL (the token rotates with the box).
      setComputerEpoch((n) => n + 1);
    }
    panelLoadId.current++;
    setPanelNote(null);
    setPanelFailed(false);
    if (next === "history" && sessions === null) {
      await loadHistory();
    }
    if (next === "needs") {
      await loadDecisions();
    }
    if (next === "people") {
      await loadPeople();
    }
    if (next === "connectors" && toolkits === null) {
      await loadConnectors();
    }
    if (next === "skills" && skills === null) {
      void loadSuggested();
      await loadInstalledSkills();
    }
    if (next === "wallet" && wallet === null) {
      await loadWallet();
    }
  }

  async function refreshSkills() {
    const res = await fetch("/api/box/v1/skills");
    if (res.ok) {
      setSkills(pickList<SkillSummary>(await res.json(), ["skills", "data", "items"]));
    }
  }

  async function loadSuggested() {
    try {
      const res = await fetch("/api/skills?suggested=1");
      if (res.ok) {
        const data = (await res.json()) as { suggested?: SuggestedSkill[] };
        setSuggested(data.suggested ?? []);
      }
    } catch {
      // suggestion row is optional
    }
  }

  async function checkSkillUpdates() {
    setUpdatesNote("Checking for updates…");
    setSkillUpdates(null);
    try {
      const res = await fetch("/api/skills?updates=1");
      if (res.ok) {
        const data = (await res.json()) as { updates?: SkillUpdate[] };
        setSkillUpdates(data.updates ?? []);
        setUpdatesNote(null);
      } else {
        setUpdatesNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Update check failed — try again shortly."
        );
      }
    } catch {
      setUpdatesNote("Update check failed — try again shortly.");
    }
  }

  async function updateHubSkill(name: string) {
    setSkillBusy(name);
    setUpdatesNote(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update", name }),
      });
      if (res.ok) {
        setSkillUpdates(
          (rows) =>
            rows?.map((u) =>
              u.name === name ? { ...u, status: "up_to_date" as const } : u
            ) ?? null
        );
        await refreshSkills();
      } else {
        setUpdatesNote("Update failed — try again shortly.");
      }
    } catch {
      setUpdatesNote("Update failed — try again shortly.");
    } finally {
      setSkillBusy(null);
    }
  }

  async function openSkillDetail(name: string) {
    if (skillDetailFor === name) {
      setSkillDetailFor(null);
      setSkillDetail(null);
      return;
    }
    setSkillDetailFor(name);
    setSkillDetail(null);
    try {
      const res = await fetch(`/api/skills?detail=${encodeURIComponent(name)}`);
      if (res.ok) {
        const data = (await res.json()) as { skill?: SkillDetail };
        setSkillDetail(data.skill ?? null);
      }
    } catch {
      // the sheet shows a fallback when detail is null
    }
  }

  async function searchSkillHub() {
    const q = skillQuery.trim();
    if (!q) return;
    setHubNote("Searching skill registries…");
    setHubResults(null);
    try {
      const res = await fetch(`/api/skills?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as { results?: HubSkill[] };
        setHubResults(data.results ?? []);
        setHubNote(null);
      } else {
        setHubNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Search failed — try again shortly."
        );
      }
    } catch {
      setHubNote("Search failed — try again shortly.");
    }
  }

  async function installHubSkill(identifier: string) {
    setSkillBusy(identifier);
    setHubNote(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "install", identifier }),
      });
      if (res.ok) {
        setHubNote("Installed.");
        await refreshSkills();
      } else {
        setHubNote("Install failed — try again shortly.");
      }
    } catch {
      setHubNote("Install failed — try again shortly.");
    } finally {
      setSkillBusy(null);
    }
  }

  async function uninstallHubSkill(name: string) {
    setSkillBusy(name);
    setHubNote(null);
    try {
      const res = await fetch("/api/skills", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "uninstall", name }),
      });
      if (res.ok) {
        await refreshSkills();
      } else {
        setHubNote("Remove failed — it may be a bundled skill.");
      }
    } catch {
      setHubNote("Remove failed — try again shortly.");
    } finally {
      setSkillBusy(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  const spendPct = me?.entitlement
    ? Math.min(
        100,
        (Number(me.entitlement.spend_mtd_usd) /
          Math.max(1e-9, Number(me.entitlement.monthly_cap_usd))) *
          100
      )
    : 0;

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
        <nav
          className="flex h-fit flex-row flex-wrap gap-1 rounded-2xl p-1.5 shadow-[0_0_0_0.5px_var(--ring)] md:flex-col md:rounded-[20px]"
          aria-label="Sections"
        >
          {TABS.map(([key, label]) => (
            <button
              key={key}
              aria-current={tab === key ? "page" : undefined}
              className={"seg" + (tab === key ? " pill-active" : "")}
              onClick={() => void loadTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="panel flex h-[72vh] flex-col !p-4">
          {tab === "needs" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <div className="flex items-center justify-between gap-2">
                <h3 className="m-0 text-[15px] font-semibold">Needs you</h3>
                <div className="flex items-center gap-1">
                  {(["pending", "resolved"] as const).map((view) => (
                    <button
                      key={view}
                      className={
                        "seg !px-3 !py-1 !text-[12px]" +
                        (needsView === view ? " pill-active" : "")
                      }
                      aria-current={needsView === view ? "page" : undefined}
                      onClick={() => {
                        setNeedsView(view);
                        if (view === "resolved" && resolved === null) {
                          void loadResolved();
                        }
                      }}
                    >
                      {view === "pending" ? "Pending" : "Last 30 days"}
                    </button>
                  ))}
                </div>
              </div>
              {decisionNote ? (
                <p className="muted m-0 text-[12px]">{decisionNote}</p>
              ) : null}
              {detailLoading ? (
                <div className="py-1">
                  <Orb pill label="Loading details…" />
                </div>
              ) : null}
              {detail ? (
                <div className="panel rise-in !p-3">
                  <div className="flex items-start justify-between gap-2">
                    <strong className="text-[13px]">
                      {decisionKindLabel(detail.decision.kind)}
                    </strong>
                    <button
                      className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                      onClick={() => setDetail(null)}
                    >
                      Close
                    </button>
                  </div>
                  <p className="muted m-0 mt-1 text-[12px]">
                    {[
                      detail.decision.label,
                      detail.decision.sender,
                      detail.decision.platform,
                      new Date(detail.decision.created_at).toLocaleString(),
                    ]
                      .filter(Boolean)
                      .join(" \u00b7 ")}
                  </p>
                  {detail.draft ? (
                    <div className="mt-2 rounded-lg bg-surface-2 p-2">
                      {detail.draft.to && detail.draft.to.length > 0 ? (
                        <p className="muted m-0 break-all text-[11px]">
                          To: {detail.draft.to.join(", ")}
                        </p>
                      ) : null}
                      {detail.draft.subject ? (
                        <p className="m-0 mt-1 text-[13px] font-medium">
                          {detail.draft.subject}
                        </p>
                      ) : null}
                      {detail.draft.text ? (
                        <p className="m-0 mt-1 whitespace-pre-wrap text-[13px]">
                          {detail.draft.text}
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                  {detail.decision.payload &&
                  Object.keys(detail.decision.payload).length > 0 ? (
                    <div className="mt-2 rounded-lg bg-surface-2 p-2">
                      {Object.entries(detail.decision.payload).map(([k, v]) => (
                        <p
                          key={k}
                          className="m-0 whitespace-pre-wrap break-all text-[12px]"
                        >
                          <span className="muted">{k}: </span>
                          {typeof v === "string" ? v : JSON.stringify(v)}
                        </p>
                      ))}
                    </div>
                  ) : null}
                  {detail.decision.status === "pending" ? (
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn !px-3 !py-1.5 !text-[12px]"
                        disabled={decisionBusy !== null}
                        onClick={() =>
                          void resolveDecision(detail.decision.id, "approve")
                        }
                      >
                        {decisionBusy === detail.decision.id
                          ? "Working\u2026"
                          : "Approve"}
                      </button>
                      <button
                        className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                        disabled={decisionBusy !== null}
                        onClick={() =>
                          void resolveDecision(detail.decision.id, "dismiss")
                        }
                      >
                        Dismiss
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
              {needsView === "resolved" ? (
                <>
                  {(resolved ?? []).map((d) => (
                    <div key={d.id} className="panel rise-in !p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <strong className="text-[13px]">
                            {decisionKindLabel(d.kind)}
                          </strong>
                          <p className="muted m-0 mt-1 text-[12px]">
                            {[
                              d.status === "approved" ? "Approved" : "Dismissed",
                              d.label,
                              d.sender,
                              d.resolved_at
                                ? new Date(d.resolved_at).toLocaleString()
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" \u00b7 ")}
                          </p>
                        </div>
                        <button
                          className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                          onClick={() => void openDecision(d.id)}
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  ))}
                  {resolved !== null && resolved.length === 0 ? (
                    <p className="muted text-[13px]">
                      Nothing resolved in the last 30 days.
                    </p>
                  ) : null}
                </>
              ) : (
                (() => {
                  // Group pending decisions by kind, with counts (V8).
                  const groups = new Map<string, Decision[]>();
                  for (const d of decisions ?? []) {
                    const list = groups.get(d.kind) ?? [];
                    list.push(d);
                    groups.set(d.kind, list);
                  }
                  return (
                    <>
                      {Array.from(groups.entries()).map(([kind, list]) => (
                        <div key={kind} className="grid gap-2">
                          <div className="flex items-center justify-between gap-2">
                            <p className="muted m-0 text-[12px] font-medium">
                              {decisionKindLabel(kind)} · {list.length}
                            </p>
                            {kind === "email_draft" && list.length > 1 ? (
                              <button
                                className="btn !px-3 !py-1.5 !text-[12px]"
                                disabled={batchBusy || decisionBusy !== null}
                                title="Sends drafts whose counterparty is a known sender; the rest stay individual."
                                onClick={() =>
                                  void batchSendDrafts(list.map((d) => d.id))
                                }
                              >
                                {batchBusy
                                  ? "Sending\u2026"
                                  : `Send all (${list.length})`}
                              </button>
                            ) : null}
                          </div>
                          {list.map((d) => (
                            <div
                              key={d.id}
                              className={
                                "panel rise-in !p-3" +
                                (d.kind === "calendar_add"
                                  ? " !shadow-none border border-dashed border-[var(--muted)]"
                                  : "")
                              }
                            >
                              <strong className="text-[13px]">
                                {decisionKindLabel(d.kind)}
                              </strong>
                              <p className="muted mb-2 mt-1 text-[12px]">
                                {[d.label, d.sender, d.platform]
                                  .filter(Boolean)
                                  .join(" \u00b7 ")}
                              </p>
                              {d.kind === "social_post" && d.payload?.text ? (
                                <div className="mb-2 rounded-lg bg-surface-2 p-2">
                                  <p className="m-0 whitespace-pre-wrap text-[13px]">
                                    {d.payload.text}
                                  </p>
                                  {d.payload.target ? (
                                    <p className="muted m-0 mt-1 break-all text-[11px]">
                                      → {d.payload.target}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}
                              <div className="flex gap-2">
                                {[
                                  "email_draft",
                                  "ad_write",
                                  "content_plan",
                                  "reconnect",
                                  "revise",
                                  "calendar_add",
                                  "social_post",
                                  "purchase_review",
                                ].includes(d.kind) ? (
                                  <button
                                    className="btn !px-3 !py-1.5 !text-[12px]"
                                    disabled={decisionBusy !== null}
                                    onClick={() =>
                                      void resolveDecision(d.id, "approve")
                                    }
                                  >
                                    {decisionBusy === d.id
                                      ? "Working\u2026"
                                      : d.kind === "email_draft"
                                        ? "Send"
                                        : d.kind === "content_plan"
                                          ? "Approve plan"
                                          : d.kind === "calendar_add"
                                            ? "Add to calendar"
                                            : d.kind === "reconnect" ||
                                                d.kind === "revise"
                                              ? "Retry"
                                              : d.kind === "social_post"
                                                ? "Post it"
                                                : d.kind === "purchase_review"
                                                  ? "Fill card"
                                                  : "Approve"}
                                  </button>
                                ) : null}
                                <button
                                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                                  disabled={decisionBusy !== null}
                                  onClick={() =>
                                    void resolveDecision(d.id, "dismiss")
                                  }
                                >
                                  Dismiss
                                </button>
                                <button
                                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                                  onClick={() => void openDecision(d.id)}
                                >
                                  Details
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ))}
                      {decisions !== null && decisions.length === 0 ? (
                        <p className="muted text-[13px]">
                          Nothing needs you right now.
                        </p>
                      ) : null}
                    </>
                  );
                })()
              )}
            </div>
          ) : tab === "people" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <h3 className="m-0 text-[15px] font-semibold">People</h3>
              <p className="muted m-0 text-[12px]">
                Known senders can talk to your agent; unknown senders wait in
                “Needs you”.
              </p>
              {senderNote ? (
                <p className="muted m-0 text-[12px]">{senderNote}</p>
              ) : null}
              {(people ?? []).map((s) => (
                <div key={s.id} className="panel rise-in !p-3">
                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      className="flex cursor-pointer items-center gap-3 border-0 bg-transparent p-0 text-left"
                      onClick={() =>
                        setOpenSenderId((open) => (open === s.id ? null : s.id))
                      }
                      aria-expanded={openSenderId === s.id}
                    >
                      <div className="h-8 w-8 overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
                        <DitherAvatar name={s.address} size={32} />
                      </div>
                      <div>
                        <strong className="text-[13px]">{s.address}</strong>
                        <p className="muted m-0 mt-0.5 text-[12px]">
                          {[
                            s.platform,
                            s.blocked_at
                              ? "blocked"
                              : s.trust_tier === 1
                                ? "known"
                                : "unknown",
                            s.run_count != null
                              ? `${s.run_count} message${s.run_count === 1 ? "" : "s"}`
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                    </button>
                    {s.trust_tier === 2 ? (
                      <button
                        className="btn !px-3 !py-1.5 !text-[12px]"
                        onClick={() => void setTrust(s.id, 1)}
                      >
                        Mark known
                      </button>
                    ) : (
                      <button
                        className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                        onClick={() => void setTrust(s.id, 2)}
                      >
                        Mark unknown
                      </button>
                    )}
                  </div>
                  {openSenderId === s.id ? (
                    <div className="mt-2 border-t border-[var(--ring)] pt-2">
                      <p className="muted m-0 text-[12px]">
                        First seen {new Date(s.first_seen).toLocaleDateString()}
                        {s.run_count != null
                          ? ` · ${s.run_count} message${s.run_count === 1 ? "" : "s"} handled`
                          : ""}
                      </p>
                      {s.tier_changed_at ? (
                        <p className="muted m-0 mt-1 text-[12px]">
                          {s.trust_tier === 1
                            ? "Promoted to known"
                            : "Marked unknown"}{" "}
                          {new Date(s.tier_changed_at).toLocaleString()}
                        </p>
                      ) : null}
                      {s.blocked_at ? (
                        <p className="muted m-0 mt-1 text-[12px]">
                          Blocked {new Date(s.blocked_at).toLocaleString()} —
                          their email is refused before your agent sees it.
                        </p>
                      ) : null}
                      {s.platform === "email" ? (
                        <div className="mt-2">
                          <button
                            className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                            disabled={senderBusy !== null}
                            onClick={() => void setBlocked(s.id, !s.blocked_at)}
                          >
                            {senderBusy === s.id
                              ? "Working…"
                              : s.blocked_at
                                ? "Unblock"
                                : "Block sender"}
                          </button>
                        </div>
                      ) : (
                        <p className="muted m-0 mt-1 text-[11px]">
                          Blocking applies to email senders.
                        </p>
                      )}
                    </div>
                  ) : null}
                </div>
              ))}
              {people !== null && people.length === 0 ? (
                <p className="muted text-[13px]">
                  No one has messaged your agent yet.
                </p>
              ) : null}
            </div>
          ) : tab === "connectors" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <h3 className="m-0 text-[15px] font-semibold">Connectors</h3>
              <p className="muted m-0 text-[12px]">
                Connect your accounts so your agent can act on them. You approve
                each one.
              </p>
              <input
                className="input"
                placeholder="Search connectors…"
                value={connectorFilter}
                onChange={(e) => setConnectorFilter(e.target.value)}
              />
              {connectorNote ? (
                <p className="muted m-0 text-[12px]">{connectorNote}</p>
              ) : null}
              {connections.length > 0 ? (
                <div className="grid gap-2">
                  {connections.map((c) => {
                    const health = connHealth.find(
                      (h) => h.toolkit === c.toolkit
                    );
                    return (
                      <div key={c.toolkit} className="panel !p-3">
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="text-[13px]">{c.toolkit}</strong>
                            <p className="muted m-0 mt-0.5 text-[11px]">
                              {[
                                health?.used_by
                                  ? `Used by ${health.used_by}`
                                  : null,
                                health?.last_ok_at
                                  ? `Last OK ${new Date(
                                      health.last_ok_at
                                    ).toLocaleDateString()}`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(" \u00b7 ")}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span
                              className={
                                "text-[12px] " +
                                (c.status === "active"
                                  ? "text-[var(--success)]"
                                  : c.status === "error"
                                    ? "text-[var(--warning)]"
                                    : "muted")
                              }
                            >
                              {c.status}
                            </span>
                            {c.status === "active" || c.status === "error" ? (
                              <button
                                className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                                disabled={connectorBusy !== null}
                                onClick={() =>
                                  void disconnectToolkit(c.toolkit)
                                }
                              >
                                {connectorBusy === c.toolkit
                                  ? "Disconnecting…"
                                  : "Disconnect"}
                              </button>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : null}
              {(toolkits ?? [])
                .filter(
                  (t) =>
                    !connectorFilter ||
                    t.name.toLowerCase().includes(connectorFilter.toLowerCase()) ||
                    t.slug.includes(connectorFilter.toLowerCase())
                )
                .slice(0, 40)
                .map((t) => (
                  <div
                    key={t.slug}
                    className="panel rise-in flex items-center justify-between !p-3"
                  >
                    <div className="flex items-center gap-2">
                      {t.logo ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={t.logo}
                          alt=""
                          width={20}
                          height={20}
                          className="rounded"
                        />
                      ) : null}
                      <strong className="text-[13px]">{t.name}</strong>
                    </div>
                    {connections.some(
                      (c) => c.toolkit === t.slug && c.status === "active"
                    ) ? (
                      <span className="muted text-[12px]">connected</span>
                    ) : (
                      <button
                        className="btn !px-3 !py-1.5 !text-[12px]"
                        onClick={() => void connectToolkit(t.slug)}
                      >
                        Connect
                      </button>
                    )}
                  </div>
                ))}
              {toolkits === null ? (
                <div className="py-2">
                  <Orb pill label="Loading connectors…" />
                </div>
              ) : null}
            </div>
          ) : tab === "history" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <h3 className="m-0 text-[15px] font-semibold">Conversations</h3>
              <input
                className="input !py-1.5 !text-[13px]"
                placeholder="Search titles…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                aria-label="Search conversations by title"
              />
              <div className="flex flex-wrap items-center gap-1">
                {(["all", ...HISTORY_CHANNELS] as const).map((channel) => (
                  <button
                    key={channel}
                    className={
                      "seg !px-3 !py-1 !text-[12px]" +
                      (historyChannel === channel ? " pill-active" : "")
                    }
                    aria-pressed={historyChannel === channel}
                    onClick={() => setHistoryChannel(channel)}
                  >
                    {channel === "all" ? "All" : channel}
                  </button>
                ))}
              </div>
              {panelNote ? (
                <div className="flex items-center gap-2 py-1">
                  <Orb pill label={panelNote} />
                  {panelFailed ? (
                    <button
                      className="btn !px-3 !py-1.5 !text-[12px]"
                      onClick={() => void loadHistory()}
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
              {(sessions ?? [])
                .filter((s) => {
                  const q = historySearch.trim().toLowerCase();
                  if (q && !(s.title ?? "").toLowerCase().includes(q)) {
                    return false;
                  }
                  if (historyChannel !== "all") {
                    return (s.platform ?? "").toLowerCase() === historyChannel;
                  }
                  return true;
                })
                .map((s, i) => {
                  const sid = s.session_id ?? s.id;
                  const open = sid != null && openSessionId === sid;
                  return (
                    <div key={sid ?? i} className="panel rise-in !p-3">
                      <div className="flex items-start justify-between gap-2">
                        <button
                          type="button"
                          className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left"
                          disabled={sid == null}
                          aria-expanded={open}
                          onClick={() => {
                            if (sid == null) return;
                            if (open) {
                              setOpenSessionId(null);
                              setTranscript(null);
                              setTranscriptNote(null);
                            } else {
                              void openSession(sid);
                            }
                          }}
                        >
                          <strong className="text-[13px]">
                            {s.title ?? "Untitled"}
                          </strong>
                          <p className="muted m-0 mt-1 text-[12px]">
                            {[
                              s.platform,
                              s.updated_at ?? s.created_at,
                              s.message_count != null
                                ? `${s.message_count} messages`
                                : null,
                            ]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        </button>
                        {sid != null ? (
                          <button
                            className="btn btn-ghost shrink-0 !px-2.5 !py-1 !text-[12px]"
                            disabled={sessionBusy !== null}
                            onClick={() => void deleteSession(sid)}
                          >
                            {sessionBusy === sid ? "Deleting…" : "Delete"}
                          </button>
                        ) : null}
                      </div>
                      {open ? (
                        <div className="mt-2 grid max-h-72 gap-1.5 overflow-y-auto border-t border-[var(--ring)] pt-2">
                          {transcriptNote ? (
                            <Orb pill label={transcriptNote} />
                          ) : null}
                          {(transcript ?? []).map((m, j) => (
                            <div
                              key={j}
                              className={
                                "max-w-[90%] whitespace-pre-wrap rounded-lg px-2.5 py-1.5 text-[12px] leading-relaxed " +
                                (m.role === "user"
                                  ? "justify-self-end bg-[var(--text)] text-[var(--bg)]"
                                  : "justify-self-start bg-surface-2")
                              }
                            >
                              {m.content}
                            </div>
                          ))}
                          {transcript !== null && transcript.length === 0 ? (
                            <p className="muted m-0 text-[12px]">
                              No messages in this conversation.
                            </p>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              {sessions !== null && sessions.length === 0 ? (
                <p className="muted text-[13px]">No conversations yet.</p>
              ) : null}
            </div>
          ) : tab === "skills" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <h3 className="m-0 text-[15px] font-semibold">Skills</h3>
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void searchSkillHub();
                }}
              >
                <input
                  className="input flex-1 !py-1.5 !text-[13px]"
                  placeholder="Search the skill hub…"
                  value={skillQuery}
                  onChange={(e) => setSkillQuery(e.target.value)}
                  aria-label="Search skills"
                />
                <button
                  type="submit"
                  className="btn !px-3 !py-1.5 !text-[12px]"
                  disabled={!skillQuery.trim()}
                >
                  Search
                </button>
              </form>
              {hubNote ? <p className="muted m-0 text-[12px]">{hubNote}</p> : null}
              {(hubResults ?? []).map((r) => (
                <div key={r.identifier} className="panel rise-in !p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-[13px]">{r.name}</strong>
                      <p className="muted m-0 mt-1 text-[12px]">{r.description}</p>
                      <p className="muted m-0 mt-1 text-[11px]">
                        {[r.source, r.trust_level].filter(Boolean).join(" \u00b7 ")}
                      </p>
                    </div>
                    <button
                      className="btn !px-3 !py-1.5 !text-[12px]"
                      disabled={skillBusy !== null}
                      onClick={() => void installHubSkill(r.identifier)}
                    >
                      {skillBusy === r.identifier ? "Installing…" : "Install"}
                    </button>
                  </div>
                </div>
              ))}
              {hubResults !== null && hubResults.length === 0 ? (
                <p className="muted m-0 text-[13px]">No skills found.</p>
              ) : null}
              {suggested.length > 0 ? (
                <>
                  <h4 className="m-0 mt-2 text-[13px] font-semibold">
                    Suggested for you
                  </h4>
                  <div className="grid gap-2">
                    {suggested.map((s) => {
                      const suggestedOpen = skillDetailFor === s.name;
                      return (
                        <div key={s.name} className="panel rise-in !p-3">
                          <button
                            type="button"
                            className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left"
                            onClick={() => void openSkillDetail(s.name)}
                            aria-expanded={suggestedOpen}
                          >
                            <strong className="text-[13px]">{s.name}</strong>
                            <p className="muted m-0 mt-1 text-[12px]">
                              {s.description}
                            </p>
                          </button>
                          {suggestedOpen ? (
                            <SkillDetailSheet detail={skillDetail} />
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </>
              ) : null}
              <div className="mt-2 flex items-center justify-between gap-2">
                <h4 className="m-0 text-[13px] font-semibold">Installed</h4>
                <button
                  className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                  disabled={updatesNote === "Checking for updates…"}
                  onClick={() => void checkSkillUpdates()}
                >
                  Check for updates
                </button>
              </div>
              {updatesNote ? (
                <p className="muted m-0 text-[12px]">{updatesNote}</p>
              ) : null}
              {skillUpdates !== null &&
              skillUpdates.every((u) => u.status !== "update_available") ? (
                <p className="muted m-0 text-[12px]">
                  Everything is up to date.
                </p>
              ) : null}
              {panelNote ? (
                <div className="flex items-center gap-2 py-1">
                  <Orb pill label={panelNote} />
                  {panelFailed ? (
                    <button
                      className="btn !px-3 !py-1.5 !text-[12px]"
                      onClick={() => void loadInstalledSkills()}
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}
              {(skills ?? []).map((s, i) => {
                const update = s.name
                  ? skillUpdates?.find((u) => u.name === s.name)
                  : undefined;
                const detailOpen = s.name != null && skillDetailFor === s.name;
                return (
                  <div key={s.name ?? i} className="panel rise-in !p-3">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        className="min-w-0 cursor-pointer border-0 bg-transparent p-0 text-left"
                        disabled={s.name == null}
                        aria-expanded={detailOpen}
                        onClick={() => {
                          if (s.name) void openSkillDetail(s.name);
                        }}
                      >
                        <strong className="text-[13px]">
                          {s.name ?? "skill"}
                        </strong>
                        {s.description ? (
                          <p className="muted m-0 mt-1 text-[12px]">
                            {s.description}
                          </p>
                        ) : null}
                      </button>
                      <div className="flex shrink-0 items-center gap-2">
                        {update?.status === "update_available" && s.name ? (
                          <button
                            className="btn !px-3 !py-1.5 !text-[12px]"
                            disabled={skillBusy !== null}
                            onClick={() =>
                              void updateHubSkill(s.name as string)
                            }
                          >
                            {skillBusy === s.name ? "Updating…" : "Update"}
                          </button>
                        ) : null}
                        {s.name ? (
                          <button
                            className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                            disabled={skillBusy !== null}
                            onClick={() =>
                              void uninstallHubSkill(s.name as string)
                            }
                          >
                            {skillBusy === s.name ? "Removing…" : "Remove"}
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {detailOpen ? (
                      <SkillDetailSheet detail={skillDetail} />
                    ) : null}
                  </div>
                );
              })}
              {skills !== null && skills.length === 0 ? (
                <p className="muted text-[13px]">No skills installed yet.</p>
              ) : null}
            </div>
          ) : tab === "computer" ? (
            // Both subtabs stack panels below the live view (Screen: snapshot,
            // power history, keep-awake; Browser: its panels), so both scroll.
            <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
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
              {computerView === "screen" ? (
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="muted m-0 flex items-center gap-2 text-[13px]">
                  <span
                    aria-hidden
                    className={
                      "inline-block h-2 w-2 rounded-full " +
                      (boxState === "ready" || boxState === "idle"
                        ? "bg-[var(--success)]"
                        : boxState === "starting" || boxState === "stopping"
                          ? "bg-[var(--warning)]"
                          : "bg-[var(--muted)]")
                    }
                  />
                  {boxState === "ready" || boxState === "idle"
                    ? "Your agent’s computer is on."
                    : boxState === "starting"
                      ? "Powering on…"
                      : boxState === "stopping"
                        ? "Powering off…"
                        : boxState === "stopped"
                          ? "Your agent’s computer is off."
                          : "Checking power state…"}
                </p>
                <div className="flex items-center gap-2">
                  {boxState === "stopped" ? (
                    <button
                      className="btn !px-3 !py-1.5 !text-[12px]"
                      disabled={powerBusy}
                      onClick={() => void powerOn()}
                    >
                      {powerBusy ? "Powering on…" : "Power on"}
                    </button>
                  ) : null}
                  {boxState === "ready" || boxState === "idle" ? (
                    <>
                      <button
                        className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                        disabled={powerBusy}
                        onClick={() => void powerOn(60)}
                        title="Keep the computer awake for the next hour"
                      >
                        Keep awake 1h
                      </button>
                      <button
                        className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                        disabled={powerBusy}
                        onClick={() => void powerOff()}
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
              {powerNote ? (
                <p className="muted m-0 text-[12px]">{powerNote}</p>
              ) : null}
              {boxState === "ready" || boxState === "idle" ? (
                <iframe
                  key={computerEpoch}
                  src="/api/box/desktop"
                  title="Your agent's computer"
                  className="min-h-[420px] flex-1 rounded-xl border-0 bg-black"
                  allow="clipboard-read; clipboard-write"
                />
              ) : (
                <div className="flex min-h-[420px] flex-1 flex-col items-center justify-center gap-3 rounded-xl bg-surface-2 text-center">
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
                <ScreenExtras
                  boxOn={boxState === "ready" || boxState === "idle"}
                />
              ) : null}
              {computerView === "browser" ? (
                <BrowserPanels
                  browser={browser}
                  onSchedule={(playbook) => {
                    setCalendarPrefill({
                      name: playbook,
                      prompt: `Run the ${playbook} playbook: read and follow the ${playbook} skill.`,
                    });
                    void loadTab("calendar");
                  }}
                />
              ) : null}
            </div>
          ) : tab === "wallet" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <h3 className="m-0 text-[15px] font-semibold">Wallet</h3>
              {walletNote ? (
                <div className="flex items-center gap-2 py-1">
                  <p className="muted m-0 text-[13px]">{walletNote}</p>
                  <button
                    className="btn !px-3 !py-1.5 !text-[12px]"
                    onClick={() => void loadWallet()}
                  >
                    Retry
                  </button>
                </div>
              ) : wallet === null ? (
                <div className="py-2">
                  <Orb pill label="Loading your wallet…" />
                </div>
              ) : wallet.address === null ? (
                <p className="muted text-[13px]">
                  Wallet not set up yet — sign out and back in with your phone
                  to attach it.
                </p>
              ) : (
                <>
                  <div className="panel !p-3">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
                        <DitherAvatar name={wallet.address} size={36} />
                      </div>
                      <div className="min-w-0">
                        <p className="m-0 break-all font-mono text-[12px]">
                          {wallet.address}
                        </p>
                        <p className="muted m-0 mt-0.5 text-[11px]">
                          Chain {wallet.chain_id}
                        </p>
                      </div>
                    </div>
                    <div className="mt-2 flex gap-2">
                      <button
                        className="btn !px-3 !py-1.5 !text-[12px]"
                        onClick={() => void copyWalletAddress(wallet.address as string)}
                      >
                        {walletCopied ? "Copied" : "Copy"}
                      </button>
                      {wallet.receive_qr ? (
                        <button
                          className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                          onClick={() => setWalletReceiveOpen((open) => !open)}
                        >
                          {walletReceiveOpen ? "Hide QR" : "Receive"}
                        </button>
                      ) : null}
                      {THIRDWEB_CLIENT_ID ? (
                        <button
                          className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                          onClick={() => setWalletFundOpen((open) => !open)}
                        >
                          {walletFundOpen ? "Hide fund" : "Fund"}
                        </button>
                      ) : null}
                    </div>
                    {walletReceiveOpen && wallet.receive_qr ? (
                      <div className="mt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={wallet.receive_qr}
                          alt="QR code of your wallet address"
                          width={160}
                          height={160}
                          className="rounded-lg bg-white p-2"
                        />
                      </div>
                    ) : null}
                    {walletFundOpen && THIRDWEB_CLIENT_ID && wallet.chain_id ? (
                      <div className="mt-3">
                        <FundWidget
                          clientId={THIRDWEB_CLIENT_ID}
                          chainId={wallet.chain_id}
                          address={wallet.address}
                        />
                      </div>
                    ) : null}
                  </div>
                  <h4 className="m-0 mt-2 text-[13px] font-semibold">Send</h4>
                  <form
                    className="panel grid gap-2 !p-3"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submitSend();
                    }}
                  >
                    <input
                      className="input font-mono !py-1.5 !text-[12px]"
                      placeholder="Recipient address (0x…)"
                      value={sendTo}
                      onChange={(e) => setSendTo(e.target.value)}
                      aria-label="Recipient address"
                    />
                    <div className="flex gap-2">
                      <input
                        className="input flex-1 !py-1.5 !text-[13px]"
                        placeholder="Amount (ETH)"
                        inputMode="decimal"
                        value={sendAmount}
                        onChange={(e) => setSendAmount(e.target.value)}
                        aria-label="Amount in ETH"
                      />
                      <button
                        type="submit"
                        className="btn !px-3 !py-1.5 !text-[12px]"
                        disabled={sendBusy || !sendTo.trim() || !sendAmount.trim()}
                      >
                        {sendBusy ? "Requesting…" : "Request send"}
                      </button>
                    </div>
                    <p className="muted m-0 text-[11px]">
                      Nothing moves until you approve it in Needs you. ENS
                      names aren’t resolved — paste the full address.
                    </p>
                    {sendNote ? (
                      <p className="m-0 text-[12px]">
                        {sendNote}{" "}
                        {sendNote.startsWith("Send requested") ? (
                          <button
                            type="button"
                            className="cursor-pointer border-0 bg-transparent p-0 text-[12px] underline"
                            onClick={() => void loadTab("needs")}
                          >
                            Open Needs you
                          </button>
                        ) : null}
                      </p>
                    ) : null}
                  </form>
                  <h4 className="m-0 mt-2 text-[13px] font-semibold">Balances</h4>
                  {wallet.degraded ? (
                    <p className="muted m-0 text-[12px]">
                      Some balances are unavailable right now — showing what we
                      could reach.
                    </p>
                  ) : null}
                  {wallet.native ? (
                    <div className="panel rise-in flex items-center justify-between !p-3">
                      <strong className="text-[13px]">{wallet.native.symbol}</strong>
                      <span className="text-[13px]">{wallet.native.display}</span>
                    </div>
                  ) : null}
                  {(wallet.tokens ?? []).map((t, i) => (
                    <div
                      key={`${t.symbol}-${i}`}
                      className="panel rise-in flex items-center justify-between !p-3"
                    >
                      <div>
                        <strong className="text-[13px]">{t.symbol}</strong>
                        <p className="muted m-0 mt-0.5 text-[12px]">{t.name}</p>
                      </div>
                      <span className="text-[13px]">{t.display}</span>
                    </div>
                  ))}
                  {!wallet.native && (wallet.tokens ?? []).length === 0 ? (
                    <p className="muted m-0 text-[13px]">
                      No balances to show yet.
                    </p>
                  ) : null}
                  <h4 className="m-0 mt-2 text-[13px] font-semibold">Activity</h4>
                  {walletTransfers.map((t) => (
                    <div
                      key={t.id}
                      className="panel rise-in flex items-center justify-between !p-3"
                    >
                      <div className="min-w-0">
                        <strong
                          className={
                            "text-[13px] " +
                            (t.status === "submitted"
                              ? "text-[var(--success)]"
                              : t.status === "pending" ||
                                  t.status === "submitting"
                                ? "text-[var(--warning)]"
                                : "text-[var(--muted-2)]")
                          }
                        >
                          {t.status === "pending"
                            ? "Send awaiting approval"
                            : t.status === "submitting"
                              ? "Sending…"
                              : t.status === "submitted"
                                ? "Sent"
                                : t.status === "denied"
                                  ? "Send denied"
                                  : "Send failed"}
                        </strong>
                        <p className="muted m-0 mt-0.5 break-all font-mono text-[11px]">
                          {t.to_address}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[13px]">{t.amount_display}</span>
                        <p className="muted m-0 mt-0.5 text-[11px]">
                          {new Date(t.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  ))}
                  {(walletTxs ?? []).map((t) => (
                    <a
                      key={t.hash}
                      href={t.explorer_url}
                      target="_blank"
                      rel="noreferrer"
                      className="panel rise-in flex items-center justify-between !p-3 no-underline"
                    >
                      <div className="min-w-0">
                        <strong
                          className={
                            "text-[13px] " +
                            (t.direction === "in"
                              ? "text-[var(--success)]"
                              : "text-[var(--muted-2)]")
                          }
                        >
                          {t.direction === "in" ? "Received" : "Sent"}
                        </strong>
                        <p className="muted m-0 mt-0.5 break-all font-mono text-[11px]">
                          {t.counterparty}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <span className="text-[13px]">{t.value_display}</span>
                        <p className="muted m-0 mt-0.5 text-[11px]">
                          {new Date(t.timestamp).toLocaleDateString()}
                        </p>
                      </div>
                    </a>
                  ))}
                  {walletTxs !== null &&
                  walletTxs.length === 0 &&
                  walletTransfers.length === 0 ? (
                    <p className="muted m-0 text-[13px]">No activity yet.</p>
                  ) : null}
                </>
              )}
            </div>
          ) : tab === "vault" ? (
            <VaultPanel active={tab === "vault"} />
          ) : tab === "bots" ? (
            <BotsPanel active={tab === "bots"} />
          ) : tab === "calendar" ? (
            <CalendarPanel
              active={tab === "calendar"}
              prefill={calendarPrefill}
              onPrefillConsumed={() => setCalendarPrefill(null)}
              onAgentRun={(prompt) => {
                setTab("chat");
                if (busy) {
                  // A run is already streaming — stage the prompt instead.
                  setInput(prompt);
                } else {
                  void send(prompt);
                }
              }}
            />
          ) : tab === "ads" ? (
            <AdsPanel
              active={tab === "ads"}
              onAskAgent={(prefill) => {
                setTab("chat");
                setInput(prefill);
              }}
              onOpenQueue={() => void loadTab("needs")}
            />
          ) : (
            <>
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
                        : "Talk to your agent — same one as on iMessage."}
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
              {chatComputerOpen ? (
                <div className="mb-2 flex flex-col gap-2 rounded-xl bg-surface p-2 shadow-[0_0_0_0.5px_var(--ring)]">
                  <div className="flex items-center justify-between gap-2">
                    <p className="muted m-0 text-[12px]">
                      Your agent is using its computer — take over when it
                      needs you (logins, approvals).
                    </p>
                    <div className="flex shrink-0 items-center gap-1">
                      <a
                        className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                        href="/api/box/desktop"
                        target="_blank"
                        rel="noreferrer noopener"
                      >
                        Open in new tab
                      </a>
                      <a
                        className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                        href="/api/box/desktop?vnc=1"
                        target="_blank"
                        rel="noreferrer noopener"
                        title="HTTPS-tunneled viewer for restrictive networks; opens as its own page"
                      >
                        Use VNC
                      </a>
                      <button
                        className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                        onClick={() => {
                          chatComputerOpenRef.current = false;
                          chatComputerDismissed.current = true;
                          setChatComputerOpen(false);
                        }}
                      >
                        Hide
                      </button>
                    </div>
                  </div>
                  <iframe
                    key={computerEpoch}
                    src="/api/box/desktop"
                    title="Your agent's computer"
                    className="h-[320px] w-full rounded-lg border-0 bg-black"
                    allow="clipboard-read; clipboard-write"
                  />
                </div>
              ) : null}
              {boxState === "starting" ? (
                <div className="flex items-center gap-2 rounded-xl bg-surface-2 px-3 py-2 text-[12px] text-[var(--muted-2)]">
                  <span
                    aria-hidden
                    className="inline-block h-2 w-2 animate-pulse rounded-full bg-[var(--warning)]"
                  />
                  Your agent’s computer is booting — replies may take a little
                  longer.
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
          )}
        </section>

        <aside className="grid content-start gap-4">
          <div className="panel">
            <div className="mb-2 flex items-center gap-3">
              {me?.user.username ? (
                <div className="h-9 w-9 overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
                  <DitherAvatar name={me.user.username} size={36} />
                </div>
              ) : null}
              <h3 className="m-0 text-[15px] font-semibold">Account</h3>
            </div>
            <p className="muted my-1 text-[12px]">
              {me?.lines[0] ? `iMessage line: ${me.lines[0].phone}` : "No line yet"}
            </p>
            <p className="muted my-1 text-[12px]">
              {me?.addresses?.[0]
                ? `Email: ${me.addresses[0].address}`
                : "Email: set a username to create one"}
            </p>
            {me?.user.username ? (
              <p className="muted my-1 text-[12px]">
                Contact card:{" "}
                <a href={`/@${me.user.username}`}>/@{me.user.username}</a>
              </p>
            ) : null}
            <p className="muted my-1 text-[12px]">
              {me?.user.wallet_address ? (
                <button
                  type="button"
                  className="cursor-pointer border-0 bg-transparent p-0 underline decoration-dotted underline-offset-2"
                  onClick={() => void loadTab("wallet")}
                >
                  Wallet: {me.user.wallet_address.slice(0, 6)}…
                  {me.user.wallet_address.slice(-4)}
                </button>
              ) : (
                "Wallet: not set up"
              )}
            </p>
            <div className="mt-2 flex gap-2">
              <input
                className="input"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                onClick={() => void saveUsername()}
              >
                Save
              </button>
            </div>
            {note ? <p className="muted mb-0 mt-2 text-[12px]">{note}</p> : null}
          </div>

          <div className="panel">
            <h3 className="mt-0 text-[15px] font-semibold">Apps</h3>
            <div className="flex gap-2">
              {(["kanban", "todo", "calendar"] as const).map((slug) => (
                <button
                  key={slug}
                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                  onClick={() => {
                    // Open the window synchronously so popup blockers allow
                    // it, then point it at the freshly minted link.
                    const win = window.open("about:blank", "_blank");
                    void fetch("/api/mini/link", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ app: slug }),
                    })
                      .then(async (res) => {
                        const data = res.ok
                          ? ((await res.json().catch(() => ({}))) as {
                              url?: string;
                            })
                          : {};
                        if (data.url) {
                          if (win) win.location.href = data.url;
                          else window.location.href = data.url;
                          return;
                        }
                        win?.close();
                      })
                      .catch(() => win?.close());
                  }}
                >
                  {slug === "kanban"
                    ? "Kanban"
                    : slug === "todo"
                      ? "To-Do"
                      : "Calendar"}
                </button>
              ))}
            </div>
          </div>

          <div className="panel">
            <h3 className="mt-0 text-[15px] font-semibold">
              Speed &amp; Intelligence
            </h3>
            <div className="grid gap-1.5">
              {(
                [
                  ["fast", "Fast"],
                  ["balanced", "Balanced"],
                  ["deep", "Deep"],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={
                    "seg rounded-lg" +
                    (tier === id
                      ? " pill-active"
                      : " shadow-[0_0_0_0.5px_var(--ring)]")
                  }
                  onClick={() => void saveTier(id)}
                >
                  {label}
                  {me?.entitlement?.tier_models ? (
                    <span
                      className={
                        "block text-[11px] font-normal " +
                        (tier === id ? "opacity-70" : "text-[var(--muted)]")
                      }
                    >
                      {me.entitlement.tier_models[id]}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>
            {me?.entitlement ? (
              <div className="mt-3">
                <div
                  className="h-2 overflow-hidden rounded-full bg-surface-2"
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(spendPct)}
                  aria-label="Monthly spend"
                >
                  <div
                    className="h-full rounded-full bg-accent [background-image:radial-gradient(circle,rgba(255,255,255,0.55)_0.7px,transparent_1.2px)] [background-size:4px_4px] transition-[width] duration-500"
                    style={{ width: `${spendPct}%` }}
                  />
                </div>
                <p className="muted mb-0 mt-2 text-[12px]">
                  ${Number(me.entitlement.spend_mtd_usd).toFixed(2)} of $
                  {Number(me.entitlement.monthly_cap_usd).toFixed(2)} used this
                  month
                </p>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
