/**
 * MA10 AEO: per-app agent card at /store/<slug>/agent.md — a plain-markdown
 * description of what the app does, its URL, its gates, how an agent opens
 * it, and the Apps API actions its manifest declares. 404 for anything that
 * is not public + published (MA7).
 */
import { NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { getRegistryApp } from "@/lib/miniapps/registry";
import { agentMd, discoverable, etagFor } from "@/lib/miniapps/discovery";
import { bundleManifest } from "@/lib/miniapps/appsApi";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
): Promise<NextResponse> {
  const { slug } = await params;
  const app = await getRegistryApp(serviceClient(), slug);
  if (!app || !discoverable(app)) {
    return new NextResponse("not found", { status: 404 });
  }
  let actions: string[] = [];
  if (app.owner_user_id && app.bundle_version) {
    try {
      actions = (await bundleManifest(app)).actions;
    } catch {
      actions = [];
    }
  }
  const body = agentMd(app, actions);
  const etag = etagFor(body);
  const headers = {
    "Content-Type": "text/markdown; charset=utf-8",
    "Cache-Control": "public, max-age=300, s-maxage=600",
    ETag: etag,
  };
  if (request.headers.get("if-none-match") === etag) {
    return new NextResponse(null, { status: 304, headers });
  }
  return new NextResponse(body, { status: 200, headers });
}
