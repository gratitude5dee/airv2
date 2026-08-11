/**
 * Computer relay (§7.4 adjacent): resolve the user's box desktop stream URL
 * server-side. The stream is WebRTC (moonlight-web) so pixels cannot pass
 * through the control plane — instead the owner's authenticated browser is
 * redirected to a freshly-fetched stream URL. The URL is never stored, never
 * returned in JSON, and only ever handed out behind an owner-authenticated
 * or single-use-token gate (SECURITY-DECISIONS.md "Desktop stream URL").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBox } from "./client";
import { ensureBoxAwake } from "../orchestrator/boxes";

export class DesktopUnavailableError extends Error {
  constructor() {
    super("desktop stream unavailable");
    this.name = "DesktopUnavailableError";
  }
}

/**
 * Wake the user's own box (never fork a new one) and fetch the current
 * desktop stream URL. Fetched fresh per view — never persisted — because
 * the token component rotates with the box lifecycle.
 */
export async function desktopStreamUrl(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const userBox = await ensureBoxAwake(supabase, userId);
  const box = await getBox(userBox.boxId);
  if (!box.desktopAvailable || !box.desktopUrl) {
    throw new DesktopUnavailableError();
  }
  return box.desktopUrl;
}
