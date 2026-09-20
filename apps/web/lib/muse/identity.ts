import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { completeSmsAuth, initiateSmsAuth } from "../thirdweb/client";
import { normalizeAddress } from "../routing/trust";
import { provisionUser } from "../provisioning/provision";

/** Same US-default normalization as the ordinary phone login endpoint. */
export function normalizeMusePhone(value: string): string {
  const digits = value.replace(/[^+\d]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export function isSupportedMusePhone(phone: string): boolean {
  // The Air iMessage line is currently a US-only product. Reject a country
  // number before asking thirdweb to send an SMS the user cannot use here.
  return /^\+1\d{10}$/.test(phone);
}

export async function startMuseOtp(phoneInput: string): Promise<string> {
  const phone = normalizeMusePhone(phoneInput);
  if (!isSupportedMusePhone(phone)) throw new MuseIdentityError("invalid_phone", 400);
  await initiateSmsAuth(phone);
  return phone;
}

export interface MuseIdentity {
  userId: string;
  phone: string;
  provisioned: boolean;
  inviteUrl: string | null;
}

/**
 * A successful OTP is the only identity assertion accepted by the connector.
 * Existing Air owners resolve exactly as ordinary web login does. A new owner
 * receives a complete Air project after the SMS proof: a line allocated from
 * this Air project's Photon/Spectrum inventory, a Box, and WZRDMail. We never
 * create a Photon project or buy a line during sign-up; inventory must already
 * have been provisioned to the Air project by the operator.
 */
export async function completeMuseOtp(
  supabase: SupabaseClient,
  phoneInput: string,
  code: string,
): Promise<MuseIdentity> {
  const phone = normalizeMusePhone(phoneInput);
  if (!isSupportedMusePhone(phone)) throw new MuseIdentityError("invalid_phone", 400);
  if (!/^\d{6}$/.test(code)) throw new MuseIdentityError("invalid_code", 401);

  let walletAddress: string;
  try {
    ({ walletAddress } = await completeSmsAuth(phone, code));
  } catch {
    throw new MuseIdentityError("invalid_code", 401);
  }

  const canonicalPhone = normalizeAddress("imessage", phone);
  const [{ data: byWallet }, { data: byHandle }] = await Promise.all([
    supabase.from("users").select("id").eq("wallet_address", walletAddress).maybeSingle(),
    supabase
      .from("handles")
      .select("user_id")
      .eq("platform", "imessage")
      .eq("address", canonicalPhone)
      .maybeSingle(),
  ]);
  const existingUserId = (byWallet?.id as string | undefined) ?? (byHandle?.user_id as string | undefined);
  if (existingUserId) {
    await attachVerifiedWallet(supabase, existingUserId, canonicalPhone, walletAddress);
    return { userId: existingUserId, phone: canonicalPhone, provisioned: false, inviteUrl: null };
  }

  const linePhone = await reserveMuseLine(supabase);
  let created;
  try {
    created = await provisionUser({
      boundPhone: canonicalPhone,
      linePhone,
      operator: "muse",
      // A phone-first account must have a mailbox before it is shown in the
      // connector. This opaque starter handle is editable in Air later and
      // contains no phone digits or thirdweb identity.
      username: `muse_${randomBytes(6).toString("hex")}`,
    });
  } catch (error) {
    // provisionUser rolls back its user + line claim if Box or WZRDMail setup
    // fails, so a retry cannot leave a half-owned Air line behind.
    throw new MuseIdentityError("provisioning_failed", 503, error);
  }
  const userId = created.userId;
  await attachVerifiedWallet(supabase, userId, canonicalPhone, walletAddress);
  return {
    userId,
    phone: canonicalPhone,
    provisioned: true,
    inviteUrl: created.inviteLink ?? `sms:${linePhone}`,
  };
}

async function attachVerifiedWallet(
  supabase: SupabaseClient,
  userId: string,
  phone: string,
  walletAddress: string,
): Promise<void> {
  // OTP is a completed possession proof. The account is immediately usable
  // from the standard Air sign-in flow on later visits as well as this OAuth
  // flow; no second, Muse-specific identity credential exists.
  await Promise.all([
    supabase
      .from("users")
      .update({ wallet_address: walletAddress, status: "active" })
      .eq("id", userId)
      .is("wallet_address", null),
    supabase
      .from("handles")
      .update({ verified_at: new Date().toISOString() })
      .eq("user_id", userId)
      .eq("platform", "imessage")
      .eq("address", phone)
      .is("verified_at", null),
    supabase
      .from("provisioning")
      .update({ state: "active", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .neq("state", "abandoned"),
  ]);
}

/**
 * Lines are provisioned under the existing Air Photon project out-of-band and
 * mirrored here by the operator. Reserving one before provisionUser lets its
 * conditional claim be the race-safe allocation check without ever invoking
 * a paid Photon upgrade from a user signup.
 */
async function reserveMuseLine(
  supabase: SupabaseClient,
): Promise<string> {
  const { data: candidate } = await supabase
    .from("lines")
    .select("phone")
    .eq("platform", "imessage")
    .eq("role", "personal")
    // A pooled Spectrum route reports "shared", which cannot truthfully be
    // shown as this owner's Air number. Phone-first Muse signup therefore
    // waits for inventory that was explicitly created as a dedicated project
    // line; it never silently degrades the identity claim.
    .eq("mode", "dedicated")
    .is("assigned_user_id", null)
    .order("phone", { ascending: true })
    .limit(1)
    .maybeSingle();
  const phone = candidate?.phone as string | undefined;
  if (!phone) throw new MuseIdentityError("no_line_available", 409);
  return phone;
}

export class MuseIdentityError extends Error {
  constructor(
    readonly code: "invalid_phone" | "invalid_code" | "no_line_available" | "provisioning_failed",
    readonly status: number,
    override readonly cause?: unknown,
  ) {
    super(code);
  }
}
