/**
 * MA2.1 x402 gate, bound lazily by lib/miniapps/gates: a gated app
 * without a paid session answers 402 with the exact-scheme accepts payload
 * (Base mainnet USDC, payTo = the publisher's verified wallet from
 * users.wallet_address at challenge time — never from a manifest). On an
 * X-PAYMENT header the payment is verified + settled through the configured
 * facilitator, a x402_receipts row is written (first-insert-wins on the
 * payment nonce — replays never mint), and only then is a paid session
 * minted. Human browsers get a pay page driven by the same 402 payload.
 */
import { NextRequest, NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
// Not a React hook despite the name — aliased so lint sees it for what it is.
import { useFacilitator as facilitatorClient } from "x402/verify";
import { decodePayment } from "x402/schemes";
import { processPriceToAtomicAmount, safeBase64Encode, toJsonSafe } from "x402/shared";
import type {
  Network,
  PaymentPayload,
  PaymentRequirements,
  VerifyResponse,
  SettleResponse,
} from "x402/types";
import { createFacilitatorConfig } from "@coinbase/x402";
import { env } from "../env";
import { serviceClient } from "../supabase";
import {
  cookieName,
  externalOrigin,
  logGateEvent,
  sessionFromCookie,
  type X402Gate,
} from "../miniapps/gates";
import { BASE_HEADERS, esc, page } from "../miniapps/html";
import { mintToken } from "../miniapps/tokens";
import type { RegistryApp } from "../miniapps/registry";

/** Paid sessions carry a synthetic principal so modules can tell them apart. */
export const PAID_SESSION_TTL_MINUTES = 60;

export interface Facilitator {
  verify: (
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ) => Promise<VerifyResponse>;
  settle: (
    payload: PaymentPayload,
    requirements: PaymentRequirements
  ) => Promise<SettleResponse>;
}

let facilitatorOverride: Facilitator | null = null;

/** Tests inject a fake facilitator; production talks to X402_FACILITATOR_URL. */
export function setFacilitatorForTests(f: Facilitator | null): void {
  facilitatorOverride = f;
}

function facilitator(): Facilitator {
  if (facilitatorOverride) return facilitatorOverride;
  const keyId = env.cdpApiKeyId();
  const keySecret = env.cdpApiKeySecret();
  return facilitatorClient(
    keyId && keySecret
      ? createFacilitatorConfig(keyId, keySecret)
      : { url: env.x402FacilitatorUrl() as `${string}://${string}` }
  );
}

function paymentError(status: number, message: string): NextResponse {
  return NextResponse.json(
    { error: message },
    { status, headers: { "Cache-Control": "no-store" } }
  );
}

/**
 * The accepts entry for an app. payTo is resolved by the caller from
 * users.wallet_address — a manifest can never steer the payout.
 */
export function buildPaymentRequirements(
  app: RegistryApp,
  payTo: string,
  resource: string
): PaymentRequirements | null {
  const price = app.x402_price_usdc;
  if (price === null || !(price > 0)) return null;
  const network = env.x402Network() as Network;
  const atomic = processPriceToAtomicAmount(Number(price), network);
  if ("error" in atomic) return null;
  const asset = atomic.asset;
  if (typeof asset.address !== "string" || !asset.address.startsWith("0x")) {
    return null;
  }
  return {
    scheme: "exact",
    network,
    maxAmountRequired: atomic.maxAmountRequired,
    resource: resource as `${string}://${string}`,
    description: app.name || app.slug,
    mimeType: "text/html",
    payTo,
    maxTimeoutSeconds: 300,
    asset: asset.address,
    extra: "eip712" in asset ? asset.eip712 : undefined,
  };
}

/**
 * The publisher's verified payout wallet, read from users.wallet_address at
 * challenge time (goal.md §MA2.1). mini_apps.publisher_wallet is display
 * metadata only and is never trusted for payouts.
 */
export async function publisherPayTo(
  supabase: SupabaseClient,
  app: RegistryApp
): Promise<string | null> {
  if (!app.owner_user_id) return null;
  const { data, error } = await supabase
    .from("users")
    .select("wallet_address")
    .eq("id", app.owner_user_id)
    .maybeSingle();
  if (error || !data) return null;
  const wallet: unknown = (data as { wallet_address: string | null }).wallet_address;
  return typeof wallet === "string" && wallet.startsWith("0x") ? wallet : null;
}

function basePathFor(request: NextRequest, slug: string): string {
  return request.headers.get("x-mini-host") === "1"
    ? `/${slug}`
    : `/mini/${slug}`;
}

function wantsHtml(request: NextRequest): boolean {
  return (request.headers.get("accept") ?? "").includes("text/html");
}

function challengeBody(
  app: RegistryApp,
  requirements: PaymentRequirements
): { error: string; x402Version: number; accepts: object[] } {
  return {
    error: "payment required",
    x402Version: 1,
    accepts: [toJsonSafe(requirements)],
  };
}

/** Human pay page: same 402 payload, rendered for a browser without a wallet. */
function payPage(
  app: RegistryApp,
  requirements: PaymentRequirements
): NextResponse {
  const price = app.x402_price_usdc ?? 0;
  const body = page(
    app.name || app.slug,
    `<h1>${esc(app.name || app.slug)}</h1>` +
      `<p class="when" style="white-space:normal">This app costs $${esc(String(price))} USDC (Base) per session, paid directly to the publisher.</p>` +
      `<p class="when" style="white-space:normal">Pay to <code>${esc(requirements.payTo)}</code> — asset <code>${esc(String(requirements.asset))}</code>, amount <code>${esc(requirements.maxAmountRequired)}</code> (atomic units).</p>` +
      `<p class="when" style="white-space:normal">From your Air wallet: message your agent "pay $${esc(String(price))} to open ${esc(app.slug)}" and approve the transfer. From an agent or external wallet: retry this URL with an <code>X-PAYMENT</code> header (x402 exact scheme).</p>` +
      `<script type="application/json" id="x402">${JSON.stringify(challengeBody(app, requirements))}</script>`
  );
  return new NextResponse(body, {
    status: 402,
    headers: {
      ...BASE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Receipt insert — first insert of a payment nonce wins; a replayed payment
 * never mints a second session (unique jti).
 */
async function insertReceipt(
  supabase: SupabaseClient,
  app: RegistryApp,
  jti: string,
  payer: string,
  amountUsdc: number,
  txHash: string
): Promise<"ok" | "replay" | "error"> {
  const { error } = await supabase.from("x402_receipts").insert({
    jti,
    app_id: app.id,
    payer_address: payer,
    amount_usdc: amountUsdc,
    tx_hash: txHash,
  });
  if (!error) return "ok";
  if (error.code === "23505") return "replay";
  console.error(
    JSON.stringify({ msg: "x402 receipt insert failed", error: error.message })
  );
  return "error";
}

function paymentNonce(payload: PaymentPayload): string | null {
  const inner: unknown = payload.payload;
  if (
    typeof inner === "object" &&
    inner !== null &&
    "authorization" in inner &&
    typeof inner.authorization === "object" &&
    inner.authorization !== null &&
    "nonce" in inner.authorization &&
    typeof inner.authorization.nonce === "string"
  ) {
    return inner.authorization.nonce;
  }
  return null;
}

/**
 * The real x402 gate. Owner sessions and already-paid sessions pass; anyone
 * else gets the 402 challenge (JSON for agents, pay page for browsers), and
 * an X-PAYMENT header is verified + settled before a paid session is minted.
 */
export const x402PaymentGate: X402Gate = async (request, app) => {
  if (!app.x402_enabled) return null;
  const session = sessionFromCookie(request, app.slug);
  if (session && session.userId === app.owner_user_id) return null;
  if (session && session.userId.startsWith("x402:")) return null;

  const supabase = serviceClient();
  const payTo = await publisherPayTo(supabase, app);
  const basePath = basePathFor(request, app.slug);
  const resource = `${externalOrigin(request)}${basePath}`;
  const requirements = payTo
    ? buildPaymentRequirements(app, payTo, resource)
    : null;
  if (!requirements) {
    // Paid app with no verified payout wallet or price: still payment-gated
    // (never open), but with nothing to accept — no payTo is ever invented.
    return NextResponse.json(
      { error: "payment required", x402Version: 1, accepts: [] },
      { status: 402, headers: { "Cache-Control": "no-store" } }
    );
  }

  const header = request.headers.get("x-payment");
  if (!header) {
    if (wantsHtml(request)) return payPage(app, requirements);
    return NextResponse.json(challengeBody(app, requirements), {
      status: 402,
      headers: { "Cache-Control": "no-store" },
    });
  }

  let payload: PaymentPayload;
  try {
    payload = decodePayment(header);
  } catch {
    return paymentError(402, "invalid X-PAYMENT header");
  }
  if (payload.scheme !== "exact" || payload.network !== requirements.network) {
    return paymentError(402, "unsupported payment scheme or network");
  }
  const jti = paymentNonce(payload);
  if (!jti) return paymentError(402, "invalid payment payload");

  const f = facilitator();
  const verification = await f.verify(payload, requirements);
  if (!verification.isValid) {
    return paymentError(
      402,
      `payment verification failed: ${verification.invalidReason ?? "invalid"}`
    );
  }

  const settlement = await f.settle(payload, requirements);
  if (!settlement.success) {
    return paymentError(
      402,
      `payment settlement failed: ${settlement.errorReason ?? "unknown"}`
    );
  }

  const payer = settlement.payer ?? verification.payer ?? "unknown";
  const inserted = await insertReceipt(
    supabase,
    app,
    jti,
    payer,
    Number(app.x402_price_usdc),
    settlement.transaction
  );
  if (inserted === "replay") return paymentError(402, "payment already redeemed");
  if (inserted === "error") return paymentError(502, "receipt write failed");

  await logGateEvent(supabase, app.id, null, "gate_settled", "x402");
  console.log(
    JSON.stringify({
      msg: "x402 settled",
      app: app.slug,
      payer,
      tx: settlement.transaction,
      jti,
    })
  );

  const response = NextResponse.redirect(
    new URL(basePath, externalOrigin(request)),
    303
  );
  response.headers.set(
    "X-PAYMENT-RESPONSE",
    safeBase64Encode(JSON.stringify(toJsonSafe(settlement)))
  );
  response.cookies.set(
    cookieName(app.slug),
    mintToken(`x402:${payer}`, app.slug, app.id, PAID_SESSION_TTL_MINUTES, {
      role: "guest",
    }),
    {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: basePath,
      maxAge: PAID_SESSION_TTL_MINUTES * 60,
    }
  );
  return response;
};

