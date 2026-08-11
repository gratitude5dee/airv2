"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { Orb } from "@/components/orb/Orb";
import { PromptInput } from "@/components/prompt-input/PromptInput";

interface Me {
  user: { id: string; username: string | null; wallet_address: string | null };
  entitlement: {
    plan: string;
    speed_tier: string;
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
  created_at: string;
}

interface Sender {
  id: string;
  platform: string;
  address: string;
  trust_tier: number;
  first_seen: string;
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

interface HubSkill {
  name: string;
  identifier: string;
  source: string;
  trust_level: string;
  description: string;
}

interface ChatMessage {
  role: "user" | "agent";
  text: string;
}

interface AdAccount {
  id: string;
  provider: string;
  account_ref: string;
  label: string | null;
  status: string;
}

interface AdSpec {
  id: string;
  stale: boolean;
}

interface AdWrite {
  id: string;
  kind: string;
  campaign_ref: string | null;
  status: string;
  daily_budget_cents: number | null;
  error: string | null;
  created_at: string;
}

interface AdGroupJob {
  jobId: string;
  specId: string;
  costEstimate: number;
  state: string;
  conformant: boolean | null;
  gaps: string[];
}

type Tab =
  | "chat"
  | "history"
  | "skills"
  | "needs"
  | "people"
  | "connectors"
  | "ads";

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

const TABS: [Tab, string][] = [
  ["chat", "Chat"],
  ["needs", "Needs you"],
  ["history", "History"],
  ["people", "People"],
  ["connectors", "Connectors"],
  ["skills", "Skills"],
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
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [skills, setSkills] = useState<SkillSummary[] | null>(null);
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [people, setPeople] = useState<Sender[] | null>(null);
  const [toolkits, setToolkits] = useState<Toolkit[] | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectorFilter, setConnectorFilter] = useState("");
  const [panelNote, setPanelNote] = useState<string | null>(null);
  const [panelFailed, setPanelFailed] = useState(false);
  const panelLoadId = useRef(0);
  const [skillQuery, setSkillQuery] = useState("");
  const [hubResults, setHubResults] = useState<HubSkill[] | null>(null);
  const [hubNote, setHubNote] = useState<string | null>(null);
  const [skillBusy, setSkillBusy] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [adAccounts, setAdAccounts] = useState<AdAccount[] | null>(null);
  const [adCeilingCents, setAdCeilingCents] = useState(0);
  const [adSpecs, setAdSpecs] = useState<AdSpec[]>([]);
  const [adWrites, setAdWrites] = useState<AdWrite[]>([]);
  const [adsNote, setAdsNote] = useState<string | null>(null);
  const [adsFailed, setAdsFailed] = useState(false);
  const [adsLoading, setAdsLoading] = useState(false);
  const adsLoadId = useRef(0);
  const [adSpecId, setAdSpecId] = useState("");
  const [adOffer, setAdOffer] = useState("");
  const [adJob, setAdJob] = useState<AdGroupJob | null>(null);
  const [adBusy, setAdBusy] = useState(false);
  const adPollId = useRef(0);
  const [writeAccountId, setWriteAccountId] = useState("");
  const [writeCampaignName, setWriteCampaignName] = useState("");
  const [writeDailyUsd, setWriteDailyUsd] = useState("");
  const [writeBusy, setWriteBusy] = useState(false);
  const [decisionBusy, setDecisionBusy] = useState<string | null>(null);
  const [decisionNote, setDecisionNote] = useState<string | null>(null);

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

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }, { role: "agent", text: "" }]);
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: text }),
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
      const { run_id } = (await res.json()) as { run_id: string };
      const events = new EventSource(`/api/chat/${run_id}/events`);
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
            type?: string;
            delta?: string;
            output?: string;
          };
          if (parsed.type === "message.delta" && parsed.delta) {
            acc += parsed.delta;
            setMessages((m) => [...m.slice(0, -1), { role: "agent", text: acc }]);
          }
          if (parsed.type === "run.completed") {
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
          if (parsed.type === "run.failed") {
            fillEmpty("Something went wrong.");
            events.close();
            setBusy(false);
          }
        } catch {
          // non-JSON keepalive
        }
      };
      events.onerror = () => {
        fillEmpty("Connection lost — try again.");
        events.close();
        setBusy(false);
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
  }, [input, busy]);

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

  async function loadConnectors() {
    const res = await fetch("/api/connectors");
    if (res.ok) {
      const data = (await res.json()) as {
        toolkits?: Toolkit[];
        connections?: Connection[];
      };
      setToolkits(data.toolkits ?? []);
      setConnections(data.connections ?? []);
    }
    // Sync statuses (picks up OAuth flows completed since last visit).
    const sync = await fetch("/api/connectors", { method: "PUT" });
    if (sync.ok) {
      const data = (await sync.json()) as { connections?: Connection[] };
      setConnections(data.connections ?? []);
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

  async function loadAds() {
    const loadId = ++adsLoadId.current;
    setAdsNote(null);
    setAdsFailed(false);
    setAdsLoading(true);
    let failed = false;
    try {
      const [accountsRes, specsRes, writesRes] = await Promise.all([
        fetch("/api/ads/accounts"),
        fetch("/api/ads/groups"),
        fetch("/api/ads/writes"),
      ]);
      if (loadId !== adsLoadId.current) return;
      if (accountsRes.ok) {
        const data = (await accountsRes.json()) as {
          accounts?: AdAccount[];
          spend_ceiling_cents?: number;
        };
        setAdAccounts(data.accounts ?? []);
        setAdCeilingCents(data.spend_ceiling_cents ?? 0);
      } else {
        failed = true;
      }
      if (specsRes.ok) {
        const data = (await specsRes.json()) as { specs?: AdSpec[] };
        setAdSpecs(data.specs ?? []);
      } else {
        failed = true;
      }
      if (writesRes.ok) {
        const data = (await writesRes.json()) as { writes?: AdWrite[] };
        setAdWrites(data.writes ?? []);
      } else {
        failed = true;
      }
    } catch {
      failed = true;
    }
    if (loadId !== adsLoadId.current) return;
    setAdsLoading(false);
    if (failed) {
      setAdsFailed(true);
      setAdsNote("Couldn't load your ads data.");
    }
  }

  async function connectMetaAds() {
    setAdBusy(true);
    setAdsFailed(false);
    setAdsNote("Installing Meta Ads on your agent's computer…");
    try {
      const res = await fetch("/api/ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ install: "meta-ads" }),
      });
      if (res.ok) {
        setAdsNote(
          "Meta Ads installed. Ask your agent in chat to connect your Meta ad account — it walks you through the login."
        );
      } else {
        setAdsNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Install failed — try again shortly."
        );
      }
    } catch {
      setAdsNote("Install failed — try again shortly.");
    } finally {
      setAdBusy(false);
    }
  }

  async function createAdGroup() {
    const specId = adSpecId || adSpecs[0]?.id;
    const offer = adOffer.trim();
    if (!specId || !offer || adBusy) return;
    setAdBusy(true);
    setAdsFailed(false);
    setAdsNote(null);
    setAdJob(null);
    const pollId = ++adPollId.current;
    try {
      const res = await fetch("/api/ads/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec_id: specId, offer }),
      });
      if (!res.ok) {
        setAdsNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Couldn't start the ad group — try again shortly."
        );
        return;
      }
      const data = (await res.json()) as {
        job_id: string;
        cost_estimate: number;
      };
      let job: AdGroupJob = {
        jobId: data.job_id,
        specId,
        costEstimate: data.cost_estimate,
        state: "running",
        conformant: null,
        gaps: [],
      };
      setAdJob(job);
      for (let i = 0; i < 60; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (pollId !== adPollId.current) return;
        const poll = await fetch(`/api/ads/groups/${data.job_id}`);
        if (!poll.ok) continue;
        const status = (await poll.json()) as {
          state?: string;
          error?: string | null;
          conformance?: { complete?: boolean; gaps?: string[] };
        };
        if (pollId !== adPollId.current) return;
        if (status.state === "done") {
          job = {
            ...job,
            state: "done",
            conformant: status.conformance?.complete ?? null,
            gaps: status.conformance?.gaps ?? [],
          };
          setAdJob(job);
          return;
        }
        if (status.state === "failed" || status.state === "cancelled") {
          setAdJob({ ...job, state: status.state });
          return;
        }
        setAdJob({ ...job, state: status.state ?? "running" });
      }
      setAdsNote("Still rendering — check back in a few minutes.");
    } catch {
      setAdsNote("Couldn't start the ad group — try again shortly.");
    } finally {
      if (pollId === adPollId.current) setAdBusy(false);
    }
  }

  async function proposeAdWrite() {
    const dailyUsd = Number(writeDailyUsd);
    if (
      writeBusy ||
      !writeAccountId ||
      !writeCampaignName.trim() ||
      !Number.isFinite(dailyUsd) ||
      dailyUsd <= 0
    )
      return;
    setWriteBusy(true);
    setAdsFailed(false);
    setAdsNote(null);
    try {
      const res = await fetch("/api/ads/writes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: writeAccountId,
          kind: "create_campaign",
          campaign_name: writeCampaignName.trim(),
          daily_budget_cents: Math.round(dailyUsd * 100),
        }),
      });
      if (res.ok) {
        setWriteCampaignName("");
        setWriteDailyUsd("");
        setAdsNote("Proposed — approve it under “Needs you” to run it.");
        const writes = await fetch("/api/ads/writes");
        if (writes.ok) {
          const data = (await writes.json()) as { writes?: AdWrite[] };
          setAdWrites(data.writes ?? []);
        }
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setAdsNote(data.error ?? "Couldn't propose the campaign — try again.");
      }
    } catch {
      setAdsNote("Couldn't propose the campaign — try again.");
    } finally {
      setWriteBusy(false);
    }
  }

  function boxErrorNote(status: number, what: string): string {
    if (status === 429)
      return "Your agent's computer is busy starting up — retry in a minute.";
    if (status === 502)
      return "Couldn't reach your agent's computer — it may still be waking up.";
    return `Couldn't load ${what} — try again shortly.`;
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
      await loadInstalledSkills();
    }
    if (next === "ads") {
      // Always re-fetch: accounts appear after the agent-side OAuth
      // handshake, so a one-shot load would go stale.
      await loadAds();
    }
  }

  async function refreshSkills() {
    const res = await fetch("/api/box/v1/skills");
    if (res.ok) {
      setSkills(pickList<SkillSummary>(await res.json(), ["skills", "data", "items"]));
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
              className={
                "cursor-pointer rounded-full border-0 px-3.5 py-2 text-left text-[13px] font-medium transition-colors " +
                (tab === key
                  ? "bg-[var(--text)] text-[var(--bg)]"
                  : "bg-transparent text-[var(--muted-2)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]")
              }
              onClick={() => void loadTab(key)}
            >
              {label}
            </button>
          ))}
        </nav>

        <section className="panel flex h-[72vh] flex-col !p-4">
          {tab === "needs" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <h3 className="m-0 text-[15px] font-semibold">Needs you</h3>
              {(decisions ?? []).map((d) => (
                <div key={d.id} className="panel rise-in !p-3">
                  <strong className="text-[13px]">
                    {d.kind === "email_draft"
                      ? "Email draft awaiting send"
                      : d.kind === "run_approval"
                        ? "Agent action awaiting approval"
                        : d.kind === "ad_write"
                          ? "Ad spend awaiting approval"
                          : d.kind === "content_plan"
                            ? "Content plan proposed"
                            : d.kind === "reconnect"
                              ? "Account needs reconnecting"
                              : d.kind === "revise"
                                ? "Post needs a revision"
                                : d.kind === "spend_divergence"
                                  ? "Ad spend diverged from budget"
                                  : d.kind === "spend_ceiling"
                                    ? "Spend ceiling reached"
                                    : "New contact"}
                  </strong>
                  <p className="muted mb-2 mt-1 text-[12px]">
                    {[d.label, d.sender, d.platform].filter(Boolean).join(" \u00b7 ")}
                  </p>
                  <div className="flex gap-2">
                    {["email_draft", "ad_write", "content_plan", "reconnect", "revise"].includes(
                      d.kind
                    ) ? (
                      <button
                        className="btn !px-3 !py-1.5 !text-[12px]"
                        disabled={decisionBusy !== null}
                        onClick={() => void resolveDecision(d.id, "approve")}
                      >
                        {decisionBusy === d.id
                          ? "Working\u2026"
                          : d.kind === "email_draft"
                            ? "Send"
                            : d.kind === "content_plan"
                              ? "Approve plan"
                              : d.kind === "reconnect" || d.kind === "revise"
                                ? "Retry"
                                : "Approve"}
                      </button>
                    ) : null}
                    <button
                      className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                      disabled={decisionBusy !== null}
                      onClick={() => void resolveDecision(d.id, "dismiss")}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
              {decisionNote ? (
                <p className="muted m-0 text-[12px]">{decisionNote}</p>
              ) : null}
              {decisions !== null && decisions.length === 0 ? (
                <p className="muted text-[13px]">Nothing needs you right now.</p>
              ) : null}
            </div>
          ) : tab === "people" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <h3 className="m-0 text-[15px] font-semibold">People</h3>
              <p className="muted m-0 text-[12px]">
                Known senders can talk to your agent; unknown senders wait in
                “Needs you”.
              </p>
              {(people ?? []).map((s) => (
                <div
                  key={s.id}
                  className="panel rise-in flex items-center justify-between !p-3"
                >
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
                      <DitherAvatar name={s.address} size={32} />
                    </div>
                    <div>
                      <strong className="text-[13px]">{s.address}</strong>
                      <p className="muted m-0 mt-0.5 text-[12px]">
                        {s.platform} · {s.trust_tier === 1 ? "known" : "unknown"}
                      </p>
                    </div>
                  </div>
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
              {connections.length > 0 ? (
                <div className="grid gap-2">
                  {connections.map((c) => (
                    <div
                      key={c.toolkit}
                      className="panel flex items-center justify-between !p-3"
                    >
                      <strong className="text-[13px]">{c.toolkit}</strong>
                      <span className="muted text-[12px]">{c.status}</span>
                    </div>
                  ))}
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
              {(sessions ?? []).map((s, i) => (
                <div key={s.session_id ?? s.id ?? i} className="panel rise-in !p-3">
                  <strong className="text-[13px]">{s.title ?? "Untitled"}</strong>
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
                </div>
              ))}
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
              <h4 className="m-0 mt-2 text-[13px] font-semibold">Installed</h4>
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
              {(skills ?? []).map((s, i) => (
                <div key={s.name ?? i} className="panel rise-in !p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <strong className="text-[13px]">{s.name ?? "skill"}</strong>
                      {s.description ? (
                        <p className="muted m-0 mt-1 text-[12px]">{s.description}</p>
                      ) : null}
                    </div>
                    {s.name ? (
                      <button
                        className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                        disabled={skillBusy !== null}
                        onClick={() => void uninstallHubSkill(s.name as string)}
                      >
                        {skillBusy === s.name ? "Removing…" : "Remove"}
                      </button>
                    ) : null}
                  </div>
                </div>
              ))}
              {skills !== null && skills.length === 0 ? (
                <p className="muted text-[13px]">No skills installed yet.</p>
              ) : null}
            </div>
          ) : tab === "ads" ? (
            <div className="grid flex-1 content-start gap-2 overflow-y-auto">
              <h3 className="m-0 text-[15px] font-semibold">Ads</h3>
              <p className="muted m-0 text-[12px]">
                Your agent drafts the creative; nothing spends money without
                your approval under “Needs you”.
              </p>
              {adsNote ? (
                <div className="flex items-center gap-2 py-1">
                  <p className="muted m-0 text-[12px]">{adsNote}</p>
                  {adsFailed ? (
                    <button
                      className="btn !px-3 !py-1.5 !text-[12px]"
                      onClick={() => void loadAds()}
                    >
                      Retry
                    </button>
                  ) : null}
                </div>
              ) : null}

              <h4 className="m-0 mt-2 text-[13px] font-semibold">Accounts</h4>
              <p className="muted m-0 text-[12px]">
                Spend ceiling: ${(adCeilingCents / 100).toFixed(2)} over 30 days
                {adCeilingCents === 0
                  ? " — no ceiling set, so ad writes are blocked. Ask your operator to set one."
                  : ""}
              </p>
              {(adAccounts ?? []).map((a) => (
                <div
                  key={a.id}
                  className="panel rise-in flex items-center justify-between !p-3"
                >
                  <div>
                    <strong className="text-[13px]">
                      {a.label ?? a.account_ref}
                    </strong>
                    <p className="muted m-0 mt-0.5 text-[12px]">
                      {a.provider} · {a.status}
                    </p>
                  </div>
                </div>
              ))}
              {adAccounts !== null && adAccounts.length === 0 ? (
                <p className="muted m-0 text-[13px]">No ad accounts yet.</p>
              ) : null}
              <div>
                <button
                  className="btn !px-3 !py-1.5 !text-[12px]"
                  disabled={adBusy}
                  onClick={() => void connectMetaAds()}
                >
                  Connect Meta Ads
                </button>
              </div>

              <h4 className="m-0 mt-2 text-[13px] font-semibold">
                Create an ad asset group
              </h4>
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void createAdGroup();
                }}
              >
                <select
                  className="input !py-1.5 !text-[13px]"
                  value={adSpecId || adSpecs[0]?.id || ""}
                  onChange={(e) => setAdSpecId(e.target.value)}
                  aria-label="Ad placement"
                >
                  {adSpecs.map((spec) => (
                    <option key={spec.id} value={spec.id}>
                      {spec.id}
                      {spec.stale ? " (spec needs re-verification)" : ""}
                    </option>
                  ))}
                </select>
                <textarea
                  className="input min-h-[64px] !py-1.5 !text-[13px]"
                  placeholder="What are you promoting? (the offer, product, or show)"
                  value={adOffer}
                  onChange={(e) => setAdOffer(e.target.value)}
                  aria-label="Offer brief"
                />
                <div>
                  <button
                    type="submit"
                    className="btn !px-3 !py-1.5 !text-[12px]"
                    disabled={adBusy || !adOffer.trim() || adSpecs.length === 0}
                  >
                    {adBusy ? "Working…" : "Generate assets"}
                  </button>
                </div>
              </form>
              {adJob ? (
                <div className="panel rise-in !p-3">
                  <strong className="text-[13px]">
                    {adJob.state === "done"
                      ? adJob.conformant
                        ? "Asset group ready — conformant"
                        : "Asset group ready — has gaps"
                      : adJob.state === "failed" || adJob.state === "cancelled"
                        ? `Generation ${adJob.state}`
                        : "Rendering…"}
                  </strong>
                  <p className="muted m-0 mt-1 text-[12px]">
                    {adJob.specId} · est. ${adJob.costEstimate.toFixed(2)}
                  </p>
                  {adJob.gaps.length > 0 ? (
                    <p className="muted m-0 mt-1 text-[12px]">
                      Missing: {adJob.gaps.join(", ")}
                    </p>
                  ) : null}
                </div>
              ) : null}

              <h4 className="m-0 mt-2 text-[13px] font-semibold">
                Propose a campaign
              </h4>
              <form
                className="grid gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void proposeAdWrite();
                }}
              >
                <select
                  className="input !py-1.5 !text-[13px]"
                  value={writeAccountId}
                  onChange={(e) => setWriteAccountId(e.target.value)}
                  aria-label="Ad account"
                >
                  <option value="">Choose an account…</option>
                  {(adAccounts ?? []).map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label ?? a.account_ref} ({a.provider})
                    </option>
                  ))}
                </select>
                <input
                  className="input !py-1.5 !text-[13px]"
                  placeholder="Campaign name"
                  value={writeCampaignName}
                  onChange={(e) => setWriteCampaignName(e.target.value)}
                  aria-label="Campaign name"
                />
                <input
                  className="input !py-1.5 !text-[13px]"
                  placeholder="Daily budget (USD)"
                  inputMode="decimal"
                  value={writeDailyUsd}
                  onChange={(e) => setWriteDailyUsd(e.target.value)}
                  aria-label="Daily budget in dollars"
                />
                <div>
                  <button
                    type="submit"
                    className="btn !px-3 !py-1.5 !text-[12px]"
                    disabled={
                      writeBusy ||
                      !writeAccountId ||
                      !writeCampaignName.trim() ||
                      !(Number(writeDailyUsd) > 0)
                    }
                  >
                    {writeBusy ? "Proposing…" : "Propose — approve in “Needs you”"}
                  </button>
                </div>
              </form>

              <h4 className="m-0 mt-2 text-[13px] font-semibold">Ad writes</h4>
              {adWrites.map((w) => (
                <div key={w.id} className="panel rise-in !p-3">
                  <strong className="text-[13px]">
                    {w.kind.replace(/_/g, " ")}
                    {w.campaign_ref ? ` · ${w.campaign_ref}` : ""}
                  </strong>
                  <p className="muted m-0 mt-1 text-[12px]">
                    {[
                      w.status,
                      w.daily_budget_cents != null
                        ? `$${(w.daily_budget_cents / 100).toFixed(2)}/day`
                        : null,
                      w.error,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
              {adAccounts !== null && adWrites.length === 0 ? (
                <p className="muted m-0 text-[13px]">No ad writes yet.</p>
              ) : null}
              {adsLoading ? (
                <div className="py-2">
                  <Orb pill label="Loading ads…" />
                </div>
              ) : null}
            </div>
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
                        {m.text}
                        {streaming ? (
                          <Orb
                            size={14}
                            label="Streaming…"
                            className="ml-1.5 align-middle"
                          />
                        ) : null}
                      </div>
                    );
                  })
                )}
              </div>
              <PromptInput
                value={input}
                onChange={setInput}
                onSend={() => void send()}
                busy={busy}
                tier={tier}
                onTierChange={(next) => void saveTier(next)}
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
              {me?.user.wallet_address
                ? `Wallet: ${me.user.wallet_address.slice(0, 6)}…${me.user.wallet_address.slice(-4)}`
                : "Wallet: not set up"}
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
              {(["kanban", "todo"] as const).map((slug) => (
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
                  {slug === "kanban" ? "Kanban" : "To-Do"}
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
                    "cursor-pointer rounded-lg border-0 px-3 py-2 text-left text-[13px] font-medium transition-colors " +
                    (tier === id
                      ? "bg-[var(--text)] text-[var(--bg)]"
                      : "bg-transparent text-[var(--muted-2)] shadow-[0_0_0_0.5px_var(--ring)] hover:bg-[var(--surface-2)] hover:text-[var(--text)]")
                  }
                  onClick={() => void saveTier(id)}
                >
                  {label}
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
