/**
 * Box Bearer auth: `Authorization: Bearer <boxes.gateway_token>` — the same
 * credential the box injects into every outbound control-plane call from
 * its skills and CLIs. Resolves to the box's owner + provider id; null on
 * any failure (callers decide whether an anonymous caller is acceptable).
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export interface CallingBox {
  readonly userId: string;
  /** The provider's box id (what `command`/`writeFile` take). */
  readonly boxId: string;
}

export async function callingBox(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<CallingBox | null> {
  const authHeader = request.headers.get("authorization") ?? "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return null;
  const { data: box } = await supabase
    .from("boxes")
    .select("user_id, provider_box_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (!box) return null;
  return {
    userId: box.user_id as string,
    boxId: box.provider_box_id as string,
  };
}
