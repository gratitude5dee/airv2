/**
 * MA10 store_search backing tool (gateway-token auth, same pattern as
 * /api/crm/update). The user's own Hermes searches the store — "find me an
 * app that…" — over exactly the public index the world sees: the same
 * MA7-safe projection as /api/store/index.json, filtered server-side. The
 * response is generic directory data (name, description, URL, gates); it
 * teaches the agent nothing beyond what any web reader of the store learns.
 * The /home App Store search reuses it with the owner's web session — same
 * public projection, second credential path.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { listPublicApps } from "@/lib/miniapps/registry";
import { canonicalDetailUrl, searchIndex } from "@/lib/miniapps/discovery";
import { env } from "@/lib/env";
import { guardResponse, requireBoxOrOwner } from "@/lib/auth/guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_RESULTS = 20;


export async function GET(request: NextRequest): Promise<NextResponse> {
  const supabase = serviceClient();
  const auth = await requireBoxOrOwner(supabase, request).catch(guardResponse);
  if (auth instanceof NextResponse) return auth;
  const q = request.nextUrl.searchParams.get("q") ?? "";
  const apps = await listPublicApps(supabase);
  const results = searchIndex(apps, q).slice(0, MAX_RESULTS);
  const base = env.miniappOrigin().replace(/\/$/, "");
  return NextResponse.json({
    query: q,
    results: results.map((entry) => ({
      ...entry,
      detail_url: canonicalDetailUrl(entry.slug),
      agent_md: `${base}/store/${entry.slug}/agent.md`,
    })),
  });
}
