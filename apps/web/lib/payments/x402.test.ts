/**
 * MA2.1 acceptance: gated app without proof → 402 with the exact-scheme
 * accepts payload (payTo = the publisher's users.wallet_address, never the
 * manifest); valid X-PAYMENT verifies + settles, writes x402_receipts, logs
 * gate_settled and mints a paid session; a replayed payment is rejected
 * (unique jti); underpay/verification failures never mint; human browsers
 * get a pay page driven by the same payload.
 */
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest, NextResponse } from "next/server";
import { encodePayment } from "x402/schemes";
import type { PaymentPayload } from "x402/types";
import type { RegistryApp } from "@/lib/miniapps/registry";
import { makeApp } from "../../app/mini/loader-test-utils";

interface PaymentsDb {
  wallets: Record<string, string | null>;
  receipts: { jti: string; app_id: string; payer_address: string }[];
  gateEvents: { app_id: string; kind: string; ref: string | null }[];
}

const db: PaymentsDb = { wallets: {}, receipts: [], gateEvents: [] };

function fakeSupabase() {
  return {
    from(table: string) {
      if (table === "users") {
        return {
          select() {
            return {
              eq(_col: string, id: string) {
                return {
                  async maybeSingle() {
                    return id in db.wallets
                      ? { data: { wallet_address: db.wallets[id] }, error: null }
                      : { data: null, error: null };
                  },
                };
              },
            };
          },
        };
      }
      if (table === "x402_receipts") {
        return {
          async insert(row: { jti: string; app_id: string; payer_address: string }) {
            if (db.receipts.some((r) => r.jti === row.jti)) {
              return { error: { code: "23505", message: "duplicate" } };
            }
            db.receipts.push(row);
            return { error: null };
          },
        };
      }
      if (table === "miniapp_gate_events") {
        return {
          async insert(row: { app_id: string; kind: string; ref: string | null }) {
            db.gateEvents.push(row);
            return { error: null };
          },
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
}

vi.mock("@/lib/supabase", () => ({ serviceClient: () => fakeSupabase() }));

import {
  setFacilitatorForTests,
  x402PaymentGate,
  type Facilitator,
} from "./x402";
import { mintToken } from "@/lib/miniapps/tokens";

const OWNER = "22222222-3333-4444-8555-666666666666";
const WALLET = "0x1111111111111111111111111111111111111111";
const PAYER = "0x2222222222222222222222222222222222222222";

function paidApp(overrides?: Partial<RegistryApp>): RegistryApp {
  return makeApp({
    slug: "paidapp",
    owner_user_id: OWNER,
    x402_enabled: true,
    x402_price_usdc: 1.5,
    // Deliberately different from users.wallet_address — must never be paid.
    publisher_wallet: "0xdeaddeaddeaddeaddeaddeaddeaddeaddeaddead",
    ...overrides,
  });
}

function makePayment(nonce: string): string {
  const payload: PaymentPayload = {
    x402Version: 1,
    scheme: "exact",
    network: "base",
    payload: {
      signature: `0x${"ab".repeat(65)}`,
      authorization: {
        from: PAYER,
        to: WALLET,
        value: "1500000",
        validAfter: "0",
        validBefore: String(Math.floor(Date.now() / 1000) + 600),
        nonce,
      },
    },
  };
  return encodePayment(payload);
}

const NONCE = `0x${"11".repeat(32)}`;

function okFacilitator(): Facilitator {
  return {
    verify: vi.fn(async () => ({ isValid: true, payer: PAYER })),
    settle: vi.fn(async () => ({
      success: true,
      transaction: "0xtxhash",
      network: "base" as const,
      payer: PAYER,
    })),
  };
}

function request(headers?: Record<string, string>): NextRequest {
  return new NextRequest("https://mini.wzrd.tech/mini/paidapp", { headers });
}

beforeAll(() => {
  process.env.MINIAPP_SIGNING_KEY = "test-signing-key";
});

beforeEach(() => {
  db.wallets = { [OWNER]: WALLET };
  db.receipts = [];
  db.gateEvents = [];
  setFacilitatorForTests(okFacilitator());
});

describe("x402 challenge", () => {
  it("responds 402 with payTo from users.wallet_address, not the manifest", async () => {
    const res = await x402PaymentGate(request(), paidApp());
    expect(res?.status).toBe(402);
    const body = (await res?.json()) as {
      accepts: { payTo: string; scheme: string; network: string; maxAmountRequired: string }[];
    };
    expect(body.accepts[0]?.payTo).toBe(WALLET);
    expect(body.accepts[0]?.scheme).toBe("exact");
    expect(body.accepts[0]?.network).toBe("base");
    expect(body.accepts[0]?.maxAmountRequired).toBe("1500000");
  });

  it("passes when x402 is disabled", async () => {
    const res = await x402PaymentGate(
      request(),
      paidApp({ x402_enabled: false })
    );
    expect(res).toBeNull();
  });

  it("passes the owner's own session", async () => {
    const cookie = mintToken(OWNER, "paidapp", "default");
    const res = await x402PaymentGate(
      request({ cookie: `mini_paidapp=${cookie}` }),
      paidApp()
    );
    expect(res).toBeNull();
  });

  it("stays payment-gated with no accepts when the publisher wallet is missing", async () => {
    db.wallets = { [OWNER]: null };
    const res = await x402PaymentGate(request(), paidApp());
    expect(res?.status).toBe(402);
    const body = (await res?.json()) as { accepts: unknown[] };
    expect(body.accepts).toHaveLength(0);
    expect(db.receipts).toHaveLength(0);
  });

  it("renders a pay page for browsers using the same payload", async () => {
    const res = await x402PaymentGate(
      request({ accept: "text/html,application/xhtml+xml" }),
      paidApp()
    );
    expect(res?.status).toBe(402);
    expect(res?.headers.get("content-type")).toContain("text/html");
    const body = await res?.text();
    expect(body).toContain(WALLET);
    expect(body).not.toContain("0xdeaddead");
  });
});

describe("x402 settlement", () => {
  it("verifies, settles, writes a receipt, logs gate_settled and mints a paid session", async () => {
    const res = await x402PaymentGate(
      request({ "x-payment": makePayment(NONCE) }),
      paidApp()
    );
    expect(res?.status).toBe(303);
    expect(db.receipts).toHaveLength(1);
    expect(db.receipts[0]?.jti).toBe(NONCE);
    expect(db.receipts[0]?.payer_address).toBe(PAYER);
    expect(db.gateEvents.map((e) => e.kind)).toContain("gate_settled");
    expect(res?.headers.get("x-payment-response")).toBeTruthy();
    const cookie = res?.cookies.get("mini_paidapp");
    expect(cookie?.value).toBeTruthy();
  });

  it("scopes the paid cookie to /mini/<slug> on the main-host form", async () => {
    const res = await x402PaymentGate(
      request({ "x-payment": makePayment(NONCE) }),
      paidApp()
    );
    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe(
      "https://mini.wzrd.tech/mini/paidapp"
    );
    expect(res?.cookies.get("mini_paidapp")?.path).toBe("/mini/paidapp");
  });

  it("scopes the paid cookie to /<slug> on the mini host (x-mini-host)", async () => {
    const res = await x402PaymentGate(
      request({ "x-payment": makePayment(NONCE), "x-mini-host": "1" }),
      paidApp()
    );
    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe("https://mini.wzrd.tech/paidapp");
    expect(res?.cookies.get("mini_paidapp")?.path).toBe("/paidapp");
  });

  it("scopes the cookie to an explicit basePath and returns the caller's settled response (launch)", async () => {
    const res = await x402PaymentGate(
      request({ "x-payment": makePayment(NONCE) }),
      paidApp(),
      {
        basePath: "/paidapp",
        settled: () =>
          NextResponse.json({ url: "https://mini.wzrd.tech/paidapp" }),
      }
    );
    expect(res?.status).toBe(200);
    const body = (await res?.json()) as { url: string };
    expect(body.url).toBe("https://mini.wzrd.tech/paidapp");
    expect(res?.headers.get("x-payment-response")).toBeTruthy();
    expect(res?.cookies.get("mini_paidapp")?.path).toBe("/paidapp");
    expect(db.receipts).toHaveLength(1);
  });

  it("rejects a replayed payment (same nonce) without minting", async () => {
    const header = makePayment(NONCE);
    const first = await x402PaymentGate(request({ "x-payment": header }), paidApp());
    expect(first?.status).toBe(303);
    const replay = await x402PaymentGate(request({ "x-payment": header }), paidApp());
    expect(replay?.status).toBe(402);
    expect(db.receipts).toHaveLength(1);
    expect(replay?.cookies.get("mini_paidapp")).toBeUndefined();
  });

  it("rejects when verification fails (underpay) and never settles", async () => {
    const facilitator: Facilitator = {
      verify: vi.fn(async () => ({
        isValid: false,
        invalidReason: "invalid_exact_evm_payload_authorization_value" as const,
      })),
      settle: vi.fn(),
    };
    setFacilitatorForTests(facilitator);
    const res = await x402PaymentGate(
      request({ "x-payment": makePayment(NONCE) }),
      paidApp()
    );
    expect(res?.status).toBe(402);
    expect(facilitator.settle).not.toHaveBeenCalled();
    expect(db.receipts).toHaveLength(0);
  });

  it("rejects when settlement fails without writing a receipt", async () => {
    setFacilitatorForTests({
      verify: vi.fn(async () => ({ isValid: true, payer: PAYER })),
      settle: vi.fn(async () => ({
        success: false,
        errorReason: "insufficient_funds" as const,
        transaction: "",
        network: "base" as const,
      })),
    });
    const res = await x402PaymentGate(
      request({ "x-payment": makePayment(NONCE) }),
      paidApp()
    );
    expect(res?.status).toBe(402);
    expect(db.receipts).toHaveLength(0);
  });

  it("rejects a garbage X-PAYMENT header", async () => {
    const res = await x402PaymentGate(
      request({ "x-payment": "not-a-payment" }),
      paidApp()
    );
    expect(res?.status).toBe(402);
    expect(db.receipts).toHaveLength(0);
  });

  it("rejects a payment on the wrong network", async () => {
    const payload: PaymentPayload = {
      x402Version: 1,
      scheme: "exact",
      network: "base-sepolia",
      payload: {
        signature: `0x${"ab".repeat(65)}`,
        authorization: {
          from: PAYER,
          to: WALLET,
          value: "1500000",
          validAfter: "0",
          validBefore: String(Math.floor(Date.now() / 1000) + 600),
          nonce: NONCE,
        },
      },
    };
    const res = await x402PaymentGate(
      request({ "x-payment": encodePayment(payload) }),
      paidApp()
    );
    expect(res?.status).toBe(402);
    expect(db.receipts).toHaveLength(0);
  });
});
