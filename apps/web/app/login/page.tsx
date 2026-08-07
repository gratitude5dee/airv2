"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Orb } from "@/components/orb/Orb";

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
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[35vh] rotate-180">
        <DitherGradient from="blue" direction="up" opacity={0.25} />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[380px] flex-col justify-center px-6">
        <div className="rise-in">
          <div className="mb-6 flex flex-col items-center gap-3 text-center">
            <Orb size={28} label="air" />
            <h1 className="m-0 text-[28px] font-semibold tracking-[-0.02em]">
              air
            </h1>
            <p className="m-0 text-[13px] text-muted-2">
              Sign in with the phone number your agent knows.
            </p>
          </div>

          <div className="panel grid gap-3">
            {stage === "phone" ? (
              <>
                <input
                  className="input"
                  placeholder="+1 555 555 5555"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && phone && !busy) void sendCode();
                  }}
                  autoFocus
                />
                <button className="btn" onClick={sendCode} disabled={busy || !phone}>
                  {busy ? (
                    <Orb size={16} label="Sending…" pill={false} />
                  ) : (
                    "Text me a code"
                  )}
                </button>
              </>
            ) : (
              <>
                <input
                  className="input text-center tracking-[0.3em]"
                  placeholder="6-digit code"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && code.length >= 6 && !busy) void verify();
                  }}
                  autoFocus
                />
                <button className="btn" onClick={verify} disabled={busy || code.length < 6}>
                  {busy ? <Orb size={16} label="Verifying…" pill={false} /> : "Sign in"}
                </button>
                <button className="btn btn-ghost" onClick={() => setStage("phone")}>
                  Different number
                </button>
              </>
            )}
            {error ? (
              <p className="m-0 text-[12px] text-danger" role="alert">
                {error}
              </p>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
