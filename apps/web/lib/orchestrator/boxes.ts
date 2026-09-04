/**
 * Box lifecycle for the message path: resolve the user's box, resume it if
 * stopped, refresh the hosted route (the hosted `_token` rotates on resume),
 * and manage the 20-minute stop_after window swept by the cron (goal.md M2
 * task 4). Box 429 start_limit_reached surfaces as a typed error so callers
 * can queue and back off rather than drop the turn (task 9).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { command, getBox, isStartLimit, resume, waitForBox } from "../box/client";
import { health, type HermesBoxTarget } from "../hermes/client";
import { mirrorBrandIfStale } from "../brand/mirror";
import { recordBoxStateEvent } from "../box/events";
import { boxTarget } from "../compute/runtime";

export const STOP_AFTER_MINUTES = 20;

export class StartLimitError extends Error {
  constructor() {
    super("box start limit reached");
    this.name = "StartLimitError";
  }
}

export interface HostedRoute {
  url: string;
  token: string;
}

export interface UserBox {
  boxId: string;
  target: HermesBoxTarget;
  /** Hermes dashboard (9119) route, for the allowlisted proxy. Server-side only. */
  dashboard?: HostedRoute | undefined;
  /** Sealed dashboard basic-auth password (CM1/CC10). Server-side only. */
  dashboardAuthSealed?: string | undefined;
}

interface BoxRow {
  provider_box_id: string;
  hosted_url: string;
  hosted_token: string;
  api_server_key: string;
  dashboard_url: string | null;
  dashboard_token: string | null;
  dashboard_auth: string | null;
}

export const API_SERVER_PORT = 8642;
export const DASHBOARD_PORT = 9119;

const HOSTED_URL_PATTERN =
  /^(https:\/\/[a-z0-9-]+-(\d+)\.on\.ascii\.dev)\?_token=([a-f0-9]+)$/m;

function parseHostedUrl(
  stdout: string,
  port: number
): { url: string; token: string } {
  for (const line of stdout.split("\n")) {
    const match = HOSTED_URL_PATTERN.exec(line.trim());
    if (match?.[1] && match[3] && Number(match[2]) === port) {
      return { url: match[1], token: match[3] };
    }
  }
  throw new Error(`hosted URL for port ${port} not found in host output`);
}

/**
 * Re-register the api_server (8642) hosted route and persist the rotated
 * token. This runs inside the wake retry loop, so it stays a single box
 * command — the dashboard route is refreshed separately, off the critical
 * path.
 */
async function refreshApiServerRoute(
  supabase: SupabaseClient,
  boxId: string
): Promise<HostedRoute> {
  const result = await command(
    boxId,
    `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; /home/user/.ascii/host url ${API_SERVER_PORT} --timeout 120 --private`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`host refresh failed: ${result.stderr}`);
  }
  const apiServer = parseHostedUrl(result.stdout, API_SERVER_PORT);
  await supabase
    .from("boxes")
    .update({ hosted_url: apiServer.url, hosted_token: apiServer.token })
    .eq("provider_box_id", boxId);
  return apiServer;
}

/**
 * Re-register the dashboard (9119) hosted route and persist the rotated
 * token. Best-effort: the dashboard unit is optional on older template
 * versions, so this never throws. Runs fire-and-forget after a wake so the
 * wake deadline is never spent on it, and synchronously from the proxy when
 * a dashboard-upstream request is rejected with a stale token.
 */
export async function refreshDashboardRoute(
  supabase: SupabaseClient,
  boxId: string
): Promise<HostedRoute | null> {
  try {
    const result = await command(
      boxId,
      `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; /home/user/.ascii/host url ${DASHBOARD_PORT} --timeout 120 --private`,
      180
    );
    if (result.exitCode !== 0) {
      return null;
    }
    const dashboard = parseHostedUrl(result.stdout, DASHBOARD_PORT);
    await supabase
      .from("boxes")
      .update({ dashboard_url: dashboard.url, dashboard_token: dashboard.token })
      .eq("provider_box_id", boxId);
    return dashboard;
  } catch (error) {
    console.log(
      JSON.stringify({
        msg: "dashboard route refresh failed",
        box_id: boxId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
    return null;
  }
}

/**
 * Eager wake (optibox: request the private box the moment a message
 * arrives, even before the debounce settles). Fire-and-forget: kicks the
 * provider resume so the VM boot overlaps the debounce window and the
 * shared bridge, then returns — no health wait, no token refresh. All
 * errors are swallowed; ensureBoxAwake owns the real wake and already
 * tolerates losing the concurrent-resume race with this call.
 */
export async function prewarmBox(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  try {
    const { data } = await supabase
      .from("boxes")
      .select("provider_box_id")
      .eq("user_id", userId)
      .maybeSingle();
    const boxId = (data?.provider_box_id as string | undefined) ?? "";
    if (!boxId) return;
    const box = await getBox(boxId);
    if (box.state === "ready" || box.state === "idle") return;
    await resume(boxId);
    await supabase
      .from("boxes")
      .update({ state: "starting" })
      .eq("provider_box_id", boxId);
  } catch (error) {
    console.log(
      JSON.stringify({
        msg: "box prewarm skipped",
        user_id: userId,
        error: error instanceof Error ? error.message : String(error),
      })
    );
  }
}

/**
 * Resolve the user's box and make sure Hermes answers, resuming if needed.
 * Clears stop_after for the duration of the run (the caller re-arms it).
 */
export async function ensureBoxAwake(
  supabase: SupabaseClient,
  userId: string
): Promise<UserBox> {
  const { data, error: selectError } = await supabase
    .from("boxes")
    .select(
      "provider_box_id, hosted_url, hosted_token, api_server_key, dashboard_url, dashboard_token, dashboard_auth"
    )
    .eq("user_id", userId)
    .maybeSingle();
  // A failed query (e.g. a migration missing a selected column) is not the
  // same as a missing row — surface it as its own error so an infra problem
  // never reads as "this user has no box".
  if (selectError) {
    throw new Error(`box lookup failed for user ${userId}: ${selectError.message}`);
  }
  if (!data) {
    throw new Error(`no box for user ${userId}`);
  }
  const row = data as BoxRow;
  const boxId = row.provider_box_id;

  await supabase
    .from("boxes")
    .update({ stop_after: null, last_active_at: new Date().toISOString() })
    .eq("user_id", userId);

  let wroteStarting = false;
  try {
  const box = await getBox(boxId);
  if (box.state !== "ready" && box.state !== "idle") {
    // Transitional state so the UI can show an honest boot progression (M10).
    await supabase
      .from("boxes")
      .update({ state: "starting" })
      .eq("provider_box_id", boxId);
    wroteStarting = true;
    try {
      await resume(boxId);
    } catch (error) {
      if (isStartLimit(error)) {
        throw new StartLimitError();
      }
      // Concurrent wakes race: the pre-warm and a chat turn can both call
      // resume, and the loser gets an error for a box that is already
      // starting. Only swallow the error if the box actually left the
      // stopped state — a still-stopped or errored box means the resume
      // genuinely failed and must surface immediately.
      const current = await getBox(boxId).catch(() => null);
      const stillDown =
        !current ||
        current.state === "archived" ||
        current.state === "archiving" ||
        current.state === "error";
      if (stillDown) {
        await supabase
          .from("boxes")
          .update({ state: "stopped" })
          .eq("provider_box_id", boxId);
        throw error;
      }
    }
    await waitForBox(boxId);
    // A VM resume revives the agent-browser daemon process but its Chrome
    // child is gone (defunct), so every browser tool call hangs until the
    // 60s tool timeout. Clear the stale daemon and sockets; the next
    // browser call relaunches cleanly in ~2s.
    void command(
      boxId,
      // Bracketed pattern so pkill never matches this command's own shell.
      "pkill -9 -f 'agent-browser-linu[x]'; rm -f /home/user/.agent-browser/*.sock /home/user/.agent-browser/*.pid; rm -rf /tmp/agent-browser-*",
      30
    ).catch(() => undefined);
  }

  let target: HermesBoxTarget = {
    hostedUrl: row.hosted_url,
    hostedToken: row.hosted_token,
    apiServerKey: row.api_server_key,
  };
  const dashboard: HostedRoute | undefined =
    row.dashboard_url && row.dashboard_token
      ? { url: row.dashboard_url, token: row.dashboard_token }
      : undefined;

  // The hosted token rotates across stop/resume; hermes-host re-registers on
  // boot but the stored token may be stale. Probe, then refresh once.
  const deadline = Date.now() + 180_000;
  let refreshed = false;
  let restarted = false;
  while (!(await health(target))) {
    if (Date.now() > deadline) {
      throw new Error(`hermes on ${boxId} not healthy after resume`);
    }
    if (refreshed && !restarted) {
      // Still unhealthy on a fresh token: the gateway/host units are
      // enabled but can miss a boot after an unclean VM death; one
      // explicit restart per wake recovers them.
      restarted = true;
      await command(
        boxId,
        "sudo systemctl restart hermes-gateway hermes-dashboard hermes-host",
        60
      ).catch(() => undefined);
    }
    try {
      // Right after resume the box reports ready before the ascii agent and
      // hermes-host have booted, so the refresh command itself can fail —
      // keep retrying until the deadline.
      const apiServer = await refreshApiServerRoute(supabase, boxId);
      target = {
        ...target,
        hostedUrl: apiServer.url,
        hostedToken: apiServer.token,
      };
      refreshed = true;
      if (await health(target)) break;
    } catch (error) {
      console.log(
        JSON.stringify({
          msg: "hosted route refresh retrying",
          box_id: boxId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }

  // The dashboard token rotated too; refresh it in the background so the
  // wake deadline is never spent on it. Dashboard-upstream proxy requests
  // that lose this race retry once with a synchronous refresh.
  if (refreshed) {
    void refreshDashboardRoute(supabase, boxId);
  }

  // A box asleep through brand edits gets the current compile on wake
  // (CM0: mirror, don't sync). Best-effort, off the critical path.
  void mirrorBrandIfStale(supabase, userId, boxId);

  // Keep connector state and the agent's availability note converged after
  // every wake. Lazy import avoids the provisioning/orchestrator cycle.
  void (async () => {
    try {
      const { data } = await supabase
        .from("connections")
        .select("id")
        .eq("user_id", userId)
        .eq("status", "active")
        .limit(1);
      const { installComposioMcp, writeConnectedToolsFile } =
        await import("../provisioning/connectors");
      const target = boxTarget(boxId);
      if (data && data.length > 0) {
        await installComposioMcp(supabase, userId, target);
      }
      await writeConnectedToolsFile(supabase, userId, target);
    } catch (error) {
      console.log(
        JSON.stringify({
          msg: "post-wake connector convergence failed",
          box_id: boxId,
          error: error instanceof Error ? error.message : String(error),
        }),
      );
    }
  })();

  await supabase
    .from("boxes")
    .update({ state: "ready" })
    .eq("provider_box_id", boxId);
  if (wroteStarting) {
    // V8: a genuine stopped→ready transition (not a no-op wake) feeds the
    // Screen tab's power-state history.
    await recordBoxStateEvent(supabase, userId, "ready").catch(() => undefined);
  }

  return {
    boxId,
    target,
    dashboard,
    dashboardAuthSealed: row.dashboard_auth ?? undefined,
  };
  } catch (error) {
    // The deadline was cleared above and the caller's re-arm will never run
    // for a wake that throws — restore it so the sweeper can still stop the
    // box.
    await armStopAfter(supabase, userId).catch(() => undefined);
    // A wake that dies after the "starting" write (waitForBox throwing, the
    // health loop deadline) must not park the row in a transitional state
    // the UI has no controls for: persist the provider's real state.
    if (wroteStarting) {
      const current = await getBox(boxId).catch(() => null);
      const state =
        current && (current.state === "ready" || current.state === "idle")
          ? "ready"
          : "stopped";
      await supabase
        .from("boxes")
        .update({ state })
        .eq("provider_box_id", boxId);
    }
    throw error;
  }
}

/**
 * Re-arm the idle deadline; the cron sweeper stops the box past it.
 * Monotonic: never moves an existing deadline earlier, so routine activity
 * re-arms (20 min) cannot shrink an explicit keep-awake window.
 */
export async function armStopAfter(
  supabase: SupabaseClient,
  userId: string,
  minutes: number = STOP_AFTER_MINUTES
): Promise<void> {
  const stopAfter = new Date(Date.now() + minutes * 60_000).toISOString();
  await supabase
    .from("boxes")
    .update({ stop_after: stopAfter })
    .eq("user_id", userId)
    .or(`stop_after.is.null,stop_after.lt.${stopAfter}`);
}
