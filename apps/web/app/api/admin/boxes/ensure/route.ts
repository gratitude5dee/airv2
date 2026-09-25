/**
 * Operator-only compute ensure for an existing account with no box: the
 * repair path for a failed self-serve build (e.g. provider billing rejected
 * the signup fork). ensureComputeProvisioned is idempotent — it no-ops when
 * a boxes row already exists — so this is safe to retry, and the post-build
 * welcome + onboarding card go out only when a box was actually created.
 * Account rows are never touched here (that's /api/admin/provision).
 */
import { NextRequest, NextResponse } from "next/server";
import { adminAuthorized } from "@/lib/admin/auth";
import { provisionComputeWithWelcome } from "@/lib/provisioning/welcome";
import { serviceClient } from "@/lib/supabase";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Same budget as the signup after() path (inbound route maxDuration 800).
export const maxDuration = 800;

export async function POST(request: NextRequest): Promise<NextResponse> {
  if (!adminAuthorized(request)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json().catch(() => ({}))) as {
    user_id?: unknown;
  };
  const userId = typeof body.user_id === "string" ? body.user_id.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "user_id required" }, { status: 400 });
  }
  const supabase = serviceClient();
  const { data: user, error: userError } = await supabase
    .from("users")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (userError) {
    return NextResponse.json({ error: userError.message }, { status: 502 });
  }
  if (!user) {
    return NextResponse.json({ error: "unknown user_id" }, { status: 404 });
  }
  const result = await provisionComputeWithWelcome(supabase, userId);
  const { data: box } = await supabase
    .from("boxes")
    .select("provider_box_id")
    .eq("user_id", userId)
    .maybeSingle();
  return NextResponse.json({
    ok: true,
    ...result,
    box_id: box?.provider_box_id ?? null,
  });
}
