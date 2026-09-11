/**
 * Box lifecycle for the message path: resolve the user's box, resume it if
 * stopped, refresh the hosted route (the hosted `_token` rotates on resume),
 * and manage the 20-minute stop_after window swept by the cron (goal.md M2
 * task 4). Box 429 start_limit_reached surfaces as a typed error so callers
 * can queue and back off rather than drop the turn (task 9).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  command,
  getBox,
  hostRoute,
  isStartLimit,
  resume,
  waitForBox,
  type HostedRoute,
} from "../box/client";
import { health, type HermesBoxTarget } from "../hermes/client";
import { mirrorBrandIfStale } from "../brand/mirror";
import { recordBoxStateEvent } from "../box/events";
import { boxTarget } from "../compute/runtime";
import { assertAdmissionOpen } from "../migration/admission";

export const STOP_AFTER_MINUTES = 20;

export class StartLimitError extends Error {
  constructor() {
    super("box start limit reached");
    this.name = "StartLimitError";
  }
}

export type { HostedRoute };

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
/** How long after the VM reports ready the wake loop lets the Hermes gateway
 * finish booting (plugins, MCP servers, tool schemas — ~25s observed on
 * ascii.dev) before it may restart the units. Restarting earlier kills a
 * gateway that was merely still starting, along with any run it had just
 * accepted from a concurrent caller. */
export const HERMES_RESTART_GRACE_MS = 60_000;
export const DASHBOARD_PORT = 9119;

/** A VM resume revives the agent-browser daemon process but its Chrome
 * child is gone (defunct), so every browser tool call hangs until the 60s
 * tool timeout. Clear the stale daemon and sockets; the next browser call
 * relaunches cleanly in ~2s. Bracketed pattern so pkill never matches this
 * command's own shell. */
export const AGENT_BROWSER_RESET_CMD =
  "pkill -9 -f 'agent-browser-linu[x]'; rm -f /home/user/.agent-browser/*.sock /home/user/.agent-browser/*.pid; rm -rf /tmp/agent-browser-*";
/** Void the idle stop's claim: it belongs to the stop this resume just
 * ended, and a provider that keeps the VM (memory restore, or an archive
 * cancelled by a quick re-wake) keeps the boot id too, so the durable index
 * worker would otherwise sit deferred until the claim's TTL. Boxes whose
 * ovctl predates the subcommand (argparse exit 2) get the file removed
 * directly. */
export const VOID_STOP_CLAIM_CMD =
  "ovctl resumed || rm -f /home/user/.openviking/stop-claim.json";
const AFTER_RESUME_ATTEMPTS = 3;
const AFTER_RESUME_RETRY_MS = 5_000;

/** Box-side housekeeping once the provider reports the VM back. Nothing
 * here gates Hermes health, so it runs detached from the wake path — but
 * right after resume the provider can report ready before the box's
 * command agent is up, so a failed round trip is retried instead of
 * dropped. */
export async function afterResume(boxId: string): Promise<void> {
  for (let attempt = 1; attempt <= AFTER_RESUME_ATTEMPTS; attempt += 1) {
    try {
      await command(boxId, AGENT_BROWSER_RESET_CMD, 30);
      await command(boxId, VOID_STOP_CLAIM_CMD, 30);
      return;
    } catch (error) {
      if (attempt === AFTER_RESUME_ATTEMPTS) {
        console.error(
          JSON.stringify({
            msg: "post-resume box housekeeping failed",
            box_id: boxId,
            error: error instanceof Error ? error.message : String(error),
          })
        );
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, AFTER_RESUME_RETRY_MS));
    }
  }
}

/**
 * Re-register the api_server (8642) hosted route and persist the rotated
 * token. This runs inside the wake retry loop, so it stays a single provider
 * call — the dashboard route is refreshed separately, off the critical path.
 */
async function refreshApiServerRoute(
  supabase: SupabaseClient,
  boxId: string
): Promise<HostedRoute> {
  const apiServer = await hostRoute(boxId, API_SERVER_PORT);
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
    const dashboard = await hostRoute(boxId, DASHBOARD_PORT);
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
      .update({ state: "starting", last_active_at: new Date().toISOString() })
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

export interface BoxPeek {
  boxId: string;
  /** The mirrored provider state says the box is up; nothing was woken. */
  awake: boolean;
}

/**
 * The user's box and its mirrored state, without a provider call and without
 * waking anything. Read-only views use this to decide between a live read
 * and the Postgres status mirror: a wake is the scarce, rate-limited
 * operation and must never be spent just to draw a status chip. The mirror
 * can lag the provider, so a caller that reads live on `awake` still needs
 * its usual error path.
 */
export async function peekBoxState(
  supabase: SupabaseClient,
  userId: string
): Promise<BoxPeek | null> {
  const { data, error } = await supabase
    .from("boxes")
    .select("provider_box_id, state")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`box lookup failed for user ${userId}: ${error.message}`);
  }
  if (!data || typeof data.provider_box_id !== "string") return null;
  return { boxId: data.provider_box_id, awake: data.state === "ready" };
}

/**
 * The user's box with live-read credentials, only while the mirrored state
 * already says it is up. Never resumes, waits, or touches stop_after — the
 * read-only twin of ensureBoxAwake for ambient surfaces (e.g. the Home
 * dashboard preview) that must not spend a wake to render a summary. The
 * mirror can lag, so reads on the returned box can still fail; callers use
 * their usual error path. Returns null when there is no box or it is not
 * mirrored as ready.
 */
export async function peekUserBox(
  supabase: SupabaseClient,
  userId: string
): Promise<UserBox | null> {
  const { data, error } = await supabase
    .from("boxes")
    .select(
      "provider_box_id, hosted_url, hosted_token, api_server_key, dashboard_url, dashboard_token, dashboard_auth, state"
    )
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`box lookup failed for user ${userId}: ${error.message}`);
  }
  if (!data) return null;
  const row = data as BoxRow & { state: string | null };
  if (row.state !== "ready") return null;
  return {
    boxId: row.provider_box_id,
    target: {
      hostedUrl: row.hosted_url,
      hostedToken: row.hosted_token,
      apiServerKey: row.api_server_key,
    },
    dashboard:
      row.dashboard_url && row.dashboard_token !== null
        ? { url: row.dashboard_url, token: row.dashboard_token }
        : undefined,
    dashboardAuthSealed: row.dashboard_auth ?? undefined,
  };
}

/**
 * Resolve the user's box and make sure Hermes answers, resuming if needed.
 * Clears stop_after for the duration of the run (the caller re-arms it).
 */
export async function ensureBoxAwake(
  supabase: SupabaseClient,
  userId: string
): Promise<UserBox> {
  // The pause window of a live migration holds box work out; callers should
  // translate MigrationBusyError to a retryable response where they have one.
  await assertAdmissionOpen(supabase, userId);
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
        current.state === "stopped" ||
        current.state === "stopping" ||
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
    void afterResume(boxId);
  }

  let target: HermesBoxTarget = {
    hostedUrl: row.hosted_url,
    hostedToken: row.hosted_token,
    apiServerKey: row.api_server_key,
  };
  // Namespace/Tenki ingress carries no route token (token is ""), so the
  // route exists whenever a URL does.
  const dashboard: HostedRoute | undefined =
    row.dashboard_url && row.dashboard_token !== null
      ? { url: row.dashboard_url, token: row.dashboard_token }
      : undefined;

  // The hosted token rotates across stop/resume; hermes-host re-registers on
  // boot but the stored token may be stale. Probe, then refresh once.
  const started = Date.now();
  const deadline = started + 180_000;
  let refreshed = false;
  let restarted = false;
  while (!(await health(target))) {
    if (Date.now() > deadline) {
      throw new Error(`hermes on ${boxId} not healthy after resume`);
    }
    if (
      refreshed &&
      !restarted &&
      Date.now() - started >= HERMES_RESTART_GRACE_MS
    ) {
      // Still unhealthy on a fresh token well past the gateway's own boot
      // time: the units are enabled but can miss a boot after an unclean
      // VM death; one explicit restart per wake recovers them.
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

  // Refresh the agent's connected-tools note after a resume; lazy import avoids
  // the provisioning↔orchestrator cycle.
  if (wroteStarting) {
    void (async () => {
      try {
        const { writeConnectedToolsFile } =
          await import("../provisioning/connectors");
        await writeConnectedToolsFile(supabase, userId, boxTarget(boxId));
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
  }

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
