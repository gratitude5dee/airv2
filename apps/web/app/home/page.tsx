"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

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

interface ChatMessage {
  role: "user" | "agent";
  text: string;
}

export default function HomePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [tier, setTier] = useState("balanced");
  const [username, setUsername] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [tab, setTab] = useState<
    "chat" | "history" | "skills" | "needs" | "people"
  >("chat");
  const [sessions, setSessions] = useState<SessionSummary[] | null>(null);
  const [skills, setSkills] = useState<SkillSummary[] | null>(null);
  const [decisions, setDecisions] = useState<Decision[] | null>(null);
  const [people, setPeople] = useState<Sender[] | null>(null);
  const [panelNote, setPanelNote] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

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
    });
  }, [router]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  const send = useCallback(async () => {
    const text = input.trim();
    if (!text || busy) return;
    setBusy(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", text }, { role: "agent", text: "…" }]);
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
                : "Something went wrong.",
          },
        ]);
        return;
      }
      const { run_id } = (await res.json()) as { run_id: string };
      const events = new EventSource(`/api/chat/${run_id}/events`);
      let acc = "";
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
            }
            events.close();
            setBusy(false);
          }
          if (parsed.type === "run.failed") {
            events.close();
            setBusy(false);
          }
        } catch {
          // non-JSON keepalive
        }
      };
      events.onerror = () => {
        events.close();
        setBusy(false);
      };
    } catch {
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
    await fetch("/api/decisions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, action }),
    });
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

  async function loadTab(
    next: "chat" | "history" | "skills" | "needs" | "people"
  ) {
    setTab(next);
    setPanelNote(null);
    if (next === "history" && sessions === null) {
      setPanelNote("Waking your agent… this can take a minute if it was asleep.");
      const res = await fetch("/api/box/api/sessions?limit=30");
      if (res.ok) {
        const data = (await res.json()) as
          | SessionSummary[]
          | { sessions?: SessionSummary[] };
        setSessions(Array.isArray(data) ? data : (data.sessions ?? []));
        setPanelNote(null);
      } else {
        setPanelNote("Couldn't load history — try again shortly.");
      }
    }
    if (next === "needs") {
      await loadDecisions();
    }
    if (next === "people") {
      await loadPeople();
    }
    if (next === "skills" && skills === null) {
      setPanelNote("Waking your agent… this can take a minute if it was asleep.");
      const res = await fetch("/api/box/v1/skills");
      if (res.ok) {
        const data = (await res.json()) as
          | SkillSummary[]
          | { skills?: SkillSummary[] };
        setSkills(Array.isArray(data) ? data : (data.skills ?? []));
        setPanelNote(null);
      } else {
        setPanelNote("Couldn't load skills — try again shortly.");
      }
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
  }

  return (
    <main style={{ maxWidth: 880, margin: "0 auto", padding: 16 }}>
      <header
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 0",
        }}
      >
        <h1 style={{ margin: 0, fontSize: 22 }}>air</h1>
        <nav style={{ display: "flex", gap: 8 }}>
          {(
            [
              ["chat", "Chat"],
              ["needs", "Needs you"],
              ["history", "History"],
              ["people", "People"],
              ["skills", "Skills"],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "btn" : "btn btn-ghost"}
              onClick={() => void loadTab(key)}
            >
              {label}
            </button>
          ))}
          <button className="btn btn-ghost" onClick={logout}>
            Sign out
          </button>
        </nav>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <section className="panel" style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
          {tab === "needs" ? (
            <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 8, alignContent: "start" }}>
              <h3 style={{ margin: 0 }}>Needs you</h3>
              {(decisions ?? []).map((d) => (
                <div key={d.id} className="panel" style={{ padding: 12 }}>
                  <strong>
                    {d.kind === "email_draft"
                      ? "Email draft awaiting send"
                      : d.kind === "run_approval"
                        ? "Agent action awaiting approval"
                        : "New contact"}
                  </strong>
                  <p className="muted" style={{ margin: "4px 0 8px" }}>
                    {[d.label, d.sender, d.platform].filter(Boolean).join(" \u00b7 ")}
                  </p>
                  <div style={{ display: "flex", gap: 8 }}>
                    {d.kind === "email_draft" ? (
                      <button className="btn" onClick={() => void resolveDecision(d.id, "approve")}>
                        Send
                      </button>
                    ) : null}
                    <button className="btn btn-ghost" onClick={() => void resolveDecision(d.id, "dismiss")}>
                      Dismiss
                    </button>
                  </div>
                </div>
              ))}
              {decisions !== null && decisions.length === 0 ? (
                <p className="muted">Nothing needs you right now.</p>
              ) : null}
            </div>
          ) : tab === "people" ? (
            <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 8, alignContent: "start" }}>
              <h3 style={{ margin: 0 }}>People</h3>
              <p className="muted" style={{ margin: 0 }}>
                Known senders can talk to your agent; unknown senders wait in “Needs you”.
              </p>
              {(people ?? []).map((s) => (
                <div key={s.id} className="panel" style={{ padding: 12, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <strong>{s.address}</strong>
                    <p className="muted" style={{ margin: "4px 0 0" }}>
                      {s.platform} · {s.trust_tier === 1 ? "known" : "unknown"}
                    </p>
                  </div>
                  {s.trust_tier === 2 ? (
                    <button className="btn" onClick={() => void setTrust(s.id, 1)}>
                      Mark known
                    </button>
                  ) : (
                    <button className="btn btn-ghost" onClick={() => void setTrust(s.id, 2)}>
                      Mark unknown
                    </button>
                  )}
                </div>
              ))}
              {people !== null && people.length === 0 ? (
                <p className="muted">No one has messaged your agent yet.</p>
              ) : null}
            </div>
          ) : tab === "history" ? (
            <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 8, alignContent: "start" }}>
              <h3 style={{ margin: 0 }}>Conversations</h3>
              {panelNote ? <p className="muted">{panelNote}</p> : null}
              {(sessions ?? []).map((s, i) => (
                <div key={s.session_id ?? s.id ?? i} className="panel" style={{ padding: 12 }}>
                  <strong>{s.title ?? "Untitled"}</strong>
                  <p className="muted" style={{ margin: "4px 0 0" }}>
                    {[s.platform, s.updated_at ?? s.created_at, s.message_count != null ? `${s.message_count} messages` : null]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
              ))}
              {sessions !== null && sessions.length === 0 ? (
                <p className="muted">No conversations yet.</p>
              ) : null}
            </div>
          ) : tab === "skills" ? (
            <div style={{ flex: 1, overflowY: "auto", display: "grid", gap: 8, alignContent: "start" }}>
              <h3 style={{ margin: 0 }}>Skills</h3>
              {panelNote ? <p className="muted">{panelNote}</p> : null}
              {(skills ?? []).map((s, i) => (
                <div key={s.name ?? i} className="panel" style={{ padding: 12 }}>
                  <strong>{s.name ?? "skill"}</strong>
                  {s.description ? (
                    <p className="muted" style={{ margin: "4px 0 0" }}>{s.description}</p>
                  ) : null}
                </div>
              ))}
              {skills !== null && skills.length === 0 ? (
                <p className="muted">No skills installed yet.</p>
              ) : null}
            </div>
          ) : (
          <>
          <div ref={scrollRef} style={{ flex: 1, overflowY: "auto", display: "grid", gap: 8, alignContent: "start" }}>
            {messages.length === 0 ? (
              <p className="muted">Talk to your agent — same one as on iMessage.</p>
            ) : (
              messages.map((m, i) => (
                <div
                  key={i}
                  style={{
                    justifySelf: m.role === "user" ? "end" : "start",
                    background: m.role === "user" ? "var(--accent)" : "var(--bg)",
                    color: m.role === "user" ? "#0b0b0f" : "var(--text)",
                    border: m.role === "user" ? "none" : "1px solid var(--border)",
                    borderRadius: 12,
                    padding: "8px 12px",
                    maxWidth: "80%",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {m.text}
                </div>
              ))
            )}
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
            <input
              className="input"
              placeholder="Message your agent…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void send();
              }}
              disabled={busy}
            />
            <button className="btn" onClick={() => void send()} disabled={busy || !input.trim()}>
              Send
            </button>
          </div>
          </>
          )}
        </section>

        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Account</h3>
            <p className="muted" style={{ margin: "4px 0" }}>
              {me?.lines[0] ? `iMessage line: ${me.lines[0].phone}` : "No line yet"}
            </p>
            <p className="muted" style={{ margin: "4px 0" }}>
              {me?.addresses?.[0]
                ? `Email: ${me.addresses[0].address}`
                : "Email: set a username to create one"}
            </p>
            {me?.user.username ? (
              <p className="muted" style={{ margin: "4px 0" }}>
                Contact card: <a href={`/@${me.user.username}`}>/@{me.user.username}</a>
              </p>
            ) : null}
            <p className="muted" style={{ margin: "4px 0" }}>
              {me?.user.wallet_address
                ? `Wallet: ${me.user.wallet_address.slice(0, 6)}…${me.user.wallet_address.slice(-4)}`
                : "Wallet: not set up"}
            </p>
            <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input
                className="input"
                placeholder="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <button className="btn" onClick={() => void saveUsername()}>
                Save
              </button>
            </div>
            {note ? <p className="muted" style={{ marginBottom: 0 }}>{note}</p> : null}
          </div>

          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Speed &amp; Intelligence</h3>
            <select className="input" value={tier} onChange={(e) => void saveTier(e.target.value)}>
              <option value="fast">Fast</option>
              <option value="balanced">Balanced</option>
              <option value="deep">Deep</option>
            </select>
            {me?.entitlement ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                ${Number(me.entitlement.spend_mtd_usd).toFixed(2)} of $
                {Number(me.entitlement.monthly_cap_usd).toFixed(2)} used this month
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </main>
  );
}
