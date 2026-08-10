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
 * Re-register both private hosted routes and persist the rotated tokens.
 * api_server (8642) backs chat on every surface; the dashboard (9119) route
 * is kept fresh for future Tier 2 dashboard slices — both tokens rotate on
 * resume, so refreshing only one leaves the other stale for the rest of the
 * box's life.
 */
async function refreshHostedRoutes(
  supabase: SupabaseClient,
  boxId: string
): Promise<{ apiServer: HostedRoute; dashboard?: HostedRoute }> {
  const result = await command(
    boxId,
    `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; /home/user/.ascii/host url ${API_SERVER_PORT} --timeout 120 --private`,
    180
  );
  if (result.exitCode !== 0) {
    throw new Error(`host refresh failed: ${result.stderr}`);
  }
  const apiServer = parseHostedUrl(result.stdout, API_SERVER_PORT);
  // The dashboard unit is optional on older template versions; chat must not
  // fail because its route is missing, so its registration runs separately
  // and any failure is tolerated.
  let dashboard: HostedRoute | undefined;
  try {
    const dashResult = await command(
      boxId,
      `eval "$(grep '^export ASCII_' /home/user/.bashrc)"; /home/user/.ascii/host url ${DASHBOARD_PORT} --timeout 120 --private`,
      180
    );
    if (dashResult.exitCode === 0) {
      dashboard = parseHostedUrl(dashResult.stdout, DASHBOARD_PORT);
    }
  } catch {
    dashboard = undefined;
  }
  await supabase
    .from("boxes")
    .update({
      hosted_url: apiServer.url,
      hosted_token: apiServer.token,
      ...(dashboard
        ? { dashboard_url: dashboard.url, dashboard_token: dashboard.token }
        : {}),
    })
    .eq("provider_box_id", boxId);
  return { apiServer, dashboard };
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
      throw error;
    }
    await waitForBox(boxId);
  }

  let target: HermesBoxTarget = {
    hostedUrl: row.hosted_url,
    hostedToken: row.hosted_token,
    apiServerKey: row.api_server_key,
  };
  let dashboard: HostedRoute | undefined =
    row.dashboard_url && row.dashboard_token
      ? { url: row.dashboard_url, token: row.dashboard_token }
      : undefined;

  // The hosted token rotates across stop/resume; hermes-host re-registers on
  // boot but the stored token may be stale. Probe, then refresh once.
  const deadline = Date.now() + 180_000;
  while (!(await health(target))) {
    if (Date.now() > deadline) {
      throw new Error(`hermes on ${boxId} not healthy after resume`);
    }
    try {
      // Right after resume the box reports ready before the ascii agent and
      // hermes-host have booted, so the refresh command itself can fail —
      // keep retrying until the deadline.
      const hosted = await refreshHostedRoutes(supabase, boxId);
      target = {
        ...target,
        hostedUrl: hosted.apiServer.url,
        hostedToken: hosted.apiServer.token,
      };
      dashboard = hosted.dashboard ?? dashboard;
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
