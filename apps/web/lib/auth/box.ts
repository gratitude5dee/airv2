/**
 * Box-facing authentication: a box carries its own gateway token, not the
 * owner's session cookie, so a control-plane route the box has to reach
 * resolves the owner through the `boxes` row that token belongs to.
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";

export function bearerToken(request: NextRequest): string {
  const header = request.headers.get("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : "";
}

export async function boxUserId(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<string | undefined> {
  const token = bearerToken(request);
  if (!token) return undefined;
  const { data: box, error } = await supabase
    .from("boxes")
    .select("user_id")
    .eq("gateway_token", token)
    .maybeSingle();
  if (error) throw new Error(`box lookup failed: ${error.message}`);
  return box ? (box.user_id as string) : undefined;
}
