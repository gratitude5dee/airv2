# airv2 environment template (names only, no values)

This is the committed template for the gitignored values file `apps/web/.env.airv2.md`.
It is the single source of truth for every environment value of the `airv2-app` Cloudflare
Worker, secrets included. The spec is `docs/specs/cloudflare-migration.md` (R-CF-01).

## How to use

1. Copy this file to `apps/web/.env.airv2.md`. The root `.gitignore` already ignores it; never commit it.
2. Fill in values inside the ```dotenv fences. Use double quotes for multi-line values such as PEM keys.
3. Run `npm run cf:env -- check` to validate against `lib/env.ts` (REQUIRED_ENV, REQUIRED_GROUPS, OPTIONAL_ENV).
4. Run `npm run cf:env -- push`. This packs the values into `AIR_ENV_00..07` + `AIR_ENV_DIGEST` and uploads them with `wrangler secret bulk`.

Do not rename the values file to `.env`, `.env.local`, `.env.production` or `.env.production.local`.
OpenNext inlines those files into the deployed bundle in plain text.

## Rules

- **Section** decides how a value ships:
  - `## secret` and `## plain` values are packed into Worker secrets.
  - `## public` values (`NEXT_PUBLIC_*` only) are build-time GitHub repository variables, inlined into the client bundle.
  - `## secret @<worker>` sections are for side workers, such as `air-sidecar`.
- **Optional values:** leave a value empty to omit it. The accessor in `lib/env.ts` then uses its default.
- **Tags:**
  - `required`: production boot fails without it (`validateEnv`).
  - `at least one of`: a REQUIRED_GROUPS member; set at least one of the group.
  - `unmanifested`: read by code but missing from the `lib/env.ts` manifest. R-CF-01 adds it.
  - `R-CF-NN`: introduced by the migration spec.
- **Vercel-injected** names are listed at the end for completeness. Do not set them on Cloudflare.

Counts at generation (2026-10-27, from `lib/env.ts` and `lib/create/config.ts`):
- 217 server names: 56 secret, 157 plain, 4 Vercel-injected.
- 27 of them are unmanifested.
- 6 more are added by the spec, plus 1 public build-time name.

## secret

```dotenv
# required (lib/env.ts:338)
ADMIN_API_KEY=
# optional (lib/env.ts:559)
ADS_VAULT_KEY=
# required (lib/env.ts:463)
AGENTMAIL_API_KEY=
# required (lib/env.ts:464)
AGENTMAIL_WEBHOOK_SECRET=
# optional (lib/env.ts:396)
AI_GATEWAY_API_KEY=
# optional (lib/env.ts:604)
APP_ORIGIN_SIGNING_KEY=
# required (lib/env.ts:288)
BOX_API_KEY=
# optional (lib/env.ts:523)
BOX_DASHBOARD_AUTH_KEY=
# optional (lib/env.ts:727)
CDP_API_KEY_ID=
# optional (lib/env.ts:728)
CDP_API_KEY_SECRET=
# optional (lib/env.ts:610)
CLOUDFLARE_API_TOKEN=
# required (lib/env.ts:636)
COMMAND_LANE_KEY=
# required (lib/env.ts:476)
COMPOSIO_API_KEY=
# optional (lib/env.ts:629)
CREATE_BRIDGE_SECRET=
# optional (lib/env.ts:342)
CRON_SECRET=
# optional (lib/env.ts:650)
DAYTONA_MANAGER_KEY=
# optional (lib/env.ts:517)
DESKTOP_SIGNING_KEY=
# optional (lib/env.ts:672)
ELEVENLABS_API_KEY=
# optional (lib/env.ts:662)
FAL_KEY=
# optional (lib/env.ts:779)
GITHUB_APP_PRIVATE_KEY=
# optional (lib/env.ts:783)
GITHUB_APP_WEBHOOK_SECRET=
# optional (lib/env.ts:788)
GITHUB_STATE_SIGNING_KEY=
# optional (lib/env.ts:659)
GMI_CLOUD_API_KEY=
# optional (lib/env.ts:658)
GROQ_API_KEY=
# optional (lib/env.ts:665)
HEYGEN_API_KEY=
# optional (lib/env.ts:797)
KERNEL_API_KEY=
# optional (lib/env.ts:631)
LIVE_TOKEN_SECRET=
# required (lib/env.ts:506)
MASTERKEY_PARTNER_SECRET=
# optional (lib/env.ts:532)
MIGRATION_SEAL_KEY=
# required (lib/env.ts:404)
MINIAPP_SIGNING_KEY=
# at least one of MODEL_PROVIDER_API_KEY | OPENROUTER_API_KEY | STT_API_KEY (lib/env.ts:346)
MODEL_PROVIDER_API_KEY=
# optional (lib/env.ts:748)
MUSE_INTERNAL_TOKEN=
# optional (lib/env.ts:747)
MUSE_WORKER_TOKEN=
# optional (lib/env.ts:315)
NAMESPACE_TOKEN=
# optional (lib/env.ts:815)
ONAIROS_API_KEY=
# at least one of MODEL_PROVIDER_API_KEY | OPENROUTER_API_KEY | STT_API_KEY (lib/env.ts:355)
OPENROUTER_API_KEY=
# optional (lib/env.ts:739)
PLUGIN_TOKEN_SIGNING_KEY=
# optional (lib/env.ts:371)
PROVIDER_VAULT_KEY=
# optional (lib/env.ts:591)
R2_ACCESS_KEY_ID=
# optional (lib/env.ts:593)
R2_SECRET_ACCESS_KEY=
# required (lib/env.ts:439)
SESSION_SECRET=
# required (lib/env.ts:441)
SPECTRUM_PROJECT_SECRET=
# required (lib/env.ts:442)
SPECTRUM_WEBHOOK_SECRET=
# required (lib/env.ts:729)
STRIPE_SECRET_KEY=
# required (lib/env.ts:735)
STRIPE_WEBHOOK_SECRET=
# at least one of MODEL_PROVIDER_API_KEY | OPENROUTER_API_KEY | STT_API_KEY (lib/env.ts:422)
STT_API_KEY=
# required (lib/env.ts:345)
SUPABASE_SERVICE_ROLE_KEY=
# required (lib/env.ts:309)
TENKI_API_KEY=
# required (lib/env.ts:416)
THIRDWEB_SECRET_KEY=
# optional (lib/env.ts:404)
TRADE_PREVIEW_SIGNING_KEY=
# optional (lib/env.ts:389)
TYPESAFE_API_KEY=
# optional (lib/env.ts:361)
VENICE_API_KEY=
# optional (lib/env.ts:824)
WANDB_API_KEY=
# required (lib/env.ts:465)
WZRDMAIL_API_KEY=
# required (lib/env.ts:468)
WZRDMAIL_WEBHOOK_SECRET=
# optional (lib/env.ts:500)
WZRD_CONNECT_ADMIN_TOKEN=

# --- added by docs/specs/cloudflare-migration.md ---
# R-CF-02: Bearer for /_switch (admin Hosting toggle). Same value the admin panel sends.
SWITCH_TOKEN=
# R-CF-02: Shared with Vercel; authenticates x-air-origin-host in rollback-proxy mode.
EDGE_PROXY_SECRET=
# R-CF-02: Optional x-vercel-protection-bypass for proxy mode.
VERCEL_AUTOMATION_BYPASS_SECRET=
```

## plain

```dotenv
# optional; unmanifested: add to OPTIONAL_ENV (lib/env.ts:473)
AGENT_EMAIL_DOMAIN=
# optional; default https://ai-gateway.vercel.sh/v4/ai (lib/env.ts:391)
AI_GATEWAY_BASE=
# optional; default apps.wzrd.tech (lib/env.ts:606)
APPS_ORIGIN_SUFFIX=
# optional; default https://app.wzrd.tech (lib/env.ts:343)
APP_ORIGIN=
# optional; default https://ascii.dev/api/box/v1 (lib/env.ts:290)
BOX_API_BASE=
# optional; default 240000 (lib/env.ts:296)
BOX_READY_TIMEOUT_MS=
# required (lib/env.ts:291)
BOX_TEMPLATE_ID=
# optional; unmanifested: add to OPTIONAL_ENV; default https://apps.wzrd.tech/__air/health (lib/env.ts:618)
CF_DISPATCH_HEALTH_URL=
# optional; default air-apps (lib/env.ts:612)
CF_DISPATCH_NAMESPACE=
# optional (lib/env.ts:613)
CF_MANIFEST_KV_ID=
# optional (lib/env.ts:615)
CF_RUNTIME_KV_ID=
# optional (lib/env.ts:608)
CLOUDFLARE_ACCOUNT_ID=
# optional; default composio (lib/env.ts:482)
CONNECTOR_PROVIDER=
# optional; unmanifested: add to OPTIONAL_ENV; default 600 (lib/create/config.ts:79)
CREATE_CANDIDATE_TTL_S=
# optional; unmanifested: add to OPTIONAL_ENV; default 5 (lib/create/config.ts:85)
CREATE_COMPILE_MAX_PER_TURN=
# optional; unmanifested: add to OPTIONAL_ENV; default 70 (lib/create/config.ts:46)
CREATE_DEV_MIN_QA=
# optional; unmanifested: add to OPTIONAL_ENV; default dev.wzrd.tech (lib/create/config.ts:77)
CREATE_DEV_ORIGIN_SUFFIX=
# optional; unmanifested: add to OPTIONAL_ENV; default 14 (lib/create/config.ts:36)
CREATE_DEV_TTL_DAYS=
# optional; default false (lib/env.ts:622)
CREATE_FUNCTIONS_ENABLED=
# optional; unmanifested: add to OPTIONAL_ENV; default gemini-3.1-flash-image (lib/create/config.ts:48)
CREATE_ICON_MODEL=
# optional; unmanifested: add to OPTIONAL_ENV; default 7 (lib/create/config.ts:34)
CREATE_INTAKE_ABANDON_DAYS=
# optional; unmanifested: add to OPTIONAL_ENV; default 3 (lib/create/config.ts:30)
CREATE_INTAKE_MAX_QUESTIONS=
# optional; default https://create.wzrd.tech (lib/env.ts:639)
CREATE_JOBS_ORIGIN=
# optional; unmanifested: add to OPTIONAL_ENV; default 600 (lib/create/config.ts:81)
CREATE_LIVE_TOKEN_TTL_S=
# optional; unmanifested: add to OPTIONAL_ENV; default 6 (lib/create/config.ts:44)
CREATE_MAX_BUILDER_TURNS=
# optional; unmanifested: add to OPTIONAL_ENV; default 3 (lib/create/config.ts:42)
CREATE_MAX_FAILED_BUILDS=
# optional; unmanifested: add to OPTIONAL_ENV; default 3 (lib/create/config.ts:75)
CREATE_MAX_FIX_ROUNDS=
# optional; unmanifested: add to OPTIONAL_ENV; default false (lib/create/config.ts:50)
CREATE_MIRROR_ENABLED=
# optional; unmanifested: add to OPTIONAL_ENV; default 5 (lib/create/config.ts:32)
CREATE_PLAN_MAX_REVISIONS=
# optional; unmanifested: add to OPTIONAL_ENV; default 30_000 (lib/create/config.ts:40)
CREATE_PROGRESS_TEXT_MS=
# optional; unmanifested: add to OPTIONAL_ENV; default 10_000 (lib/create/config.ts:38)
CREATE_PROGRESS_TICK_MS=
# optional; unmanifested: add to OPTIONAL_ENV; default 50 (lib/create/config.ts:60)
CREATE_PUBLIC_ZIP_MAX_BYTES=
# optional; unmanifested: add to OPTIONAL_ENV; default 5 (lib/create/config.ts:83)
CREATE_SKILL_VERSION_MIN=
# optional; unmanifested: add to OPTIONAL_ENV; default false (lib/create/config.ts:65)
CREATE_V13=
# optional (lib/env.ts:81)
CREATE_V13_USER_IDS=
# optional; default 5 (lib/env.ts:715)
CREATIVE_COST_CENTS_IMAGE=
# optional; default 25 (lib/env.ts:828)
CREATIVE_COST_CENTS_VIDEO=
# optional; default 20 (lib/env.ts:701)
CREATIVE_DAILY_LIMIT=
# optional; default 2 (lib/env.ts:695)
CREATIVE_MAX_CONCURRENCY=
# optional (lib/env.ts:708)
CREATIVE_UNLIMITED_USER_IDS=
# optional; default https://app.daytona.io/api (lib/env.ts:654)
DAYTONA_API_URL=
# optional (lib/env.ts:652)
DAYTONA_ORGANIZATION_ID=
# optional; default https://api.elevenlabs.io (lib/env.ts:674)
ELEVENLABS_API_URL=
# optional; default eleven_multilingual_v2 (lib/env.ts:676)
ELEVENLABS_TTS_MODEL=
# optional (lib/env.ts:454)
EVAL_SPECTRUM_RECORD_URL=
# optional; default minimax/h3-max/lip-sync/image-to-video (lib/env.ts:680)
FAL_TWIN_LIPSYNC_MODEL=
# optional (lib/env.ts:845)
GATEWAY_MODEL_FAMILY_OVERRIDE=
# optional; default https://api.github.com (lib/env.ts:785)
GITHUB_API_BASE=
# optional (lib/env.ts:776)
GITHUB_APP_ID=
# optional (lib/env.ts:777)
GITHUB_APP_SLUG=
# optional; default wzrd-create (lib/env.ts:791)
GITHUB_OIDC_AUDIENCE=
# optional (lib/env.ts:871)
GMI_BALANCED_MODEL=
# optional; unmanifested: add to OPTIONAL_ENV; default medium (lib/create/config.ts:58)
GMI_CREATE_BUILD_EFFORT=
# optional (lib/env.ts:872)
GMI_DEEP_MODEL=
# optional (lib/env.ts:870)
GMI_FAST_MODEL=
# optional; default low (lib/env.ts:873)
GMI_GLM_EFFORT=
# optional; default https://api.gmi-serving.com/v1 (lib/env.ts:366)
GMI_INFERENCE_BASE_URL=
# optional (lib/env.ts:689)
GMI_MEDIA_HOSTS=
# optional (lib/env.ts:682)
GMI_ORGANIZATION_ID=
# optional; unmanifested: add to OPTIONAL_ENV; default https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests (lib/env.ts:685)
GMI_REQUEST_QUEUE_URL=
# optional (lib/env.ts:843)
GMI_ROUTINE_FAST=
# optional; default https://api.heygen.com (lib/env.ts:667)
HEYGEN_API_URL=
# optional; default Spectrum (lib/env.ts:577)
IMESSAGE_APP_NAME=
# optional; default 6777616651 (lib/env.ts:573)
IMESSAGE_APP_STORE_ID=
# optional; unmanifested: add to OPTIONAL_ENV; default codes.photon.Spectrum.MessagesExtension (lib/env.ts:579)
IMESSAGE_EXTENSION_BUNDLE_ID=
# optional; default P8XT6232SL (lib/env.ts:582)
IMESSAGE_TEAM_ID=
# optional; default https://api.onkernel.com (lib/env.ts:799)
KERNEL_API_BASE=
# optional; default false (lib/env.ts:800)
KERNEL_ENABLED=
# optional; default false (lib/env.ts:802)
KERNEL_VAULTS_ENABLED=
# optional (lib/env.ts:852)
KIT_DIR=
# optional (lib/env.ts:857)
KIT_RESTRICTED_SHA256=
# optional (lib/env.ts:855)
KIT_RESTRICTED_VERSION=
# optional (lib/env.ts:853)
KIT_SCRATCH_DIR=
# optional; default https://link.wzrd.tech (lib/env.ts:806)
LINKAPP_ORIGIN=
# optional (lib/env.ts:862)
LINK_AGENT_PAYMENTS_ENABLED=
# optional; default false (lib/env.ts:808)
LINK_HOST_ENABLED=
# optional; default nscr.io/nroeoinh9vg4q/air/mac-bootstrap:latest (lib/env.ts:133)
MAC_BOOTSTRAP_IMAGE=
# optional (lib/env.ts:328)
MAC_BOOTSTRAP_URL=
# optional; default wzrdmail (lib/env.ts:457)
MAIL_PROVIDER=
# optional; default https://masterkey.sh (lib/env.ts:505)
MASTERKEY_ORIGIN=
# optional; default 5 (lib/env.ts:509)
MASTERKEY_PER_CALL_MAX_USD=
# optional; default 120000 (lib/env.ts:537)
MIGRATION_CUTOVER_DEADLINE_MS=
# optional; default 90000 (lib/env.ts:541)
MIGRATION_DRAIN_BUDGET_MS=
# optional; default 600 (lib/env.ts:554)
MIGRATION_DRIVE_LEASE_SECONDS=
# optional (lib/env.ts:527)
MIGRATION_ENABLED=
# optional; default 900000 (lib/env.ts:544)
MIGRATION_OBSERVE_MS=
# optional; default 3 (lib/env.ts:551)
MIGRATION_PRECOPY_PASSES=
# optional; default 86400000 (lib/env.ts:548)
MIGRATION_RETAIN_MS=
# optional; default https://mini.wzrd.tech (lib/env.ts:561)
MINIAPP_ORIGIN=
# optional (lib/env.ts:875)
MODEL_BALANCED=
# optional (lib/env.ts:891)
MODEL_CREATE_BALANCED=
# optional (lib/env.ts:892)
MODEL_CREATE_DEEP=
# optional (lib/env.ts:889)
MODEL_CREATE_FAST=
# optional (lib/env.ts:876)
MODEL_DEEP=
# optional (lib/env.ts:874)
MODEL_FAST=
# optional (lib/env.ts:895)
MODEL_LABEL_BALANCED=
# optional (lib/env.ts:896)
MODEL_LABEL_DEEP=
# optional (lib/env.ts:893)
MODEL_LABEL_FAST=
# at least one of MODEL_PROVIDER_BASE_URL | OPENROUTER_BASE_URL | STT_BASE_URL (lib/env.ts:347)
MODEL_PROVIDER_BASE_URL=
# optional (lib/env.ts:880)
MODEL_REASONING_BALANCED=
# optional (lib/env.ts:882)
MODEL_REASONING_DEEP=
# optional; default xhigh (lib/env.ts:878)
MODEL_REASONING_FAST=
# optional (lib/env.ts:886)
MODEL_SERVICE_TIER_BALANCED=
# optional (lib/env.ts:888)
MODEL_SERVICE_TIER_DEEP=
# optional (lib/env.ts:884)
MODEL_SERVICE_TIER_FAST=
# optional; default false (lib/env.ts:744)
MUSE_ENABLED=
# optional; default 30 (lib/env.ts:758)
MUSE_MODE_TTL_MINUTES=
# optional; default https://muse.wzrd.tech (lib/env.ts:746)
MUSE_ORIGIN=
# optional; default 5 (lib/env.ts:769)
MUSE_RUN_DAILY_USD=
# optional; default 0.50 (lib/env.ts:765)
MUSE_RUN_MAX_USD=
# optional; default 6 (lib/env.ts:754)
MUSE_UPDATES_ALERT_CAP=
# optional; default 30 (lib/env.ts:750)
MUSE_UPDATES_DAILY_CAP=
# optional; unmanifested: add to OPTIONAL_ENV; default https://${optional("NAMESPACE_REGION", "us")}.compute.namespaceapis.com (lib/env.ts:318)
NAMESPACE_COMPUTE_API=
# optional; default https://iam.namespaceapis.com (lib/env.ts:324)
NAMESPACE_IAM_API=
# optional; default us (lib/env.ts:319)
NAMESPACE_REGION=
# optional (lib/env.ts:304)
OMARCHY_TEMPLATE_ID=
# optional (lib/env.ts:821)
ONAIROS_GOOGLE_CLIENT_ID=
# at least one of MODEL_PROVIDER_BASE_URL | OPENROUTER_BASE_URL | STT_BASE_URL (lib/env.ts:353)
OPENROUTER_BASE_URL=
# optional (lib/env.ts:641)
OPERATOR_ALLOWLIST=
# optional (lib/env.ts:864)
PUBLISH_KILL_SWITCH=
# optional (lib/env.ts:863)
PUBLISH_TIKTOK=
# optional (lib/env.ts:590)
R2_ACCOUNT_ID=
# optional; default air-media (lib/env.ts:594)
R2_BUCKET=
# optional; default https://media.wzrd.tech (lib/env.ts:596)
R2_PUBLIC_BASE_URL=
# optional (lib/env.ts:867)
SHOPPING_DRY_RUN_HOSTS=
# optional; default https://api.openai.com/v1 (lib/env.ts:379)
SIWC_API_BASE=
# optional; default https://auth.openai.com (lib/env.ts:377)
SIWC_AUTH_BASE=
# optional; default https://auth.openai.com/.well-known/jwks.json (lib/env.ts:381)
SIWC_JWKS_URL=
# optional; default http://127.0.0.1:1455/auth/callback (lib/env.ts:383)
SIWC_REDIRECT_URI=
# optional; default https://spectrum.photon.codes (lib/env.ts:444)
SPECTRUM_API_BASE=
# optional (lib/env.ts:866)
SPECTRUM_IMESSAGE_ADDRESS=
# required (lib/env.ts:440)
SPECTRUM_PROJECT_ID=
# optional (lib/env.ts:449)
SPECTRUM_RECORD_OUTBOX=
# optional (lib/env.ts:859)
STRIPE_LINK_ENABLED=
# optional (lib/env.ts:860)
STRIPE_LINK_HOSTS=
# optional (lib/env.ts:734)
STRIPE_PUBLISHABLE_KEY=
# at least one of MODEL_PROVIDER_BASE_URL | OPENROUTER_BASE_URL | STT_BASE_URL (lib/env.ts:420)
STT_BASE_URL=
# optional; default 1 (lib/env.ts:425)
STT_COST_CENTS_PER_MIN=
# optional; default whisper-1 (lib/env.ts:423)
STT_MODEL=
# required (lib/env.ts:344)
SUPABASE_URL=
# optional (lib/env.ts:848)
TENKI_API_ENDPOINT=
# optional (lib/env.ts:849)
TENKI_API_URL=
# optional (lib/env.ts:311)
TENKI_TEMPLATE_ID=
# optional (lib/env.ts:412)
TRADE_ALLOWLIST=
# optional; default false (lib/env.ts:408)
TRADE_LIVE_ENABLED=
# optional; default https://api.typesafe.ai (lib/env.ts:388)
TYPESAFE_API_BASE=
# optional; default https://api.venice.ai/api/v1 (lib/env.ts:360)
VENICE_BASE_URL=
# optional; default 8453 (lib/env.ts:430)
WALLET_CHAIN_ID=
# optional; unmanifested: add to OPTIONAL_ENV; default 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 (lib/env.ts:436)
WALLET_USDC_ADDRESS=
# optional; default air-traces (lib/env.ts:825)
WANDB_PROJECT=
# optional; default https://api.wzrd.tech (lib/env.ts:467)
WZRDMAIL_BASE_URL=
# optional; default https://mcp.mail.wzrd.tech/mcp (lib/env.ts:470)
WZRDMAIL_MCP_URL=
# optional; default https://connector.wzrd.tech (lib/env.ts:491)
WZRD_CONNECT_ORIGIN=
# optional (lib/env.ts:227)
WZRD_CREATE_INSTALLATION_ID=
# optional; unmanifested: add to OPTIONAL_ENV; default gratitude5dee/wzrd-create (lib/create/config.ts:51)
WZRD_CREATE_REPO=
# optional; default https://x402.org/facilitator (lib/env.ts:725)
X402_FACILITATOR_URL=
# optional; default base (lib/env.ts:726)
X402_NETWORK=

# --- added by docs/specs/cloudflare-migration.md ---
# R-CF-02: Rollback-proxy target. Default https://airv2.vercel.app.
UPSTREAM_VERCEL=
# R-CF-03: spectrum | relay | http. Default spectrum on Vercel, relay on Cloudflare.
IMESSAGE_TRANSPORT=
# R-CF-03: Photon imessage-server-v2-http address, once Photon confirms one.
PHOTON_IMESSAGE_HTTP_ADDRESS=
```

## public

```dotenv
# Build-time client value (app/home/panels/wallet-panel.tsx). Store as a GitHub repository variable, not a secret.
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=
```

## secret @air-sidecar

```dotenv
# R-CF-03. air-sidecar ImessageRelay container: Spectrum token mint (same values as above).
SPECTRUM_PROJECT_ID=
SPECTRUM_PROJECT_SECRET=
```

## Vercel-injected (reference only, do not set on Cloudflare)

```dotenv
# Vercel sets this automatically; on Cloudflare see the R-CF-12 replacement (lib/env.ts:840)
# VERCEL_DEPLOYMENT_CREATED_AT=
# Vercel sets this automatically; on Cloudflare see the R-CF-12 replacement (lib/env.ts:838)
# VERCEL_GIT_COMMIT_SHA=
# Vercel sets this automatically; on Cloudflare see the R-CF-12 replacement (lib/env.ts:397)
# VERCEL_OIDC_TOKEN=
# Vercel sets this automatically; on Cloudflare see the R-CF-12 replacement (lib/env.ts:841)
# VERCEL_REGION=
```
