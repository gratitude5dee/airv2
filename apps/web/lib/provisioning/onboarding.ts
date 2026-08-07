/**
 * M3 claim + inline wallet onboarding (goal.md M3 steps 4–5).
 *
 * The line is bound to bound_phone from birth (C11): before the account is
 * active, inbound from any other sender routes nowhere. The first inbound
 * from bound_phone claims the account, then the thirdweb SMS OTP runs inline
 * in that same conversation — a possession proof we perform ourselves, even
 * though the operator vouched and Photon named the sender.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { completeSmsAuth, initiateSmsAuth } from "../thirdweb/client";

export type OnboardingAction =
  | { kind: "ignore" }
  | { kind: "reply"; text: string }
  | { kind: "continue" };

interface ProvisioningRow {
  state: string;
  bound_phone: string;
  otp_attempts: number;
}

const MAX_OTP_ATTEMPTS = 5;
const CODE_PATTERN = /\b(\d{6})\b/;

function normalizePhone(value: string): string {
  return value.replace(/[^+\d]/g, "");
}

export async function handleOnboarding(
  supabase: SupabaseClient,
  userId: string,
  senderId: string | undefined,
  body: string
): Promise<OnboardingAction> {
  const { data } = await supabase
    .from("provisioning")
    .select("state, bound_phone, otp_attempts")
    .eq("user_id", userId)
    .maybeSingle();
  const row = data as ProvisioningRow | null;
  if (!row || row.state === "active") return { kind: "continue" };
  if (row.state === "abandoned") return { kind: "ignore" };

  const sender = normalizePhone(senderId ?? "");
  const bound = normalizePhone(row.bound_phone);
  if (!sender || sender !== bound) {
    // Pre-active, wrong sender: tier 2, routes nowhere (M3 acceptance).
    return { kind: "ignore" };
  }

  if (row.state !== "claimed") {
    // First inbound from bound_phone claims the account.
    await supabase
      .from("provisioning")
      .update({
        state: "claimed",
        claimed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", userId);
    try {
      await initiateSmsAuth(row.bound_phone);
      return {
        kind: "reply",
        text: "Hey! I'm your agent. To secure your account I just sent a 6-digit code to this number by SMS — reply with it here.",
      };
    } catch (error) {
      console.error(
        JSON.stringify({
          msg: "thirdweb initiate failed",
          user_id: userId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
      // Wallet setup unavailable: activate without it so the agent works;
      // the wallet can be attached later from settings.
      await activate(supabase, userId, row.bound_phone, null);
      return {
        kind: "reply",
        text: "Hey! I'm your agent — you're all set. Text me anything.",
      };
    }
  }

  // state === 'claimed': expect the OTP code.
  const match = CODE_PATTERN.exec(body);
  if (!match?.[1]) {
    return {
      kind: "reply",
      text: "Reply with the 6-digit code I texted you to finish setup.",
    };
  }
  try {
    const auth = await completeSmsAuth(row.bound_phone, match[1]);
    await activate(supabase, userId, row.bound_phone, auth.walletAddress);
    return {
      kind: "reply",
      text: "Verified — your account is secured. Text me anything, any time.",
    };
  } catch {
    const attempts = row.otp_attempts + 1;
    if (attempts >= MAX_OTP_ATTEMPTS) {
      await supabase
        .from("provisioning")
        .update({
          state: "abandoned",
          otp_attempts: attempts,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId);
      return {
        kind: "reply",
        text: "Too many incorrect codes — ask the person who set you up to re-send an invite.",
      };
    }
    await supabase
      .from("provisioning")
      .update({ otp_attempts: attempts, updated_at: new Date().toISOString() })
      .eq("user_id", userId);
    return {
      kind: "reply",
      text: "That code didn't match — check the SMS and reply with the 6 digits.",
    };
  }
}

async function activate(
  supabase: SupabaseClient,
  userId: string,
  boundPhone: string,
  walletAddress: string | null
): Promise<void> {
  const now = new Date().toISOString();
  await supabase
    .from("provisioning")
    .update({ state: "active", updated_at: now })
    .eq("user_id", userId);
  await supabase
    .from("users")
    .update({
      status: "active",
      ...(walletAddress ? { wallet_address: walletAddress } : {}),
    })
    .eq("id", userId);
  await supabase
    .from("handles")
    .update({ verified_at: now })
    .eq("user_id", userId)
    .eq("platform", "imessage")
    .eq("address", boundPhone);
}
