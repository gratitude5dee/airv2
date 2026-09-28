/**
 * "Needs you" queue reads: pending decisions, or the resolved history — the
 * last 30 days of receipts (V8, C22) so an approval or dismissal is always
 * findable after the fact.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export async function listDecisions(
  supabase: SupabaseClient,
  userId: string,
  status: "pending" | "resolved",
): Promise<unknown[]> {
  if (status === "resolved") {
    const since = new Date(
      Date.now() - 30 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const { data } = await supabase
      .from("decisions")
      .select(
        "id, kind, platform, sender, ref, label, status, created_at, resolved_at, payload",
      )
      .eq("user_id", userId)
      .in("status", ["approved", "dismissed"])
      .gte("resolved_at", since)
      .order("resolved_at", { ascending: false })
      .limit(100);
    return data ?? [];
  }
  const { data } = await supabase
    .from("decisions")
    .select(
      "id, kind, platform, sender, ref, label, status, created_at, payload",
    )
    .eq("user_id", userId)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(50);
  return data ?? [];
}
