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
  // Speech-to-text (M13). Defaults to the main model provider; STT_* overrides
  // exist for providers with no audio endpoint (goal.md §5).
  sttBaseUrl: (): string =>
    process.env.STT_BASE_URL ?? required("MODEL_PROVIDER_BASE_URL"),
  sttApiKey: (): string =>
    process.env.STT_API_KEY ?? required("MODEL_PROVIDER_API_KEY"),
  sttModel: (): string => optional("STT_MODEL", "whisper-1"),
  sttCostCentsPerMin: (): number => {
    const parsed = Number(optional("STT_COST_CENTS_PER_MIN", "1"));
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : 1;
  },
  // Chain the wallet tab reads from (goal.md M15). Default: Base mainnet.
  walletChainId: (): number => {
    const parsed = Number.parseInt(optional("WALLET_CHAIN_ID", "8453"), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 8453;
  },
  // USDC contract for the wallet send lane. Default: Base mainnet USDC.
  walletUsdcAddress: (): string =>
    optional(
      "WALLET_USDC_ADDRESS",
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    ),
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
  // MA4 public media lane (R2). All three credentials must be present for the
  // lane to be configured; when absent every write path reports itself
  // unconfigured instead of failing the deploy. Keys are server-side only —
  // never per-box env, never a browser (C18).
  r2AccountId: (): string | null => process.env.R2_ACCOUNT_ID ?? null,
  r2AccessKeyId: (): string | null => process.env.R2_ACCESS_KEY_ID ?? null,
  r2SecretAccessKey: (): string | null =>
    process.env.R2_SECRET_ACCESS_KEY ?? null,
  r2Bucket: (): string => optional("R2_BUCKET", "air-media"),
  r2PublicBaseUrl: (): string =>
    optional("R2_PUBLIC_BASE_URL", "https://media.wzrd.tech"),
  operatorAllowlist: (): string[] =>
    optional("OPERATOR_ALLOWLIST", "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  // M16 creative lane. Both provider keys are optional: with either absent
  // the lane reports itself unconfigured and preflight degrades gracefully
  // instead of failing the deploy.
  groqApiKey: (): string | null => process.env.GROQ_API_KEY ?? null,
  gmiCloudApiKey: (): string | null => process.env.GMI_CLOUD_API_KEY ?? null,
  gmiOrganizationId: (): string | null =>
    process.env.GMI_ORGANIZATION_ID ?? null,
  gmiRequestQueueUrl: (): string =>
    optional(
      "GMI_REQUEST_QUEUE_URL",
      "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests"
    ),
  gmiMediaHosts: (): string[] =>
    optional("GMI_MEDIA_HOSTS", "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  creativeMaxConcurrency: (): number => {
    const parsed = Number.parseInt(
      optional("CREATIVE_MAX_CONCURRENCY", "2"),
      10
    );
    return Math.max(1, Math.min(4, parsed || 2));
  },
  creativeDailyLimit: (): number => {
    const parsed = Number.parseInt(optional("CREATIVE_DAILY_LIMIT", "20"), 10);
    return parsed > 0 ? parsed : 20;
  },
  creativeCostCentsImage: (): number => {
    const parsed = Number.parseInt(
      optional("CREATIVE_COST_CENTS_IMAGE", "5"),
      10
    );
    return parsed >= 0 ? parsed : 5;
  },
  // MA2 payments. The facilitator URL defaults to the Coinbase CDP
  // facilitator; CDP key id/secret are required for Base mainnet settlement
  // (the gate reports itself unconfigured without them rather than failing
  // the deploy).
  x402FacilitatorUrl: (): string =>
    optional("X402_FACILITATOR_URL", "https://x402.org/facilitator"),
  x402Network: (): string => optional("X402_NETWORK", "base"),
  cdpApiKeyId: (): string | null => process.env.CDP_API_KEY_ID ?? null,
  cdpApiKeySecret: (): string | null => process.env.CDP_API_KEY_SECRET ?? null,
  stripeSecretKey: (): string => required("STRIPE_SECRET_KEY"),
  stripeWebhookSecret: (): string => required("STRIPE_WEBHOOK_SECRET"),
  // MA2.4 plugin sign-in. Hashes plugin bearer tokens at rest; defaults to
  // the web session secret so the beta needs no new deploy config.
  pluginTokenSigningKey: (): string =>
    process.env.PLUGIN_TOKEN_SIGNING_KEY ?? required("SESSION_SECRET"),
  // MA9.2 Onairos developer API key. Optional: absent = the connect step
  // reports itself unconfigured and the onboarding UI hides the button. The
  // key is server-side only (goal.md §5) — how the client SDK gets
  // initialized is a product decision, never NEXT_PUBLIC_.
  onairosApiKey: (): string | null => process.env.ONAIROS_API_KEY ?? null,
  // MA9.3 optional W&B Weave mirror — receipt METADATA only, never content
  // (C4). Off by default: with no key the mirror makes zero network calls.
  wandbApiKey: (): string | null => process.env.WANDB_API_KEY ?? null,
  wandbProject: (): string => optional("WANDB_PROJECT", "air-traces"),
  creativeCostCentsVideo: (): number => {
    const parsed = Number.parseInt(
      optional("CREATIVE_COST_CENTS_VIDEO", "25"),
      10
    );
    return parsed >= 0 ? parsed : 25;
  },
};
