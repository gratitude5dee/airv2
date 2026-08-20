# air 2.0 — Full-App Engineering Review

**Date:** 2026-08-20 · **Scope:** entire repo (531 files: apps/web, supabase/migrations, infra/template, scripts) · **Method:** five parallel deep-dive reviews (lib layer, API surface, mini-apps platform, home UI, data layer + infra), every finding verified against the code before inclusion.

**Baseline verified in a clean environment:** `npm run typecheck` ✅ · `npm run test` ✅ 681/681 (79 files) · `npm run lint` ✅.

---

## Executive summary

This is an unusually disciplined codebase for its ambition. The three hard security boundaries — (a) all Box/Hermes traffic through `lib/box`/`lib/hermes` behind an exact method+path allowlist, (b) Supabase holds routing metadata only, (c) secrets sealed or hashed and scrubbed before logging — are enforced *in code*, not by convention, and hold everywhere we looked. Idempotency via DB unique constraints + `23505` handling, compare-and-swap claim primitives, verify-before-parse webhooks, and single-use jti ledgers are applied consistently across independent features. Type hygiene: zero `any` in `lib/`, no empty catches.

The real risks cluster in four places: **the money path** (one double-send window, one burned-payment path), **the metering path** (an open POST proxy and a monthly cap that never resets), **dark-launched platform features** (publisher monetization gates that no code path can enable; three fully built Settings sections mounted nowhere), and **the single 3,139-line home page component** (which the redesign spec addresses head-on).

Counts: **4 high, 13 medium, ~20 low/info** findings survived verification. Nothing here is on fire in a single-user beta; the P0s become urgent the day real users move money or publish paid apps.

---

## P0 — fix before real money/users (high)

| # | Finding | Where | Failure scenario | Fix |
|---|---------|-------|------------------|-----|
| P0-1 | **Wallet transfer can double-send.** Approved transfer has no idempotency key; on *any* throw after submit, the row is reset `submitting → pending` "so approval can be retried". If the tx broadcast but the response was lost, re-approval broadcasts a second transfer. | `lib/wallet/send.ts:231`, `lib/thirdweb/client.ts:53` | Timeout after broadcast → user re-approves → funds sent twice. | Derive an idempotency key from `transfer.id` and send it to thirdweb; treat submit-throw as terminal-unknown (like GMI's `submit_unknown`, C23), never reset to `pending`. |
| P0-2 | **x402 settle-without-access at `/api/mini/launch`.** Middleware never sets `x-mini-host` on `/api/mini/*`, so the paid cookie is minted with `Path=/mini/<slug>` while the app is served at `/<slug>` — the 301 hop drops it. An x402 client retrying per the docstring settles USDC on-chain and never gets in. | `lib/payments/x402.ts:341`, `middleware.ts:76-83`, `app/api/mini/launch/route.ts:62-65` | Paying agent/customer is charged, receipt written, access denied. | Pass an explicit external basePath into the gate (or mark `/api/mini/*` with `x-mini-host`), and have launch return `{url}` after settlement instead of the gate redirect. |
| P0-3 | **Paying x402 visitors get a broken app.** Paid sessions carry synthetic `userId = "x402:<payer>"`, which flows into `ensureBoxAwake()` — a uuid lookup that throws; state GET / action POST return 500 on the bundle's first fetch. | `app/api/apps/v1/state/route.ts:26-33`, `lib/payments/x402.ts:334`, `lib/miniapps/store.ts:61` | Customer pays, app white-screens. | For `x402:`/guest sessions resolve state against the app **owner's** box (grant-guests already do this) or return `{state:{}}` read-only. |
| P0-4 | **Publisher monetization is unreachable.** No code path anywhere writes `x402_enabled`, `x402_price_usdc`, `password_hash`, `plugin_signin_enabled`, or `access` — the entire x402/password/plugin-sign-in/multiplayer machinery (built and tested) cannot be enabled by a real publisher. | `lib/miniapps/publish.ts:91-106`, `app/api/mini/publish/route.ts:35-58` | goal.md MA3 promises these toggles; publishers can never create paid/password/plugin apps. | Owner-scoped PATCH on `/api/mini/publish` (+ four form controls on the publish page). `hashPassword` already exists in `gates.ts`. ~100 lines; highest-leverage fix in the platform. |

## P1 — correctness/durability (medium)

| # | Finding | Where | Fix |
|---|---------|-------|-----|
| P1-1 | **Gateway forwards any POST subpath to the provider with the platform key**, and only chat-completion SSE usage is metered — a compromised box can drive unmetered, uncapped spend on `/v1/responses`, `/v1/embeddings`, etc. (GET arm correctly allowlists `models`.) | `app/api/gateway/v1/[...path]/route.ts:206` | Allowlist POST paths exactly like the GET arm (404 otherwise). |
| P1-2 | **`spend_mtd_usd` never resets — the "monthly" cap is a lifetime cap.** Only writer is `add_spend()` (increment); no period anchor column, no cron zeroes it. Every user monotonically accumulates until they permanently 429 at the gateway. | `entitlements` (0001/0002), `gateway route:147` | Add `spend_period_start` and roll-on-read (pattern already exists in `automation_rules` / `lib/browser/rules.ts:112`). |
| P1-3 | **Failed turns leak awake boxes.** `ensureBoxAwake` nulls `stop_after` eagerly; `runFlush`/`startChatRun` only re-arm on success, and the idle sweep filters `stop_after < now` (never matches NULL) — a throw mid-turn leaves the box awake with no deadline. | `lib/orchestrator/boxes.ts:157`, `flush.ts:553`, `chat/relay.ts:36` | Re-arm in a `finally`; also have the sweep catch `ready` boxes with NULL `stop_after`. |
| P1-4 | **`ad_conversions` has no idempotency key** — the one externally-reachable ingest without a replay guard; retried/replayed postbacks inflate conversions and `value_cents`. | `0014_ads.sql:89`, `app/api/ads/conversions/route.ts:53` | Client `event_id` + `UNIQUE(account_id, event_id)`, upsert. |
| P1-5 | **Abandoned presigns permanently leak storage quota.** Presign pre-charges `bytes_used` then reserves; 0039 promises a sweeper, none exists (`cron/sweep` never touches `pending_uploads`). | `lib/storage/confirm.ts:27`, `app/api/media/upload-url/route.ts:86` | Sweep rows older than the presign TTL in the existing cron; `addUsage(-charged)`. |
| P1-6 | **Two missing indexes on the traces-export hot path**: `decisions` has only `(user_id,status)` but export sorts by `created_at`; `miniapp_gate_events` has no `user_id` index at all → per-user full scans of the two busiest ledgers. | `lib/traces/receipts.ts:132,145` | `create index on decisions (user_id, created_at)`; `create index on miniapp_gate_events (user_id, created_at)`. |
| P1-7 | **Default tier→model map is stale/inconsistent** (`gpt-4o-mini`/`gpt-4o`/`o3` vs documented `gpt-5.6-*`), and the gateway pins `reasoning_effort:"none"` which the 4o family rejects — with checked-in defaults, every fast/balanced tool-turn would 400 unless env-overridden. | `lib/entitlements/models.ts:9`, gateway route:176,187 | Fix defaults to real model IDs or gate `reasoning_effort` injection on model family. |
| P1-8 | **Phone numbers stored unnormalized at provision, normalized on every read** — a formatted `bound_phone` (`+1 (415) 555-1212`) breaks owner tier-0 recognition; owner messages get parked as tier-2 contact decisions. | `lib/provisioning/provision.ts:85,94` vs `routing/trust.ts:20-24` | Normalize once at the provisioning write boundary. |
| P1-9 | **No timeouts on box/Hermes/provider HTTP clients** — a hung upstream pins a function until `maxDuration` (up to 800s) and can wedge sweep/debounce loops. Creative lane (`gmi.ts`, `media-url.ts`) is the template. | `lib/box/client.ts:83`, `hermes/client.ts:62`, `agentmail`, `composio`, `thirdweb` | `AbortSignal.timeout(...)` in the shared fetch helpers. |
| P1-10 | **Agent `media_publish` skips rate limit + ops ledger** that every other write path records — a prompt-injected agent can loop 50MB publishes to quota with no throttle and invisible to MA11's upload-spike alert (goal.md names "quota-drain uploads" explicitly). | `app/api/media/publish/route.ts:81-140` | Add the same `uploadRateLimited` + `recordOpsEvent("upload")` as `apps/v1/media-upload-url`. |
| P1-11 | **Box template bakes one shared Daytona API key into every user's fork** (`~/.daytona`, excluded from nothing but `store.enc` in the C18 sweep). One box compromise exfiltrates a platform-wide credential. | `infra/template/setup.sh:176` | Per-fork Daytona credentials at provision, or per-tenant scoping. |
| P1-12 | **`computer-relay` skill `source`s the entire `~/.hermes/.env`** — the exact pattern `setup.sh` deliberately avoids for the vault wrapper ("never sources it"); pulls all secrets (incl. `AIR_VAULT_KEY`) into the model-orchestrated shell and executes any `$()` in values. | `infra/template/skills/computer-relay/SKILL.md:24` | Grep the two needed vars like the vault wrapper. |
| P1-13 | **SSE terminal detection can miss a chunk-split `"run.completed"`** — web/desktop/bot streams substring-match undelimited chunks (unlike `flush.ts`, which frames on `\n\n`), leaving `agent_runs` rows unclosed (outcome/cost never recorded). | `lib/chat/relay.ts:78`, `lib/bots/chat.ts:108` | Buffer and frame-split like `hermesDeltas`. |

## P2 — worth scheduling (selected lows)

- **CSV formula injection** in publisher earnings export and traces export — quote-escaped but no `=+-@` prefix guard (`mini/publish/earnings/route.ts:24`, `lib/traces/receipts.ts:192`). Share one hardened `toCsv`.
- **Shell-quoting parity**: `media/publish` interpolates a box path with `JSON.stringify` (double quotes — `$()` still expands); safe today only because `BOX_PATH_RE` excludes metacharacters. Use the single-quote `shellQuote` that `chat/upload` uses.
- **Spend caps are TOCTOU soft caps** (gateway + storage quota): concurrent requests all pass the pre-check before any spend records. Acceptable for single-user boxes; document, or reserve/debit for hard caps.
- **Vault CLI reads `JSON.parse(stdout)` unguarded** (`lib/vault/client.ts:154,243`) — stray CLI noise becomes an untyped 500 instead of `VaultCliError`.
- **CRM box file is read-modify-write with no lock** (`lib/crm/store.ts:187`) — concurrent edits last-writer-wins.
- **DNS-rebinding TOCTOU in box calendar sync** (`infra/template/calendar/sync.py:189`) — validate-then-reconnect resolves twice; pin the validated IP.
- **`mini/agent` returns 403 for missing auth** where everything else returns 401; **apps/v1 payload caps count UTF-16 units not bytes**; **`cost_events` UNIQUE doesn't dedupe NULL refs**; **store session TTL is 7d vs the specified 24h**; **sealed secrets carry no AAD** binding them to their row.
- **Duplicated auth helpers**: `boxUserId()` copy-pasted in ≥10 routes; cron `authorized()` copy-pasted 7×. Extract `lib/auth/box.ts` + `cronAuthorized()`.
- **systemd units unhardened** (no `NoNewPrivileges`/`ProtectSystem`/`PrivateTmp`); **unpinned supply chain** for uv/nvm/agent-browser/daytona (Hermes itself is SHA-pinned).
- **Convention gap:** README says every webhook ships an idempotency test; `stripe` and `calcom` have per-route replay tests, `imessage` and `email` rely on the shared `dedupeInboundEvent` unit test only.

Home-UI tech debt (the god component, SSE leak on unmount, zombie ads poller, index keys, no URL state, a11y gaps) is catalogued in `03-redesign-spec.md` §7, since the redesign restructures those files anyway.

---

## What's genuinely excellent (preserve through the redesign)

1. **`lib/creative/media-url.ts` SSRF/download gate** — HTTPS-only, IP-literal + private-range rejection, per-hop redirect re-validation, magic-byte vs MIME check, byte cap, end-to-end timeout budget. The model for every outbound fetch.
2. **Uniform replay/idempotency discipline** — `inbound_events`, `stripe_events`, `x402_receipts`, `fill_ticket_redemptions`, `miniapp_redemptions`, `desktop_devices.pairing_jti` all first-insert-wins; CAS claims (`claimFlush`/`claimSlot`/`claimSchedule`) as one reused concurrency primitive.
3. **C18 secret hygiene** — request-scoped scrub registry before every structured log; values transported via one-shot 600-mode box inbox files, never argv; MA8 upload guard (Luhn/private-key/TOTP patterns, EXIF/PNG-chunk strip, no-SVG).
4. **Webhook discipline identical across providers** — signature over raw bytes before parse, 5-min staleness, `timingSafeEqual` behind a length guard (Spectrum, Svix, Stripe, cal.com).
5. **The box allowlist proxy** — exact `(method, anchored RegExp)` pairs, allowlist-never-denylist → 404.
6. **The vault fill path** — value pushed over CDP `Input.insertText`, never argv/stdout/transcript; single-use host-bound HMAC fill tickets; CVV burns last.
7. **C24 platform lockdown** — build fails closed if the adapter enumeration shrinks or any non-`api_server` adapter is enabled, verified twice during template prep.

## Auth matrix (condensed)

All 125 routes declare `runtime="nodejs"` + `force-dynamic`. Every route group authenticates: admin → `ADMIN_API_KEY` timing-safe; cron → `CRON_SECRET` fail-closed; webhooks → provider signatures; agent-facing → per-box `gateway_token`; owner web → session cookie; desktop → HMAC device tokens; mini-apps → single-use token → path-scoped cookie → full gate chain re-run on every request; Apps API → path-scoped `mini_api_<slug>` HMAC cookie. Unauthenticated routes are all deliberate (auth flows, device-code endpoints, public store/SEO projections) and were individually judged safe. **No IDOR found**; tenant is always derived from the verified credential, never the body.

## Module health (A–F)

`env/supabase/crypto/routing/storage` **A** · `auth/box/hermes/payments/commerce/vault/email/calendar/bots/ads/publish/creative/security/admin/browser/onairos/traces` **A-** · `chat/provisioning/entitlements` **B+/B** · `orchestrator` **B** (stop_after leak, 890-line flush) · `crm` **B+** · `wallet` **C+** (P0-1) · `app/home/page.tsx` **D** (3,139 lines, 69 useState — see redesign spec).

## Recommended sequencing

1. **Week 1 (money + metering):** P0-1, P0-2, P0-3, P1-1, P1-2.
2. **Week 2 (platform unlock + durability):** P0-4, P1-3, P1-4, P1-5, P1-6, P1-13.
3. **Week 3 (hygiene):** P1-7…P1-12, P2 batch (shared `toCsv`, `boxUserId` extraction, fetch timeouts).
4. **Then the redesign** (`03-redesign-spec.md`) — which also retires the home-UI debt list.

Tickets for each finding can be filed under `.scratch/review-2026-08/issues/` per `docs/agents/issue-tracker.md`.