"use client";

/**
 * Right rail: installed mini-apps grid. Clicking an app docks it in-chat
 * (signed link in an iframe, spec §5); the ↗ affordance and the dock header
 * both fall back to a new tab via the shared launcher (D12).
 *
 * iOS-style arrangement: press-and-hold a tile to enter edit mode (wiggle),
 * drag to rearrange, release to save. The order is users.miniapp_home_order —
 * the same column the Home mini-app's press-and-hold writes — so the web rail
 * and the card launcher stay arranged alike.
 */
import { useEffect, useRef, useState } from "react";
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

const HOLD_MS = 450;

function rank(slug: string, saved: string[]): number {
  const i = saved.indexOf(slug);
  return i === -1 ? saved.length : i;
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
  const [order, setOrder] = useState<string[]>([]);
  const [editing, setEditing] = useState(false);
  const [dragging, setDragging] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const holdTimer = useRef(0);
  const savedOrder = useRef<string>("");
  const suppressClick = useRef(false);

  useEffect(() => {
    let stale = false;
    (async () => {
      try {
        const res = await fetch("/api/mini/apps");
        if (!res.ok) return;
        const data = (await res.json()) as {
          apps: AppRow[];
          home_order?: string[];
        };
        if (!stale) {
          setApps(data.apps);
          setOrder(data.home_order ?? []);
        }
      } catch {
        // grid is a nicety; the Apps panel is the full surface
      }
    })();
    return () => {
      stale = true;
    };
  }, []);

  const installed = (apps ?? [])
    .filter((a) => a.installed && a.status === "published")
    .sort((a, b) => rank(a.slug, order) - rank(b.slug, order));

  function stopEditing() {
    window.clearTimeout(holdTimer.current);
    if (!editing) return;
    setEditing(false);
    setDragging(null);
    suppressClick.current = true;
    window.setTimeout(() => {
      suppressClick.current = false;
    }, 0);
    const next = installed.map((a) => a.slug).join(",");
    if (next !== savedOrder.current) {
      void fetch("/api/settings/home-order", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order: next.split(",") }),
      }).catch(() => undefined);
    }
  }

  function onTilePointerDown(slug: string) {
    window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      savedOrder.current = installed.map((a) => a.slug).join(",");
      setEditing(true);
      setDragging(slug);
    }, HOLD_MS);
  }

  function onGridPointerMove(event: React.PointerEvent) {
    if (!editing || !dragging) {
      // Any real movement before the hold fires means a scroll, not a hold.
      window.clearTimeout(holdTimer.current);
      return;
    }
    event.preventDefault();
    const over = document.elementFromPoint(event.clientX, event.clientY);
    const target = over?.closest<HTMLElement>("[data-slug]");
    const slug = target?.dataset["slug"];
    if (!slug || slug === dragging) return;
    setOrder(() => {
      const slugs = installed.map((a) => a.slug);
      const from = slugs.indexOf(dragging);
      const to = slugs.indexOf(slug);
      if (from === -1 || to === -1) return slugs;
      slugs.splice(to, 0, ...slugs.splice(from, 1));
      return slugs;
    });
  }

  function onSpot(event: React.PointerEvent<HTMLElement>) {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    el.style.setProperty("--mx", `${event.clientX - rect.left}px`);
    el.style.setProperty("--my", `${event.clientY - rect.top}px`);
  }

  return (
    <div className="panel spot" onPointerMove={onSpot}>
      <div className="flex items-center justify-between gap-2">
        <h3 className="chrome mt-0 flex items-center gap-1.5 !text-[11px]">
          <PixelIcon glyph="grid" size={12} />
          Apps
        </h3>
        {editing ? (
          <button className="btn btn-ghost" onClick={stopEditing}>
            Done
          </button>
        ) : (
          <button
            className="btn btn-ghost"
            onClick={onOpenAppsPanel}
            title="Manage installed apps"
          >
            Manage
          </button>
        )}
      </div>
      {error ? <p className="muted m-0 text-[12px]">{error}</p> : null}
      {installed.length === 0 ? (
        <p className="muted m-0 text-[12px]">
          No apps installed yet — add some under APPS.
        </p>
      ) : (
        <div
          ref={gridRef}
          className={
            "grid grid-cols-3 gap-2" + (editing ? " appgrid-editing" : "")
          }
          style={editing ? { touchAction: "none" } : undefined}
          onPointerMove={onGridPointerMove}
          onPointerUp={stopEditing}
          onPointerCancel={stopEditing}
        >
          {installed.slice(0, 9).map((app) => (
            <div
              key={app.slug}
              data-slug={app.slug}
              className={
                "appgrid-item relative" +
                (dragging === app.slug && editing ? " drag" : "")
              }
            >
              <button
                className="flex w-full cursor-pointer flex-col items-center gap-1 border-0 bg-transparent p-0 text-[var(--text)]"
                title={app.description}
                onPointerDown={() => onTilePointerDown(app.slug)}
                onClick={() => {
                  if (editing || suppressClick.current) return;
                  onOpenInChat(app.slug);
                }}
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
              {editing ? null : (
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
              )}
            </div>
          ))}
        </div>
      )}
      {editing ? (
        <p className="muted m-0 mt-2 text-[10px]">
          Drag to rearrange — Done saves.
        </p>
      ) : null}
    </div>
  );
}
