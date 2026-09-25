/**
 * The boxes table's credential columns — hosted_url, hosted_token,
 * api_server_key, dashboard_url, dashboard_token, dashboard_auth — have one
 * reader: this module (R-ARCH-08). Every other caller consumes the loaded
 * BoxCredentials; the grep test in seam.test.ts fails any read of those
 * columns outside lib/box (the tracked allowlist is for the write sites —
 * provisioning and the migration credential swap).
 *
 * None of it ever leaves the server: C3 gates every consumer.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { HermesBoxTarget } from "../hermes/client";
import type { HostedRoute } from "./types";

export interface BoxCredentialRow {
  provider_box_id: string;
  hosted_url: string;
  hosted_token: string;
  api_server_key: string;
  dashboard_url: string | null;
  dashboard_token: string | null;
  dashboard_auth: string | null;
}

/** The credential columns plus `state`, the mirrored liveness callers gate on. */
export const BOX_CREDENTIAL_COLUMNS =
  "provider_box_id, hosted_url, hosted_token, api_server_key, dashboard_url, dashboard_token, dashboard_auth, state";

export interface BoxCredentials {
  boxId: string;
  /** Mirrored provider state, as last written by the wake/stop paths. */
  state: string | null;
  target: HermesBoxTarget;
  dashboard?: HostedRoute | undefined;
  /** Sealed dashboard basic-auth password (CM1/CC10). Server-side only. */
  dashboardAuthSealed?: string | undefined;
}

export function toBoxCredentials(
  row: BoxCredentialRow & { state?: string | null }
): BoxCredentials {
  return {
    boxId: row.provider_box_id,
    state: row.state ?? null,
    target: {
      hostedUrl: row.hosted_url,
      hostedToken: row.hosted_token,
      apiServerKey: row.api_server_key,
    },
    // Namespace/Tenki ingress carries no route token (token is ""), so the
    // route exists whenever a URL does.
    dashboard:
      row.dashboard_url && row.dashboard_token !== null
        ? { url: row.dashboard_url, token: row.dashboard_token }
        : undefined,
    dashboardAuthSealed: row.dashboard_auth ?? undefined,
  };
}

/**
 * Load the user's box credentials. A failed query (e.g. a migration missing
 * a selected column) throws rather than reading as "this user has no box" —
 * null means the row is genuinely absent.
 */
export async function loadBoxCredentials(
  supabase: SupabaseClient,
  userId: string
): Promise<BoxCredentials | null> {
  const { data, error } = await supabase
    .from("boxes")
    .select(BOX_CREDENTIAL_COLUMNS)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) {
    throw new Error(`box lookup failed for user ${userId}: ${error.message}`);
  }
  if (!data) return null;
  return toBoxCredentials(
    data as BoxCredentialRow & { state: string | null }
  );
}

/** Persist a (re-)registered api_server hosted route's rotated URL+token. */
export async function recordHostedRoute(
  supabase: SupabaseClient,
  boxId: string,
  route: HostedRoute
): Promise<void> {
  await supabase
    .from("boxes")
    .update({ hosted_url: route.url, hosted_token: route.token })
    .eq("provider_box_id", boxId);
}

/** Persist a (re-)registered dashboard hosted route's rotated URL+token. */
export async function recordDashboardRoute(
  supabase: SupabaseClient,
  boxId: string,
  route: HostedRoute
): Promise<void> {
  await supabase
    .from("boxes")
    .update({ dashboard_url: route.url, dashboard_token: route.token })
    .eq("provider_box_id", boxId);
}
