"use client";

/**
 * Right rail: installed mini-apps grid. Clicking an app docks it in-chat
 * (signed link in an iframe, spec §5); the ↗ affordance and the dock header
 * both fall back to a new tab via the shared launcher (D12).
 */
import { useEffect, useState } from "react";
import { launchMiniApp } from "../launch";
import { AppTile } from "../app-tile";
import { PixelIcon } from "@/components/dither-kit/icon";

interface AppRow {
  slug: string;
  name: string;
  description: string;
  icon_url?: string | null;
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
        <h3 className="chrome mt-0 flex items-center gap-1.5 !text-[11px]">
          <PixelIcon glyph="grid" size={12} />
          Apps
        </h3>
        <button
          className="btn btn-ghost"
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
        <div className="grid grid-cols-3 gap-2">
          {installed.slice(0, 9).map((app) => (
            <div key={app.slug} className="relative">
              <button
                className="flex w-full cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 text-[var(--text)]"
                title={app.description}
                onClick={() => onOpenInChat(app.slug)}
              >
                <AppTile
                  slug={app.slug}
                  name={app.name}
                  iconUrl={app.icon_url}
                  size={44}
                  radius={9}
                />
                <span className="chrome !text-[8.5px]">
                  {app.name || app.slug}
                </span>
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
