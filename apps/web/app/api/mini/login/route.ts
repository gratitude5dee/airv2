/**
 * MA0 direct store login on the mini origin: the same thirdweb SMS OTP flow
 * as /api/auth/login, but it sets the mini-origin store cookie — never
 * air_session; the two origins share no session state (MA1). No signup here:
 * accounts are created on the main app.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import {
  ThirdwebApiError,
  completeSmsAuth,
  initiateSmsAuth,
} from "@/lib/thirdweb/client";
import {
  STORE_COOKIE,
  mintStoreSessionToken,
  storeCookieOptions,
} from "@/lib/miniapps/storeSession";

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
  }
  if (!userId) {
    return NextResponse.json(
      { error: "no account — sign up on the main app first" },
      { status: 404 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(
    STORE_COOKIE,
    mintStoreSessionToken(userId),
    storeCookieOptions()
  );
  return response;
}
