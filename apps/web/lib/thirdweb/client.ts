/**
 * thirdweb server-side phone auth (goal.md M3 step 5). The OTP is a
 * possession proof we perform ourselves; the wallet is created by thirdweb
 * on completion and no key material ever enters the box (C2-adjacent).
 */
import { env } from "../env";

const THIRDWEB_API = "https://api.thirdweb.com";

export class ThirdwebApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ThirdwebApiError";
    this.status = status;
  }
}

async function thirdwebFetch<T>(path: string, body: object): Promise<T> {
  const response = await fetch(`${THIRDWEB_API}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-secret-key": env.thirdwebSecretKey(),
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new ThirdwebApiError(response.status, text.slice(0, 500));
  }
  return (await response.json()) as T;
}

interface SendTokensResponse {
  result?: { transactionIds?: string[] };
}

/**
 * Token send from a server-managed wallet (V8 wallet tab). Executed
 * with the secret key only after the run_approval decision is approved —
 * this function is never reachable straight from a composer. A null
 * tokenAddress sends the chain's native token; an ERC-20 contract address
 * sends that token. Quantity is in the asset's smallest unit.
 */
export async function sendWalletTokens(
  from: string,
  chainId: number,
  to: string,
  quantityAtomic: string,
  tokenAddress: string | null
): Promise<string[]> {
  const data = await thirdwebFetch<SendTokensResponse>("/v1/wallets/send", {
    from,
    chainId,
    recipients: [{ address: to, quantity: quantityAtomic }],
    ...(tokenAddress ? { tokenAddress } : {}),
  });
  const ids = data.result?.transactionIds;
  if (!ids || ids.length === 0) {
    throw new ThirdwebApiError(500, "send response missing transaction ids");
  }
  return ids;
}

export async function initiateSmsAuth(phone: string): Promise<void> {
  await thirdwebFetch("/v1/auth/initiate", { method: "sms", phone });
}

export interface SmsAuthResult {
  walletAddress: string;
  isNewUser: boolean;
  token: string;
}

interface CompleteAuthResponse {
  result?: {
    walletAddress?: string;
    isNewUser?: boolean;
    token?: string;
  };
  walletAddress?: string;
  isNewUser?: boolean;
  token?: string;
}

export async function completeSmsAuth(
  phone: string,
  code: string
): Promise<SmsAuthResult> {
  const data = await thirdwebFetch<CompleteAuthResponse>("/v1/auth/complete", {
    method: "sms",
    phone,
    code,
  });
  const result = data.result ?? data;
  if (!result.walletAddress || !result.token) {
    throw new ThirdwebApiError(500, "auth complete response missing wallet");
  }
  return {
    walletAddress: result.walletAddress,
    isNewUser: result.isNewUser ?? false,
    token: result.token,
  };
}
