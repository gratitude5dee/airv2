/**
 * Wallet send flow (V8): the composer creates a transfer intent plus a
 * run_approval decision — never a transaction. Execution happens here,
 * server-side via thirdweb, only when the decision is approved; a dismissal
 * marks the intent denied and nothing moves. The owner wallet comes from
 * users.wallet_address — never from client input (C21).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { sendWalletTokens } from "../thirdweb/client";
import { env } from "../env";

const ADDRESS_RE = /^0x[0-9a-fA-F]{40}$/;
// Integer part bounded so the display string stays sane; fraction digits
// bounded by the asset's decimals. ENS names are display-only — sends
// require the resolved 0x address.
const AMOUNT_RE = /^(0|[1-9][0-9]{0,8})(\.[0-9]{1,18})?$/;

/** Assets the send lane accepts: the chain's native token or USDC. */
export type WalletAsset = "native" | "usdc";

interface AssetSpec {
  decimals: number;
  symbol: string;
  tokenAddress: string | null;
}

function assetSpec(asset: WalletAsset): AssetSpec {
  return asset === "usdc"
    ? { decimals: 6, symbol: "USDC", tokenAddress: env.walletUsdcAddress() }
    : { decimals: 18, symbol: "ETH", tokenAddress: null };
}

export class WalletSendError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "WalletSendError";
    this.status = status;
  }
}

/**
 * The provider may or may not have broadcast the transfer (C23). The intent
 * is terminal (`submit_unknown`) — approval must never be retried, because a
 * retry could double-send.
 */
export class WalletSubmitUnknownError extends WalletSendError {
  constructor() {
    super(
      502,
      "not sure that send went through — it won't retry; check activity before sending again"
    );
    this.name = "WalletSubmitUnknownError";
  }
}

/** Deterministic per-intent key so a repeat submit of the same transfer
 * dedupes at the provider instead of broadcasting twice. */
export function transferIdempotencyKey(transferId: string): string {
  return `wallet-transfer-${transferId}`;
}

/** Decimal amount → the asset's smallest unit. Throws WalletSendError(400)
 * on bad input, including more fraction digits than the asset carries. */
export function parseAssetAmount(amount: string, decimals = 18): bigint {
  const trimmed = amount.trim();
  if (!AMOUNT_RE.test(trimmed)) {
    throw new WalletSendError(400, "invalid amount");
  }
  const [whole = "0", fraction = ""] = trimmed.split(".");
  if (fraction.length > decimals) {
    throw new WalletSendError(400, "invalid amount");
  }
  const atomic =
    BigInt(whole) * 10n ** BigInt(decimals) +
    BigInt(fraction.padEnd(decimals, "0") || "0");
  if (atomic <= 0n) {
    throw new WalletSendError(400, "amount must be positive");
  }
  return atomic;
}

/** Decimal native amount → wei. Throws WalletSendError(400) on bad input. */
export function parseNativeAmount(amount: string): bigint {
  return parseAssetAmount(amount, 18);
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
  token_address: string | null;
  token_symbol: string;
  status:
    | "pending"
    | "submitting"
    | "submitted"
    | "denied"
    | "failed"
    | "submit_unknown";
  transaction_id: string | null;
  created_at: string;
  resolved_at: string | null;
}

const TRANSFER_COLUMNS =
  "id, user_id, to_address, amount_wei, amount_display, chain_id, token_address, token_symbol, status, transaction_id, created_at, resolved_at";

/**
 * Create the transfer intent + its run_approval decision. Returns the
 * decision id so the UI can point at Needs you. No transaction happens here.
 */
export async function createTransferRequest(
  supabase: SupabaseClient,
  userId: string,
  toRaw: string,
  amountRaw: string,
  asset: WalletAsset = "native"
): Promise<{ transferId: string; decisionId: string }> {
  const to = validateSendAddress(toRaw);
  const spec = assetSpec(asset);
  const atomic = parseAssetAmount(amountRaw, spec.decimals);
  const display = amountRaw.trim();
  const chainId = env.walletChainId();
  const { data: transfer, error } = await supabase
    .from("wallet_transfers")
    .insert({
      user_id: userId,
      to_address: to,
      amount_wei: atomic.toString(),
      amount_display: display,
      chain_id: chainId,
      token_address: spec.tokenAddress,
      token_symbol: spec.symbol,
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
      label: `Send ${display} ${spec.symbol} to ${shortAddress(to)}`,
      payload: {
        wallet_send: true,
        to_address: to,
        amount_display: display,
        token_symbol: spec.symbol,
        token_address: spec.tokenAddress,
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
 * wallet. The row is claimed pending→submitting first (a conditional update,
 * same single-use pattern as claimSchedule and fill-ticket redemption) so
 * concurrent approvals cannot both reach the provider. A failure before the
 * provider is reached releases the claim back to pending so approval can be
 * retried; a throw during the submit itself is ambiguous — the transaction
 * may have broadcast — so the row goes terminal `submit_unknown` and is
 * never reset to pending (a retry could double-send, P0-1/C23).
 */
export async function executeTransfer(
  supabase: SupabaseClient,
  userId: string,
  transfer: WalletTransfer
): Promise<string> {
  const { data: claimed } = await supabase
    .from("wallet_transfers")
    .update({ status: "submitting" })
    .eq("id", transfer.id)
    .eq("user_id", userId)
    .eq("status", "pending")
    .select("id");
  if (!claimed || claimed.length === 0) {
    throw new WalletSendError(409, "this send is already being processed");
  }
  let walletAddress: string;
  try {
    const { data: user } = await supabase
      .from("users")
      .select("wallet_address")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.wallet_address) {
      throw new WalletSendError(409, "no wallet on file");
    }
    walletAddress = user.wallet_address as string;
  } catch (error) {
    // Nothing has reached the provider: safe to release the claim.
    await supabase
      .from("wallet_transfers")
      .update({ status: "pending" })
      .eq("id", transfer.id)
      .eq("user_id", userId)
      .eq("status", "submitting");
    throw error;
  }
  let transactionId: string | undefined;
  try {
    [transactionId] = await sendWalletTokens(
      walletAddress,
      transfer.chain_id,
      transfer.to_address,
      transfer.amount_wei,
      transfer.token_address ?? null,
      transferIdempotencyKey(transfer.id)
    );
  } catch {
    await markSubmitUnknown(supabase, userId, transfer.id);
    throw new WalletSubmitUnknownError();
  }
  if (!transactionId) {
    // A 2xx without a transaction id: accepted but untrackable — ambiguous.
    await markSubmitUnknown(supabase, userId, transfer.id);
    throw new WalletSubmitUnknownError();
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

async function markSubmitUnknown(
  supabase: SupabaseClient,
  userId: string,
  transferId: string
): Promise<void> {
  await supabase
    .from("wallet_transfers")
    .update({ status: "submit_unknown", resolved_at: new Date().toISOString() })
    .eq("id", transferId)
    .eq("user_id", userId)
    .eq("status", "submitting");
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
