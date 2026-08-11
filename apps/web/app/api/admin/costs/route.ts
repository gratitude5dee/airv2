/**
 * CM8 task 6: creative cost dashboard. Per-user render spend (cost_events
 * ledger rows recorded from completed box jobs), storage spend (bytes of
 * content-addressed creative assets at a flat monthly rate), ad spend
 * (platform-reported spend_reports over the window), and each user's ad
 * spend ceiling so the dashboard shows spend against cap in one read.
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Flat object-storage price used for the dashboard estimate. */
const STORAGE_CENTS_PER_GB_MONTH = 2.1;

const WINDOW_DAYS = 30;

interface UserCosts {
  user_id: string;
  render_cents: number;
  storage_bytes: number;
  storage_cents_month: number;
  ad_spend_cents: number;
  ad_ceiling_cents: number | null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const supabase = serviceClient();
  const since = new Date(Date.now() - WINDOW_DAYS * 86_400_000);
  const sinceIso = since.toISOString();
  const sinceDate = sinceIso.slice(0, 10);

  const [renders, assets, spend, settings] = await Promise.all([
    supabase
      .from("cost_events")
      .select("user_id, kind, amount_cents")
      .eq("kind", "render")
      .gte("occurred_at", sinceIso),
    supabase.from("creative_assets").select("user_id, bytes"),
    supabase
      .from("spend_reports")
      .select("user_id, spend_cents")
      .gte("report_date", sinceDate),
    supabase.from("ad_settings").select("user_id, spend_ceiling_cents"),
  ]);

  const users = new Map<string, UserCosts>();
  const forUser = (userId: string): UserCosts => {
    let entry = users.get(userId);
    if (!entry) {
      entry = {
        user_id: userId,
        render_cents: 0,
        storage_bytes: 0,
        storage_cents_month: 0,
        ad_spend_cents: 0,
        ad_ceiling_cents: null,
      };
      users.set(userId, entry);
    }
    return entry;
  };

  for (const row of renders.data ?? []) {
    forUser(row.user_id as string).render_cents += row.amount_cents as number;
  }
  for (const row of assets.data ?? []) {
    forUser(row.user_id as string).storage_bytes += (row.bytes as number) ?? 0;
  }
  for (const row of spend.data ?? []) {
    forUser(row.user_id as string).ad_spend_cents += row.spend_cents as number;
  }
  for (const row of settings.data ?? []) {
    forUser(row.user_id as string).ad_ceiling_cents =
      row.spend_ceiling_cents as number;
  }
  for (const entry of users.values()) {
    entry.storage_cents_month = Math.ceil(
      (entry.storage_bytes / 1_073_741_824) * STORAGE_CENTS_PER_GB_MONTH
    );
  }

  return NextResponse.json({
    window_days: WINDOW_DAYS,
    users: [...users.values()],
  });
}
