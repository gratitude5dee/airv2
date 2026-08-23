/**
 * Computer relay (§7.4 adjacent): resolve the user's box desktop stream URL
 * server-side. The stream is WebRTC (moonlight-web) so pixels cannot pass
 * through the control plane — instead the owner's authenticated browser is
 * redirected to a freshly-fetched stream URL. The URL is never stored, never
 * returned in JSON, and only ever handed out behind an owner-authenticated
 * or single-use-token gate (SECURITY-DECISIONS.md "Desktop stream URL").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBox, requestDesktop } from "./client";
import { ensureBoxAwake, prewarmBox } from "../orchestrator/boxes";

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

/**
 * Non-blocking variant for embedded viewers: if the machine is already up,
 * return a fresh stream URL right away; otherwise kick a resume and report
 * "waking" so the caller can render a self-refreshing progress page instead
 * of holding the request open through a multi-minute boot. Only machine
 * liveness gates the stream — Hermes health is irrelevant to pixels.
 */
export async function desktopStreamUrlIfUp(
  supabase: SupabaseClient,
  userId: string,
  options?: { vnc?: boolean }
): Promise<{ status: "up"; url: string } | { status: "waking" }> {
  const { data, error } = await supabase
    .from("boxes")
    .select("provider_box_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`box lookup failed for user ${userId}: ${error.message}`);
  }
  const boxId = (data?.provider_box_id as string | undefined) ?? "";
  if (!boxId) {
    throw new Error(`no box for user ${userId}`);
  }
  const box = await getBox(boxId);
  if (box.state !== "ready" && box.state !== "idle") {
    await prewarmBox(supabase, userId);
    return { status: "waking" };
  }
  const url = await requestDesktop(boxId, options);
  // A just-resumed machine can report ready before the stream endpoint is
  // prepared — treat that as still waking rather than an error.
  if (!url) return { status: "waking" };
  return { status: "up", url };
}
