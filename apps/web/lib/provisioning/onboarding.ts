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
import { normalizeAddress } from "../routing/trust";
import { completeSmsAuth, initiateSmsAuth } from "../thirdweb/client";

export type OnboardingAction =
  | { kind: "ignore" }
  | {
      kind: "reply";
      text: string;
      /**
       * Set when this reply activated a self-serve account that has no
       * compute yet — the caller provisions the box after the response
       * (the build outlives any request budget).
       */
      startCompute?: boolean;
    }
  | { kind: "continue" };

/**
 * Self-serve signup on the public onboarding line (platform.md §user
 * lifecycle): an unknown sender gets a pending account bound to their own
 * handle, then runs the same claim → OTP → activate flow an invited user
 * does — the texter *is* the owner, so there is no claim code to steal and
 * the OTP is the possession proof. Idempotent: a redelivered first message
 * or a burst racing itself resolves the handle created moments earlier.
 */
export async function signupSender(
  supabase: SupabaseClient,
  senderId: string
): Promise<string> {
  const address = normalizeAddress("imessage", senderId);
  const { data: existing } = await supabase
    .from("handles")
    .select("user_id")
    .eq("platform", "imessage")
    .eq("address", address)
    .maybeSingle();
  if (existing?.user_id) return existing.user_id as string;

  const { data: user, error: userError } = await supabase
    .from("users")
    .insert({ status: "pending" })
    .select("id")
    .single();
  if (userError || !user) {
    throw new Error(`users insert failed: ${userError?.message}`);
  }
  const userId = user.id as string;

  const { error: entitlementError } = await supabase
    .from("entitlements")
    .insert({ user_id: userId });
  if (entitlementError) {
    throw new Error(`entitlements insert failed: ${entitlementError.message}`);
  }
  const { error: provisioningError } = await supabase
    .from("provisioning")
    .insert({
      user_id: userId,
      state: "created",
      bound_phone: address,
      operator: "self-serve",
    });
  if (provisioningError) {
    throw new Error(`provisioning insert failed: ${provisioningError.message}`);
  }

  const { error: handleError } = await supabase.from("handles").insert({
    user_id: userId,
    platform: "imessage",
    address,
  });
  if (handleError) {
    if (handleError.code === "23505") {
      // A concurrent webhook won the race — return the existing account.
      const { data: won } = await supabase
        .from("handles")
        .select("user_id")
        .eq("platform", "imessage")
        .eq("address", address)
        .maybeSingle();
      if (won?.user_id) return won.user_id as string;
    }
    throw new Error(`handles insert failed: ${handleError.message}`);
  }
  const { error: senderError } = await supabase.from("senders").insert({
    user_id: userId,
    platform: "imessage",
    address,
    trust_tier: 0,
  });
  if (senderError && senderError.code !== "23505") {
    throw new Error(`senders insert failed: ${senderError.message}`);
  }
  return userId;
}

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
      const activated = await activate(supabase, userId, row.bound_phone, null);
      const startCompute = activated && !(await hasCompute(supabase, userId));
      return {
        kind: "reply",
        text: startCompute
          ? "Hey! I'm your agent — I'm setting up your computer now, give me a minute and then text me anything."
          : "Hey! I'm your agent — you're all set. Text me anything.",
        ...(startCompute ? { startCompute: true } : {}),
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
    const activated = await activate(
      supabase,
      userId,
      row.bound_phone,
      auth.walletAddress
    );
    const startCompute = activated && !(await hasCompute(supabase, userId));
    return {
      kind: "reply",
      text: startCompute
        ? "Verified — I'm setting up your computer now, give me a minute and then text me anything."
        : "Verified — your account is secured. Text me anything, any time.",
      ...(startCompute ? { startCompute: true } : {}),
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

async function hasCompute(
  supabase: SupabaseClient,
  userId: string
): Promise<boolean> {
  const { data } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return data !== null;
}

/**
 * The claimed→active transition, claimed atomically: only the first call
 * resolves true, so a replayed OTP can't kick a second box build.
 */
async function activate(
  supabase: SupabaseClient,
  userId: string,
  boundPhone: string,
  walletAddress: string | null
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data: transitioned } = await supabase
    .from("provisioning")
    .update({ state: "active", updated_at: now })
    .eq("user_id", userId)
    .neq("state", "active")
    .select("user_id");
  if (!transitioned || transitioned.length === 0) return false;
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
  return true;
}
