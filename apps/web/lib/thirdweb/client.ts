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
