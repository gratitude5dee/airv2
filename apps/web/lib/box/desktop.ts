/**
 * Computer relay (§7.4 adjacent): resolve the user's box desktop stream URL
 * server-side. The stream is WebRTC (moonlight-web) so pixels cannot pass
 * through the control plane — instead the owner's authenticated browser is
 * redirected to a freshly-fetched stream URL. The URL is never stored, never
 * returned in JSON, and only ever handed out behind an owner-authenticated
 * or single-use-token gate (SECURITY-DECISIONS.md "Desktop stream URL").
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getBox, isStartLimit, requestDesktop, resume } from "./client";
import { BoxApiError } from "./types";
import { ensureBoxAwake, StartLimitError } from "../orchestrator/boxes";

/** The mini-app retries on a short cadence; never block one browser request. */
const DESKTOP_PROBE_TIMEOUT_MS = 5_000;
const pendingDesktopRequests = new Map<string, Promise<string | undefined>>();
const pendingResumes = new Map<string, Promise<unknown>>();

function singleFlight<T>(
  map: Map<string, Promise<T>>,
  key: string,
  run: () => Promise<T>
): Promise<T> {
  const existing = map.get(key);
  if (existing) return existing;
  const pending = run();
  map.set(key, pending);
  void pending.then(
    () => {
      if (map.get(key) === pending) map.delete(key);
    },
    () => {
      if (map.get(key) === pending) map.delete(key);
    }
  );
  return pending;
}

function requestDesktopOnce(boxId: string, vnc = false): Promise<string | undefined> {
  return singleFlight(pendingDesktopRequests, `${boxId}:${vnc ? "vnc" : "webrtc"}`, () =>
    requestDesktop(
      boxId,
      vnc
        ? { vnc: true, timeoutMs: DESKTOP_PROBE_TIMEOUT_MS }
        : { timeoutMs: DESKTOP_PROBE_TIMEOUT_MS }
    )
  );
}

function resumeOnce(boxId: string): Promise<unknown> {
  return singleFlight(pendingResumes, boxId, () =>
    resume(boxId, { timeoutMs: DESKTOP_PROBE_TIMEOUT_MS })
  );
}

export class DesktopUnavailableError extends Error {
  constructor() {
    super("desktop stream unavailable");
    this.name = "DesktopUnavailableError";
  }
}

export type DesktopStreamResult =
  | { status: "up"; url: string }
  | { status: "waking" }
  | { status: "preparing" };

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
  const url = await requestDesktopOnce(userBox.boxId, options?.vnc === true);
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
 * A provider 429 surfaces as StartLimitError so the caller can show a
 * try-again-later page instead of a refresh loop that keeps re-resuming.
 */
export async function desktopStreamUrlIfUp(
  supabase: SupabaseClient,
  userId: string,
  options?: { vnc?: boolean }
): Promise<DesktopStreamResult> {
  const { data, error } = await supabase
    .from("boxes")
    .select("provider_box_id, state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`box lookup failed for user ${userId}: ${error.message}`);
  }
  const boxId = (data?.provider_box_id as string | undefined) ?? "";
  if (!boxId) {
    throw new Error(`no box for user ${userId}`);
  }
  // Another Messages tap may already be waking this tenant. Avoid a second
  // provider resume from the same user-facing recovery loop.
  if (data?.state === "starting") return { status: "waking" };
  const box = await getBox(boxId, { timeoutMs: DESKTOP_PROBE_TIMEOUT_MS });
  if (box.state !== "ready" && box.state !== "idle") {
    try {
      await resumeOnce(boxId);
      // last_active_at starts the stale-transition clock the sweeper
      // reconciles from; a stale timestamp would put a fresh boot on it.
      await supabase
        .from("boxes")
        .update({ state: "starting", last_active_at: new Date().toISOString() })
        .eq("provider_box_id", boxId);
    } catch (error) {
      if (isStartLimit(error)) {
        throw new StartLimitError();
      }
      // Only call a failed resume a concurrent wake when a fresh provider
      // read proves the machine advanced. Unknown failures must surface so
      // the UI does not claim a dead machine is waking.
      const latest = await getBox(boxId, { timeoutMs: DESKTOP_PROBE_TIMEOUT_MS });
      if (latest.state === "ready" || latest.state === "idle") {
        return { status: "waking" };
      }
      throw error;
    }
    return { status: "waking" };
  }
  let url: string | undefined;
  try {
    url = await requestDesktopOnce(boxId, options?.vnc === true);
  } catch (error) {
    // ASCII reports a running box before the desktop daemon has finished
    // preparing the stream. This is recoverable and must not become the
    // generic dead-end page shown by the old Computer card.
    if (
      error instanceof BoxApiError &&
      (error.code === "desktop_not_ready" ||
        /desktop[_ -]not[_ -]ready/i.test(error.message))
    ) {
      return { status: "preparing" };
    }
    throw error;
  }
  // A just-resumed machine can report ready before the stream endpoint is
  // prepared — treat that as still waking rather than an error.
  if (!url) return { status: "preparing" };
  return { status: "up", url };
}
