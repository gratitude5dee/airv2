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
  // The Omarchy template box (infra/template-omarchy — an ascii.dev box like
  // BOX_TEMPLATE_ID, forked the same way). Optional: without it — and without
  // a box_environment_templates pointer — the omarchy environment reports
  // itself unavailable instead of falling back to the Ubuntu template.
  omarchyTemplateId: (): string | null =>
    process.env["OMARCHY_TEMPLATE_ID"] ?? null,
  // Namespace (macos environment). The token is a tenant token
  // (`nsc token create`); without it the macos environment is disabled
  // and onboarding does not offer it.
  namespaceToken: (): string | null => process.env["NAMESPACE_TOKEN"] ?? null,
  namespaceComputeApi: (): string =>
    optional(
      "NAMESPACE_COMPUTE_API",
      `https://${optional("NAMESPACE_REGION", "us")}.compute.namespaceapis.com`,
    ),
  // IAM endpoint that issues ingress access tokens (authenticated-ingress
  // requests carry them in x-nsc-ingress-auth).
  namespaceIamApi: (): string =>
    optional("NAMESPACE_IAM_API", "https://iam.namespaceapis.com"),
  // Bootstrap script a fresh Mac curls on first boot (infra/template-macos).
  // The macos "template pointer" in box_environment_templates overrides it.
  macBootstrapUrl: (): string | null =>
    process.env["MAC_BOOTSTRAP_URL"] ?? null,
  // Support-disk image required by Namespace macOS applications. Must be a
  // registry image Namespace can unpack for the mac (a plain file layer in
  // the workspace's nscr.io registry — see infra/template-macos/UPGRADE.md);
  // Linux images like busybox leave the instance stuck/erroring.
  macBootstrapImage: (): string =>
    optional(
      "MAC_BOOTSTRAP_IMAGE",
      "nscr.io/nroeoinh9vg4q/air/mac-bootstrap:latest",
    ),
  adminApiKey: (): string => required("ADMIN_API_KEY"),
  appOrigin: (): string => optional("APP_ORIGIN", "https://app.wzrd.tech"),
  supabaseUrl: (): string => required("SUPABASE_URL"),
  supabaseServiceRoleKey: (): string => required("SUPABASE_SERVICE_ROLE_KEY"),
  modelProviderApiKey: (): string => required("MODEL_PROVIDER_API_KEY"),
  modelProviderBaseUrl: (): string => required("MODEL_PROVIDER_BASE_URL"),
  // OpenRouter serves every non-OpenAI model family (Ox Alpha, Inkling).
  // Defaults to the main model provider, so a single OpenRouter
  // MODEL_PROVIDER_* pair works for all families; set the OPENROUTER_* pair
  // to keep OpenAI on its native endpoint while the rest go to OpenRouter.
  openRouterBaseUrl: (): string =>
    process.env["OPENROUTER_BASE_URL"] ?? required("MODEL_PROVIDER_BASE_URL"),
  openRouterApiKey: (): string =>
    process.env["OPENROUTER_API_KEY"] ?? required("MODEL_PROVIDER_API_KEY"),
  // Venice (OpenAI-compatible, https://api.venice.ai/api/v1). The platform
  // key is optional: without it the Venice family only works for users who
  // saved a personal key in Settings.
  veniceBaseUrl: (): string =>
    optional("VENICE_BASE_URL", "https://api.venice.ai/api/v1"),
  veniceApiKey: (): string | null => process.env["VENICE_API_KEY"] ?? null,
  // Seals per-user provider API keys (Settings → provider keys) at rest.
  // A dedicated 64-hex key with no fallback: provider-key storage stays
  // disabled until it is set, and it rotates independently of every other
  // secret. Rotating it invalidates previously sealed keys.
  providerVaultKey: (): string | null => process.env["PROVIDER_VAULT_KEY"] || null,
  thirdwebSecretKey: (): string => required("THIRDWEB_SECRET_KEY"),
  // Speech-to-text (M13). Defaults to the main model provider; STT_* overrides
  // exist for providers with no audio endpoint (goal.md §5).
  sttBaseUrl: (): string =>
    process.env["STT_BASE_URL"] ?? required("MODEL_PROVIDER_BASE_URL"),
  sttApiKey: (): string =>
    process.env["STT_API_KEY"] ?? required("MODEL_PROVIDER_API_KEY"),
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
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
    ),
  sessionSecret: (): string => required("SESSION_SECRET"),
  spectrumProjectId: (): string => required("SPECTRUM_PROJECT_ID"),
  spectrumProjectSecret: (): string => required("SPECTRUM_PROJECT_SECRET"),
  spectrumWebhookSecret: (): string => required("SPECTRUM_WEBHOOK_SECRET"),
  // Mail provider cutover flag: AgentMail stays the default until the
  // wzrdmail staging validation passes (see lib/mail/provider.ts).
  mailProvider: (): "agentmail" | "wzrdmail" => {
    const value = optional("MAIL_PROVIDER", "agentmail");
    if (value !== "agentmail" && value !== "wzrdmail") {
      throw new Error(`MAIL_PROVIDER must be "agentmail" or "wzrdmail", got "${value}"`);
    }
    return value;
  },
  agentmailApiKey: (): string => required("AGENTMAIL_API_KEY"),
  agentmailWebhookSecret: (): string => required("AGENTMAIL_WEBHOOK_SECRET"),
  wzrdmailApiKey: (): string => required("WZRDMAIL_API_KEY"),
  wzrdmailBaseUrl: (): string =>
    optional("WZRDMAIL_BASE_URL", "https://api.wzrd.tech").replace(/\/+$/, ""),
  wzrdmailWebhookSecret: (): string => required("WZRDMAIL_WEBHOOK_SECRET"),
  wzrdmailMcpUrl: (): string =>
    optional("WZRDMAIL_MCP_URL", "https://mcp.mail.wzrd.tech/mcp"),
  agentEmailDomain: (): string =>
    optional(
      "AGENT_EMAIL_DOMAIN",
      optional("MAIL_PROVIDER", "agentmail") === "wzrdmail" ? "wzrd.tech" : "agentmail.to",
    ),
  composioApiKey: (): string => required("COMPOSIO_API_KEY"),
  // MasterKey (x402 service catalog + MCP). The partner secret is the
  // server-to-server credential the /api/mcp/masterkey proxy uses to mint
  // per-user MCP tokens; it never reaches a box or browser.
  masterkeyOrigin: (): string =>
    optional("MASTERKEY_ORIGIN", "https://masterkey.sh").replace(/\/+$/, ""),
  masterkeyPartnerSecret: (): string => required("MASTERKEY_PARTNER_SECRET"),
  // Hard ceiling on a single MasterKey run_service call, in USD.
  masterkeyPerCallMaxUsd: (): number => {
    const parsed = Number(optional("MASTERKEY_PER_CALL_MAX_USD", "5"));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 5;
  },
  miniappSigningKey: (): string => required("MINIAPP_SIGNING_KEY"),
  // Desktop pairing/device tokens. Defaults to the web session secret so the
  // desktop surface needs no new deploy config; set it to rotate desktop
  // credentials independently of web sessions.
  desktopSigningKey: (): string =>
    process.env["DESKTOP_SIGNING_KEY"] ?? required("SESSION_SECRET"),
  // Seals the box dashboard basic-auth password at rest (CM1 task 0 / CC10).
  // 64 hex chars (32 bytes). Optional until the creative plugin ships: when
  // unset, provisioning skips persisting the credential and the dashboard
  // proxy paths return 503.
  boxDashboardAuthKey: (): string | null =>
    process.env["BOX_DASHBOARD_AUTH_KEY"] ?? null,
  // Seals per-account ad platform API keys at rest (CM6). Defaults to the
  // dashboard auth key so the beta needs no extra deploy config; set it to
  // rotate ad credentials independently.
  adsVaultKey: (): string | null =>
    process.env["ADS_VAULT_KEY"] ?? process.env["BOX_DASHBOARD_AUTH_KEY"] ?? null,
  miniappOrigin: (): string =>
    optional("MINIAPP_ORIGIN", "https://mini.wzrd.tech"),
  // iMessage extension identity for full-screen mini-app cards. Defaults to
  // Photon/Spectrum's own published extension; override the IMESSAGE_* vars
  // only when shipping a first-party extension. IMESSAGE_APP_STORE_ID routes
  // recipients without the extension to its App Store entry.
  imessageMiniAppExtension: (): {
    appName: string;
    extensionBundleId: string;
    teamId: string;
    appStoreId?: number;
  } => {
    const appStoreId = Number.parseInt(
      optional("IMESSAGE_APP_STORE_ID", "6777616651"),
      10,
    );
    return {
      appName: optional("IMESSAGE_APP_NAME", "Spectrum"),
      extensionBundleId: optional(
        "IMESSAGE_EXTENSION_BUNDLE_ID",
        "codes.photon.Spectrum.MessagesExtension",
      ),
      teamId: optional("IMESSAGE_TEAM_ID", "P8XT6232SL"),
      ...(Number.isFinite(appStoreId) && appStoreId > 0 ? { appStoreId } : {}),
    };
  },
  // MA4 public media lane (R2). All three credentials must be present for the
  // lane to be configured; when absent every write path reports itself
  // unconfigured instead of failing the deploy. Keys are server-side only —
  // never per-box env, never a browser (C18).
  r2AccountId: (): string | null => process.env["R2_ACCOUNT_ID"] ?? null,
  r2AccessKeyId: (): string | null => process.env["R2_ACCESS_KEY_ID"] ?? null,
  r2SecretAccessKey: (): string | null =>
    process.env["R2_SECRET_ACCESS_KEY"] ?? null,
  r2Bucket: (): string => optional("R2_BUCKET", "air-media"),
  r2PublicBaseUrl: (): string =>
    optional("R2_PUBLIC_BASE_URL", "https://media.wzrd.tech"),
  operatorAllowlist: (): string[] =>
    optional("OPERATOR_ALLOWLIST", "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  // Per-user Daytona sandbox keys. The manager key (manage:api_keys +
  // sandbox scopes) is server-side only — never a box env. Both must be set
  // for the sandbox lane; when absent, provisioning injects no Daytona
  // credential and the lane stays disabled.
  daytonaManagerKey: (): string | null =>
    process.env["DAYTONA_MANAGER_KEY"] ?? null,
  daytonaOrganizationId: (): string | null =>
    process.env["DAYTONA_ORGANIZATION_ID"] ?? null,
  daytonaApiUrl: (): string =>
    optional("DAYTONA_API_URL", "https://app.daytona.io/api"),
  // M16 creative lane. Both provider keys are optional: with either absent
  // the lane reports itself unconfigured and preflight degrades gracefully
  // instead of failing the deploy.
  groqApiKey: (): string | null => process.env["GROQ_API_KEY"] ?? null,
  gmiCloudApiKey: (): string | null => process.env["GMI_CLOUD_API_KEY"] ?? null,
  // fal.ai renders the /zap lane (MiniMax H3 Max Turbo). Control-plane only: this
  // key is never handed to a box or a browser.
  falKey: (): string | null => process.env["FAL_KEY"] ?? null,
  // Direct HeyGen API key — used only to create per-user avatar IDs
  // (POST /v3/avatars); video rendering stays on the GMI queue.
  heygenApiKey: (): string | null => process.env["HEYGEN_API_KEY"] ?? null,
  heygenApiUrl: (): string =>
    optional("HEYGEN_API_URL", "https://api.heygen.com"),
  gmiOrganizationId: (): string | null =>
    process.env["GMI_ORGANIZATION_ID"] ?? null,
  gmiRequestQueueUrl: (): string =>
    optional(
      "GMI_REQUEST_QUEUE_URL",
      "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests",
    ),
  gmiMediaHosts: (): string[] =>
    optional("GMI_MEDIA_HOSTS", "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
  creativeMaxConcurrency: (): number => {
    const parsed = Number.parseInt(
      optional("CREATIVE_MAX_CONCURRENCY", "2"),
      10,
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
      10,
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
  cdpApiKeyId: (): string | null => process.env["CDP_API_KEY_ID"] ?? null,
  cdpApiKeySecret: (): string | null => process.env["CDP_API_KEY_SECRET"] ?? null,
  stripeSecretKey: (): string => required("STRIPE_SECRET_KEY"),
  // Publishable by definition (it renders in browser payloads) — served to
  // the hosted approval page for the Express Checkout Element. Optional:
  // without it the page simply offers the Checkout redirect instead.
  stripePublishableKey: (): string | null =>
    process.env["STRIPE_PUBLISHABLE_KEY"] ?? null,
  stripeWebhookSecret: (): string => required("STRIPE_WEBHOOK_SECRET"),
  // MA2.4 plugin sign-in. Hashes plugin bearer tokens at rest; defaults to
  // the web session secret so the beta needs no new deploy config.
  pluginTokenSigningKey: (): string =>
    process.env["PLUGIN_TOKEN_SIGNING_KEY"] ?? required("SESSION_SECRET"),
  // MA9.2 Onairos developer API key. Optional: absent = the connect step
  // reports itself unconfigured and the onboarding UI hides the button.
  // Never NEXT_PUBLIC_ (goal.md §5): the key is not baked into any client
  // bundle. The vendor web SDK requires client-side initializeApiKey, so
  // the key is delivered only inside the owner-authenticated onboarding
  // render (signed mini-session, per-user), not on any public surface.
  onairosApiKey: (): string | null => process.env["ONAIROS_API_KEY"] ?? null,
  // Google OAuth *web client ID* for the Onairos SDK's "Continue with
  // Google" (public identifier, not a secret). Must list the mini-app
  // origins as authorized JavaScript origins; without it the SDK falls
  // back to Onairos's own client ID, which rejects our origins.
  onairosGoogleClientId: (): string | null =>
    process.env["ONAIROS_GOOGLE_CLIENT_ID"] ?? null,
  // MA9.3 optional W&B Weave mirror — receipt METADATA only, never content
  // (C4). Off by default: with no key the mirror makes zero network calls.
  wandbApiKey: (): string | null => process.env["WANDB_API_KEY"] ?? null,
  wandbProject: (): string => optional("WANDB_PROJECT", "air-traces"),
  creativeCostCentsVideo: (): number => {
    const parsed = Number.parseInt(
      optional("CREATIVE_COST_CENTS_VIDEO", "25"),
      10,
    );
    return parsed >= 0 ? parsed : 25;
  },
};
