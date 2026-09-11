/**
 * The sealed credential envelope (plan §3). Per target record, control-plane
 * state is sealed under MIGRATION_SEAL_KEY (fallback BOX_DASHBOARD_AUTH_KEY)
 * with the existing secretbox pattern. The envelope holds only box-scoped
 * tokens — the candidate's fresh gateway/api/dashboard credentials and hosted
 * route tokens. It NEVER contains AIR_VAULT_KEY (C18) or provider account
 * credentials; a vault-bearing account fails preflight long before this runs.
 */
import { env } from "../env";
import { openSecret, sealSecret } from "../crypto/secretbox";

/** The routing fields a route commit needs for one side. */
export interface TargetCredentials {
  provider: string;
  provider_box_id: string;
  environment: string;
  hosted_url: string;
  hosted_token: string;
  dashboard_url: string;
  dashboard_token: string;
  /** Sealed dashboard basic-auth password for the boxes row (CM1). */
  dashboard_auth: string | null;
  api_server_key: string;
  gateway_token: string;
  template_version: string | null;
  channel: string | null;
  baseline_version: string | null;
  baseline_synced_at: string | null;
  provider_name: string | null;
  control_url: string | null;
  control_token: string | null;
  state: string;
}

export function sealCredentials(creds: TargetCredentials): string {
  const key = env.migrationSealKey();
  if (!key) {
    throw new Error(
      "MIGRATION_SEAL_KEY (or BOX_DASHBOARD_AUTH_KEY) is required for credential staging"
    );
  }
  return sealSecret(JSON.stringify(creds), key);
}

export function openCredentials(sealed: string): TargetCredentials {
  const key = env.migrationSealKey();
  if (!key) {
    throw new Error(
      "MIGRATION_SEAL_KEY (or BOX_DASHBOARD_AUTH_KEY) is required to open the envelope"
    );
  }
  const parsed = JSON.parse(openSecret(sealed, key)) as TargetCredentials;
  if (!parsed.provider_box_id || !parsed.gateway_token) {
    throw new Error("sealed credentials missing required fields");
  }
  return parsed;
}

/** The jsonb `route` argument commit_migration_route expects. */
export function routePayload(creds: TargetCredentials): Record<string, unknown> {
  return {
    provider: creds.provider,
    provider_box_id: creds.provider_box_id,
    environment: creds.environment,
    state: creds.state,
    hosted_url: creds.hosted_url,
    hosted_token: creds.hosted_token,
    dashboard_url: creds.dashboard_url,
    dashboard_token: creds.dashboard_token,
    dashboard_auth: creds.dashboard_auth,
    control_url: creds.control_url,
    control_token: creds.control_token,
    api_server_key: creds.api_server_key,
    gateway_token: creds.gateway_token,
    template_version: creds.template_version,
    channel: creds.channel,
    baseline_version: creds.baseline_version,
    baseline_synced_at: creds.baseline_synced_at,
    provider_name: creds.provider_name,
  };
}
