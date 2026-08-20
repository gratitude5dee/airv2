"use client";

/**
 * Right rail: installed mini-apps grid. Clicking an app docks it in-chat
 * (signed link in an iframe, spec §5); the ↗ affordance and the dock header
 * both fall back to a new tab via the shared launcher (D12).
 */
import { useEffect, useState } from "react";
import { launchMiniApp } from "../launch";

interface AppRow {
  slug: string;
  name: string;
  description: string;
  status: string;
  installed: boolean;
}

export function AppsGrid({
  onOpenInChat,
  onOpenAppsPanel,
}: {
  /** Mint a signed link and dock the app in the chat column. */
  onOpenInChat: (slug: string) => void;
  onOpenAppsPanel: () => void;
}) {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const res = await fetch("/api/mini/apps");
        if (!res.ok) return;
        const data = (await res.json()) as { apps: AppRow[] };
        if (!stale) setApps(data.apps);
      } catch {
        // grid is a nicety; the Apps panel is the full surface
      }
    })();
    return () => {
      stale = true;
    };
  }, []);

  const installed = (apps ?? []).filter(
    (a) => a.installed && a.status === "published"
  );

  return (
    <div className="panel">
      <div className="flex items-center justify-between gap-2">
        <h3 className="mt-0 text-[15px] font-semibold">Apps</h3>
        <button
          className="btn-ghost text-[12px]"
          onClick={onOpenAppsPanel}
          title="Manage installed apps"
        >
          Manage
        </button>
      </div>
      {error ? <p className="muted m-0 text-[12px]">{error}</p> : null}
      {installed.length === 0 ? (
        <p className="muted m-0 text-[12px]">
          No apps installed yet — add some under APPS.
        </p>
      ) : (
        <div className="grid grid-cols-3 gap-1.5">
          {installed.slice(0, 9).map((app) => (
            <div key={app.slug} className="relative">
              <button
                className="seg w-full rounded-lg !px-1 !py-2 text-center text-[11px] shadow-[0_0_0_0.5px_var(--ring)]"
                title={app.description}
                onClick={() => onOpenInChat(app.slug)}
              >
                {app.name || app.slug}
              </button>
              <button
                className="muted absolute right-0.5 top-0.5 cursor-pointer border-0 bg-transparent p-0.5 text-[10px] leading-none"
                aria-label={`Open ${app.name || app.slug} in a new tab`}
                title="Open in new tab"
                onClick={() => {
                  void launchMiniApp({ app: app.slug }).then((ok) => {
                    if (!ok) setError("Couldn't open that app.");
                  });
                }}
              >
                ↗
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
