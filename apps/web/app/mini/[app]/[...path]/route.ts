/**
 * MA3 bundle assets: /<slug>/<path> on the mini origin serves the published
 * bundle's static files (script-src/style-src 'self' in the publisher CSP
 * resolve here). Requires the same path-scoped session cookie as the app
 * view — the cookie's path /<slug> covers every asset under it — and the
 * same visibility gate: a suspended publisher's bundle prefix is inert
 * within one request.
 */
import { NextRequest, NextResponse } from "next/server";
import { serviceClient } from "@/lib/supabase";
import { getRegistryApp } from "@/lib/miniapps/registry";
import { sessionFromCookie, visibilityGate } from "@/lib/miniapps/gates";
import {
  publishedModule,
  serveBundleAsset,
} from "@/lib/miniapps/apps/published";
import { bundleContentType } from "@/lib/miniapps/bundles";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ app: string; path: string[] }> }
): Promise<NextResponse> {
  const { app: slug, path } = await context.params;
  const supabase = serviceClient();
  const app = await getRegistryApp(supabase, slug);
  if (!app || !publishedModule(app)) {
    return new NextResponse("not found", { status: 404 });
  }
  const blocked = visibilityGate(app);
  if (blocked) return blocked;
  if (!sessionFromCookie(request, slug)) {
    return new NextResponse("forbidden", { status: 403 });
  }
  const assetPath = path.join("/");
  if (assetPath.includes("..") || assetPath.startsWith("/")) {
    return new NextResponse("not found", { status: 404 });
  }
  const contentType = bundleContentType(assetPath);
  if (!contentType) return new NextResponse("not found", { status: 404 });
  return serveBundleAsset(app, assetPath, contentType);
}
