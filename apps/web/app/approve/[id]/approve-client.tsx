"use client";

/**
 * The Link-style approval sheet: amount (band for purchase reviews — C18
 * keeps exact figures out of the control plane; exact display amount for
 * payment requests), expiry countdown, merchant + cart inspect, saved
 * payment method, Decline/Approve. For fiat payment requests with a
 * configured publishable key it also mounts Stripe's Express Checkout
 * Element (Link / Apple Pay / Google Pay one-click buttons); only the
 * publishable key and a PaymentIntent client secret ever reach the browser.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface View {
  id: string;
  kind: "purchase_review" | "payment_request";
  status: string;
  label: string | null;
  agent: string | null;
  expires_at: string | null;
  purchase?: {
    host: string;
    summary: string;
    amount_band: string;
    card_name: string;
    card_masked: string | null;
    link_supported: boolean;
  };
  payment?: {
    amount_display: string;
    amount_cents: number | null;
    currency: string;
    payee: string;
    memo: string;
    request_status: string;
  };
  express?: {
    publishable_key: string;
    stripe_account: string;
    amount_cents: number;
  };
}

/* Minimal Stripe.js surface used here — the script loads from
 * js.stripe.com at runtime; no SDK dependency. */
interface StripeElementsLike {
  create(kind: "expressCheckout"): {
    mount(selector: string): void;
    on(event: "confirm", handler: () => void): void;
  };
  submit(): Promise<{ error?: { message?: string } }>;
}
interface StripeLike {
  elements(options: {
    mode: "payment";
    amount: number;
    currency: string;
  }): StripeElementsLike;
  confirmPayment(options: {
    elements: StripeElementsLike;
    clientSecret: string;
    confirmParams: { return_url: string };
    redirect: "if_required";
  }): Promise<{ error?: { message?: string } }>;
}
declare global {
  interface Window {
    Stripe?: (key: string, options?: { stripeAccount?: string }) => StripeLike;
  }
}

type Phase =
  | "loading"
  | "ready"
  | "working"
  | "approved"
  | "declined"
  | "paid"
  | "gone"
  | "error";

function useCountdown(target: string | null): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!target) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);
  if (!target) return null;
  const remaining = Date.parse(target) - now;
  if (Number.isNaN(remaining)) return null;
  if (remaining <= 0) return "Expired";
  const minutes = Math.floor(remaining / 60_000);
  if (minutes >= 1) return `Expires in ${minutes} min`;
  return `Expires in ${Math.floor(remaining / 1000)}s`;
}

function loadStripeJs(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.Stripe) return resolve();
    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://js.stripe.com/v3"]'
    );
    if (existing) {
      existing.addEventListener("load", () => resolve());
      existing.addEventListener("error", () => reject(new Error("stripe.js")));
      return;
    }
    const script = document.createElement("script");
    script.src = "https://js.stripe.com/v3";
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("stripe.js"));
    document.head.appendChild(script);
  });
}

export function ApproveClient({ decisionId }: { decisionId: string }) {
  const token = useMemo(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("k") ?? "";
  }, []);
  const [view, setView] = useState<View | null>(null);
  const [phase, setPhase] = useState<Phase>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);
  const elementsRef = useRef<StripeElementsLike | null>(null);
  const stripeRef = useRef<StripeLike | null>(null);
  const apiUrl = `/api/approvals/${decisionId}${token ? `?k=${encodeURIComponent(token)}` : ""}`;
  const countdown = useCountdown(
    view && view.status === "pending" ? view.expires_at : null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(apiUrl, { cache: "no-store" });
        if (res.status === 401) {
          if (!cancelled) {
            setPhase("gone");
            setNotice(
              "This link has expired. Open the app and check Needs You."
            );
          }
          return;
        }
        if (!res.ok) {
          if (!cancelled) setPhase("error");
          return;
        }
        const data = (await res.json()) as View;
        if (cancelled) return;
        setView(data);
        if (data.status !== "pending") {
          setPhase(data.status === "approved" ? "approved" : "declined");
        } else {
          setPhase("ready");
        }
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiUrl]);

  const resolve = useCallback(
    async (action: "approve" | "dismiss", method?: "link") => {
      setPhase("working");
      setNotice(null);
      try {
        const res = await fetch(`/api/approvals/${decisionId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, method, k: token || undefined }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          checkoutUrl?: string;
          message?: string;
          error?: string;
        };
        if (!res.ok) {
          setPhase("ready");
          setNotice(data.message ?? data.error ?? "Something went wrong — try again.");
          return;
        }
        if (action === "approve" && data.checkoutUrl) {
          // Fiat payment request: finish in Stripe Checkout, where Link
          // prefills saved payment details for a one-click confirm.
          window.location.assign(data.checkoutUrl);
          return;
        }
        setPhase(action === "approve" ? "approved" : "declined");
      } catch {
        setPhase("ready");
        setNotice("Something went wrong — try again.");
      }
    },
    [decisionId, token]
  );

  // Express Checkout Element — mounts only when the server offered it.
  const express = view?.express;
  useEffect(() => {
    if (!express || phase !== "ready" || elementsRef.current) return;
    let cancelled = false;
    (async () => {
      try {
        await loadStripeJs();
        if (cancelled || !window.Stripe || elementsRef.current) return;
        const stripe = window.Stripe(express.publishable_key, {
          stripeAccount: express.stripe_account,
        });
        const elements = stripe.elements({
          mode: "payment",
          amount: express.amount_cents,
          currency: "usd",
        });
        stripeRef.current = stripe;
        elementsRef.current = elements;
        const expressCheckout = elements.create("expressCheckout");
        expressCheckout.on("confirm", async () => {
          setPhase("working");
          setNotice(null);
          try {
            const { error: submitError } = await elements.submit();
            if (submitError) throw new Error(submitError.message);
            const res = await fetch(
              `/api/approvals/${decisionId}/intent`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ k: token || undefined }),
              }
            );
            const data = (await res.json()) as {
              client_secret?: string;
              error?: string;
            };
            if (!res.ok || !data.client_secret) {
              throw new Error(data.error ?? "could not start the payment");
            }
            const { error } = await stripe.confirmPayment({
              elements,
              clientSecret: data.client_secret,
              confirmParams: { return_url: window.location.href },
              redirect: "if_required",
            });
            if (error) throw new Error(error.message);
            setPhase("paid");
          } catch (err) {
            setPhase("ready");
            setNotice(
              err instanceof Error && err.message
                ? err.message
                : "Payment failed — try again."
            );
          }
        });
        expressCheckout.mount("#express-checkout");
      } catch {
        // No wallet buttons — the Approve button still works.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [express, phase, decisionId, token]);

  const expired = countdown === "Expired";
  const purchase = view?.purchase;
  const payment = view?.payment;
  const agent = view?.agent ?? "Your agent";
  const amount = purchase
    ? purchase.amount_band
    : (payment?.amount_display ?? "");
  const host = purchase?.host ?? null;
  const cardName = purchase?.card_name ?? null;
  const cardMasked = purchase?.card_masked ?? null;
  const summary = purchase?.summary ?? payment?.memo ?? view?.label ?? "";
  const merchantName = host
    ? host.replace(/\.(com|net|org|co|io|shop)$/i, "")
    : (payment?.payee ?? "");
  const initial = (merchantName || "?").charAt(0).toUpperCase();

  return (
    <main className="approve-sheet">
      <style>{`
        .approve-sheet{min-height:100dvh;background:var(--bg);color:var(--text);display:flex;flex-direction:column;align-items:center;padding:20px 16px calc(20px + env(safe-area-inset-bottom));font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Inter,sans-serif}
        .approve-frame{width:100%;max-width:430px;display:flex;flex-direction:column;flex:1}
        .approve-head{display:flex;align-items:center;justify-content:space-between;padding:4px 0 20px}
        .wallet-brand{display:flex;align-items:center;gap:8px;font-weight:700;font-size:22px;letter-spacing:-0.02em}
        .wallet-dot{width:26px;height:26px;border-radius:50%;background:#00d66f;color:#003b1f;display:flex;align-items:center;justify-content:center;font-size:15px;font-weight:800}
        .agent-chip{width:44px;height:44px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-family:var(--font-chrome);font-size:18px;margin:4px auto 20px}
        .ask{text-align:center;font-size:26px;font-weight:700;letter-spacing:-0.02em;line-height:1.25;margin:0 8px}
        .ask .amt{display:block;font-size:30px;margin-top:6px}
        .expiry{margin:18px auto 26px;padding:8px 16px;border-radius:999px;border:1px solid var(--border);background:var(--surface);font-size:14px;color:var(--muted-2);width:fit-content}
        .expiry.warn{color:var(--danger);border-color:var(--danger)}
        .card{width:100%;border-radius:16px;background:var(--surface-2);border:1px solid var(--border);padding:14px;margin-bottom:14px;box-sizing:border-box}
        .card-row{display:flex;align-items:center;gap:12px}
        .avatar{width:44px;height:44px;border-radius:12px;background:var(--surface);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-size:18px;font-weight:700;flex-shrink:0}
        .merchant-name{font-family:var(--font-chrome);font-size:14px}
        .merchant-url{font-family:var(--font-chrome);font-size:12px;color:var(--muted);word-break:break-all}
        .inspect-btn{margin-left:auto;padding:9px 16px;border-radius:999px;border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:14px;font-weight:600;cursor:pointer}
        .cart-line{display:flex;gap:12px;border-top:1px solid var(--border);margin-top:12px;padding-top:12px;font-size:14px;line-height:1.45;color:var(--muted-2)}
        .visa-badge{width:44px;height:30px;border-radius:6px;background:#1a3c8b;color:#fff;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:800;font-style:italic;letter-spacing:0.03em;flex-shrink:0}
        .pm-name{font-size:15px;font-weight:600}
        .pm-masked{font-size:13px;color:var(--muted)}
        .spacer{flex:1;min-height:16px}
        #express-checkout{width:100%;margin-bottom:12px}
        .legal{text-align:center;font-size:12px;color:var(--muted);line-height:1.5;margin:0 12px 14px}
        .actions{display:flex;gap:12px;width:100%}
        .btn{flex:1;padding:16px 0;border-radius:999px;font-size:16px;font-weight:600;cursor:pointer;border:1px solid var(--border)}
        .btn.decline{background:var(--surface);color:var(--muted-2)}
        .btn.approve{background:var(--text);color:var(--bg);border-color:var(--text)}
        .btn:disabled{opacity:0.5;cursor:default}
        .notice{text-align:center;color:var(--danger);font-size:13px;margin-bottom:10px}
        .final{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center}
        .final-mark{width:64px;height:64px;border-radius:50%;border:3px solid var(--success);color:var(--success);display:flex;align-items:center;justify-content:center;font-size:30px}
        .final-mark.declined{border-color:var(--muted);color:var(--muted)}
        .spin{width:22px;height:22px;border:3px solid rgba(127,127,127,.3);border-top-color:currentColor;border-radius:50%;animation:approve-spin .8s linear infinite;display:inline-block;vertical-align:middle}
        @keyframes approve-spin{to{transform:rotate(360deg)}}
      `}</style>
      <div className="approve-frame">
        <header className="approve-head">
          <div className="wallet-brand">
            <span className="wallet-dot">›</span>
            {purchase ? "link" : "air pay"}
          </div>
        </header>

        {phase === "loading" && (
          <div className="final">
            <span className="spin" aria-label="Loading" />
          </div>
        )}

        {(phase === "error" || phase === "gone") && (
          <div className="final">
            <div className="final-mark declined">!</div>
            <p>{notice ?? "This approval could not be loaded."}</p>
          </div>
        )}

        {(phase === "approved" || phase === "paid") && (
          <div className="final">
            <div className="final-mark">✓</div>
            <p>
              {phase === "paid"
                ? "Payment complete. Your agent has been notified."
                : "Approved. Your agent is finishing the purchase."}
            </p>
          </div>
        )}

        {phase === "declined" && (
          <div className="final">
            <div className="final-mark declined">×</div>
            <p>Declined. Your agent has been told no.</p>
          </div>
        )}

        {(phase === "ready" || phase === "working") && view && (
          <>
            <div className="agent-chip">&lt;/&gt;</div>
            <h1 className="ask">
              {agent} is requesting to spend
              <span className="amt">{amount}</span>
            </h1>
            <div className={`expiry${expired ? " warn" : ""}`}>
              {countdown ?? "Waiting for you"}
            </div>

            <section className="card">
              <div className="card-row">
                <div className="avatar">{initial}</div>
                <div>
                  <div className="merchant-name">{merchantName}</div>
                  <div className="merchant-url">
                    {host ? `https://${host}` : (payment?.payee ?? "")}
                  </div>
                </div>
                {summary ? (
                  <button
                    type="button"
                    className="inspect-btn"
                    onClick={() => setInspecting((v) => !v)}
                  >
                    Inspect
                  </button>
                ) : null}
              </div>
              {inspecting && summary ? (
                <div className="cart-line">
                  <span aria-hidden>🛍</span>
                  <span>{summary}</span>
                </div>
              ) : null}
            </section>

            {cardName ? (
              <section className="card">
                <div className="card-row">
                  <div className="visa-badge">VISA</div>
                  <div>
                    <div className="pm-name">{cardName}</div>
                    {cardMasked ? (
                      <div className="pm-masked">{cardMasked}</div>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

            <div className="spacer" />
            {notice ? <p className="notice">{notice}</p> : null}
            {express ? <div id="express-checkout" /> : null}
            <p className="legal">
              {purchase
                ? "By approving, you authorize your agent to fill this saved card at checkout. Your real payment details are never shared with the platform."
                : "By approving, you authorize this payment to the payee shown. Your payment details stay with Stripe."}
            </p>
            <div className="actions">
              <button
                type="button"
                className="btn decline"
                disabled={phase === "working"}
                onClick={() => resolve("dismiss")}
              >
                Decline
              </button>
              <button
                type="button"
                className="btn approve"
                disabled={phase === "working" || expired}
                onClick={() => resolve("approve")}
              >
                {phase === "working" ? <span className="spin" /> : "Approve"}
              </button>
            </div>
          </>
        )}
      </div>
    </main>
  );
}
