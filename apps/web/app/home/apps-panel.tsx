"use client";

/**
 * MA0 Apps tab in /home: first-party registry apps with install/uninstall
 * (a pin, not a permission) and one-click launch. Launch mints an owner
 * token via /api/mini/link and opens mini.wzrd.tech/<slug>?t=…; "Store"
 * opens the mini-origin store already signed in via the handoff link.
 */
import { useCallback, useEffect, useState } from "react";

interface AppRow {
  slug: string;
  name: string;
  description: string;
  status: string;
  installed: boolean;
}

export function AppsPanel({ active }: { active: boolean }) {
  const [apps, setApps] = useState<AppRow[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const res = await fetch("/api/mini/apps");
    if (res.ok) {
      const data = (await res.json()) as { apps: AppRow[] };
      setApps(data.apps);
    } else {
      setError("Couldn't load apps.");
    }
  }, []);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  async function launch(slug: string) {
    setBusy(slug);
    setError(null);
    const res = await fetch("/api/mini/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ app: slug }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Couldn't open that app.");
      return;
    }
    const data = (await res.json()) as { url: string };
    window.open(data.url, "_blank", "noopener");
  }

  async function openStore() {
    setBusy("__store");
    setError(null);
    const res = await fetch("/api/mini/link", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: "store" }),
    });
    setBusy(null);
    if (!res.ok) {
      setError("Couldn't open the store.");
      return;
    }
    const data = (await res.json()) as { url: string };
    window.open(data.url, "_blank", "noopener");
  }

  async function toggleInstall(app: AppRow) {
    setBusy(app.slug);
    await fetch("/api/mini/install", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        app: app.slug,
        action: app.installed ? "uninstall" : "install",
      }),
    });
    setBusy(null);
    void refresh();
  }

  if (!active) return null;

  const installed = (apps ?? []).filter((app) => app.installed);
  const available = (apps ?? []).filter((app) => !app.installed);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <h2 className="m-0 text-[15px] font-semibold">Apps</h2>
        <button
          className="btn-ghost ml-auto text-[12px]"
          disabled={busy === "__store"}
          onClick={() => void openStore()}
        >
          Open store ↗
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
              <h3 className="muted m-0 mb-2 text-[11px] font-semibold uppercase tracking-[0.08em]">
                {label}
              </h3>
              <div className="flex flex-col gap-2">
                {rows.map((app) => (
                  <div
                    key={app.slug}
                    className="panel !p-3 flex items-center gap-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="m-0 text-[13px] font-medium">
                        {app.name || app.slug}
                        {app.status !== "published" ? (
                          <span className="muted ml-2 text-[10px] uppercase">
                            soon
                          </span>
                        ) : null}
                      </p>
                      <p className="muted m-0 truncate text-[12px]">
                        {app.description}
                      </p>
                    </div>
                    {app.status === "published" ? (
                      <button
                        className="btn text-[12px]"
                        disabled={busy === app.slug}
                        onClick={() => void launch(app.slug)}
                      >
                        Open
                      </button>
                    ) : null}
                    <button
                      className="btn-ghost text-[12px]"
                      disabled={busy === app.slug}
                      onClick={() => void toggleInstall(app)}
                    >
                      {app.installed ? "Remove" : "Install"}
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
