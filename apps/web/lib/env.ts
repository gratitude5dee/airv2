/**
 * Server-side environment access (goal.md §5). Nothing here is ever
 * NEXT_PUBLIC_; importing this module from client code is a bug.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

function optional(name: string, fallback: string): string {
  return process.env[name] ?? fallback;
}

export const env = {
  boxApiKey: (): string => required("BOX_API_KEY"),
  boxApiBase: (): string =>
    optional("BOX_API_BASE", "https://ascii.dev/api/box/v1"),
  boxTemplateId: (): string => required("BOX_TEMPLATE_ID"),
  adminApiKey: (): string => required("ADMIN_API_KEY"),
  appOrigin: (): string => optional("APP_ORIGIN", "https://airv2.vercel.app"),
  supabaseUrl: (): string => required("SUPABASE_URL"),
  supabaseServiceRoleKey: (): string => required("SUPABASE_SERVICE_ROLE_KEY"),
  modelProviderApiKey: (): string => required("MODEL_PROVIDER_API_KEY"),
  modelProviderBaseUrl: (): string => required("MODEL_PROVIDER_BASE_URL"),
  thirdwebSecretKey: (): string => required("THIRDWEB_SECRET_KEY"),
  sessionSecret: (): string => required("SESSION_SECRET"),
  spectrumProjectId: (): string => required("SPECTRUM_PROJECT_ID"),
  spectrumProjectSecret: (): string => required("SPECTRUM_PROJECT_SECRET"),
  spectrumWebhookSecret: (): string => required("SPECTRUM_WEBHOOK_SECRET"),
  agentmailApiKey: (): string => required("AGENTMAIL_API_KEY"),
  agentmailWebhookSecret: (): string => required("AGENTMAIL_WEBHOOK_SECRET"),
  agentEmailDomain: (): string =>
    optional("AGENT_EMAIL_DOMAIN", "agentmail.to"),
  composioApiKey: (): string => required("COMPOSIO_API_KEY"),
  miniappSigningKey: (): string => required("MINIAPP_SIGNING_KEY"),
  // Desktop pairing/device tokens. Defaults to the web session secret so the
  // desktop surface needs no new deploy config; set it to rotate desktop
  // credentials independently of web sessions.
  desktopSigningKey: (): string =>
    process.env.DESKTOP_SIGNING_KEY ?? required("SESSION_SECRET"),
  // Seals the box dashboard basic-auth password at rest (CM1 task 0 / CC10).
  // 64 hex chars (32 bytes). Optional until the creative plugin ships: when
  // unset, provisioning skips persisting the credential and the dashboard
  // proxy paths return 503.
  boxDashboardAuthKey: (): string | null =>
    process.env.BOX_DASHBOARD_AUTH_KEY ?? null,
  // Seals per-account ad platform API keys at rest (CM6). Defaults to the
  // dashboard auth key so the beta needs no extra deploy config; set it to
  // rotate ad credentials independently.
  adsVaultKey: (): string | null =>
    process.env.ADS_VAULT_KEY ?? process.env.BOX_DASHBOARD_AUTH_KEY ?? null,
  miniappOrigin: (): string =>
    optional("MINIAPP_ORIGIN", "https://mini.wzrd.tech"),
  operatorAllowlist: (): string[] =>
    optional("OPERATOR_ALLOWLIST", "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
};
