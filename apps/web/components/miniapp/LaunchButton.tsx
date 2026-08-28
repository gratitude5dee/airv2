"use client";

/**
 * Open/Install CTA on the store detail page (MA0). POST /api/mini/launch
 * runs the gate chain server-side; 401 sends the visitor to the store
 * login, 402 routes to the app's human pay page (the browser GET of the app
 * URL renders the x402 challenge with payment instructions).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";

export function LaunchButton({
  slug,
  signInUrl = "/login",
  payUrl,
}: {
  slug: string;
  signInUrl?: string;
  /** The app URL whose browser GET renders the x402 pay page. */
  payUrl?: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function logFailure(status: number, reason: string, ms: number) {
    console.error(
      JSON.stringify({
        msg: "store launch failed",
        slug,
        status,
        reason,
        ms: Math.round(ms * 10) / 10,
      })
    );
  }

  async function open() {
    setBusy(true);
    setError(null);
    const t0 = performance.now();
    let res: Response;
    try {
      res = await fetch("/api/mini/launch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
    } catch (err) {
      setBusy(false);
      console.error(
        JSON.stringify({
          msg: "store launch failed",
          slug,
          reason: "fetch_threw",
          error: err instanceof Error ? err.message : String(err),
          ms: Math.round((performance.now() - t0) * 10) / 10,
        })
      );
      setError("Couldn't open this app right now.");
      return;
    }
    const ms = performance.now() - t0;
    setBusy(false);
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      window.location.assign(data.url);
      return;
    }
    if (res.status === 401) {
      logFailure(res.status, "no_store_session", ms);
      if (signInUrl.startsWith("/")) {
        router.push(signInUrl);
      } else {
        window.location.assign(signInUrl);
      }
      return;
    }
    if (res.status === 402) {
      logFailure(res.status, "payment_required", ms);
      if (payUrl) {
        window.location.assign(payUrl);
      } else {
        setError("This app is paid — open it directly to see payment options.");
      }
      return;
    }
    logFailure(res.status, "launch_not_ok", ms);
    setError("Couldn't open this app right now.");
  }

  return (
    <div className="flex flex-col gap-2">
      <button className="btn" disabled={busy} onClick={open}>
        {busy ? "Opening…" : "Open"}
      </button>
      {error ? <p className="m-0 text-[12px] text-muted">{error}</p> : null}
    </div>
  );
}
