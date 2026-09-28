/**
 * Box-local Stripe Link SpendRequest adapter.
 *
 * The release gate is off by default. This adapter can create only an
 * owner-approved request: it never passes `--approve`, never asks the CLI to
 * include a credential in stdout, and returns only normalized status fields.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command } from "../box/client";
import { shellQuote } from "../box/shell";
import { safeCheckoutUrl } from "../checkout/handoffs";
import { ensureBoxAwake } from "../orchestrator/boxes";
import { asRecord } from "../records";
import { checkLinkAuth, LINK_CREDENTIALS_PATH } from "./linkAuth";
import { env } from "../env";

const LINK_CLI = "/home/user/.hermes/node/bin/link-cli";
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/;
const SAFE_PROVIDER_ID = /^[A-Za-z0-9][A-Za-z0-9_-]{7,199}$/;
const SAFE_ACCOUNT_ID = /^acct_[A-Za-z0-9]{4,}$/;

export type LinkSpendStatus =
  | "created"
  | "pending_approval"
  | "approved"
  | "requires_action"
  | "denied"
  | "expired"
  | "canceled"
  | "completed"
  | "unknown_outcome";

export interface LinkSpendResult {
  id: string;
  status: LinkSpendStatus;
  /** Sanitized provider next-action resolution, never a credential or URL. */
  resolution: string | null;
}

export interface LinkSpendLineItem {
  name: string;
  unitAmountCents: number;
  quantity: number;
}

export interface LinkSpendTotal {
  type: "subtotal" | "tax" | "shipping" | "discount" | "total";
  label: string;
  amountCents: number;
}

export type LinkSpendMethod =
  | { type: "card" }
  | {
      type: "link_pay_token";
      merchantAccountId: string;
      /** True only after both steering markers were read from the checkout. */
      markerVerified: boolean;
    }
  | {
      type: "shared_payment_token";
      /** True only for a decoded, supported HTTP 402 MPP challenge. */
      challengeVerified: boolean;
    };

export interface CreateLinkSpendInput {
  idempotencyKey: string;
  amountCents: number;
  currency: string;
  merchantName: string;
  merchantUrl: string;
  context: string;
  lineItems: readonly LinkSpendLineItem[];
  totals: readonly LinkSpendTotal[];
  method: LinkSpendMethod;
  test?: boolean;
}

function integerCents(value: number, label: string, allowNegative = false): number {
  if (
    !Number.isSafeInteger(value) ||
    (!allowNegative && value < 0) ||
    Math.abs(value) > 2_147_483_647
  ) {
    throw new Error(`${label} is invalid`);
  }
  return value;
}

function plainText(value: string, label: string, max: number): string {
  const normalized = value
    .replace(/[\u0000-\u001f\u007f,:]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
  if (!normalized || normalized.length > max) throw new Error(`${label} is invalid`);
  return normalized;
}

function flag(name: string, value: string | number): string {
  return `--${name} ${shellQuote(String(value))}`;
}

/** Build the exact verified v0.19.x CLI shape without executing anything. */
export function buildLinkSpendCreateCommand(input: CreateLinkSpendInput): string {
  if (!SAFE_ID.test(input.idempotencyKey)) {
    throw new Error("Link spend idempotency key is invalid");
  }
  const amount = integerCents(input.amountCents, "Link spend amount");
  if (amount <= 0) throw new Error("Link spend amount is invalid");
  const currency = input.currency.trim().toLowerCase();
  if (!/^[a-z]{3}$/.test(currency)) throw new Error("Link spend currency is invalid");
  const merchantName = plainText(input.merchantName, "Link merchant name", 120);
  const merchantUrl = safeCheckoutUrl(input.merchantUrl);
  if (!merchantUrl) throw new Error("Link merchant URL is invalid");
  const context = input.context.replace(/\s+/gu, " ").trim();
  if (context.length < 100 || context.length > 1_000) {
    throw new Error("Link spend context must be 100-1000 characters");
  }
  if (input.lineItems.length < 1 || input.lineItems.length > 100) {
    throw new Error("Link spend line items are invalid");
  }
  if (input.totals.length < 1 || input.totals.length > 20) {
    throw new Error("Link spend totals are invalid");
  }
  if (!input.totals.some((total) => total.type === "total" && total.amountCents === amount)) {
    throw new Error("Link spend total must match the requested amount");
  }

  let credentialType = "card";
  const methodFlags: string[] = [];
  if (input.method.type === "link_pay_token") {
    if (!input.method.markerVerified || !SAFE_ACCOUNT_ID.test(input.method.merchantAccountId)) {
      throw new Error("Link Pay Token capability is not verified");
    }
    methodFlags.push(
      flag("executionMethod", "link_pay_token"),
      flag("merchantAccountId", input.method.merchantAccountId),
    );
  } else if (input.method.type === "shared_payment_token") {
    if (!input.method.challengeVerified) {
      throw new Error("MPP challenge is not verified");
    }
    credentialType = "shared_payment_token";
  }

  const args = [
    LINK_CLI,
    "spend-request create",
    flag("idempotencyKey", input.idempotencyKey),
    flag("credentialType", credentialType),
    ...methodFlags,
    flag("amount", amount),
    flag("currency", currency),
    flag("merchantName", merchantName),
    // A provider approval needs merchant identity, not a bearer cart URL.
    flag("merchantUrl", new URL("/", merchantUrl.origin).toString()),
    flag("context", context),
  ];
  for (const item of input.lineItems) {
    const name = plainText(item.name, "Link line item name", 200);
    const unit = integerCents(item.unitAmountCents, "Link line item amount");
    const quantity = integerCents(item.quantity, "Link line item quantity");
    if (quantity < 1 || quantity > 10_000) {
      throw new Error("Link line item quantity is invalid");
    }
    args.push(flag("lineItem", `name:${name},unit_amount:${unit},quantity:${quantity}`));
  }
  for (const total of input.totals) {
    const label = plainText(total.label, "Link total label", 120);
    const totalAmount = integerCents(
      total.amountCents,
      "Link total amount",
      total.type === "discount",
    );
    args.push(flag(
      "total",
      `type:${total.type},display_text:${label},amount:${totalAmount}`,
    ));
  }
  // Fixed literals are intentionally not caller-controlled.
  args.push("--requestApproval true");
  if (input.test === true) args.push("--test true");
  args.push("--format json", flag("auth", LINK_CREDENTIALS_PATH));
  return args.join(" ");
}

function responseRecord(raw: unknown): Record<string, unknown> | null {
  const outer = asRecord(Array.isArray(raw) ? raw[0] : raw);
  if (!outer) return null;
  return (
    asRecord(outer["spend_request"]) ??
    asRecord(outer["spendRequest"]) ??
    asRecord(outer["data"]) ??
    outer
  );
}

function normalizedStatus(raw: unknown): LinkSpendStatus {
  if (typeof raw !== "string") return "unknown_outcome";
  const status = raw.trim().toLowerCase();
  if (status === "cancelled") return "canceled";
  if (status === "pending" || status === "approval_required") return "pending_approval";
  if (status === "succeeded" || status === "success") return "completed";
  const known: readonly LinkSpendStatus[] = [
    "created",
    "pending_approval",
    "approved",
    "requires_action",
    "denied",
    "expired",
    "canceled",
    "completed",
    "unknown_outcome",
  ];
  return known.includes(status as LinkSpendStatus)
    ? status as LinkSpendStatus
    : "unknown_outcome";
}

/** Discard every unrecognized provider field, including credential payloads. */
export function normalizeLinkSpendResponse(raw: unknown): LinkSpendResult {
  const record = responseRecord(raw);
  const rawId = record?.["id"] ?? record?.["spend_request_id"] ?? record?.["spendRequestId"];
  if (typeof rawId !== "string" || !SAFE_PROVIDER_ID.test(rawId)) {
    throw new Error("Link spend response is missing a valid request id");
  }
  const nextAction = asRecord(record?.["next_action"] ?? record?.["nextAction"]);
  const rawResolution = nextAction?.["resolution"];
  const resolution =
    typeof rawResolution === "string" && /^[a-z0-9_-]{1,80}$/i.test(rawResolution)
      ? rawResolution.toLowerCase()
      : null;
  return {
    id: rawId,
    status: normalizedStatus(record?.["status"]),
    resolution,
  };
}

export async function createLinkSpendRequest(
  supabase: SupabaseClient,
  userId: string,
  input: CreateLinkSpendInput,
): Promise<LinkSpendResult> {
  if (!env.linkAgentPaymentsEnabled()) {
    throw new Error("Link agent payments are disabled");
  }
  const auth = await checkLinkAuth(supabase, userId);
  if (!auth.authenticated) {
    throw new Error("Link agent-payment grant is not verified");
  }
  const box = await ensureBoxAwake(supabase, userId);
  const result = await command(box.boxId, buildLinkSpendCreateCommand(input), 55);
  if (result.exitCode !== 0) {
    // stderr can contain third-party/provider details and is never surfaced.
    throw new Error("Link spend request failed");
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(result.stdout.trim());
  } catch {
    throw new Error("Link spend response was invalid");
  }
  return normalizeLinkSpendResponse(parsed);
}
