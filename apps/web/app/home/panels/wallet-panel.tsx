"use client";

/**
 * Wallet — balances, receive/fund, send-with-approval, activity (extracted
 * verbatim from the old page.tsx wallet tab in the redesign phase-1 split;
 * now self-contained). Sends still route through Needs You approval.
 */
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { DitherAvatar } from "@/components/dither-kit/avatar";
import { Orb } from "@/components/orb/Orb";

// Loaded on demand so the main route doesn't pay for thirdweb/react unless
// the user opens Fund (goal.md M15 bundle budget).
const FundWidget = dynamic(() => import("@/components/wallet/FundWidget"), {
  ssr: false,
});

const THIRDWEB_CLIENT_ID = process.env.NEXT_PUBLIC_THIRDWEB_CLIENT_ID;

interface WalletSummary {
  address: string | null;
  chain_id?: number;
  native?: { symbol: string; display: string } | null;
  tokens?: { symbol: string; name: string; display: string }[];
  degraded?: boolean;
  receive_qr?: string | null;
  updated_at?: string;
}

interface WalletTx {
  hash: string;
  direction: "in" | "out";
  counterparty: string;
  value_display: string;
  timestamp: string;
  explorer_url: string;
}

/** V8: a send intent from the transfer ledger — every send goes through a
 * Needs-you approval before anything moves. */
interface WalletTransfer {
  id: string;
  to_address: string;
  amount_display: string;
  token_symbol?: string;
  status:
    | "pending"
    | "submitting"
    | "submitted"
    | "denied"
    | "failed"
    | "submit_unknown";
  created_at: string;
}

/** Phase 3: pending payment_requests preview — the tile deep-links into
 * the pay mini-app, where approve/dismiss actually live. */
interface PaymentRequestPreview {
  id: string;
  amount_display: string;
  currency: "usd" | "usdc";
  payee: string;
  memo: string;
  created_at: string;
}

export function WalletPanel({
  active,
  onOpenNeeds,
  onOpenPay,
}: {
  active: boolean;
  /** "Open Needs you" jump after a send request — navigates the shell. */
  onOpenNeeds: () => void;
  /** Deep link into the pay mini-app (signed-link launch). */
  onOpenPay: () => void;
}) {
  const [wallet, setWallet] = useState<WalletSummary | null>(null);
  const [walletTxs, setWalletTxs] = useState<WalletTx[] | null>(null);
  const [walletNote, setWalletNote] = useState<string | null>(null);
  const [walletCopied, setWalletCopied] = useState(false);
  const [walletReceiveOpen, setWalletReceiveOpen] = useState(false);
  const [walletFundOpen, setWalletFundOpen] = useState(false);
  const [walletTransfers, setWalletTransfers] = useState<WalletTransfer[]>([]);
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAsset, setSendAsset] = useState<"native" | "usdc">("native");
  const [sendBusy, setSendBusy] = useState(false);
  const [sendNote, setSendNote] = useState<string | null>(null);
  const [payRequests, setPayRequests] = useState<PaymentRequestPreview[]>([]);
  const [payCount, setPayCount] = useState(0);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  async function loadWallet() {
    setWalletNote(null);
    try {
      const [summaryRes, activityRes, payRes] = await Promise.all([
        fetch("/api/wallet"),
        fetch("/api/wallet/activity"),
        fetch("/api/wallet/payment-requests"),
      ]);
      if (summaryRes.ok) {
        setWallet((await summaryRes.json()) as WalletSummary);
      } else {
        setWalletNote("Couldn't load your wallet — try again shortly.");
      }
      if (activityRes.ok) {
        const data = (await activityRes.json()) as {
          transactions?: WalletTx[];
          transfers?: WalletTransfer[];
        };
        setWalletTxs(data.transactions ?? []);
        setWalletTransfers(data.transfers ?? []);
      } else {
        setWalletTxs([]);
      }
      if (payRes.ok) {
        const data = (await payRes.json()) as {
          pending?: PaymentRequestPreview[];
          pending_count?: number;
        };
        setPayRequests(data.pending ?? []);
        setPayCount(data.pending_count ?? 0);
      }
    } catch {
      setWalletNote("Couldn't load your wallet — try again shortly.");
    }
  }

  useEffect(() => {
    // D6: stale-while-revalidate — cached balances stay on screen while
    // each activation re-fetches in the background.
    if (active) void loadWallet();
  }, [active]);

  async function submitSend() {
    const to = sendTo.trim();
    const amount = sendAmount.trim();
    if (!to || !amount) return;
    setSendBusy(true);
    setSendNote(null);
    try {
      const res = await fetch("/api/wallet/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, amount, asset: sendAsset }),
      });
      if (res.ok) {
        setSendTo("");
        setSendAmount("");
        setSendNote(
          "Send requested — approve it in Needs you before anything moves."
        );
        await loadWallet();
      } else {
        const data = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        setSendNote(data.error ?? "Couldn't request the send — try again.");
      }
    } catch {
      setSendNote("Couldn't request the send — try again shortly.");
    } finally {
      setSendBusy(false);
    }
  }

  async function copyWalletAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setWalletCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setWalletCopied(false), 1500);
    } catch {
      // clipboard unavailable; the address is selectable text
    }
  }

  if (!active) return null;

  return (
    <div className="grid flex-1 content-start gap-2 overflow-y-auto">
      <h3 className="m-0 text-[15px] font-semibold">Wallet</h3>
      {walletNote ? (
        <div className="flex items-center gap-2 py-1">
          <p className="muted m-0 text-[13px]">{walletNote}</p>
          <button
            className="btn !px-3 !py-1.5 !text-[12px]"
            onClick={() => void loadWallet()}
          >
            Retry
          </button>
        </div>
      ) : wallet === null ? (
        <div className="py-2">
          <Orb pill label="Loading your wallet…" />
        </div>
      ) : wallet.address === null ? (
        <p className="muted text-[13px]">
          Wallet not set up yet — sign out and back in with your phone to
          attach it.
        </p>
      ) : (
        <>
          <div className="panel !p-3">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 shrink-0 overflow-hidden rounded-full shadow-[0_0_0_0.5px_var(--ring)]">
                <DitherAvatar name={wallet.address} size={36} />
              </div>
              <div className="min-w-0">
                <p className="m-0 break-all font-mono text-[12px]">
                  {wallet.address}
                </p>
                <p className="muted m-0 mt-0.5 text-[11px]">
                  Chain {wallet.chain_id}
                </p>
              </div>
            </div>
            <div className="mt-2 flex gap-2">
              <button
                className="btn !px-3 !py-1.5 !text-[12px]"
                onClick={() => void copyWalletAddress(wallet.address as string)}
              >
                {walletCopied ? "Copied" : "Copy"}
              </button>
              {wallet.receive_qr ? (
                <button
                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                  onClick={() => setWalletReceiveOpen((open) => !open)}
                >
                  {walletReceiveOpen ? "Hide QR" : "Receive"}
                </button>
              ) : null}
              {THIRDWEB_CLIENT_ID ? (
                <button
                  className="btn btn-ghost !px-3 !py-1.5 !text-[12px]"
                  onClick={() => setWalletFundOpen((open) => !open)}
                >
                  {walletFundOpen ? "Hide fund" : "Fund"}
                </button>
              ) : null}
            </div>
            {walletReceiveOpen && wallet.receive_qr ? (
              <div className="mt-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={wallet.receive_qr}
                  alt="QR code of your wallet address"
                  width={160}
                  height={160}
                  className="rounded-lg bg-white p-2"
                />
              </div>
            ) : null}
            {walletFundOpen && THIRDWEB_CLIENT_ID && wallet.chain_id ? (
              <div className="mt-3">
                <FundWidget
                  clientId={THIRDWEB_CLIENT_ID}
                  chainId={wallet.chain_id}
                  address={wallet.address}
                />
              </div>
            ) : null}
          </div>
          <h4 className="m-0 mt-2 text-[13px] font-semibold">Send</h4>
          <form
            className="panel grid gap-2 !p-3"
            onSubmit={(e) => {
              e.preventDefault();
              void submitSend();
            }}
          >
            <input
              className="input font-mono !py-1.5 !text-[12px]"
              placeholder="Recipient address (0x…)"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
              aria-label="Recipient address"
            />
            <div className="flex gap-2">
              <input
                className="input flex-1 !py-1.5 !text-[13px]"
                placeholder={
                  sendAsset === "usdc" ? "Amount (USDC)" : "Amount (ETH)"
                }
                inputMode="decimal"
                value={sendAmount}
                onChange={(e) => setSendAmount(e.target.value)}
                aria-label="Amount"
              />
              <select
                className="input !w-auto !py-1.5 !text-[13px]"
                value={sendAsset}
                onChange={(e) =>
                  setSendAsset(e.target.value === "usdc" ? "usdc" : "native")
                }
                aria-label="Asset"
              >
                <option value="native">ETH</option>
                <option value="usdc">USDC</option>
              </select>
              <button
                type="submit"
                className="btn !px-3 !py-1.5 !text-[12px]"
                disabled={sendBusy || !sendTo.trim() || !sendAmount.trim()}
              >
                {sendBusy ? "Requesting…" : "Request send"}
              </button>
            </div>
            <p className="muted m-0 text-[11px]">
              Nothing moves until you approve it in Needs you. ENS names aren’t
              resolved — paste the full address.
            </p>
            {sendNote ? (
              <p className="m-0 text-[12px]">
                {sendNote}{" "}
                {sendNote.startsWith("Send requested") ? (
                  <button
                    type="button"
                    className="cursor-pointer border-0 bg-transparent p-0 text-[12px] underline"
                    onClick={onOpenNeeds}
                  >
                    Open Needs you
                  </button>
                ) : null}
              </p>
            ) : null}
          </form>
          {payCount > 0 ? (
            <>
              <h4 className="m-0 mt-2 text-[13px] font-semibold">
                Payment requests
              </h4>
              <div className="panel rise-in grid gap-2 !p-3">
                {payRequests.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0">
                      <strong className="text-[13px]">
                        {r.amount_display}
                        {r.currency === "usdc" ? " USDC" : ""} to {r.payee}
                      </strong>
                      {r.memo ? (
                        <p className="muted m-0 mt-0.5 truncate text-[11px]">
                          {r.memo}
                        </p>
                      ) : null}
                    </div>
                    <span className="muted shrink-0 text-[11px]">
                      {new Date(r.created_at).toLocaleDateString()}
                    </span>
                  </div>
                ))}
                <button
                  className="btn !px-3 !py-1.5 !text-[12px]"
                  onClick={onOpenPay}
                >
                  {payCount === 1
                    ? "Review 1 request in Pay"
                    : `Review ${payCount} requests in Pay`}
                </button>
              </div>
            </>
          ) : null}
          <h4 className="m-0 mt-2 text-[13px] font-semibold">Balances</h4>
          {wallet.degraded ? (
            <p className="muted m-0 text-[12px]">
              Some balances are unavailable right now — showing what we could
              reach.
            </p>
          ) : null}
          {wallet.native ? (
            <div className="panel rise-in flex items-center justify-between !p-3">
              <strong className="text-[13px]">{wallet.native.symbol}</strong>
              <span className="text-[13px]">{wallet.native.display}</span>
            </div>
          ) : null}
          {(wallet.tokens ?? []).map((t) => (
            <div
              key={`${t.symbol}-${t.name}`}
              className="panel rise-in flex items-center justify-between !p-3"
            >
              <div>
                <strong className="text-[13px]">{t.symbol}</strong>
                <p className="muted m-0 mt-0.5 text-[12px]">{t.name}</p>
              </div>
              <span className="text-[13px]">{t.display}</span>
            </div>
          ))}
          {!wallet.native && (wallet.tokens ?? []).length === 0 ? (
            <p className="muted m-0 text-[13px]">No balances to show yet.</p>
          ) : null}
          <h4 className="m-0 mt-2 text-[13px] font-semibold">Activity</h4>
          {walletTransfers.map((t) => (
            <div
              key={t.id}
              className="panel rise-in flex items-center justify-between !p-3"
            >
              <div className="min-w-0">
                <strong
                  className={
                    "text-[13px] " +
                    (t.status === "submitted"
                      ? "text-[var(--success)]"
                      : t.status === "pending" ||
                          t.status === "submitting" ||
                          t.status === "submit_unknown"
                        ? "text-[var(--warning)]"
                        : "text-[var(--muted-2)]")
                  }
                >
                  {t.status === "pending"
                    ? "Send awaiting approval"
                    : t.status === "submitting"
                      ? "Sending…"
                      : t.status === "submitted"
                        ? "Sent"
                        : t.status === "denied"
                          ? "Send denied"
                          : t.status === "submit_unknown"
                            ? "Send outcome unknown — check the chain"
                            : "Send failed"}
                </strong>
                <p className="muted m-0 mt-0.5 break-all font-mono text-[11px]">
                  {t.to_address}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[13px]">
                  {t.amount_display} {t.token_symbol ?? "ETH"}
                </span>
                <p className="muted m-0 mt-0.5 text-[11px]">
                  {new Date(t.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
          {(walletTxs ?? []).map((t) => (
            <a
              key={t.hash}
              href={t.explorer_url}
              target="_blank"
              rel="noreferrer"
              className="panel rise-in flex items-center justify-between !p-3 no-underline"
            >
              <div className="min-w-0">
                <strong
                  className={
                    "text-[13px] " +
                    (t.direction === "in"
                      ? "text-[var(--success)]"
                      : "text-[var(--muted-2)]")
                  }
                >
                  {t.direction === "in" ? "Received" : "Sent"}
                </strong>
                <p className="muted m-0 mt-0.5 break-all font-mono text-[11px]">
                  {t.counterparty}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <span className="text-[13px]">{t.value_display}</span>
                <p className="muted m-0 mt-0.5 text-[11px]">
                  {new Date(t.timestamp).toLocaleDateString()}
                </p>
              </div>
            </a>
          ))}
          {walletTxs !== null &&
          walletTxs.length === 0 &&
          walletTransfers.length === 0 ? (
            <p className="muted m-0 text-[13px]">No activity yet.</p>
          ) : null}
        </>
      )}
    </div>
  );
}
