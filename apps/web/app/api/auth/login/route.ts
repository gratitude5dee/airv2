/**
 * Web sign-in (M6): thirdweb SMS OTP, server-side. Step 1 posts { phone } to
 * send the code; step 2 posts { phone, code } to verify. On success the
 * wallet's phone is matched against verified imessage handles (or a stored
 * wallet) to find the user, and an httpOnly session cookie is set.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  ThirdwebApiError,
  completeSmsAuth,
  initiateSmsAuth,
} from "@/lib/thirdweb/client";
import {
  SESSION_COOKIE,
  createSessionToken,
  createSignupToken,
} from "@/lib/auth/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Accept "5104154787", "1 510 415 4787", or full E.164; default to +1. */
function normalizePhone(value: string): string {
  const digits = value.replace(/[^+\d]/g, "");
  if (digits.startsWith("+")) return digits;
  if (/^\d{10}$/.test(digits)) return `+1${digits}`;
  if (/^1\d{10}$/.test(digits)) return `+${digits}`;
  return digits ? `+${digits}` : "";
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const body = (await request.json().catch(() => ({}))) as {
    phone?: string;
    code?: string;
  };
  const phone = normalizePhone(body.phone ?? "");
  if (!/^\+\d{7,15}$/.test(phone)) {
    return NextResponse.json({ error: "invalid phone" }, { status: 400 });
  }

  if (!body.code) {
    try {
      await initiateSmsAuth(phone);
    } catch (error) {
      const status =
        error instanceof ThirdwebApiError && error.status === 429 ? 429 : 502;
      return NextResponse.json(
        {
          error:
            status === 429
              ? "too many codes requested — wait a few minutes"
              : "could not send code",
        },
        { status }
      );
    }
    return NextResponse.json({ ok: true, sent: true });
  }

  let walletAddress: string;
  try {
    const auth = await completeSmsAuth(phone, body.code);
    walletAddress = auth.walletAddress;
  } catch {
    return NextResponse.json({ error: "invalid code" }, { status: 401 });
  }

  const supabase = serviceClient();
  const { data: byWallet } = await supabase
    .from("users")
    .select("id")
    .eq("wallet_address", walletAddress)
    .maybeSingle();
  let userId = byWallet?.id as string | undefined;
  if (!userId) {
    const { data: handle } = await supabase
      .from("handles")
      .select("user_id")
      .eq("platform", "imessage")
      .eq("address", phone)
      .maybeSingle();
    userId = handle?.user_id as string | undefined;
    if (userId) {
      // First web sign-in for a phone-provisioned account: attach the wallet.
      await supabase
        .from("users")
        .update({ wallet_address: walletAddress })
        .eq("id", userId)
        .is("wallet_address", null);
    }
  }
  if (!userId) {
    // Phone ownership is proven but no account exists: hand back a
    // short-lived signup grant so /api/auth/signup can self-provision.
    return NextResponse.json(
      {
        error: "no account",
        signup_token: createSignupToken(phone, walletAddress),
      },
      { status: 404 }
    );
  }

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
