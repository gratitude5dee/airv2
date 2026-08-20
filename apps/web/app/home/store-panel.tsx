"use client";

/**
 * App Store screen (spec §4) — the Pixel OS showpiece. Featured banner
 * (DitherGradient + one gloss band, rotating first-party apps), mono category
 * pills, 4-up grid of chunky outlined tiles with price/gate badges and a
 * dithered selection marquee, and a detail sheet whose Open docks the app
 * in-chat and whose Install/Pin posts to /api/mini/install. Search rides the
 * existing /api/store/search projection.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { DitherButton } from "@/components/dither-kit/button";
import { DitherGradient } from "@/components/dither-kit/gradient";
import { DitherMarquee } from "@/components/dither-kit/marquee";
import { PixelIcon } from "@/components/dither-kit/icon";
import { pixelPrefersReducedMotion } from "@/components/dither-kit/pixel";
import { AppTile } from "./app-tile";
import { launchMiniApp } from "./launch";

interface StoreApp {
  slug: string;
  name: string;
  description: string;
  icon_url: string | null;
  status: string;
  installed: boolean;
  publisher_username: string | null;
  access: "single" | "multiplayer";
  password_gated: boolean;
  x402_enabled: boolean;
  x402_price_usdc: number | null;
}

interface EarningsRow {
  slug: string;
  name: string;
  receipts: number;
  total_usdc: number;
}

/** Same slug buckets as the public store home. */
const CATEGORIES: [string, string[]][] = [
  ["Agent", ["computer", "browser", "connect", "onboarding", "settings"]],
  ["Work", ["calendar", "inbox", "crm", "analytics"]],
  ["Create", ["video", "image", "shop"]],
  ["Money", ["pay", "vault"]],
];

const FEATURED_SLUGS = ["ads", "pay", "calendar"];
const ROTATE_MS = 7000;

function gateBadge(app: StoreApp): string | null {
  if (app.x402_enabled) {
    return app.x402_price_usdc ? `$${app.x402_price_usdc}` : "$";
  }
  if (app.password_gated) return "•••";
  return null;
}

function gateLines(app: StoreApp): string[] {
  const gates: string[] = [];
  if (app.password_gated) gates.push("Password protected");
  if (app.x402_enabled) {
    gates.push(
      app.x402_price_usdc
        ? `Paid — $${app.x402_price_usdc} USDC (x402)`
        : "Paid — x402"
    );
  }
  if (gates.length === 0) gates.push("Free — sign in to open");
  return gates;
}

export function StorePanel({
  active,
  onOpenInChat,
}: {
  active: boolean;
  /** Mint a signed link and dock the app in the chat column. */
  onOpenInChat: (slug: string) => void;
}) {
  const [apps, setApps] = useState<StoreApp[] | null>(null);
  const [earnings, setEarnings] = useState<EarningsRow[]>([]);
  const [adsBlocked, setAdsBlocked] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [category, setCategory] = useState<string>("All");
  const [selected, setSelected] = useState<string | null>(null);
  const [featuredIdx, setFeaturedIdx] = useState(0);
  const [query, setQuery] = useState("");
  const [searchSlugs, setSearchSlugs] = useState<Set<string> | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const searchSeq = useRef(0);

  useEffect(() => {
    if (!active || apps !== null) return;
    let stale = false;
    (async () => {
      try {
        const res = await fetch("/api/mini/apps?earnings=1");
        if (!res.ok) {
          if (!stale) setError("Couldn't load the store.");
          return;
        }
        const data = (await res.json()) as {
          apps: StoreApp[];
          earnings?: EarningsRow[];
          ads_writes_blocked?: boolean;
        };
        if (!stale) {
          setApps(data.apps.filter((a) => a.status === "published"));
          setEarnings(data.earnings ?? []);
          setAdsBlocked(data.ads_writes_blocked === true);
        }
      } catch {
        if (!stale) setError("Couldn't load the store.");
      }
    })();
    return () => {
      stale = true;
    };
  }, [active, apps]);

  // Featured banner rotation — static under prefers-reduced-motion.
  useEffect(() => {
    if (!active || pixelPrefersReducedMotion()) return;
    const timer = setInterval(
      () => setFeaturedIdx((i) => i + 1),
      ROTATE_MS
    );
    return () => clearInterval(timer);
  }, [active]);

  // Debounced search over the existing public store index.
  useEffect(() => {
    if (!active) return;
    const q = query.trim();
    if (!q) {
      setSearchSlugs(null);
      return;
    }
    const seq = ++searchSeq.current;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/store/search?q=${encodeURIComponent(q)}`);
        if (!res.ok || seq !== searchSeq.current) return;
        const data = (await res.json()) as { results: { slug: string }[] };
        if (seq === searchSeq.current) {
          setSearchSlugs(new Set(data.results.map((r) => r.slug)));
        }
      } catch {
        // keep the previous grid on search failure
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [active, query]);

  const featured = useMemo(() => {
    const list = (apps ?? []).filter((a) => FEATURED_SLUGS.includes(a.slug));
    return list.length > 0 ? list : (apps ?? []).slice(0, 3);
  }, [apps]);

  const visible = useMemo(() => {
    let list = apps ?? [];
    if (category === "Yours") {
      list = list.filter((a) => a.installed);
    } else if (category !== "All") {
      const slugs = CATEGORIES.find(([name]) => name === category)?.[1] ?? [];
      list = list.filter((a) => slugs.includes(a.slug));
    }
    if (searchSlugs) list = list.filter((a) => searchSlugs.has(a.slug));
    return list;
  }, [apps, category, searchSlugs]);

  const detail = useMemo(
    () => (apps ?? []).find((a) => a.slug === selected) ?? null,
    [apps, selected]
  );
  const detailEarnings = useMemo(
    () => earnings.find((row) => row.slug === selected) ?? null,
    [earnings, selected]
  );

  async function toggleInstall(app: StoreApp) {
    setBusy(app.slug);
    try {
      const res = await fetch("/api/mini/install", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          app: app.slug,
          action: app.installed ? "uninstall" : "install",
        }),
      });
      if (res.ok) {
        setApps(
          (prev) =>
            prev?.map((a) =>
              a.slug === app.slug ? { ...a, installed: !a.installed } : a
            ) ?? prev
        );
      }
    } catch {
      // leave state unchanged; the button stays actionable
    } finally {
      setBusy(null);
    }
  }

  if (!active) return null;

  const banner = featured.length > 0 ? featured[featuredIdx % featured.length] : null;

  return (
    <div className="flex flex-1 flex-col gap-4 overflow-y-auto">
      <div className="chrome flex items-center rounded-[9px] border border-[var(--outline)] bg-[var(--text)] px-3 py-2 text-[var(--bg)] shadow-[3px_3px_0_var(--hard)]">
        <PixelIcon glyph="store" size={12} />
        <span className="mx-auto tracking-[0.22em]">AIR · APP STORE</span>
        <PixelIcon glyph="bolt" size={12} />
      </div>

      {banner ? (
        <div className="relative flex-shrink-0 overflow-hidden rounded-xl border border-[var(--outline)] bg-surface shadow-[3px_3px_0_var(--hard)]">
          <DitherGradient
            from="blue"
            direction="down"
            opacity={0.3}
            className="absolute inset-0"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 h-[34%]"
            style={{
              background:
                "linear-gradient(var(--chrome-top), rgba(255,255,255,0))",
            }}
          />
          <div className="relative flex items-center gap-4 p-5">
            <AppTile
              slug={banner.slug}
              name={banner.name}
              iconUrl={banner.icon_url}
              size={84}
              radius={14}
            />
            <div className="min-w-0">
              <div className="chrome mb-1 text-[var(--muted-2)]">
                Featured · first-party
              </div>
              <h2 className="chrome m-0 mb-1 !text-[20px] tracking-[0.16em]">
                {banner.name || banner.slug}
              </h2>
              <p className="muted m-0 max-w-[520px] text-[13px]">
                {banner.description}
              </p>
              <div className="mt-3 flex gap-2">
                <DitherButton
                  color="blue"
                  onClick={() => onOpenInChat(banner.slug)}
                >
                  Open
                </DitherButton>
                <button className="btn btn-ghost" onClick={() => setSelected(banner.slug)}>
                  Details
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {["All", ...CATEGORIES.map(([name]) => name), "Yours"].map((name) => (
          <button
            key={name}
            className={"seg !rounded-[7px] border !border-[var(--outline)] !px-2.5 !py-1.5" + (category === name ? " pill-active" : "")}
            aria-pressed={category === name}
            onClick={() => setCategory(name)}
          >
            {name}
          </button>
        ))}
        <input
          className="input chrome ml-auto w-44 !rounded-[7px] !border-[var(--outline)] !py-1.5"
          placeholder="SEARCH"
          value={query}
          aria-label="Search the store"
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {error ? <p className="muted m-0 text-[12px]">{error}</p> : null}
      {apps === null && !error ? (
        <p className="muted m-0 text-[12px]">Loading…</p>
      ) : null}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
        {visible.map((app) => {
          const badge = gateBadge(app);
          const isSelected = selected === app.slug;
          return (
            <button
              key={app.slug}
              className="flex cursor-pointer flex-col items-center gap-2 border-0 bg-transparent p-0 text-[var(--text)]"
              aria-pressed={isSelected}
              onClick={() => setSelected(isSelected ? null : app.slug)}
            >
              <span className="relative">
                <AppTile
                  slug={app.slug}
                  name={app.name}
                  iconUrl={app.icon_url}
                  size={64}
                  radius={10}
                />
                {isSelected ? <DitherMarquee seed={app.slug} /> : null}
                {app.slug === "ads" && adsBlocked ? (
                  <span
                    className="chrome absolute -right-2 -top-2 rounded-[6px] border border-[var(--outline)] bg-[var(--text)] px-1 py-0.5 text-[9px] text-[var(--bg)]"
                    title="Ad writes are blocked — no spend ceiling set"
                  >
                    $0
                  </span>
                ) : badge ? (
                  <span className="chrome absolute -right-2 -top-2 rounded-[6px] border border-[var(--outline)] bg-[var(--text)] px-1 py-0.5 text-[9px] text-[var(--bg)]">
                    {badge}
                  </span>
                ) : app.installed ? (
                  <span className="chrome absolute -right-2 -top-2 rounded-[6px] border border-[var(--outline)] bg-surface px-1 py-0.5 text-[9px]">
                    ✓
                  </span>
                ) : null}
              </span>
              <span className="chrome text-[9.5px]">{app.name || app.slug}</span>
              <span className="muted -mt-1.5 text-[9px]">
                @{app.publisher_username ?? "air"}
              </span>
            </button>
          );
        })}
      </div>
      {apps !== null && visible.length === 0 ? (
        <p className="muted m-0 text-[12px]">No apps here yet.</p>
      ) : null}

      {detail ? (
        <div className="panel rise-in !p-4">
          <div className="flex items-start gap-3">
            <AppTile
              slug={detail.slug}
              name={detail.name}
              iconUrl={detail.icon_url}
              size={52}
              radius={9}
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <h3 className="chrome m-0 !text-[13px]">
                  {detail.name || detail.slug}
                </h3>
                <span className="muted text-[11px]">
                  @{detail.publisher_username ?? "air"} ·{" "}
                  {detail.access === "multiplayer" ? "multiplayer" : "single"}
                </span>
              </div>
              <p className="muted m-0 mt-1 text-[12px]">{detail.description}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {gateLines(detail).map((gate) => (
                  <span
                    key={gate}
                    className="chrome rounded-[6px] border border-[var(--ring)] bg-surface-2 px-1.5 py-0.5 text-[9px]"
                  >
                    {gate}
                  </span>
                ))}
                {detailEarnings && detailEarnings.receipts > 0 ? (
                  <span
                    className="chrome rounded-[6px] border border-[var(--outline)] px-1.5 py-0.5 text-[9px] text-success"
                    title="Your x402 earnings from this app"
                  >
                    Earned ${detailEarnings.total_usdc.toFixed(2)} ·{" "}
                    {detailEarnings.receipts} receipts
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex flex-none flex-col gap-2">
              <DitherButton
                color="blue"
                onClick={() => onOpenInChat(detail.slug)}
              >
                Open
              </DitherButton>
              <button
                className="btn btn-ghost"
                disabled={busy === detail.slug}
                onClick={() => void toggleInstall(detail)}
              >
                {detail.installed ? "Unpin" : "Install"}
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => {
                  void launchMiniApp({ app: detail.slug });
                }}
              >
                New tab ↗
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
