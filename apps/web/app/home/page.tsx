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
        <button className="btn btn-ghost" onClick={logout}>
          Sign out
        </button>
      </header>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 16 }}>
        <section className="panel" style={{ display: "flex", flexDirection: "column", height: "70vh" }}>
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
        </section>

        <aside style={{ display: "grid", gap: 16, alignContent: "start" }}>
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>Account</h3>
            <p className="muted" style={{ margin: "4px 0" }}>
              {me?.lines[0] ? `iMessage line: ${me.lines[0].phone}` : "No line yet"}
            </p>
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
