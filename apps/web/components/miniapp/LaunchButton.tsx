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

  async function open() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/mini/launch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug }),
    });
    setBusy(false);
    if (res.ok) {
      const data = (await res.json()) as { url: string };
      window.location.assign(data.url);
      return;
    }
    if (res.status === 401) {
      if (signInUrl.startsWith("/")) {
        router.push(signInUrl);
      } else {
        window.location.assign(signInUrl);
      }
      return;
    }
    if (res.status === 402) {
      if (payUrl) {
        window.location.assign(payUrl);
      } else {
        setError("This app is paid — open it directly to see payment options.");
      }
      return;
    }
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
