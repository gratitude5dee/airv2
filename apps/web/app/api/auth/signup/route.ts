/**
 * Self-serve sign-up (M6). Redeems the short-lived signup grant minted by
 * /api/auth/login after a successful OTP for a phone with no account:
 * provisions the user's box, activates the account with the verified wallet
 * and phone, and sets the session cookie. The grant — not this route — is
 * the proof of phone ownership.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  SESSION_COOKIE,
  createSessionToken,
  verifySignupToken,
} from "@/lib/auth/session";
import { provisionUser } from "@/lib/provisioning/provision";

export const maxDuration = 800;

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    signup_token?: string;
  };
  const grant = body.signup_token
    ? verifySignupToken(body.signup_token)
    : undefined;
  if (!grant) {
    return NextResponse.json(
      { error: "invalid or expired signup link — sign in again" },
      { status: 403 }
    );
  }

  const supabase = serviceClient();

  // Re-check both identities: the grant may be replayed after an account
  // exists (double click, retry) — resolve to that account instead.
  const [{ data: byWallet }, { data: byHandle }] = await Promise.all([
    supabase
      .from("users")
      .select("id")
      .eq("wallet_address", grant.walletAddress)
      .maybeSingle(),
    supabase
      .from("handles")
      .select("user_id")
      .eq("platform", "imessage")
      .eq("address", grant.phone)
      .maybeSingle(),
  ]);
  let userId =
    (byWallet?.id as string | undefined) ??
    (byHandle?.user_id as string | undefined);

  if (!userId) {
    const result = await provisionUser({ boundPhone: grant.phone });
    userId = result.userId;
    console.log(
      JSON.stringify({ msg: "self-serve signup provisioned", user_id: userId })
    );
  }

  // OTP verified: the account is claimed by its owner from birth.
  await supabase
    .from("users")
    .update({ status: "active", wallet_address: grant.walletAddress })
    .eq("id", userId)
    .is("wallet_address", null);
  await supabase
    .from("provisioning")
    .update({ state: "claimed", updated_at: new Date().toISOString() })
    .eq("user_id", userId);

  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, createSessionToken(userId), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
