/**
 * CM6 credential custody, operator side. Ad accounts are registered here —
 * ADMIN_API_KEY-authorized, never a user-facing screen — so no product
 * surface ever accepts a raw platform API key. The OpenAI Ads key (scoped to
 * one ad account by issuance) is sealed immediately and only its presence is
 * ever reported back. Meta accounts carry no key: OAuth lives in the box's
 * Meta Ads MCP registration.
 */
import { randomBytes } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";
import { env } from "@/lib/env";
import { sealSecret } from "@/lib/crypto/secretbox";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: string;
    provider?: string;
    account_ref?: string;
    label?: string;
    api_key?: string;
    spend_ceiling_cents?: number;
  };
  if (!body.user_id || !body.account_ref) {
    return NextResponse.json(
      { error: "user_id and account_ref required" },
      { status: 400 }
    );
  }
  if (body.provider !== "meta" && body.provider !== "openai") {
    return NextResponse.json({ error: "bad provider" }, { status: 400 });
  }
  let sealed: string | null = null;
  if (body.api_key) {
    const vaultKey = env.adsVaultKey();
    if (!vaultKey) {
      return NextResponse.json(
        { error: "ads vault key not configured" },
        { status: 503 }
      );
    }
    sealed = sealSecret(body.api_key, vaultKey);
  }
  if (body.provider === "openai" && !sealed) {
    return NextResponse.json(
      { error: "openai accounts require api_key" },
      { status: 400 }
    );
  }
  const supabase = serviceClient();
  const { data, error } = await supabase
    .from("ad_accounts")
    .upsert(
      {
        user_id: body.user_id,
        provider: body.provider,
        account_ref: body.account_ref,
        label: body.label ?? null,
        api_key_sealed: sealed,
        conversion_token: randomBytes(24).toString("hex"),
        status: "active",
      },
      { onConflict: "user_id,provider,account_ref" }
    )
    .select("id, conversion_token")
    .single();
  if (error || !data) {
    return NextResponse.json({ error: "account upsert failed" }, { status: 500 });
  }
  if (
    typeof body.spend_ceiling_cents === "number" &&
    Number.isInteger(body.spend_ceiling_cents) &&
    body.spend_ceiling_cents >= 0
  ) {
    await supabase.from("ad_settings").upsert({
      user_id: body.user_id,
      spend_ceiling_cents: body.spend_ceiling_cents,
      updated_at: new Date().toISOString(),
    });
  }
  return NextResponse.json({
    account_id: data.id,
    conversion_token: data.conversion_token,
  });
}
