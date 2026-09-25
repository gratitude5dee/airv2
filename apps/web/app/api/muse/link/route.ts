import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { museEnabled } from "@/lib/muse/auth";
import { listMuseKeys } from "@/lib/muse/keys";
import { listMuseLink, revokeMuseLink } from "@/lib/muse/link";
import { getMuseSettings } from "@/lib/muse/settings";
import { callMuseWorker } from "@/lib/muse/worker";
import { writeConnectedToolsFile } from "@/lib/provisioning/connectors";
import { guardResponse, requireOwner } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function owner(request: NextRequest): Promise<string | NextResponse> {
  const principal = await requireOwner(request).catch(guardResponse);
  return principal instanceof NextResponse ? principal : principal.userId;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled()) return new NextResponse(null, { status: 404 });
  const userId = await owner(request);
  if (userId instanceof NextResponse) return userId;
  const supabase = serviceClient();
  const [link, keys, settings, events, line] = await Promise.all([
    listMuseLink(supabase, userId),
    listMuseKeys(supabase, userId),
    getMuseSettings(supabase, userId),
    supabase
      .from("muse_events")
      .select("kind, agent, chars, status, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50),
    supabase
      .from("lines")
      .select("phone")
      .eq("assigned_user_id", userId)
      .eq("platform", "imessage")
      .maybeSingle(),
  ]);
  return NextResponse.json({
    ...link,
    keys,
    settings,
    line: typeof line.data?.phone === "string" ? line.data.phone : null,
    activity: events.data ?? [],
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  if (!museEnabled()) return new NextResponse(null, { status: 404 });
  const userId = await owner(request);
  if (userId instanceof NextResponse) return userId;
  const supabase = serviceClient();
  const grants = await revokeMuseLink(supabase, userId);
  // Revocation reaches the Worker before the response when it is configured;
  // a failed call is safe because the database link is already revoked and
  // the Worker is fail-closed whenever MUSE_ENABLED is disabled.
  await Promise.all(
    grants.map((grant) => callMuseWorker("/internal/revoke", { user_id: userId, grant_id: grant.id }).catch(() => null)),
  );
  await callMuseWorker("/internal/purge", { user_id: userId }).catch(() => null);
  await writeConnectedToolsFile(supabase, userId).catch(() => undefined);
  return NextResponse.json({ ok: true });
}
