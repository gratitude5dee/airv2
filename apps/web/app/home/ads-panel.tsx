"use client";

/**
 * Ads surface, five subtabs: Meta Business onboarding, creative gallery,
 * deployment (finalize/schedule/spend), pixels, and analytics + agent chat.
 * Everything runs through AirV2's authenticated server routes — provider
 * OAuth lives agent-side in the box's Meta Ads MCP, spend-mutating writes
 * land in "Needs you", and the same actions stay available from Hermes
 * chat/iMessage because the agent shares the identical box state.
 */

import { useEffect, useRef, useState } from "react";
import { Orb } from "@/components/orb/Orb";

interface AdAccount {
  id: string;
  provider: string;
  account_ref: string;
  label: string | null;
  status: string;
}

interface AdCampaign {
  id: string;
  account_id: string;
  campaign_ref: string;
  name: string | null;
  daily_budget_cents: number;
  status: string;
}

interface AdSpec {
  id: string;
  stale: boolean;
}

interface AdWrite {
  id: string;
  kind: string;
  campaign_ref: string | null;
  status: string;
  daily_budget_cents: number | null;
  error: string | null;
  created_at: string;
}

interface AdGroupJob {
  jobId: string;
  specId: string;
  costEstimate: number;
  state: string;
  conformant: boolean | null;
  gaps: string[];
}

interface CreativeAsset {
  id: string;
  box_asset_id: string;
  kind: string | null;
  ext: string | null;
  bytes: number | null;
  created_at: string;
}

interface AdPixel {
  id: string;
  account_id: string | null;
  pixel_ref: string;
  name: string | null;
  status: string;
  created_at: string;
}

interface AdsAnalytics {
  window_days: number;
  spend_total_cents: number;
  spend_by_campaign: { campaign_ref: string; spend_cents: number }[];
  conversions_by_event: { event: string; count: number; value_cents: number }[];
  conversion_count: number;
  truncated?: boolean;
}

type AdsTab = "onboarding" | "gallery" | "deploy" | "pixels" | "analytics";

const ADS_TABS: [AdsTab, string][] = [
  ["onboarding", "Get set up"],
  ["gallery", "Creative"],
  ["deploy", "Deploy"],
  ["pixels", "Pixels"],
  ["analytics", "Analytics"],
];

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdsPanel({
  active,
  onAskAgent,
}: {
  active: boolean;
  /** Jump to the chat tab with a prefilled message — the agent (same one as
   * iMessage) completes Meta logins and answers deeper data questions. */
  onAskAgent: (prefill: string) => void;
}) {
  const [subtab, setSubtab] = useState<AdsTab>("onboarding");
  const [accounts, setAccounts] = useState<AdAccount[] | null>(null);
  const [campaigns, setCampaigns] = useState<AdCampaign[]>([]);
  const [ceilingCents, setCeilingCents] = useState(0);
  const [specs, setSpecs] = useState<AdSpec[]>([]);
  const [writes, setWrites] = useState<AdWrite[]>([]);
  const [note, setNote] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [loading, setLoading] = useState(false);
  const loadId = useRef(0);

  // Gallery
  const [assets, setAssets] = useState<CreativeAsset[] | null>(null);
  const [specId, setSpecId] = useState("");
  const [offer, setOffer] = useState("");
  const [job, setJob] = useState<AdGroupJob | null>(null);
  const [genBusy, setGenBusy] = useState(false);
  const pollId = useRef(0);

  // Deploy
  const [writeAccountId, setWriteAccountId] = useState("");
  const [writeCampaignName, setWriteCampaignName] = useState("");
  const [writeDailyUsd, setWriteDailyUsd] = useState("");
  const [writeBusy, setWriteBusy] = useState(false);
  const [campaignBusy, setCampaignBusy] = useState<string | null>(null);

  // Onboarding
  const [installBusy, setInstallBusy] = useState(false);

  // Pixels
  const [pixels, setPixels] = useState<AdPixel[] | null>(null);
  const [pixelRef, setPixelRef] = useState("");
  const [pixelName, setPixelName] = useState("");
  const [pixelBusy, setPixelBusy] = useState(false);

  // Analytics
  const [analytics, setAnalytics] = useState<AdsAnalytics | null>(null);

  async function loadAds() {
    const id = ++loadId.current;
    setNote(null);
    setFailed(false);
    setLoading(true);
    let anyFailed = false;
    try {
      const [accountsRes, specsRes, writesRes, pixelsRes, analyticsRes, assetsRes] =
        await Promise.all([
          fetch("/api/ads/accounts"),
          fetch("/api/ads/groups"),
          fetch("/api/ads/writes"),
          fetch("/api/ads/pixels"),
          fetch("/api/ads/analytics"),
          fetch("/api/assets"),
        ]);
      if (id !== loadId.current) return;
      if (accountsRes.ok) {
        const data = (await accountsRes.json()) as {
          accounts?: AdAccount[];
          campaigns?: AdCampaign[];
          spend_ceiling_cents?: number;
        };
        setAccounts(data.accounts ?? []);
        setCampaigns(data.campaigns ?? []);
        setCeilingCents(data.spend_ceiling_cents ?? 0);
      } else {
        anyFailed = true;
      }
      if (specsRes.ok) {
        const data = (await specsRes.json()) as { specs?: AdSpec[] };
        setSpecs(data.specs ?? []);
      } else {
        anyFailed = true;
      }
      if (writesRes.ok) {
        const data = (await writesRes.json()) as { writes?: AdWrite[] };
        setWrites(data.writes ?? []);
      } else {
        anyFailed = true;
      }
      if (pixelsRes.ok) {
        const data = (await pixelsRes.json()) as { pixels?: AdPixel[] };
        setPixels(data.pixels ?? []);
      } else {
        anyFailed = true;
      }
      if (analyticsRes.ok) {
        setAnalytics((await analyticsRes.json()) as AdsAnalytics);
      } else {
        anyFailed = true;
      }
      if (assetsRes.ok) {
        const data = (await assetsRes.json()) as { assets?: CreativeAsset[] };
        setAssets(data.assets ?? []);
      } else {
        anyFailed = true;
      }
    } catch {
      anyFailed = true;
    }
    if (id !== loadId.current) return;
    setLoading(false);
    if (anyFailed) {
      setFailed(true);
      setNote("Couldn't load your ads data.");
    }
  }

  useEffect(() => {
    // Always re-fetch on entry: accounts appear after the agent-side OAuth
    // handshake, so a one-shot load would go stale.
    if (active) void loadAds();
  }, [active]);

  async function connectMetaAds() {
    setInstallBusy(true);
    setFailed(false);
    setNote("Installing Meta Ads on your agent's computer…");
    try {
      const res = await fetch("/api/ads/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ install: "meta-ads" }),
      });
      if (res.ok) {
        setNote(
          "Meta Ads installed. Ask your agent in chat to connect your Meta Business account — it walks you through the login."
        );
      } else {
        setNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Install failed — try again shortly."
        );
      }
    } catch {
      setNote("Install failed — try again shortly.");
    } finally {
      setInstallBusy(false);
    }
  }

  async function createAdGroup() {
    const spec = specId || specs[0]?.id;
    const brief = offer.trim();
    if (!spec || !brief || genBusy) return;
    setGenBusy(true);
    setFailed(false);
    setNote(null);
    setJob(null);
    const id = ++pollId.current;
    try {
      const res = await fetch("/api/ads/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ spec_id: spec, offer: brief }),
      });
      if (!res.ok) {
        setNote(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Couldn't start the ad group — try again shortly."
        );
        return;
      }
      const data = (await res.json()) as {
        job_id: string;
        cost_estimate: number;
      };
      let current: AdGroupJob = {
        jobId: data.job_id,
        specId: spec,
        costEstimate: data.cost_estimate,
        state: "running",
        conformant: null,
        gaps: [],
      };
      setJob(current);
      for (let i = 0; i < 60; i++) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        if (id !== pollId.current) return;
        const poll = await fetch(`/api/ads/groups/${data.job_id}`);
        if (!poll.ok) continue;
        const status = (await poll.json()) as {
          state?: string;
          conformance?: { complete?: boolean; gaps?: string[] };
        };
        if (id !== pollId.current) return;
        if (status.state === "done") {
          current = {
            ...current,
            state: "done",
            conformant: status.conformance?.complete ?? null,
            gaps: status.conformance?.gaps ?? [],
          };
          setJob(current);
          return;
        }
        if (status.state === "failed" || status.state === "cancelled") {
          setJob({ ...current, state: status.state });
          return;
        }
        setJob({ ...current, state: status.state ?? "running" });
      }
      setNote("Still rendering — check back in a few minutes.");
    } catch {
      setNote("Couldn't start the ad group — try again shortly.");
    } finally {
      if (id === pollId.current) setGenBusy(false);
    }
  }

  async function refreshWrites() {
    const res = await fetch("/api/ads/writes");
    if (res.ok) {
      const data = (await res.json()) as { writes?: AdWrite[] };
      setWrites(data.writes ?? []);
    }
  }

  async function proposeCampaign() {
    const dailyUsd = Number(writeDailyUsd);
    if (
      writeBusy ||
      !writeAccountId ||
      !writeCampaignName.trim() ||
      !Number.isFinite(dailyUsd) ||
      dailyUsd <= 0
    )
      return;
    setWriteBusy(true);
    setFailed(false);
    setNote(null);
    try {
      const res = await fetch("/api/ads/writes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: writeAccountId,
          kind: "create_campaign",
          campaign_name: writeCampaignName.trim(),
          daily_budget_cents: Math.round(dailyUsd * 100),
        }),
      });
      if (res.ok) {
        setWriteCampaignName("");
        setWriteDailyUsd("");
        setNote("Proposed — approve it under “Needs you” to run it.");
        await refreshWrites();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setNote(data.error ?? "Couldn't propose the campaign — try again.");
      }
    } catch {
      setNote("Couldn't propose the campaign — try again.");
    } finally {
      setWriteBusy(false);
    }
  }

  async function proposeCampaignStatus(campaign: AdCampaign, status: string) {
    if (campaignBusy) return;
    setCampaignBusy(campaign.id);
    setFailed(false);
    setNote(null);
    try {
      const res = await fetch("/api/ads/writes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          account_id: campaign.account_id,
          kind: "set_status",
          campaign_ref: campaign.campaign_ref,
          status,
        }),
      });
      if (res.ok) {
        setNote(
          `Proposed ${status === "paused" ? "pause" : "resume"} — approve it under “Needs you”.`
        );
        await refreshWrites();
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setNote(data.error ?? "Couldn't propose the change — try again.");
      }
    } catch {
      setNote("Couldn't propose the change — try again.");
    } finally {
      setCampaignBusy(null);
    }
  }

  async function registerPixel() {
    const ref = pixelRef.trim();
    if (!ref || pixelBusy) return;
    setPixelBusy(true);
    setFailed(false);
    setNote(null);
    try {
      const res = await fetch("/api/ads/pixels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pixel_ref: ref, name: pixelName.trim() }),
      });
      if (res.ok) {
        setPixelRef("");
        setPixelName("");
        const list = await fetch("/api/ads/pixels");
        if (list.ok) {
          const data = (await list.json()) as { pixels?: AdPixel[] };
          setPixels(data.pixels ?? []);
        }
      } else {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setNote(data.error ?? "Couldn't save the pixel — try again.");
      }
    } catch {
      setNote("Couldn't save the pixel — try again.");
    } finally {
      setPixelBusy(false);
    }
  }

  async function archivePixel(pixel: AdPixel) {
    if (pixelBusy) return;
    setPixelBusy(true);
    try {
      const res = await fetch("/api/ads/pixels", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pixel.id,
          status: pixel.status === "active" ? "archived" : "active",
        }),
      });
      if (res.ok) {
        setPixels(
          (pixels ?? []).map((p) =>
            p.id === pixel.id
              ? { ...p, status: p.status === "active" ? "archived" : "active" }
              : p
          )
        );
      }
    } finally {
      setPixelBusy(false);
    }
  }

  const metaConnected = (accounts ?? []).some(
    (a) => a.provider === "meta" && a.status === "active"
  );

  return (
    <div className="grid flex-1 content-start gap-2 overflow-y-auto">
      <h3 className="m-0 text-[15px] font-semibold">Ads</h3>
      <p className="muted m-0 text-[12px]">
        Your agent drafts the creative; nothing spends money without your
        approval under “Needs you”. Everything here is also manageable by
        asking your agent in chat or iMessage.
      </p>
      <div className="flex flex-wrap gap-1.5 py-1">
        {ADS_TABS.map(([id, label]) => (
          <button
            key={id}
            className={
              "btn !px-3 !py-1.5 !text-[12px]" +
              (subtab === id
                ? " !bg-[var(--text)] !text-[var(--bg)]"
                : "")
            }
            onClick={() => setSubtab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {note ? (
        <div className="flex items-center gap-2 py-1">
          <p className="muted m-0 text-[12px]">{note}</p>
          {failed ? (
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              onClick={() => void loadAds()}
            >
              Retry
            </button>
          ) : null}
        </div>
      ) : null}

      {subtab === "onboarding" ? (
        <>
          <h4 className="m-0 mt-1 text-[13px] font-semibold">
            Connect Meta Business
          </h4>
          <div className="panel !p-3">
            <strong className="text-[13px]">
              1. Install Meta Ads tools on your agent{"\u2019"}s computer
            </strong>
            <p className="muted m-0 mt-1 text-[12px]">
              Registers Meta{"\u2019"}s official Ads tools with your agent. No
              credentials touch this browser.
            </p>
            <button
              className="btn mt-2 !px-3 !py-1.5 !text-[12px]"
              disabled={installBusy}
              onClick={() => void connectMetaAds()}
            >
              {installBusy ? "Installing…" : "Install Meta Ads tools"}
            </button>
          </div>
          <div className="panel !p-3">
            <strong className="text-[13px]">
              2. Log into Meta Business with your agent
            </strong>
            <p className="muted m-0 mt-1 text-[12px]">
              The OAuth handshake happens agent-side — ask in chat (or
              iMessage) and it walks you through the login.
            </p>
            <button
              className="btn mt-2 !px-3 !py-1.5 !text-[12px]"
              onClick={() =>
                onAskAgent(
                  "Connect my Meta Business ad account — walk me through the Meta login."
                )
              }
            >
              Ask your agent in chat
            </button>
          </div>
          <div className="panel !p-3">
            <strong className="text-[13px]">
              3. Connected accounts{metaConnected ? " — Meta connected" : ""}
            </strong>
            {(accounts ?? []).map((a) => (
              <p key={a.id} className="muted m-0 mt-1 text-[12px]">
                {a.label ?? a.account_ref} · {a.provider} · {a.status}
              </p>
            ))}
            {accounts !== null && accounts.length === 0 ? (
              <p className="muted m-0 mt-1 text-[12px]">
                No ad accounts yet — finish steps 1–2 and it appears here.
              </p>
            ) : null}
          </div>
          <p className="muted m-0 text-[12px]">
            Spend ceiling: {usd(ceilingCents)} over 30 days
            {ceilingCents === 0
              ? " — no ceiling set, so ad writes are blocked. Ask your operator to set one."
              : ""}
          </p>
        </>
      ) : null}

      {subtab === "gallery" ? (
        <>
          <h4 className="m-0 mt-1 text-[13px] font-semibold">
            Generate ad creative
          </h4>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void createAdGroup();
            }}
          >
            <select
              className="input !py-1.5 !text-[13px]"
              value={specId || specs[0]?.id || ""}
              onChange={(e) => setSpecId(e.target.value)}
              aria-label="Ad placement"
            >
              {specs.map((spec) => (
                <option key={spec.id} value={spec.id}>
                  {spec.id}
                  {spec.stale ? " (spec needs re-verification)" : ""}
                </option>
              ))}
            </select>
            <textarea
              className="input min-h-[64px] !py-1.5 !text-[13px]"
              placeholder="What are you promoting? (the offer, product, or show)"
              value={offer}
              onChange={(e) => setOffer(e.target.value)}
              aria-label="Offer brief"
            />
            <div>
              <button
                type="submit"
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={genBusy || !offer.trim() || specs.length === 0}
              >
                {genBusy ? "Working…" : "Generate assets"}
              </button>
            </div>
          </form>
          {job ? (
            <div className="panel rise-in !p-3">
              <strong className="text-[13px]">
                {job.state === "done"
                  ? job.conformant
                    ? "Asset group ready — conformant"
                    : "Asset group ready — has gaps"
                  : job.state === "failed" || job.state === "cancelled"
                    ? `Generation ${job.state}`
                    : "Rendering…"}
              </strong>
              <p className="muted m-0 mt-1 text-[12px]">
                {job.specId} · est. ${job.costEstimate.toFixed(2)}
              </p>
              {job.gaps.length > 0 ? (
                <p className="muted m-0 mt-1 text-[12px]">
                  Missing: {job.gaps.join(", ")}
                </p>
              ) : null}
            </div>
          ) : null}
          <h4 className="m-0 mt-2 text-[13px] font-semibold">Your assets</h4>
          {(assets ?? []).map((a) => (
            <div key={a.id} className="panel rise-in !p-3">
              <strong className="text-[13px]">{a.box_asset_id}</strong>
              <p className="muted m-0 mt-1 text-[12px]">
                {[
                  a.kind,
                  a.ext,
                  a.bytes != null ? `${Math.round(a.bytes / 1024)} KB` : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ))}
          {assets !== null && assets.length === 0 ? (
            <p className="muted m-0 text-[13px]">
              No creative assets yet — generate some above or ask your agent.
            </p>
          ) : null}
        </>
      ) : null}

      {subtab === "deploy" ? (
        <>
          <p className="muted m-0 text-[12px]">
            Spend ceiling: {usd(ceilingCents)} over 30 days
            {ceilingCents === 0
              ? " — no ceiling set, so ad writes are blocked. Ask your operator to set one."
              : ""}
          </p>
          <h4 className="m-0 mt-1 text-[13px] font-semibold">
            Propose a campaign
          </h4>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void proposeCampaign();
            }}
          >
            <select
              className="input !py-1.5 !text-[13px]"
              value={writeAccountId}
              onChange={(e) => setWriteAccountId(e.target.value)}
              aria-label="Ad account"
            >
              <option value="">Choose an account…</option>
              {(accounts ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label ?? a.account_ref} ({a.provider})
                </option>
              ))}
            </select>
            <input
              className="input !py-1.5 !text-[13px]"
              placeholder="Campaign name"
              value={writeCampaignName}
              onChange={(e) => setWriteCampaignName(e.target.value)}
              aria-label="Campaign name"
            />
            <input
              className="input !py-1.5 !text-[13px]"
              placeholder="Daily budget (USD)"
              inputMode="decimal"
              value={writeDailyUsd}
              onChange={(e) => setWriteDailyUsd(e.target.value)}
              aria-label="Daily budget in dollars"
            />
            <div>
              <button
                type="submit"
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={
                  writeBusy ||
                  !writeAccountId ||
                  !writeCampaignName.trim() ||
                  !(Number(writeDailyUsd) > 0)
                }
              >
                {writeBusy ? "Proposing…" : "Propose — approve in “Needs you”"}
              </button>
            </div>
          </form>

          <h4 className="m-0 mt-2 text-[13px] font-semibold">Campaigns</h4>
          {campaigns.map((c) => (
            <div
              key={c.id}
              className="panel rise-in flex items-center justify-between !p-3"
            >
              <div>
                <strong className="text-[13px]">
                  {c.name ?? c.campaign_ref}
                </strong>
                <p className="muted m-0 mt-0.5 text-[12px]">
                  {c.status} · {usd(c.daily_budget_cents)}/day
                </p>
              </div>
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={campaignBusy === c.id}
                onClick={() =>
                  void proposeCampaignStatus(
                    c,
                    c.status === "active" ? "paused" : "active"
                  )
                }
              >
                {campaignBusy === c.id
                  ? "Proposing…"
                  : c.status === "active"
                    ? "Propose pause"
                    : "Propose resume"}
              </button>
            </div>
          ))}
          {campaigns.length === 0 ? (
            <p className="muted m-0 text-[13px]">No campaigns yet.</p>
          ) : null}

          <h4 className="m-0 mt-2 text-[13px] font-semibold">Ad writes</h4>
          {writes.map((w) => (
            <div key={w.id} className="panel rise-in !p-3">
              <strong className="text-[13px]">
                {w.kind.replace(/_/g, " ")}
                {w.campaign_ref ? ` · ${w.campaign_ref}` : ""}
              </strong>
              <p className="muted m-0 mt-1 text-[12px]">
                {[
                  w.status,
                  w.daily_budget_cents != null
                    ? `${usd(w.daily_budget_cents)}/day`
                    : null,
                  w.error,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          ))}
          {accounts !== null && writes.length === 0 ? (
            <p className="muted m-0 text-[13px]">No ad writes yet.</p>
          ) : null}
        </>
      ) : null}

      {subtab === "pixels" ? (
        <>
          <h4 className="m-0 mt-1 text-[13px] font-semibold">Your pixels</h4>
          <p className="muted m-0 text-[12px]">
            Pixels live on Meta — your agent creates and wires them through
            its Meta Ads tools; register the pixel ID here so every surface
            sees the same inventory.
          </p>
          <div>
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              onClick={() =>
                onAskAgent(
                  "Create a Meta pixel for my site and tell me its pixel ID."
                )
              }
            >
              Ask your agent to create a pixel
            </button>
          </div>
          <form
            className="grid gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              void registerPixel();
            }}
          >
            <input
              className="input !py-1.5 !text-[13px]"
              placeholder="Pixel ID"
              value={pixelRef}
              onChange={(e) => setPixelRef(e.target.value)}
              aria-label="Pixel ID"
            />
            <input
              className="input !py-1.5 !text-[13px]"
              placeholder="Name (optional)"
              value={pixelName}
              onChange={(e) => setPixelName(e.target.value)}
              aria-label="Pixel name"
            />
            <div>
              <button
                type="submit"
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={pixelBusy || !pixelRef.trim()}
              >
                {pixelBusy ? "Saving…" : "Register pixel"}
              </button>
            </div>
          </form>
          {(pixels ?? []).map((p) => (
            <div
              key={p.id}
              className="panel rise-in flex items-center justify-between !p-3"
            >
              <div>
                <strong className="text-[13px]">{p.name ?? p.pixel_ref}</strong>
                <p className="muted m-0 mt-0.5 text-[12px]">
                  {p.pixel_ref} · {p.status}
                </p>
              </div>
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={pixelBusy}
                onClick={() => void archivePixel(p)}
              >
                {p.status === "active" ? "Archive" : "Restore"}
              </button>
            </div>
          ))}
          {pixels !== null && pixels.length === 0 ? (
            <p className="muted m-0 text-[13px]">No pixels registered yet.</p>
          ) : null}
        </>
      ) : null}

      {subtab === "analytics" ? (
        <>
          <h4 className="m-0 mt-1 text-[13px] font-semibold">
            Last {analytics?.window_days ?? 30} days
          </h4>
          <div className="panel !p-3">
            <strong className="text-[13px]">
              Reported spend: {usd(analytics?.spend_total_cents ?? 0)}
            </strong>
            <p className="muted m-0 mt-1 text-[12px]">
              Conversions: {analytics?.conversion_count ?? 0}
              {analytics?.truncated
                ? " (partial — too much data to total exactly)"
                : ""}
            </p>
          </div>
          {(analytics?.spend_by_campaign ?? []).map((row) => (
            <div key={row.campaign_ref} className="panel rise-in !p-3">
              <strong className="text-[13px]">{row.campaign_ref}</strong>
              <p className="muted m-0 mt-1 text-[12px]">
                {usd(row.spend_cents)} spent
              </p>
            </div>
          ))}
          {(analytics?.conversions_by_event ?? []).map((row) => (
            <div key={row.event} className="panel rise-in !p-3">
              <strong className="text-[13px]">{row.event}</strong>
              <p className="muted m-0 mt-1 text-[12px]">
                {row.count} events · {usd(row.value_cents)} value
              </p>
            </div>
          ))}
          {analytics &&
          analytics.spend_by_campaign.length === 0 &&
          analytics.conversions_by_event.length === 0 ? (
            <p className="muted m-0 text-[13px]">
              No reported spend or conversions yet.
            </p>
          ) : null}
          <h4 className="m-0 mt-2 text-[13px] font-semibold">
            Ask about your Meta data
          </h4>
          <p className="muted m-0 text-[12px]">
            Your agent holds the Meta Ads tools — ask it anything about
            performance, audiences, or spend. Same agent as iMessage.
          </p>
          <div>
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              onClick={() =>
                onAskAgent(
                  "Using your Meta Ads tools, summarize my ad performance over the last 30 days."
                )
              }
            >
              Chat with your Meta data
            </button>
          </div>
        </>
      ) : null}

      {loading ? (
        <div className="py-2">
          <Orb pill label="Loading ads…" />
        </div>
      ) : null}
    </div>
  );
}
