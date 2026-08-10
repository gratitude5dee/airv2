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
  dashboard?: HostedRoute;
}

interface BoxRow {
  provider_box_id: string;
  hosted_url: string;
  hosted_token: string;
  api_server_key: string;
  dashboard_url: string | null;
  dashboard_token: string | null;
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
 * versions and nothing on the request path consumes the route yet, so this
 * runs fire-and-forget after the box is confirmed healthy and never blocks
 * or fails a turn.
 */
async function refreshDashboardRoute(
  supabase: SupabaseClient,
  boxId: string
): Promise<void> {
  try {
    const result = await command(
      boxId,
      `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; /home/user/.ascii/host url ${DASHBOARD_PORT} --timeout 120 --private`,
      180
    );
    if (result.exitCode !== 0) {
      return;
    }
    const dashboard = parseHostedUrl(result.stdout, DASHBOARD_PORT);
    await supabase
      .from("boxes")
      .update({ dashboard_url: dashboard.url, dashboard_token: dashboard.token })
      .eq("provider_box_id", boxId);
  } catch (error) {
    console.log(
      JSON.stringify({
        msg: "dashboard route refresh failed",
        box_id: boxId,
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
  const { data } = await supabase
    .from("boxes")
    .select(
      "provider_box_id, hosted_url, hosted_token, api_server_key, dashboard_url, dashboard_token"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (!data) {
    throw new Error(`no box for user ${userId}`);
  }
  const row = data as BoxRow;
  const boxId = row.provider_box_id;

  await supabase
    .from("boxes")
    .update({ stop_after: null, last_active_at: new Date().toISOString() })
    .eq("user_id", userId);

  const box = await getBox(boxId);
  if (box.state !== "ready" && box.state !== "idle") {
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
        throw error;
      }
    }
    await waitForBox(boxId);
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
  while (!(await health(target))) {
    if (Date.now() > deadline) {
      throw new Error(`hermes on ${boxId} not healthy after resume`);
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

  // The dashboard token rotated too, but nothing on the request path reads
  // it — refresh it in the background so the wake deadline is never spent
  // on it.
  if (refreshed) {
    void refreshDashboardRoute(supabase, boxId);
  }

  await supabase
    .from("boxes")
    .update({ state: "ready" })
    .eq("provider_box_id", boxId);

  return { boxId, target, dashboard };
}

/** Re-arm the idle deadline; the cron sweeper stops the box past it. */
export async function armStopAfter(
  supabase: SupabaseClient,
  userId: string
): Promise<void> {
  const stopAfter = new Date(
    Date.now() + STOP_AFTER_MINUTES * 60_000
  ).toISOString();
  await supabase
    .from("boxes")
    .update({ stop_after: stopAfter })
    .eq("user_id", userId);
}
