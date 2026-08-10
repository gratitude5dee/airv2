/**
 * Surface-agnostic request auth: the browser presents the httpOnly session
 * cookie, the desktop app a scoped device bearer token. Both resolve to a
 * user_id and nothing else, so every route downstream is identical across
 * surfaces — which is the point of the third surface.
 */
import type { NextRequest } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import { sessionUserId } from "./user";
import { bearerToken, desktopSession } from "./desktop";

export type Surface = "web" | "desktop";

export interface SurfaceSession {
  userId: string;
  surface: Surface;
}

export async function requestSession(
  supabase: SupabaseClient,
  request: NextRequest
): Promise<SurfaceSession | undefined> {
  const cookieUser = sessionUserId(request);
  if (cookieUser) return { userId: cookieUser, surface: "web" };
  if (!bearerToken(request)) return undefined;
  const device = await desktopSession(supabase, request);
  return device ? { userId: device.userId, surface: "desktop" } : undefined;
}
