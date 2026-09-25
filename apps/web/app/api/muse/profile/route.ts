import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getMuseSettings } from "@/lib/muse/settings";
import { touchMuseGrant } from "@/lib/muse/link";
import { serviceClient } from "@/lib/supabase";
import { guardResponse, requireWorker } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  user_id: z.string().uuid(),
  grant_id: z.string().uuid().optional(),
  key_id: z.string().uuid().optional(),
}).refine((value) => Boolean(value.grant_id) !== Boolean(value.key_id), "exactly one credential is required");

/**
 * Worker-only, deliberately small identity projection. Phone numbers, box
 * locations, inbox addresses, credentials, and user content never cross this
 * boundary; the Worker only needs enough state to present an honest status.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireWorker(request, "muse").catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });
  const { user_id: userId, grant_id: grantId, key_id: keyId } = parsed.data;
  const supabase = serviceClient();
  const [{ data: grant }, { data: key }, { data: connection }, { data: user }, { data: box }] = await Promise.all([
    grantId
      ? supabase.from("muse_grants").select("id").eq("id", grantId).eq("user_id", userId).is("revoked_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
    keyId
      ? supabase.from("plugin_tokens").select("id").eq("id", keyId).eq("user_id", userId).eq("tool", "muse").is("revoked_at", null).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("connections").select("status").eq("user_id", userId).eq("provider", "muse").eq("toolkit", "muse").maybeSingle(),
    supabase.from("users").select("username").eq("id", userId).maybeSingle(),
    supabase.from("boxes").select("state").eq("user_id", userId).maybeSingle(),
  ]);
  if ((!grant && !key) || connection?.status !== "active") return NextResponse.json({ error: "grant_revoked" }, { status: 401 });
  if (grantId) await touchMuseGrant(supabase, grantId).catch(() => undefined);
  const settings = await getMuseSettings(supabase, userId);
  const state = String(box?.state ?? "none");
  return NextResponse.json({
    handle_display: typeof user?.username === "string" ? `@${user.username}` : "Air",
    link: "active",
    box: state === "ready" || state === "idle" || state === "provisioning" ? "ready" : state === "none" ? "none" : "stopped",
    updates: { enabled: settings.updates_enabled, daily_cap: settings.daily_cap },
    relay: { last_pull_at: null },
  }, { headers: { "Cache-Control": "no-store" } });
}
