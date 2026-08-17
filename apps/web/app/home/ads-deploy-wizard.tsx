"use client";

/**
 * M14 task 3: three-step deploy wizard (draft → review → approve). Every
 * step only collects a draft; Submit proposes ordered `ad_writes` rows that
 * land in "Needs you" — nothing executes inline, no provider call happens
 * here (C22). Later steps reference their parent write by id so the ad
 * group can name the campaign its own approval will create.
 */

import { useMemo, useState } from "react";

export interface WizardAccount {
  id: string;
  provider: string;
  account_ref: string;
  label: string | null;
  status: string;
}

export interface WizardCampaign {
  id: string;
  account_id: string;
  campaign_ref: string;
  name: string | null;
  daily_budget_cents: number;
  status: string;
}

export interface WizardAsset {
  id: string;
  box_asset_id: string;
  kind: string | null;
  ext: string | null;
}

const TITLE_LIMIT = 50;
const BODY_LIMIT = 300;

function usd(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

export function AdsDeployWizard({
  accounts,
  campaigns,
  assets,
  onProposed,
  onOpenQueue,
  onAskAgent,
}: {
  accounts: WizardAccount[];
  campaigns: WizardCampaign[];
  assets: WizardAsset[];
  /** Called after writes are proposed so the parent can refresh its list. */
  onProposed: () => void | Promise<void>;
  onOpenQueue: () => void;
  onAskAgent: (prefill: string) => void;
}) {
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [doneCount, setDoneCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Step 1 — provider + campaign
  const [accountId, setAccountId] = useState("");
  const [campaignMode, setCampaignMode] = useState<"existing" | "new">("new");
  const [campaignRef, setCampaignRef] = useState("");
  const [campaignName, setCampaignName] = useState("");
  const [dailyUsd, setDailyUsd] = useState("");

  // Step 2 — ad group
  const [groupName, setGroupName] = useState("");
  const [hints, setHints] = useState<string[]>([]);
  const [hintInput, setHintInput] = useState("");
  const [maxBidUsd, setMaxBidUsd] = useState("");

  // Step 3 — creative
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [targetUrl, setTargetUrl] = useState("");
  const [assetId, setAssetId] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [minting, setMinting] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const accountCampaigns = useMemo(
    () => campaigns.filter((c) => c.account_id === accountId),
    [campaigns, accountId]
  );
  const imageAssets = useMemo(
    () =>
      assets.filter(
        (a) =>
          a.kind === "image" ||
          ["png", "jpg", "jpeg", "webp", "gif"].includes(
            (a.ext ?? "").toLowerCase()
          )
      ),
    [assets]
  );

  const dailyBudgetCents = Math.round(Number(dailyUsd) * 100);
  const step1Ok =
    !!account &&
    (campaignMode === "existing"
      ? !!campaignRef
      : !!campaignName.trim() && dailyBudgetCents > 0);
  const step2Ok = !!groupName.trim();
  const step3Ok =
    !!title.trim() &&
    title.trim().length <= TITLE_LIMIT &&
    !!body.trim() &&
    /^https?:\/\//.test(targetUrl.trim());

  function addHint() {
    const hint = hintInput.trim();
    if (!hint || hints.includes(hint) || hints.length >= 10) return;
    setHints([...hints, hint]);
    setHintInput("");
  }

  async function pickAsset(id: string) {
    setAssetId(id);
    setImageUrl("");
    if (!id) return;
    const asset = imageAssets.find((a) => a.id === id);
    if (!asset) return;
    setMinting(true);
    setError(null);
    try {
      const res = await fetch("/api/assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          box_asset_id: asset.box_asset_id,
          purpose: "ad-creative",
        }),
      });
      if (res.ok) {
        const data = (await res.json()) as { url?: string };
        setImageUrl(data.url ?? "");
      } else {
        setError(
          res.status === 429
            ? "Your agent's computer is busy starting up — try again in a minute."
            : "Couldn't fetch that image — try another."
        );
        setAssetId("");
      }
    } catch {
      setError("Couldn't fetch that image — try another.");
      setAssetId("");
    } finally {
      setMinting(false);
    }
  }

  async function propose(payload: Record<string, unknown>): Promise<string> {
    const res = await fetch("/api/ads/writes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = (await res.json().catch(() => ({}))) as {
      write_id?: string;
      error?: string;
    };
    if (!res.ok || !data.write_id) {
      throw new Error(data.error ?? "proposal failed");
    }
    return data.write_id;
  }

  async function submit() {
    if (busy || !account) return;
    setBusy(true);
    setError(null);
    try {
      let count = 0;
      let campaignWriteId: string | null = null;
      if (campaignMode === "new") {
        campaignWriteId = await propose({
          account_id: account.id,
          kind: "create_campaign",
          campaign_name: campaignName.trim(),
          daily_budget_cents: dailyBudgetCents,
        });
        count += 1;
      }
      const maxBidCents = Math.round(Number(maxBidUsd) * 100);
      const groupWriteId = await propose({
        account_id: account.id,
        kind: "create_ad_group",
        ...(campaignMode === "existing" ? { campaign_ref: campaignRef } : {}),
        args: {
          name: groupName.trim(),
          ...(hints.length > 0 ? { context_hints: hints } : {}),
          ...(maxBidCents > 0 ? { max_bid_cents: maxBidCents } : {}),
          ...(campaignWriteId ? { parent_write_id: campaignWriteId } : {}),
        },
      });
      count += 1;
      await propose({
        account_id: account.id,
        kind: "create_ad",
        args: {
          parent_write_id: groupWriteId,
          name: title.trim(),
          creative: {
            title: title.trim(),
            body: body.trim(),
            target_url: targetUrl.trim(),
          },
          ...(imageUrl ? { image_url: imageUrl } : {}),
        },
      });
      count += 1;
      setDoneCount(count);
      await onProposed();
    } catch (err) {
      setError(err instanceof Error ? err.message : "proposal failed");
    } finally {
      setBusy(false);
    }
  }

  if (doneCount !== null) {
    return (
      <div className="panel rise-in !p-3">
        <strong className="text-[13px]">
          {doneCount} changes waiting for your approval
        </strong>
        <p className="muted m-0 mt-1 text-[12px]">
          Nothing runs until you approve each one — review them in the queue.
        </p>
        <div className="mt-2 flex gap-2">
          <button
            className="btn !px-3 !py-1.5 !text-[12px]"
            onClick={onOpenQueue}
          >
            Open “Needs you”
          </button>
          <button
            className="btn !px-3 !py-1.5 !text-[12px]"
            onClick={() => {
              setDoneCount(null);
              setStep(1);
            }}
          >
            Deploy another
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-2">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            [1, "1 · Campaign"],
            [2, "2 · Ad group"],
            [3, "3 · Creative"],
            [4, "Review"],
          ] as [1 | 2 | 3 | 4, string][]
        ).map(([id, label]) => (
          <span
            key={id}
            className={
              "rounded px-2 py-1 text-[11px] " +
              (step === id
                ? "bg-[var(--text)] text-[var(--bg)]"
                : "muted border border-[var(--border)]")
            }
          >
            {label}
          </span>
        ))}
      </div>
      {error ? <p className="muted m-0 text-[12px]">{error}</p> : null}

      {step === 1 ? (
        <div className="grid gap-2">
          <select
            className="input !py-1.5 !text-[13px]"
            value={accountId}
            onChange={(e) => {
              setAccountId(e.target.value);
              setCampaignRef("");
            }}
            aria-label="Ad account"
          >
            <option value="">Choose an account…</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label ?? a.account_ref} ({a.provider})
              </option>
            ))}
          </select>
          {account?.provider === "meta" ? (
            <div className="panel !p-3">
              <p className="muted m-0 text-[12px]">
                Meta campaigns are composed by your agent through its Meta Ads
                tools — the same approval gate applies before anything spends.
              </p>
              <button
                className="btn mt-2 !px-3 !py-1.5 !text-[12px]"
                onClick={() =>
                  onAskAgent(
                    "Draft a Meta ads campaign with an ad set and one ad for me — propose the changes for my approval, don't run anything without it."
                  )
                }
              >
                Compose with your agent
              </button>
            </div>
          ) : null}
          {account && account.provider !== "meta" ? (
            <>
              <div className="flex gap-1.5">
                <button
                  className={
                    "btn !px-3 !py-1.5 !text-[12px]" +
                    (campaignMode === "new"
                      ? " !bg-[var(--text)] !text-[var(--bg)]"
                      : "")
                  }
                  onClick={() => setCampaignMode("new")}
                >
                  New campaign
                </button>
                <button
                  className={
                    "btn !px-3 !py-1.5 !text-[12px]" +
                    (campaignMode === "existing"
                      ? " !bg-[var(--text)] !text-[var(--bg)]"
                      : "")
                  }
                  disabled={accountCampaigns.length === 0}
                  onClick={() => setCampaignMode("existing")}
                >
                  Existing campaign
                </button>
              </div>
              {campaignMode === "existing" ? (
                <select
                  className="input !py-1.5 !text-[13px]"
                  value={campaignRef}
                  onChange={(e) => setCampaignRef(e.target.value)}
                  aria-label="Campaign"
                >
                  <option value="">Choose a campaign…</option>
                  {accountCampaigns.map((c) => (
                    <option key={c.id} value={c.campaign_ref}>
                      {c.name ?? c.campaign_ref} · {usd(c.daily_budget_cents)}
                      /day
                    </option>
                  ))}
                </select>
              ) : (
                <>
                  <input
                    className="input !py-1.5 !text-[13px]"
                    placeholder="Campaign name"
                    value={campaignName}
                    onChange={(e) => setCampaignName(e.target.value)}
                    aria-label="Campaign name"
                  />
                  <input
                    className="input !py-1.5 !text-[13px]"
                    placeholder="Daily budget (USD)"
                    inputMode="decimal"
                    value={dailyUsd}
                    onChange={(e) => setDailyUsd(e.target.value)}
                    aria-label="Daily budget in dollars"
                  />
                </>
              )}
            </>
          ) : null}
          <div>
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              disabled={!step1Ok || account?.provider === "meta"}
              onClick={() => setStep(2)}
            >
              Next: ad group
            </button>
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="grid gap-2">
          <input
            className="input !py-1.5 !text-[13px]"
            placeholder="Ad group name"
            value={groupName}
            onChange={(e) => setGroupName(e.target.value)}
            aria-label="Ad group name"
          />
          <div className="flex flex-wrap items-center gap-1.5">
            {hints.map((hint) => (
              <button
                key={hint}
                className="btn !px-2 !py-1 !text-[11px]"
                title="Remove"
                onClick={() => setHints(hints.filter((h) => h !== hint))}
              >
                {hint} ×
              </button>
            ))}
            <input
              className="input max-w-[200px] !py-1.5 !text-[13px]"
              placeholder="Context hint — Enter to add"
              value={hintInput}
              onChange={(e) => setHintInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addHint();
                }
              }}
              aria-label="Context hint"
            />
          </div>
          <input
            className="input !py-1.5 !text-[13px]"
            placeholder="Max bid per impression (USD, optional)"
            inputMode="decimal"
            value={maxBidUsd}
            onChange={(e) => setMaxBidUsd(e.target.value)}
            aria-label="Max bid in dollars"
          />
          <div className="flex gap-2">
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              onClick={() => setStep(1)}
            >
              Back
            </button>
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              disabled={!step2Ok}
              onClick={() => setStep(3)}
            >
              Next: creative
            </button>
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="grid gap-2">
          <input
            className="input !py-1.5 !text-[13px]"
            placeholder={`Title (≤ ${TITLE_LIMIT} chars)`}
            value={title}
            maxLength={TITLE_LIMIT}
            onChange={(e) => setTitle(e.target.value)}
            aria-label="Ad title"
          />
          <textarea
            className="input min-h-[64px] !py-1.5 !text-[13px]"
            placeholder="Body"
            value={body}
            maxLength={BODY_LIMIT}
            onChange={(e) => setBody(e.target.value)}
            aria-label="Ad body"
          />
          <input
            className="input !py-1.5 !text-[13px]"
            placeholder="Target URL (https://…)"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            aria-label="Target URL"
          />
          <select
            className="input !py-1.5 !text-[13px]"
            value={assetId}
            onChange={(e) => void pickAsset(e.target.value)}
            aria-label="Creative image"
          >
            <option value="">No image</option>
            {imageAssets.map((a) => (
              <option key={a.id} value={a.id}>
                {a.box_asset_id}
                {a.ext ? `.${a.ext}` : ""}
              </option>
            ))}
          </select>
          {minting ? (
            <p className="muted m-0 text-[12px]">Fetching image…</p>
          ) : null}

          {/* Live chat-card preview */}
          <div className="panel max-w-[360px] !p-3">
            <p className="muted m-0 mb-1 text-[11px]">Preview</p>
            {imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={imageUrl}
                alt="Ad creative"
                className="mb-2 w-full rounded border border-[var(--border)]"
              />
            ) : null}
            <strong className="text-[13px]">{title.trim() || "Title"}</strong>
            <p className="m-0 mt-1 text-[12px]">
              {body.trim() || "Body copy shows here."}
            </p>
            <p className="muted m-0 mt-1 truncate text-[11px]">
              {targetUrl.trim() || "https://example.com"}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              onClick={() => setStep(2)}
            >
              Back
            </button>
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              disabled={!step3Ok}
              onClick={() => setStep(4)}
            >
              Review
            </button>
          </div>
        </div>
      ) : null}

      {step === 4 && account ? (
        <div className="grid gap-2">
          <div className="panel !p-3">
            <strong className="text-[13px]">
              {campaignMode === "new" ? "3 proposals" : "2 proposals"} — nothing
              runs before you approve
            </strong>
            <ol className="m-0 mt-1 grid gap-1 pl-4 text-[12px]">
              {campaignMode === "new" ? (
                <li>
                  Create campaign “{campaignName.trim()}” at{" "}
                  {usd(dailyBudgetCents)}/day
                </li>
              ) : (
                <li className="muted">
                  Use existing campaign{" "}
                  {accountCampaigns.find((c) => c.campaign_ref === campaignRef)
                    ?.name ?? campaignRef}
                </li>
              )}
              <li>
                Create ad group “{groupName.trim()}”
                {hints.length > 0 ? ` · hints: ${hints.join(", ")}` : ""}
                {Number(maxBidUsd) > 0
                  ? ` · max bid ${usd(Math.round(Number(maxBidUsd) * 100))}`
                  : ""}
              </li>
              <li>
                Create ad “{title.trim()}” → {targetUrl.trim()}
                {imageUrl ? " · with image" : ""}
              </li>
            </ol>
          </div>
          <div className="flex gap-2">
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              onClick={() => setStep(3)}
            >
              Back
            </button>
            <button
              className="btn !px-3 !py-1.5 !text-[12px]"
              disabled={busy}
              onClick={() => void submit()}
            >
              {busy ? "Proposing…" : "Propose for approval"}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
