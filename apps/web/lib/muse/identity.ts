import type { SupabaseClient } from "@supabase/supabase-js";
import { randomBytes } from "node:crypto";
import { completeSmsAuth, initiateSmsAuth } from "../thirdweb/client";
import { normalizeAddress } from "../routing/trust";
import { provisionUser } from "../provisioning/provision";
import {
  createOrUpdateSpectrumSharedUser,
  SpectrumUserProvisionError,
} from "../spectrum/users";

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
 * receives a complete Air project after the SMS proof: its own number from
 * this Air project's Photon/Spectrum shared pool, a Box, and WZRDMail. We
 * create an idempotent user inside the existing Photon project; we never
 * create a Photon project or purchase a Business/dedicated line at sign-up.
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
    const linePhone = await ensureExistingMuseLine(supabase, existingUserId, canonicalPhone);
    return {
      userId: existingUserId,
      phone: canonicalPhone,
      provisioned: false,
      inviteUrl: inviteUrl(linePhone),
    };
  }

  const preparedLine = await prepareMuseLine(supabase, canonicalPhone);
  if (preparedLine.assignedUserId !== null) {
    throw new MuseIdentityError("provisioning_failed", 503);
  }
  const linePhone = preparedLine.phone;
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
    inviteUrl: created.inviteLink ?? inviteUrl(linePhone),
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
 * Create (or idempotently recover) one Spectrum shared-project user, then
 * mirror that user's distinct assigned number into Air. The shared pool is a
 * delivery mode, not a shared owner number: every user gets their own line.
 */
async function prepareMuseLine(
  supabase: SupabaseClient,
  ownerPhone: string,
): Promise<{ phone: string; assignedUserId: string | null }> {
  let spectrumUser;
  try {
    spectrumUser = await createOrUpdateSpectrumSharedUser(ownerPhone);
  } catch (error) {
    if (error instanceof SpectrumUserProvisionError && error.kind === "capacity") {
      throw new MuseIdentityError("no_line_available", 409, error);
    }
    throw new MuseIdentityError("provisioning_failed", 503, error);
  }

  const { error: insertError } = await supabase.from("lines").upsert(
    {
      platform: "imessage",
      phone: spectrumUser.assignedPhoneNumber,
      role: "personal",
      mode: "shared",
      provider_ref: spectrumUser.id,
    },
    { onConflict: "phone", ignoreDuplicates: true },
  );
  if (insertError) {
    throw new MuseIdentityError("provisioning_failed", 503, insertError);
  }

  const { data: line, error: lineError } = await supabase
    .from("lines")
    .select("phone, platform, role, mode, provider_ref, assigned_user_id")
    .eq("phone", spectrumUser.assignedPhoneNumber)
    .maybeSingle();
  if (lineError || !line) {
    throw new MuseIdentityError("provisioning_failed", 503, lineError);
  }
  if (
    line.platform !== "imessage" ||
    line.role !== "personal" ||
    line.mode !== "shared" ||
    (line.provider_ref !== null && line.provider_ref !== spectrumUser.id)
  ) {
    throw new MuseIdentityError("provisioning_failed", 503);
  }
  if (line.provider_ref === null) {
    const { error: providerRefError } = await supabase
      .from("lines")
      .update({ provider_ref: spectrumUser.id })
      .eq("phone", spectrumUser.assignedPhoneNumber)
      .is("provider_ref", null);
    if (providerRefError) {
      throw new MuseIdentityError("provisioning_failed", 503, providerRefError);
    }
  }
  return {
    phone: spectrumUser.assignedPhoneNumber,
    assignedUserId: typeof line.assigned_user_id === "string" ? line.assigned_user_id : null,
  };
}

async function ensureExistingMuseLine(
  supabase: SupabaseClient,
  userId: string,
  ownerPhone: string,
): Promise<string> {
  const { data: current, error: currentError } = await supabase
    .from("lines")
    .select("phone")
    .eq("assigned_user_id", userId)
    .eq("platform", "imessage")
    .eq("role", "personal")
    .maybeSingle();
  if (currentError) throw new MuseIdentityError("provisioning_failed", 503, currentError);

  let phone = current?.phone as string | undefined;
  if (!phone) {
    const prepared = await prepareMuseLine(supabase, ownerPhone);
    phone = prepared.phone;
    if (prepared.assignedUserId !== null && prepared.assignedUserId !== userId) {
      throw new MuseIdentityError("provisioning_failed", 503);
    }
    if (prepared.assignedUserId === null) {
      const { data: claimed, error: claimError } = await supabase
        .from("lines")
        .update({
          assigned_user_id: userId,
          assigned_at: new Date().toISOString(),
          role: "personal",
        })
        .eq("phone", phone)
        .is("assigned_user_id", null)
        .select("id");
      if (claimError) throw new MuseIdentityError("provisioning_failed", 503, claimError);
      if (!claimed || claimed.length === 0) {
        const { data: raced } = await supabase
          .from("lines")
          .select("assigned_user_id")
          .eq("phone", phone)
          .maybeSingle();
        if (raced?.assigned_user_id !== userId) {
          throw new MuseIdentityError("provisioning_failed", 503);
        }
      }
    }
  }

  const { error: entitlementError } = await supabase
    .from("entitlements")
    .update({ phone_entitled: true })
    .eq("user_id", userId);
  if (entitlementError) {
    throw new MuseIdentityError("provisioning_failed", 503, entitlementError);
  }
  return phone;
}

function inviteUrl(linePhone: string): string {
  const body = encodeURIComponent("Hi! Send this to get started.");
  return `sms:${linePhone}&body=${body}`;
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
