"use client";

/**
 * MA0 store login on the mini origin. Direct visitors sign in with the same
 * thirdweb SMS OTP as the main app, but the cookie set is the mini-origin
 * store session — never air_session (the origins share no session state).
 * Owners arriving from /home skip this page entirely via the signed handoff
 * (/api/mini/session?t=…).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { Orb } from "@/components/orb/Orb";

export default function StoreLoginPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"phone" | "code">("phone");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function sendCode() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/mini/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone }),
    });
    setBusy(false);
    if (res.ok) {
      setStage("code");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "could not send code");
    }
  }

  async function verify() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/mini/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ phone, code }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/");
    } else {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "invalid code");
    }
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[45vh]">
        <DitherGradient from="blue" direction="up" opacity={0.35} />
      </div>

      <div className="relative mx-auto flex min-h-screen w-full max-w-[380px] flex-col items-center justify-center px-6 text-center">
        <div className="rise-in flex w-full flex-col items-center gap-5">
          <Orb size={32} label="air" />
          <h1 className="m-0 text-[28px] font-semibold tracking-[-0.03em]">
            Sign in to mini
          </h1>
          {stage === "phone" ? (
            <>
              <input
                className="input w-full"
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
              <button
                className="btn w-full"
                disabled={busy || !phone}
                onClick={sendCode}
              >
                {busy ? "Sending…" : "Send code"}
              </button>
            </>
          ) : (
            <>
              <input
                className="input w-full"
                type="text"
                inputMode="numeric"
                placeholder="Code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
              />
              <button
                className="btn w-full"
                disabled={busy || !code}
                onClick={verify}
              >
                {busy ? "Checking…" : "Sign in"}
              </button>
            </>
          )}
          {error ? (
            <p className="m-0 text-[12px] text-muted">{error}</p>
          ) : null}
        </div>
      </div>
    </main>
  );
}
