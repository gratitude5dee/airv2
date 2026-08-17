/**
 * Pure projection helpers for the wallet readers (goal.md M15). No network,
 * no client — kept separate so they are unit-testable.
 */
import { toTokens } from "thirdweb/utils";

/** Insight transaction fields the projection reads. */
export interface InsightTransaction {
  hash: string;
  from_address: string;
  to_address: string;
  value: string;
  block_timestamp: number;
}

export interface ProjectedTransaction {
  hash: string;
  direction: "in" | "out";
  counterparty: string;
  value_display: string;
  timestamp: string;
  explorer_url: string;
}

const EXPLORERS: Record<number, string> = {
  1: "https://etherscan.io",
  8453: "https://basescan.org",
  84532: "https://sepolia.basescan.org",
};

export function explorerTxUrl(chainId: number, hash: string): string {
  const base = EXPLORERS[chainId];
  return base ? `${base}/tx/${hash}` : `https://blockscan.com/tx/${hash}`;
}

/** Wei (or smallest unit) → trimmed decimal display, capped at 6 places. */
export function displayAmount(value: bigint, decimals: number): string {
  const full = toTokens(value, decimals);
  const dot = full.indexOf(".");
  if (dot === -1) return full;
  const whole = full.slice(0, dot);
  const trimmed = full.slice(dot + 1, dot + 7).replace(/0+$/, "");
  return trimmed ? `${whole}.${trimmed}` : whole;
}

export function projectTransaction(
  walletAddress: string,
  chainId: number,
  tx: InsightTransaction
): ProjectedTransaction {
  const self = walletAddress.toLowerCase();
  const direction = tx.from_address.toLowerCase() === self ? "out" : "in";
  let value = 0n;
  try {
    value = BigInt(tx.value);
  } catch {
    // non-numeric value from the indexer: display as zero
  }
  return {
    hash: tx.hash,
    direction,
    counterparty: direction === "out" ? tx.to_address : tx.from_address,
    value_display: displayAmount(value, 18),
    timestamp: new Date(tx.block_timestamp * 1000).toISOString(),
    explorer_url: explorerTxUrl(chainId, tx.hash),
  };
}
