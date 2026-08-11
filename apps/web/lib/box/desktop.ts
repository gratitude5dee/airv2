/**
 * Computer relay (§7.4 adjacent): resolve the user's box desktop stream URL
 * server-side. The stream is WebRTC (moonlight-web) so pixels cannot pass
 * through the control plane — instead the owner's authenticated browser is
 * redirected to a freshly-fetched stream URL. The URL is never stored, never
 * returned in JSON, and only ever handed out behind an owner-authenticated
 * or single-use-token gate (SECURITY-DECISIONS.md "Desktop stream URL").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { requestDesktop } from "./client";
import { ensureBoxAwake } from "../orchestrator/boxes";

export class DesktopUnavailableError extends Error {
  constructor() {
    super("desktop stream unavailable");
    this.name = "DesktopUnavailableError";
  }
}

/**
 * Wake the user's own box (never fork a new one) and request a fresh
 * desktop stream URL via POST /boxes/{id}/desktop. Fetched fresh per view —
 * never persisted — because the token component rotates with the box
 * lifecycle. `vnc` requests the HTTPS-tunneled noVNC viewer for restrictive
 * networks; it must open as a top-level page, not embedded.
 */
export async function desktopStreamUrl(
  supabase: SupabaseClient,
  userId: string,
  options?: { vnc?: boolean }
): Promise<string> {
  const userBox = await ensureBoxAwake(supabase, userId);
  const url = await requestDesktop(userBox.boxId, options);
  if (!url) {
    throw new DesktopUnavailableError();
  }
  return url;
}
