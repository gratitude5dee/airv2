/**
 * Server-side Hermes dashboard (9119) client. Dashboard auth is a
 * password-login flow, not an Authorization header: POST /auth/password-login
 * verifies the sealed credential (CM1 task 0 / CC10) and mints
 * hermes_session_* cookies that gate every protected route. The cookies stay
 * in this module's memory — never forwarded to a browser or a box (C3).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  refreshDashboardRoute,
  type HostedRoute,
} from "@/lib/orchestrator/boxes";

export const DASHBOARD_USERNAME = "air";

export type DashboardResult =
  | { kind: "ok"; response: Response }
  | { kind: "stale"; response?: Response }
  | { kind: "fail" };

/**
 * Login then execute one request against the dashboard route. 401/403 —
 * from the login endpoint (no response kept) or from the executed request
 * (response kept so an exhausted retry can forward it verbatim) — classify
 * as `stale`; other login failures (5xx, missing cookies) are `fail`.
 */
export async function dashboardRequest(
  route: HostedRoute,
  password: string,
  execute: (
    route: HostedRoute,
    headers: Record<string, string>
  ) => Promise<Response>
): Promise<DashboardResult> {
  const login = await fetch(`${route.url}/auth/password-login`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Cookie: `_port_auth=${route.token}`,
    },
    body: JSON.stringify({
      provider: "basic",
      username: DASHBOARD_USERNAME,
      password,
    }),
  });
  // Only status/headers matter — cancel the body so undici returns the
  // connection to the pool instead of holding it until GC.
  await login.body?.cancel();
  if (login.status === 401 || login.status === 403) {
    return { kind: "stale" };
  }
  if (!login.ok) return { kind: "fail" };
  const sessionCookies = login.headers
    .getSetCookie()
    .map((cookie) => cookie.split(";")[0])
    .join("; ");
  if (!sessionCookies) return { kind: "fail" };
  const response = await execute(route, {
    Cookie: `_port_auth=${route.token}; ${sessionCookies}`,
  });
  if (response.status === 401 || response.status === 403) {
    return { kind: "stale", response };
  }
  return { kind: "ok", response };
}

/**
 * dashboardRequest with the stale-token retry. The hosted _token rotates on
 * resume and the wake path refreshes the dashboard route only in the
 * background. Only a 401/403 (stale _port_auth or auth rejection) is worth
 * the synchronous route re-registration + retry — other failures (dashboard
 * 5xx, missing cookies) fail fast instead of paying a multi-minute box
 * command. The superseded stale response's body is cancelled only once a
 * retry has actually replaced it.
 */
export async function dashboardRequestWithRetry(
  supabase: SupabaseClient,
  boxId: string,
  route: HostedRoute,
  password: string,
  execute: (
    route: HostedRoute,
    headers: Record<string, string>
  ) => Promise<Response>
): Promise<DashboardResult> {
  let attempt = await dashboardRequest(route, password, execute);
  if (attempt.kind === "stale") {
    const fresh = await refreshDashboardRoute(supabase, boxId);
    if (fresh) {
      const superseded = attempt.response;
      attempt = await dashboardRequest(fresh, password, execute);
      await superseded?.body?.cancel();
    }
  }
  return attempt;
}
