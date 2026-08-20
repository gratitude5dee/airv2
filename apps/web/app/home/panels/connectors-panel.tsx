"use client";

/**
 * Connectors — Composio toolkit connect/disconnect (extracted verbatim from
 * the old page.tsx connectors tab in the redesign phase-1 split; now
 * self-contained, OAuth redirect + PUT resync unchanged).
 */
import { useEffect, useState } from "react";
import { Orb } from "@/components/orb/Orb";

interface Toolkit {
  slug: string;
  name: string;
  logo: string | null;
}

interface Connection {
  toolkit: string;
  status: string;
  connected_at: string | null;
}

/** V8: per-connection health + "used by" hint, derived server-side. */
interface ConnectionHealth {
  toolkit: string;
  status: string;
  last_ok_at: string | null;
  used_by: string | null;
}

export function ConnectorsPanel({ active }: { active: boolean }) {
  const [toolkits, setToolkits] = useState<Toolkit[] | null>(null);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [connHealth, setConnHealth] = useState<ConnectionHealth[]>([]);
  const [connectorBusy, setConnectorBusy] = useState<string | null>(null);
  const [connectorNote, setConnectorNote] = useState<string | null>(null);
  const [connectorFilter, setConnectorFilter] = useState("");

  async function loadConnectors() {
    const res = await fetch("/api/connectors");
    if (res.ok) {
      const data = (await res.json()) as {
        toolkits?: Toolkit[];
        connections?: Connection[];
        health?: ConnectionHealth[];
      };
      setToolkits(data.toolkits ?? []);
      setConnections(data.connections ?? []);
      setConnHealth(data.health ?? []);
    }
    // Sync statuses (picks up OAuth flows completed since last visit).
    const sync = await fetch("/api/connectors", { method: "PUT" });
    if (sync.ok) {
      const data = (await sync.json()) as { connections?: Connection[] };
      setConnections(data.connections ?? []);
    }
  }

  useEffect(() => {
    if (active && toolkits === null) void loadConnectors();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  async function disconnectToolkit(toolkit: string) {
    setConnectorBusy(toolkit);
    setConnectorNote(null);
    try {
      const res = await fetch("/api/connectors", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ toolkit }),
      });
      if (res.ok) {
        setConnections((rows) =>
          rows.map((c) =>
            c.toolkit === toolkit ? { ...c, status: "revoked" } : c
          )
        );
      } else {
        setConnectorNote("Couldn't disconnect — try again shortly.");
      }
    } catch {
      setConnectorNote("Couldn't disconnect — try again shortly.");
    } finally {
      setConnectorBusy(null);
    }
  }

  async function connectToolkit(slug: string) {
    const res = await fetch("/api/connectors", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toolkit: slug }),
    });
    if (res.ok) {
      const data = (await res.json()) as { redirect_url?: string };
      if (data.redirect_url) window.location.href = data.redirect_url;
    }
  }

  if (!active) return null;

  return (
    <div className="grid flex-1 content-start gap-2 overflow-y-auto">
      <h3 className="m-0 text-[15px] font-semibold">Connectors</h3>
      <p className="muted m-0 text-[12px]">
        Connect your accounts so your agent can act on them. You approve each
        one.
      </p>
      <input
        className="input"
        placeholder="Search connectors…"
        value={connectorFilter}
        onChange={(e) => setConnectorFilter(e.target.value)}
      />
      {connectorNote ? (
        <p className="muted m-0 text-[12px]">{connectorNote}</p>
      ) : null}
      {connections.length > 0 ? (
        <div className="grid gap-2">
          {connections.map((c) => {
            const health = connHealth.find((h) => h.toolkit === c.toolkit);
            return (
              <div key={c.toolkit} className="panel !p-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <strong className="text-[13px]">{c.toolkit}</strong>
                    <p className="muted m-0 mt-0.5 text-[11px]">
                      {[
                        health?.used_by ? `Used by ${health.used_by}` : null,
                        health?.last_ok_at
                          ? `Last OK ${new Date(
                              health.last_ok_at
                            ).toLocaleDateString()}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" \u00b7 ")}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span
                      className={
                        "text-[12px] " +
                        (c.status === "active"
                          ? "text-[var(--success)]"
                          : c.status === "error"
                            ? "text-[var(--warning)]"
                            : "muted")
                      }
                    >
                      {c.status}
                    </span>
                    {c.status === "active" || c.status === "error" ? (
                      <button
                        className="btn btn-ghost !px-2.5 !py-1 !text-[12px]"
                        disabled={connectorBusy !== null}
                        onClick={() => void disconnectToolkit(c.toolkit)}
                      >
                        {connectorBusy === c.toolkit
                          ? "Disconnecting…"
                          : "Disconnect"}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : null}
      {(toolkits ?? [])
        .filter(
          (t) =>
            !connectorFilter ||
            t.name.toLowerCase().includes(connectorFilter.toLowerCase()) ||
            t.slug.includes(connectorFilter.toLowerCase())
        )
        .slice(0, 40)
        .map((t) => (
          <div
            key={t.slug}
            className="panel rise-in flex items-center justify-between !p-3"
          >
            <div className="flex items-center gap-2">
              {t.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={t.logo}
                  alt=""
                  width={20}
                  height={20}
                  className="rounded"
                />
              ) : null}
              <strong className="text-[13px]">{t.name}</strong>
            </div>
            {connections.some(
              (c) => c.toolkit === t.slug && c.status === "active"
            ) ? (
              <span className="muted text-[12px]">connected</span>
            ) : (
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                onClick={() => void connectToolkit(t.slug)}
              >
                Connect
              </button>
            )}
          </div>
        ))}
      {toolkits === null ? (
        <div className="py-2">
          <Orb pill label="Loading connectors…" />
        </div>
      ) : null}
    </div>
  );
}
