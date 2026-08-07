"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setBusy(false);
    if (res.ok) {
      setStage("code");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        res.status === 429
          ? "Too many codes requested — wait a few minutes and try again."
          : (data.error ?? "could not send code")
      );
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/home");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(
        data.error === "no account"
          ? "No account for that number yet — ask for an invite."
          : "That code didn't match."
      );
    }
  }

  return (
    <main style={{ maxWidth: 380, margin: "15vh auto", padding: 16 }}>
      <h1 style={{ marginBottom: 4 }}>air</h1>
      <p className="muted" style={{ marginTop: 0 }}>
        Sign in with the phone number your agent knows.
      </p>
      <div className="panel" style={{ display: "grid", gap: 12 }}>
        {stage === "phone" ? (
          <>
            <input
              className="input"
              placeholder="+1 555 555 5555"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              autoFocus
            />
            <button className="btn" onClick={sendCode} disabled={busy || !phone}>
              {busy ? "Sending…" : "Text me a code"}
            </button>
          </>
        ) : (
          <>
            <input
              className="input"
              placeholder="6-digit code"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus
            />
            <button className="btn" onClick={verify} disabled={busy || code.length < 6}>
              {busy ? "Verifying…" : "Sign in"}
            </button>
            <button className="btn btn-ghost" onClick={() => setStage("phone")}>
              Different number
            </button>
          </>
        )}
        {error ? <p style={{ color: "#ff7b72", margin: 0 }}>{error}</p> : null}
      </div>
    </main>
  );
}
