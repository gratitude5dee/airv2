/**
 * Wallet send flow (V8): the composer creates a transfer intent plus a
 * run_approval decision — never a transaction. Execution happens here,
 * server-side via thirdweb, only when the decision is approved; a dismissal
 * marks the intent denied and nothing moves. The owner wallet comes from
 * users.wallet_address — never from client input (C21).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendNativeTokens } from "../thirdweb/client";
import { env } from "../env";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
// Up to 18 fraction digits (wei precision); integer part bounded so the
// display string stays sane. ENS names are display-only — sends require
// the resolved 0x address.
const AMOUNT_RE = /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,18})?$/;

export class WalletSendError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "WalletSendError";
    this.status = status;
  }
}

/** Decimal native amount → wei. Throws WalletSendError(400) on bad input. */
export function parseNativeAmount(amount: string): bigint {
  const trimmed = amount.trim();
  if (!AMOUNT_RE.test(trimmed)) {
    throw new WalletSendError(400, "invalid amount");
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  const wei =
    BigInt(whole) * 10n ** 18n + BigInt(fraction.padEnd(18, "0") || "0");
  if (wei <= 0n) {
    throw new WalletSendError(400, "amount must be positive");
  }
  return wei;
}

export function validateSendAddress(address: string): string {
  const trimmed = address.trim();
  if (!ADDRESS_RE.test(trimmed)) {
    throw new WalletSendError(
      400,
      "invalid address — paste the full 0x address (ENS names are display-only)"
    );
  }
  return trimmed;
}

export function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export interface WalletTransfer {
  id: string;
  user_id: string;
  to_address: string;
  amount_wei: string;
  amount_display: string;
  chain_id: number;
  status: "pending" | "submitted" | "denied" | "failed";
  transaction_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

const TRANSFER_COLUMNS =
  "id, user_id, to_address, amount_wei, amount_display, chain_id, status, transaction_id, created_at, resolved_at";

/**
 * Create the transfer intent + its run_approval decision. Returns the
 * decision id so the UI can point at Needs you. No transaction happens here.
 */
export async function createTransferRequest(
  supabase: SupabaseClient,
  userId: string,
  toRaw: string,
  amountRaw: string
): Promise<{ transferId: string; decisionId: string }> {
  const to = validateSendAddress(toRaw);
  const wei = parseNativeAmount(amountRaw);
  const display = amountRaw.trim();
  const chainId = env.walletChainId();
  const { data: transfer, error } = await supabase
    .from("wallet_transfers")
    .insert({
      user_id: userId,
      to_address: to,
      amount_wei: wei.toString(),
      amount_display: display,
      chain_id: chainId,
    })
    .select("id")
    .single();
  if (error || !transfer) {
    throw new WalletSendError(500, "could not record the transfer");
  }
  const { data: decision, error: decisionError } = await supabase
    .from("decisions")
    .insert({
      user_id: userId,
      kind: "run_approval",
      ref: transfer.id,
      label: `Send ${display} to ${shortAddress(to)}`,
      payload: {
        wallet_send: true,
        to_address: to,
        amount_display: display,
        chain_id: chainId,
      },
    })
    .select("id")
    .single();
  if (decisionError || !decision) {
    // Keep the gate invariant: an intent without a decision can never
    // execute, but don't leave a dangling pending row either.
    await supabase
      .from("wallet_transfers")
      .update({ status: "failed", resolved_at: new Date().toISOString() })
      .eq("id", transfer.id);
    throw new WalletSendError(500, "could not create the approval");
  }
  return { transferId: transfer.id as string, decisionId: decision.id as string };
}

/** The pending transfer a run_approval ref points at, if it is one. */
export async function findPendingTransfer(
  supabase: SupabaseClient,
  userId: string,
  ref: string
): Promise<WalletTransfer | null> {
  const { data } = await supabase
    .from("wallet_transfers")
    .select(TRANSFER_COLUMNS)
    .eq("id", ref)
    .eq("user_id", userId)
    .eq("status", "pending")
    .maybeSingle();
  return (data as WalletTransfer | null) ?? null;
}

/**
 * Execute an approved transfer via thirdweb from the server-stored owner
 * wallet. On provider failure the row stays pending (and the caller must
 * leave the decision pending) so approval can be retried.
 */
export async function executeTransfer(
  supabase: SupabaseClient,
  userId: string,
  transfer: WalletTransfer
): Promise<string> {
  const { data: user } = await supabase
    .from("users")
    .select("wallet_address")
    .eq("id", userId)
    .maybeSingle();
  if (!user?.wallet_address) {
    throw new WalletSendError(409, "no wallet on file");
  }
  const [transactionId] = await sendNativeTokens(
    user.wallet_address as string,
    transfer.chain_id,
    transfer.to_address,
    transfer.amount_wei
  );
  if (!transactionId) {
    throw new WalletSendError(502, "send returned no transaction id");
  }
  await supabase
    .from("wallet_transfers")
    .update({
      status: "submitted",
      transaction_id: transactionId,
      resolved_at: new Date().toISOString(),
    })
    .eq("id", transfer.id)
    .eq("user_id", userId);
  return transactionId;
}

/** Dismissal: mark the intent denied — no transaction exists or ever will. */
export async function denyTransfer(
  supabase: SupabaseClient,
  userId: string,
  transferId: string
): Promise<void> {
  await supabase
    .from("wallet_transfers")
    .update({ status: "denied", resolved_at: new Date().toISOString() })
    .eq("id", transferId)
    .eq("user_id", userId)
    .eq("status", "pending");
}

/** Recent transfer intents for the activity panel (Insight is degraded). */
export async function listTransfers(
  supabase: SupabaseClient,
  userId: string
): Promise<WalletTransfer[]> {
  const { data } = await supabase
    .from("wallet_transfers")
    .select(TRANSFER_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(25);
  return (data as WalletTransfer[] | null) ?? [];
}
