/**
 * Server-side environment access (goal.md §5). Nothing here is ever
 * NEXT_PUBLIC_; importing this module from client code is a bug.
 */
import { z } from "zod";

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

/**
 * R-ARCH-02: the env manifest — every variable the server knows, split by
 * whether a production boot may proceed without it. `required` here is
 * deliberately conservative: a variable is required only where a lazy
 * accessor below already throws when it is missing.
 */
export const REQUIRED_ENV = [
  "ADMIN_API_KEY",
  "AGENTMAIL_API_KEY",
  "AGENTMAIL_WEBHOOK_SECRET",
  "BOX_API_KEY",
  "BOX_TEMPLATE_ID",
  "COMPOSIO_API_KEY",
  "MASTERKEY_PARTNER_SECRET",
  "MINIAPP_SIGNING_KEY",
  "SESSION_SECRET",
  "SPECTRUM_PROJECT_ID",
  "SPECTRUM_PROJECT_SECRET",
  "SPECTRUM_WEBHOOK_SECRET",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_URL",
  "TENKI_API_KEY",
  "THIRDWEB_SECRET_KEY",
  "WZRDMAIL_API_KEY",
  "WZRDMAIL_WEBHOOK_SECRET",
] as const;

/** Accessors that fall back across a small set of names are satisfied by
 * ANY member — e.g. STT_API_KEY and OPENROUTER_API_KEY both fall back to
 * MODEL_PROVIDER_API_KEY, so requiring each member would over-ask. */
export const REQUIRED_GROUPS: readonly (readonly [string, ...string[]])[] = [
  ["MODEL_PROVIDER_API_KEY", "OPENROUTER_API_KEY", "STT_API_KEY"],
  ["MODEL_PROVIDER_BASE_URL", "OPENROUTER_BASE_URL", "STT_BASE_URL"],
];

/** Recognized but optional at boot everywhere — the lazy accessor supplies
 * its own default or failure mode. NEXT_PUBLIC_ vars are deliberately not
 * here: they are build-time client values, not server env. */
export const OPTIONAL_ENV = [
  "ADS_VAULT_KEY",
  "AI_GATEWAY_API_KEY",
  "AI_GATEWAY_BASE",
  "APPS_ORIGIN_SUFFIX",
  "APP_ORIGIN",
  "APP_ORIGIN_SIGNING_KEY",
  "BOX_API_BASE",
  "BOX_DASHBOARD_AUTH_KEY",
  "BOX_READY_TIMEOUT_MS",
  "CDP_API_KEY_ID",
  "CDP_API_KEY_SECRET",
  "CF_DISPATCH_NAMESPACE",
  "CF_MANIFEST_KV_ID",
  "CF_RUNTIME_KV_ID",
  "CLOUDFLARE_ACCOUNT_ID",
  "CLOUDFLARE_API_TOKEN",
  "COMMAND_LANE_KEY",
  "CREATE_BRIDGE_SECRET",
  "CREATE_FUNCTIONS_ENABLED",
  "CREATE_JOBS_ORIGIN",
  "CREATE_V13_USER_IDS",
  "CREATIVE_COST_CENTS_IMAGE",
  "CREATIVE_COST_CENTS_VIDEO",
  "CREATIVE_DAILY_LIMIT",
  "CREATIVE_MAX_CONCURRENCY",
  "CREATIVE_UNLIMITED_USER_IDS",
  "CRON_SECRET",
  "DAYTONA_API_URL",
  "DAYTONA_MANAGER_KEY",
  "DAYTONA_ORGANIZATION_ID",
  "DESKTOP_SIGNING_KEY",
  "ELEVENLABS_API_KEY",
  "ELEVENLABS_API_URL",
  "ELEVENLABS_TTS_MODEL",
  "FAL_KEY",
  "FAL_TWIN_LIPSYNC_MODEL",
  "GATEWAY_MODEL_FAMILY_OVERRIDE",
  "GITHUB_API_BASE",
  "GITHUB_APP_ID",
  "GITHUB_APP_PRIVATE_KEY",
  "GITHUB_APP_SLUG",
  "GITHUB_APP_WEBHOOK_SECRET",
  "GITHUB_OIDC_AUDIENCE",
  "GITHUB_STATE_SIGNING_KEY",
  "GMI_BALANCED_MODEL",
  "GMI_CLOUD_API_KEY",
  "GMI_DEEP_MODEL",
  "GMI_FAST_MODEL",
  "GMI_GLM_EFFORT",
  "GMI_INFERENCE_BASE_URL",
  "GMI_MEDIA_HOSTS",
  "GMI_ORGANIZATION_ID",
  "GMI_ROUTINE_FAST",
  "GROQ_API_KEY",
  "HEYGEN_API_KEY",
  "HEYGEN_API_URL",
  "IMESSAGE_APP_NAME",
  "IMESSAGE_APP_STORE_ID",
  "IMESSAGE_TEAM_ID",
  "KERNEL_API_BASE",
  "KERNEL_API_KEY",
  "KERNEL_ENABLED",
  "KERNEL_VAULTS_ENABLED",
  "KIT_DIR",
  "KIT_RESTRICTED_SHA256",
  "KIT_RESTRICTED_VERSION",
  "KIT_SCRATCH_DIR",
  "LINKAPP_ORIGIN",
  "LINK_AGENT_PAYMENTS_ENABLED",
  "LINK_HOST_ENABLED",
  "LIVE_TOKEN_SECRET",
  "MAC_BOOTSTRAP_IMAGE",
  "MAC_BOOTSTRAP_URL",
  "MAIL_PROVIDER",
  "MASTERKEY_ORIGIN",
  "MASTERKEY_PER_CALL_MAX_USD",
  "MIGRATION_CUTOVER_DEADLINE_MS",
  "MIGRATION_DRAIN_BUDGET_MS",
  "MIGRATION_DRIVE_LEASE_SECONDS",
  "MIGRATION_ENABLED",
  "MIGRATION_OBSERVE_MS",
  "MIGRATION_PRECOPY_PASSES",
  "MIGRATION_RETAIN_MS",
  "MIGRATION_SEAL_KEY",
  "MINIAPP_ORIGIN",
  "MODEL_BALANCED",
  "MODEL_CREATE_BALANCED",
  "MODEL_CREATE_DEEP",
  "MODEL_CREATE_FAST",
  "MODEL_DEEP",
  "MODEL_FAST",
  "MODEL_LABEL_BALANCED",
  "MODEL_LABEL_DEEP",
  "MODEL_LABEL_FAST",
  "MODEL_PROVIDER_API_KEY",
  "MODEL_PROVIDER_BASE_URL",
  "MODEL_REASONING_BALANCED",
  "MODEL_REASONING_DEEP",
  "MODEL_REASONING_FAST",
  "MODEL_SERVICE_TIER_BALANCED",
  "MODEL_SERVICE_TIER_DEEP",
  "MODEL_SERVICE_TIER_FAST",
  "MUSE_ENABLED",
  "MUSE_INTERNAL_TOKEN",
  "MUSE_MODE_TTL_MINUTES",
  "MUSE_ORIGIN",
  "MUSE_RUN_DAILY_USD",
  "MUSE_RUN_MAX_USD",
  "MUSE_UPDATES_ALERT_CAP",
  "MUSE_UPDATES_DAILY_CAP",
  "MUSE_WORKER_TOKEN",
  "NAMESPACE_IAM_API",
  "NAMESPACE_REGION",
  "NAMESPACE_TOKEN",
  "OMARCHY_TEMPLATE_ID",
  "ONAIROS_API_KEY",
  "ONAIROS_GOOGLE_CLIENT_ID",
  "OPENROUTER_API_KEY",
  "OPENROUTER_BASE_URL",
  "OPERATOR_ALLOWLIST",
  "PLUGIN_TOKEN_SIGNING_KEY",
  "PROVIDER_VAULT_KEY",
  "PUBLISH_KILL_SWITCH",
  "PUBLISH_TIKTOK",
  "R2_ACCESS_KEY_ID",
  "R2_ACCOUNT_ID",
  "R2_BUCKET",
  "R2_PUBLIC_BASE_URL",
  "R2_SECRET_ACCESS_KEY",
  "SHOPPING_DRY_RUN_HOSTS",
  "SPECTRUM_API_BASE",
  "SPECTRUM_IMESSAGE_ADDRESS",
  "STRIPE_LINK_ENABLED",
  "STRIPE_LINK_HOSTS",
  "STRIPE_PUBLISHABLE_KEY",
  "STT_API_KEY",
  "STT_BASE_URL",
  "STT_COST_CENTS_PER_MIN",
  "STT_MODEL",
  "TENKI_API_ENDPOINT",
  "TENKI_API_URL",
  "TENKI_TEMPLATE_ID",
  "TRADE_ALLOWLIST",
  "TRADE_LIVE_ENABLED",
  "TRADE_PREVIEW_SIGNING_KEY",
  "TYPESAFE_API_BASE",
  "TYPESAFE_API_KEY",
  "VENICE_API_KEY",
  "VENICE_BASE_URL",
  "VERCEL_DEPLOYMENT_CREATED_AT",
  "VERCEL_GIT_COMMIT_SHA",
  "VERCEL_OIDC_TOKEN",
  "VERCEL_REGION",
  "WALLET_CHAIN_ID",
  "WANDB_API_KEY",
  "WANDB_PROJECT",
  "WZRDMAIL_BASE_URL",
  "WZRDMAIL_MCP_URL",
  "WZRD_CREATE_INSTALLATION_ID",
  "X402_FACILITATOR_URL",
  "X402_NETWORK",
] as const;

export type EnvName =
  | (typeof REQUIRED_ENV)[number]
  | (typeof OPTIONAL_ENV)[number];

/**
 * The one env schema — every variable with its requiredness for a
 * production boot. Unknown process vars pass through; `""` on a required
 * name counts as missing, matching `required()`.
 */
export const envSchema = z
  .object(
    Object.fromEntries([
      ...REQUIRED_ENV.map((name) => [name, z.string().min(1)]),
      ...OPTIONAL_ENV.map((name) => [name, z.string().optional()]),
    ])
  )
  .passthrough()
  .superRefine((value, ctx) => {
    for (const group of REQUIRED_GROUPS) {
      if (!group.some((name) => value[name])) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `one of ${group.join(" / ")} required`,
          path: [group[0]],
        });
      }
    }
  });

/**
 * Boot-time check, invoked once from instrumentation.ts: a production boot
 * refuses to come up when a required variable is missing — the alternative
 * is discovering it at request time. Development and test warn but boot —
 * an optional-secret dev box must still start.
 */
export function validateEnv(
  source: NodeJS.ProcessEnv = process.env,
  environment: string = source["NODE_ENV"] ?? "development"
): void {
  const parsed = envSchema.safeParse(source);
  if (parsed.success) return;
  const problems = [
    ...new Set(
      parsed.error.issues.map((issue) =>
        issue.code === z.ZodIssueCode.custom
          ? issue.message
          : String(issue.path[0] ?? "")
      )
    ),
  ];
  const message = `Missing required env var(s): ${problems.join(", ")}`;
  if (environment === "production") throw new Error(message);
  console.warn(`[env] ${message} — continuing (${environment})`);
}

export const env = {
  boxApiKey: (): string => required("BOX_API_KEY"),
  boxApiBase: (): string =>
    optional("BOX_API_BASE", "https://ascii.dev/api/box/v1"),
  boxTemplateId: (): string => required("BOX_TEMPLATE_ID"),
  // How long fork/resume waits for an ascii.dev box to report ready/idle.
  // Forks of an archived template restore from cold storage and have taken
  // over four minutes; a deployment can raise this up to its route budget.
  boxReadyTimeoutMs: (): number => {
    const parsed = Number(optional("BOX_READY_TIMEOUT_MS", "240000"));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 240_000;
  },
  // The Omarchy template box (infra/template-omarchy — an ascii.dev box like
  // BOX_TEMPLATE_ID, forked the same way). Optional: without it — and without
  // a box_environment_templates pointer — the omarchy environment reports
  // itself unavailable instead of falling back to the Ubuntu template.
  omarchyTemplateId: (): string | null =>
    process.env["OMARCHY_TEMPLATE_ID"] ?? null,
  // Tenki Sandbox (opt-in second Linux provider, lib/box/tenki.ts). The key
  // is workspace-scoped; the template is a Tenki snapshot of the Ubuntu
  // template built by apps/web/scripts/tenki-template.mjs, stored as a
  // `tenki:<snapshot id>` ref so the provider is visible in the pointer.
  tenkiApiKey: (): string => required("TENKI_API_KEY"),
  tenkiTemplateId: (): string | null =>
    process.env["TENKI_TEMPLATE_ID"] ?? null,
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
  // OpenRouter serves its non-OpenAI model families (Ox Alpha, Inkling).
  // Defaults to the main model provider, so a single OpenRouter
  // MODEL_PROVIDER_* pair works for all families; set the OPENROUTER_* pair
  // to keep OpenAI on its native endpoint while those families go to OpenRouter.
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
  // GMI Cloud's OpenAI-compatible inference endpoint. The platform key is
  // optional: without it the MiniMax families only work for users who saved
  // a personal key in Settings.
  gmiInferenceBaseUrl: (): string =>
    optional("GMI_INFERENCE_BASE_URL", "https://api.gmi-serving.com/v1"),
  // Seals per-user provider API keys (Settings → provider keys) at rest.
  // A dedicated 64-hex key with no fallback: provider-key storage stays
  // disabled until it is set, and it rotates independently of every other
  // secret. Rotating it invalidates previously sealed keys.
  providerVaultKey: (): string | null => process.env["PROVIDER_VAULT_KEY"] || null,
  // TypeSafe's System One endpoint + key for the Jev turn router
  // (lib/jev). Optional: without the key every chat turn goes unrouted,
  // exactly as before.
  typesafeApiBase: (): string =>
    optional("TYPESAFE_API_BASE", "https://api.typesafe.ai"),
  typesafeApiKey: (): string | null => process.env["TYPESAFE_API_KEY"] ?? null,
  aiGatewayBase: (): string =>
    optional("AI_GATEWAY_BASE", "https://ai-gateway.vercel.sh/v4/ai"),
  /** Vercel AI Gateway credential: an AI_GATEWAY_API_KEY, or the OIDC token
   * Vercel injects into functions when OIDC federation is enabled. `||` so a
   * set-but-empty key can't shadow the OIDC token. */
  aiGatewayApiKey: (): string | null =>
    process.env["AI_GATEWAY_API_KEY"] ||
    process.env["VERCEL_OIDC_TOKEN"] ||
    null,
  // Trade (docs/trade/plan.md). The preview-token HMAC key defaults to the
  // mini-app signing key — a different use-prefix separates the domains. Set
  // TRADE_PREVIEW_SIGNING_KEY to rotate preview authority independently of
  // mini-app sessions.
  tradePreviewSigningKey: (): string =>
    process.env["TRADE_PREVIEW_SIGNING_KEY"] ?? required("MINIAPP_SIGNING_KEY"),
  // Kill switch for live orders: paper mode always works; venue submits
  // refuse unless explicitly enabled.
  tradeLiveEnabled: (): boolean =>
    optional("TRADE_LIVE_ENABLED", "false") === "true",
  // Optional user-id allowlist for live trading (comma-separated). Empty =
  // every owner can connect and trade once live is enabled.
  tradeAllowlist: (): string[] =>
    optional("TRADE_ALLOWLIST", "")
      .split(",")
      .map((entry) => entry.trim())
      .filter(Boolean),
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
  spectrumApiBase: (): string =>
    optional("SPECTRUM_API_BASE", "https://spectrum.photon.codes").replace(/\/+$/, ""),
  // Mail provider: wzrdmail is the deployment default; AGENTMAIL_* stays for rollback (see lib/mail/provider.ts).
  mailProvider: (): "agentmail" | "wzrdmail" => {
    const value = optional("MAIL_PROVIDER", "wzrdmail");
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
      optional("MAIL_PROVIDER", "wzrdmail") === "wzrdmail" ? "wzrd.tech" : "agentmail.to",
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
  // Compute migrations (Box <-> Tenki). Disabled by default: the schema and
  // gating ship dark, and prepare/cutover refuse until enabled.
  migrationEnabled: (): boolean =>
    process.env["MIGRATION_ENABLED"] === "true",
  // Seals the per-migration credential envelope on migration_targets — the
  // same secretbox pattern as the dashboard auth key (64 hex chars).
  // Defaults to the dashboard auth key so rollout needs no extra secret.
  migrationSealKey: (): string | null =>
    process.env["MIGRATION_SEAL_KEY"] ??
    process.env["BOX_DASHBOARD_AUTH_KEY"] ??
    null,
  // Work-pause deadline for the cutover attempt (plan §1: 120s default).
  migrationCutoverDeadlineMs: (): number =>
    Number(optional("MIGRATION_CUTOVER_DEADLINE_MS", "120000")),
  // How long the drain step waits for admitted operations to finish before
  // the attempt aborts and reopens admission.
  migrationDrainBudgetMs: (): number =>
    Number(optional("MIGRATION_DRAIN_BUDGET_MS", "90000")),
  // Post-activation observe window before the retained source is stopped.
  migrationObserveMs: (): number =>
    Number(optional("MIGRATION_OBSERVE_MS", "900000")),
  // How long the stopped, fenced retained source lives before cleanup may
  // delete it (plan §7: 24h default; deletion also needs operator approval).
  migrationRetainMs: (): number =>
    Number(optional("MIGRATION_RETAIN_MS", "86400000")),
  // Bounded live-copy passes before the final quiesced pass.
  migrationPrecopyPasses: (): number =>
    Number(optional("MIGRATION_PRECOPY_PASSES", "3")),
  // Drive-lease TTL for the migration worker claim.
  migrationDriveLeaseSeconds: (): number =>
    Number(optional("MIGRATION_DRIVE_LEASE_SECONDS", "600")),
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
  // V11 Create: per-app origins and Functions (docs/goal-create-v11.md §14.3).
  // Two origins, two keys — the app-origin key never mints a mini-origin
  // token and vice versa. Cloudflare credentials are server-side only, read
  // exclusively by lib/functions/cloudflare.ts (CR6, C18). Any nullable
  // accessor returning null means "lane unconfigured": new publishes stay on
  // the legacy R2 lane and the loader never hands off.
  appOriginSigningKey: (): string | null =>
    process.env["APP_ORIGIN_SIGNING_KEY"] ?? null,
  appsOriginSuffix: (): string =>
    optional("APPS_ORIGIN_SUFFIX", "apps.wzrd.tech"),
  cloudflareAccountId: (): string | null =>
    process.env["CLOUDFLARE_ACCOUNT_ID"] ?? null,
  cloudflareApiToken: (): string | null =>
    process.env["CLOUDFLARE_API_TOKEN"] ?? null,
  cfDispatchNamespace: (): string =>
    optional("CF_DISPATCH_NAMESPACE", "air-apps"),
  cfManifestKvId: (): string | null => process.env["CF_MANIFEST_KV_ID"] ?? null,
  /** The Outbound Worker's KV: runtime tokens by opaque reference (§11.3). */
  cfRuntimeKvId: (): string | null => process.env["CF_RUNTIME_KV_ID"] ?? null,
  cfDispatchHealthUrl: (): string =>
    optional(
      "CF_DISPATCH_HEALTH_URL",
      "https://dispatch.apps.wzrd.tech/__air/health"
    ),
  createFunctionsEnabled: (): boolean =>
    optional("CREATE_FUNCTIONS_ENABLED", "false") === "true",
  // V13 Create job lane (docs/goal-create-v13.md §11.2). The bridge secret
  // signs every Vercel ↔ Cloudflare call (CF1); the live-token secret mints
  // the 10-minute progress-socket tokens the OwnerRoom verifies (§5.3).
  // Both are server-side only. A null means the V13 lane is unconfigured
  // and /api/create/go reports it instead of failing mid-build (CF8).
  createBridgeSecret: (): string | null =>
    process.env["CREATE_BRIDGE_SECRET"] ?? null,
  liveTokenSecret: (): string | null =>
    process.env["LIVE_TOKEN_SECRET"] ?? null,
  /** Origin of the air-create Worker the Workflow and OwnerRoom live behind. */
  createJobsOrigin: (): string =>
    optional("CREATE_JOBS_ORIGIN", "https://create.wzrd.tech"),
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
  // ElevenLabs — Instant Voice Clone + speech for the digital twin. Optional:
  // without the key the voice step reports itself unconfigured. Control-plane
  // only; the key never reaches a box or a browser (C2).
  elevenlabsApiKey: (): string | null =>
    process.env["ELEVENLABS_API_KEY"] || null,
  elevenlabsApiUrl: (): string =>
    optional("ELEVENLABS_API_URL", "https://api.elevenlabs.io"),
  elevenlabsTtsModel: (): string =>
    optional("ELEVENLABS_TTS_MODEL", "eleven_multilingual_v2"),
  // fal endpoint that lip-syncs the twin's profile image to speech — one
  // place to bump when the provider renames it.
  falTwinLipsyncModel: (): string =>
    optional("FAL_TWIN_LIPSYNC_MODEL", "minimax/h3-max/lip-sync/image-to-video"),
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
  /** Operator-owned UUID allowlist for accounts whose creative jobs are not
   * subject to the shared daily cap. Never sourced from a user request. */
  creativeUnlimitedUserIds: (): ReadonlySet<string> =>
    new Set(
      optional("CREATIVE_UNLIMITED_USER_IDS", "")
        .split(",")
        .map((id) => id.trim())
        .filter(Boolean)
    ),
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
  // Air × Muse stays dark until the control plane and Worker share their
  // server-to-server credentials. These values are deliberately nullable so
  // an ordinary web deploy does not accidentally expose a half-configured
  // connector.
  museEnabled: (): boolean => optional("MUSE_ENABLED", "false") === "true",
  museOrigin: (): string =>
    optional("MUSE_ORIGIN", "https://muse.wzrd.tech").replace(/\/+$/, ""),
  museWorkerToken: (): string | null => process.env["MUSE_WORKER_TOKEN"] ?? null,
  museInternalToken: (): string | null => process.env["MUSE_INTERNAL_TOKEN"] ?? null,
  museUpdatesDailyCap: (): number => {
    const parsed = Number.parseInt(optional("MUSE_UPDATES_DAILY_CAP", "30"), 10);
    return Number.isFinite(parsed) ? Math.min(120, Math.max(0, parsed)) : 30;
  },
  museUpdatesAlertCap: (): number => {
    const parsed = Number.parseInt(optional("MUSE_UPDATES_ALERT_CAP", "6"), 10);
    return Number.isFinite(parsed) ? Math.min(120, Math.max(0, parsed)) : 6;
  },
  museModeTtlMinutes: (): number => {
    const parsed = Number.parseInt(optional("MUSE_MODE_TTL_MINUTES", "30"), 10);
    return Number.isFinite(parsed) ? Math.min(24 * 60, Math.max(1, parsed)) : 30;
  },
  // Admission headroom for work Muse asks the owner's Box to perform. The
  // inference gateway remains the metering authority; these bounds stop a
  // Muse relay loop from admitting work beyond the owner's Air plan.
  museRunMaxUsd: (): number => {
    const parsed = Number(optional("MUSE_RUN_MAX_USD", "0.50"));
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(10, parsed) : 0.5;
  },
  museRunDailyUsd: (): number => {
    const parsed = Number(optional("MUSE_RUN_DAILY_USD", "5"));
    return Number.isFinite(parsed) && parsed > 0 ? Math.min(100, parsed) : 5;
  },
  // V11 MC7 Import: the WZRD Tech Inc GitHub App. All optional — absent
  // means the Import lane reports itself unconfigured and /create hides
  // "Connect GitHub". The private key is PEM (newlines may be escaped as
  // \n); it signs 10-minute App JWTs and never leaves this process.
  githubAppId: (): string | null => process.env["GITHUB_APP_ID"] ?? null,
  githubAppSlug: (): string | null => process.env["GITHUB_APP_SLUG"] ?? null,
  githubAppPrivateKey: (): string | null => {
    const raw = process.env["GITHUB_APP_PRIVATE_KEY"];
    return raw ? raw.replace(/\\n/g, "\n") : null;
  },
  githubAppWebhookSecret: (): string | null =>
    process.env["GITHUB_APP_WEBHOOK_SECRET"] ?? null,
  githubApiBase: (): string =>
    optional("GITHUB_API_BASE", "https://api.github.com"),
  /** Signs the connect→setup state round trip; defaults to the session secret. */
  githubStateSigningKey: (): string =>
    process.env["GITHUB_STATE_SIGNING_KEY"] ?? required("SESSION_SECRET"),
  /** The `aud` a repo's Actions OIDC token must carry to push to /api/create/push. */
  githubOidcAudience: (): string =>
    optional("GITHUB_OIDC_AUDIENCE", "wzrd-create"),
  // Kernel cloud browsers + vaults (docs/plans/kernel-shop-commerce-swe2.md).
  // All optional: with KERNEL_ENABLED unset/false every Kernel lane reports
  // itself unconfigured and fails closed, and the key never leaves the
  // control plane (C26) — it is never NEXT_PUBLIC_, never written to a box,
  // and never sent to any Kernel host other than kernelApiBase.
  kernelApiKey: (): string | null => process.env["KERNEL_API_KEY"] ?? null,
  kernelApiBase: (): string =>
    optional("KERNEL_API_BASE", "https://api.onkernel.com"),
  kernelEnabled: (): boolean => optional("KERNEL_ENABLED", "false") === "true",
  kernelVaultsEnabled: (): boolean =>
    optional("KERNEL_VAULTS_ENABLED", "false") === "true",
  // Link host: link.wzrd.tech/<slug> serves public product payment
  // pages (Phase 4). Flag-gated like the Kernel lanes.
  linkappOrigin: (): string =>
    optional("LINKAPP_ORIGIN", "https://link.wzrd.tech").replace(/\/+$/, ""),
  linkHostEnabled: (): boolean =>
    optional("LINK_HOST_ENABLED", "false") === "true",
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

  // R-ARCH-02: accessors for the reads that bypassed this module. Same
  // lazy-accessor contract — tests stub process.env per test.
  // The scheduler's bearer secret. Optional like the other worker tokens:
  // a deployment without cron jobs has nothing to protect, and an unset
  // secret fails closed (no token can equal it).
  cronSecret: (): string | null => process.env["CRON_SECRET"] ?? null,
  // Vercel platform metadata for the deployments report.
  vercelGitCommitSha: (): string | null =>
    process.env["VERCEL_GIT_COMMIT_SHA"] ?? null,
  vercelDeploymentCreatedAt: (): string | null =>
    process.env["VERCEL_DEPLOYMENT_CREATED_AT"] ?? null,
  vercelRegion: (): string | null => process.env["VERCEL_REGION"] ?? null,
  // GMI "routine" fast lane can be pinned off at the gateway.
  gmiRoutineFast: (): string | null => process.env["GMI_ROUTINE_FAST"] ?? null,
  gatewayModelFamilyOverride: (): string | null =>
    process.env["GATEWAY_MODEL_FAMILY_OVERRIDE"] ?? null,
  // Tenki's API origin — TENKI_API_ENDPOINT wins over the older TENKI_API_URL.
  tenkiApiBase: (): string =>
    process.env["TENKI_API_ENDPOINT"] ||
    process.env["TENKI_API_URL"] ||
    "https://api.tenki.cloud",
  // Create Kit location + restricted-build pins.
  kitDir: (): string | null => process.env["KIT_DIR"] ?? null,
  kitScratchDir: (): string | null => process.env["KIT_SCRATCH_DIR"] ?? null,
  kitRestrictedVersion: (): string | null =>
    process.env["KIT_RESTRICTED_VERSION"] ?? null,
  kitRestrictedSha256: (): string | null =>
    process.env["KIT_RESTRICTED_SHA256"] ?? null,
  // The box's shared command-lane key. Optional: the lane degrades to
  // unauthenticated-local behavior without it (R-SEC-09 tracks hardening).
  commandLaneKey: (): string | null => process.env["COMMAND_LANE_KEY"] ?? null,
  stripeLinkEnabled: (): boolean =>
    process.env["STRIPE_LINK_ENABLED"] === "1",
  stripeLinkHosts: (): string => optional("STRIPE_LINK_HOSTS", ""),
  linkAgentPaymentsEnabled: (): boolean =>
    process.env["LINK_AGENT_PAYMENTS_ENABLED"] === "true",
  publishTiktokEnabled: (): boolean => process.env["PUBLISH_TIKTOK"] === "1",
  publishKillSwitch: (): boolean => process.env["PUBLISH_KILL_SWITCH"] === "1",
  spectrumImessageAddress: (): string | null =>
    process.env["SPECTRUM_IMESSAGE_ADDRESS"] ?? null,
  shoppingDryRunHosts: (): string => optional("SHOPPING_DRY_RUN_HOSTS", ""),
  // Per-tier model pins (lib/entitlements/models.ts): ops re-pins without a
  // deploy; unset means the compiled default.
  gmiFastModel: (): string | undefined => process.env["GMI_FAST_MODEL"],
  gmiBalancedModel: (): string | undefined => process.env["GMI_BALANCED_MODEL"],
  gmiDeepModel: (): string | undefined => process.env["GMI_DEEP_MODEL"],
  gmiGlmEffort: (): string => optional("GMI_GLM_EFFORT", "low"),
  modelFast: (): string | undefined => process.env["MODEL_FAST"],
  modelBalanced: (): string | undefined => process.env["MODEL_BALANCED"],
  modelDeep: (): string | undefined => process.env["MODEL_DEEP"],
  modelReasoningFast: (): string =>
    optional("MODEL_REASONING_FAST", "xhigh"),
  modelReasoningBalanced: (): string | undefined =>
    process.env["MODEL_REASONING_BALANCED"],
  modelReasoningDeep: (): string | undefined =>
    process.env["MODEL_REASONING_DEEP"],
  modelServiceTierFast: (): string | undefined =>
    process.env["MODEL_SERVICE_TIER_FAST"],
  modelServiceTierBalanced: (): string | undefined =>
    process.env["MODEL_SERVICE_TIER_BALANCED"],
  modelServiceTierDeep: (): string | undefined =>
    process.env["MODEL_SERVICE_TIER_DEEP"],
  modelCreateFast: (): string | undefined => process.env["MODEL_CREATE_FAST"],
  modelCreateBalanced: (): string | undefined =>
    process.env["MODEL_CREATE_BALANCED"],
  modelCreateDeep: (): string | undefined => process.env["MODEL_CREATE_DEEP"],
  modelLabelFast: (): string | undefined => process.env["MODEL_LABEL_FAST"],
  modelLabelBalanced: (): string | undefined =>
    process.env["MODEL_LABEL_BALANCED"],
  modelLabelDeep: (): string | undefined => process.env["MODEL_LABEL_DEEP"],
};
