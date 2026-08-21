/** Session-scoped profile: safe columns only, never box secrets (C3). */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { sessionUserId } from "@/lib/auth/user";
import {
  DEFAULT_MODEL_FAMILY,
  isModelFamily,
  isSpeedTier,
  modelLabelForFamily,
  modelLabelForTier,
} from "@/lib/entitlements/models";
import { MODEL_FAMILIES } from "@/lib/settings/account";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<NextResponse> {
  const userId = sessionUserId(request);
  if (!userId) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const [{ data: user }, { data: entitlement }, { data: lines }, { data: addresses }] =
    await Promise.all([
      supabase
        .from("users")
        .select("id, status, username, wallet_address, created_at")
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("entitlements")
        .select("plan, speed_tier, model_family, monthly_cap_usd, spend_mtd_usd")
        .eq("user_id", userId)
        .maybeSingle(),
      supabase
        .from("lines")
        .select("phone, platform")
        .eq("assigned_user_id", userId),
      supabase
        .from("agent_addresses")
        .select("address, is_primary, retired_at")
        .eq("user_id", userId)
        .is("retired_at", null),
    ]);
  if (!user) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  const familyValue = String(entitlement?.model_family ?? "");
  const family = isModelFamily(familyValue) ? familyValue : DEFAULT_MODEL_FAMILY;
  const tierValue = String(entitlement?.speed_tier ?? "");
  const tier = isSpeedTier(tierValue) ? tierValue : "balanced";
  return NextResponse.json({
    user,
    entitlement: entitlement
      ? {
          ...entitlement,
          model_family: family,
          tier_models: {
            fast: modelLabelForTier("fast"),
            balanced: modelLabelForTier("balanced"),
            deep: modelLabelForTier("deep"),
          },
          family_models: Object.fromEntries(
            MODEL_FAMILIES.map((f) => [f, modelLabelForFamily(f, tier)])
          ),
        }
      : entitlement,
    lines: lines ?? [],
    addresses: addresses ?? [],
  });
}
