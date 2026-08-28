"use client";

/**
 * MA0 Apps tab in /home: first-party registry apps with install/uninstall
 * (a pin, not a permission) and one-click launch. Launch mints an owner
 * token via /api/mini/link and opens mini.wzrd.tech/<slug>?t=…; "Store"
 * opens the mini-origin store already signed in via the handoff link.
 */
import { useState } from "react";
import { launchMiniAppDetailed, type LaunchResult } from "./launch";
import { AppTile } from "./app-tile";
import { useStaleWhileRevalidate } from "./use-swr";

interface AppRow {
  slug: string;
  name: string;
  description: string;
  icon_url?: string | null;
  status: string;
  installed: boolean;
}

export function AppsPanel({
  onOpenStore,
}: {
  /** Navigate to the in-app App Store section. */
  onOpenStore?: () => void;
}) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // D6: stale-while-revalidate — cached apps render instantly on remount
  // while a background refresh runs.
  const { data: apps, refresh } = useStaleWhileRevalidate<AppRow[]>(
    "apps-panel",
    true,
    async () => {
      try {
        const res = await fetch("/api/mini/apps");
        if (res.ok) {
          const data = (await res.json()) as { apps: AppRow[] };
          return data.apps;
        }
        setError("Couldn't load apps.");
      } catch {
        setError("Couldn't load apps.");
      }
      return undefined;
    }
  );

  function logFailure(result: LaunchResult, surface: string) {
    console.error(
      JSON.stringify({
        msg: "apps panel launch failed",
        surface,
        slug: result.slug,
        reason: result.reason,
        status: result.status ?? null,
        mint_ms: result.mintMs,
        ms: result.ms,
      })
    );
  }

  async function launch(slug: string) {
    setBusy(slug);
    setError(null);
    const result = await launchMiniAppDetailed({ app: slug });
    setBusy(null);
    if (!result.ok) {
      logFailure(result, "apps-panel");
      setError("Couldn't open that app.");
    }
  }

  async function openStore() {
    setBusy("__store");
    setError(null);
    const result = await launchMiniAppDetailed({ target: "store" });
    setBusy(null);
    if (!result.ok) {
      logFailure(result, "apps-panel-store");
      setError("Couldn't open the store.");
    }
  }

  async function toggleInstall(app: AppRow) {
    setBusy(app.slug);
    try {
      await fetch("/api/mini/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: app.slug,
          action: app.installed ? "uninstall" : "install",
        }),
      });
    } catch {
      setError("That didn't go through — try again.");
    }
    setBusy(null);
    void refresh();
  }

  const installed = (apps ?? []).filter((app) => app.installed);
  const available = (apps ?? []).filter((app) => !app.installed);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="chrome m-0 !text-[12px]">Installed</h2>
        {onOpenStore ? (
          <button className="btn btn-ghost ml-auto" onClick={onOpenStore}>
            App Store
          </button>
        ) : null}
        <button
          className={"btn btn-ghost" + (onOpenStore ? "" : " ml-auto")}
          disabled={busy === "__store"}
          onClick={() => void openStore()}
        >
          Store ↗
        </button>
      </div>
      {error ? <p className="muted m-0 text-[12px]">{error}</p> : null}
      {apps === null ? (
        <p className="muted m-0 text-[13px]">Loading…</p>
      ) : (
        [
          ["Installed", installed] as const,
          ["All apps", available] as const,
        ].map(([label, rows]) =>
          rows.length === 0 ? null : (
            <section key={label}>
              <h3 className="chrome-2 m-0 mb-2">{label}</h3>
              <div className="flex flex-col gap-2">
                {rows.map((app) => (
                  <div
                    key={app.slug}
                    className="panel !p-3 flex items-center gap-3"
                  >
                    <AppTile
                      slug={app.slug}
                      name={app.name}
                      iconUrl={app.icon_url}
                      size={36}
                      radius={7}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="chrome m-0 !text-[11px]">
                        {app.name || app.slug}
                        {app.status !== "published" ? (
                          <span className="muted ml-2 text-[9px]">soon</span>
                        ) : null}
                      </p>
                      <p className="muted m-0 truncate text-[12px]">
                        {app.description}
                      </p>
                    </div>
                    {app.status === "published" ? (
                      <button
                        className="btn"
                        disabled={busy === app.slug}
                        onClick={() => void launch(app.slug)}
                      >
                        Open
                      </button>
                    ) : null}
                    <button
                      className="btn btn-ghost"
                      disabled={busy === app.slug}
                      onClick={() => void toggleInstall(app)}
                    >
                      {app.installed ? "Unpin" : "Install"}
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )
        )
      )}
    </div>
  );
}
