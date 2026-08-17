/**
 * Server-side wallet readers (goal.md M15). Balances and activity come from
 * the thirdweb SDK + Insight with the secret key; the browser only ever sees
 * the projected JSON from /api/wallet* (C21 — the secret never leaves the
 * server). Insight outages degrade to native-only rather than 500.
 */
import { createThirdwebClient, defineChain, Insight } from "thirdweb";
import { getWalletBalance } from "thirdweb/wallets";
import { env } from "../env";
import {
  displayAmount,
  projectTransaction,
  type ProjectedTransaction,
} from "./project";

const MAX_TOKENS = 20;
const MAX_ACTIVITY = 25;

function serverClient() {
  return createThirdwebClient({ secretKey: env.thirdwebSecretKey() });
}

export interface WalletToken {
  symbol: string;
  name: string;
  display: string;
  usd: null;
}

export interface WalletSummary {
  address: string;
  chain_id: number;
  native: { symbol: string; display: string } | null;
  tokens: WalletToken[];
  degraded: boolean;
  updated_at: string;
}

export async function readWalletSummary(
  address: string
): Promise<WalletSummary> {
  const client = serverClient();
  const chainId = env.walletChainId();
  const chain = defineChain(chainId);
  let degraded = false;

  let native: WalletSummary["native"] = null;
  try {
    const balance = await getWalletBalance({ address, client, chain });
    native = {
      symbol: balance.symbol,
      display: displayAmount(balance.value, balance.decimals),
    };
  } catch {
    degraded = true;
  }

  let tokens: WalletToken[] = [];
  try {
    const owned = await Insight.getOwnedTokens({
      client,
      chains: [chain],
      ownerAddress: address,
      queryOptions: { limit: MAX_TOKENS },
    });
    tokens = owned.slice(0, MAX_TOKENS).map((t) => ({
      symbol: t.symbol,
      name: t.name,
      display: displayAmount(t.value, t.decimals),
      usd: null,
    }));
  } catch {
    degraded = true;
  }

  return {
    address,
    chain_id: chainId,
    native,
    tokens,
    degraded,
    updated_at: new Date().toISOString(),
  };
}

export async function readWalletActivity(
  address: string
): Promise<{ transactions: ProjectedTransaction[]; degraded: boolean }> {
  const client = serverClient();
  const chainId = env.walletChainId();
  try {
    const transactions = await Insight.getTransactions({
      client,
      walletAddress: address,
      chains: [defineChain(chainId)],
      queryOptions: { limit: MAX_ACTIVITY },
    });
    return {
      transactions: transactions
        .slice(0, MAX_ACTIVITY)
        .map((tx) => projectTransaction(address, chainId, tx)),
      degraded: false,
    };
  } catch {
    return { transactions: [], degraded: true };
  }
}
