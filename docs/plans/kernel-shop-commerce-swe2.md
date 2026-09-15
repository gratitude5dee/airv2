# Kernel browsers, vault payments, link.wzrd.tech, hypeman — implementation plan for SWE-2 Max

**Outcome:** Air agents can run real cloud browsers (Kernel) with an attached Kernel
vault (Link by Stripe + AgentCard card items) for errands and checkout, while the
owner watches a live/replay view inside a mini-app and approves payment from
iMessage. Merchants get a self-hosted product payment link at
`link.wzrd.tech/<product-name>` for inbound sales (Stripe Checkout, Link enabled)
with Connect handling payouts, plus Shopify catalog sync for outbound
distribution. The eval suite grows to the ten consumer-agent capability
categories with a defined high-score bar. hypeman is evaluated (not yet adopted)
as a self-hosted compute substrate for admin, eval twins, and fleet.

**Approach:** extend what exists — do not fork it. The box-local headed Chrome +
`air-vault type` + fill-ticket choreography stays the default browser lane. Kernel
becomes a second, control-plane-managed browser lane selected per task; Kernel
vaults handle card data only; `air-vault` + the 1Password/Bitwarden manager path
keep owning logins, identity fields, TOTP, and API keys. The existing
`checkout_handoffs` state machine, `purchase_review` decisions, `mintApprovalUrl`,
`sendOrUpdateCheckoutCard`, and mini-app loader carry the new lanes; new code is
additive (`lib/kernel/*`, one new host, one new mini-app, additive migrations).

## Evidence base

- Kernel docs (attached brief): browsers with `vaults` fixed at creation,
  `browser_live_view_url`, `cdp_ws_url`, stealth, proxies, profiles
  (`profile:{name, save_changes}`), replays (`replay_view_url`, mp4 download),
  standby, pools; vault items `wallet` + `card`, `state.aliases`
  `{number,cvc,exp_month,exp_year}` for egress substitution; actions
  `link_oauth | spend_approval | push_approval | collect | mfa |
  embedded_ceremony | card_enrollment`; `items.authorize`; immutable item
  events. Specs: Link card = `provider:'link'`, `payment_method_id`, amount minor
  units 1–500000, `merchant_url` absolute https, `context` ≥100 chars; agentcard
  = `merchant` ≤120, `amount` ≤ 2^53-1.
- Hermes upstream ships `kernel/hermes-browser-plugin` that routes `browser_*`
  tools to Kernel browsers — see "integration model" decision below for why we
  do NOT ship a box-side Kernel key.
- Existing anchors: `lib/box/{client,tenki,desktop}.ts` (provider dispatch by id
  prefix), `lib/compute/{environments,runtime,awake}.ts` (environment
  abstraction), `lib/vault/{client,managers,fill,purchase,tickets}.ts` (air-vault
  + BYO managers + fill tickets), `lib/browser/{grants,rules,probe}.ts`,
  `lib/checkout/handoffs.ts`, `lib/miniapps/{cards,gates,tokens,shell}.ts` +
  `apps/{checkout,passthrough,storefront,shop}.tsx`, `lib/payments/{stripe,link,
  linkAuth,linkSpend,approvalPolicy}.ts`, `lib/commerce/{catalog,checkout,
  merchants,paymentRequests}.ts`, `apps/web/app/api/browser/purchase/route.ts`
  (box-auth purchase surface), `apps/web/app/api/mini/checkout-launch/route.ts`
  (fragment-token → cookie → action presenter), `middleware.ts` (host routing),
  `infra/template/{setup.sh,agent-browser-guard.sh,browser-lease-guard.sh}`,
  `infra/template/skills/{shopping-checkout,link-payments,storefront-commerce,
  browser-use}/SKILL.md`, `evals/agent-suite/{lib,run,score}.ts` +
  `results/2026-09-11T-tenki-run2/report.md` (baseline: routing 97%, gating 76%,
  context 61%, honesty 99%; execution axis has only 7 signal cases — expand it),
  `SECURITY-DECISIONS.md` (through C25), `goal.md` V10 (EvaluationTwin contract),
  `docs/goal-gmi-models.md` (`gmi` family tier map: fast → `zai-org/GLM-5.3-Flash`,
  deep → `openai/gpt-6-astra`; verify landed state before relying on it).

## Integration model decision (decide in Phase 0, defaults pre-chosen)

Kernel browser sessions can be created two ways. Ship **control-plane-managed**
(A); document (B) as a dev-mode fallback only.

- **A. Control-plane-managed (ship this).** `KERNEL_API_KEY` lives only in Vercel
  env (new invariant C26). The control plane creates browsers
  (`vaults`, `stealth`, `proxy`, `profile`, `timeout_seconds`, `kiosk_mode`
  chosen here), keeps `browser_live_view_url`/`cdp_ws_url` sealed server-side,
  and hands the box a scoped session handle. The box's `browser_*` tools reach
  the Kernel browser over a localhost CDP relay (below); the agent never sees a
  Kernel credential, and no box holds spending authority (`items.authorize` is
  control-plane-only, C29). Per-user isolation = one Kernel project per user,
  provisioned lazily at first use, named `air-user-<id8>`.
- **B. Box-managed plugin path (dev only).** Installing
  `kernel/hermes-browser-plugin` puts `KERNEL_API_KEY` in `~/.hermes` env: any
  box compromise yields the whole Kernel account, and its documented settings
  (`KERNEL_PROFILE_NAME`, `KERNEL_PROXY_NAME`) expose no vault attachment, so
  it cannot serve the payments lane anyway. Keep it out of `infra/template`;
  allow it only on dev boxes with a scoped key.

## Phase 0 — accounts, env, spike proofs

1. Kernel org account; single org/project-admin API key in Vercel env as
   `KERNEL_API_KEY`; verify project-scoped key creation via API or dashboard.
   Add `KERNEL_API_KEY`, `KERNEL_ENABLED=false`,
   `LINKAPP_ORIGIN=https://link.wzrd.tech` to `apps/web/lib/env.ts` following the
   `optional()`/`required()` conventions; secrets never in `env.ts` defaults.
2. `@onkernel/sdk` added to `apps/web` deps (pin a version ≥7 days old).
3. Spike proofs (record outcomes in the PR, they gate Phase 1–2):
   - `browsers.create` returns both `cdp_ws_url` and `browser_live_view_url`;
     the ws URL works over a plain CDP client and carries no additional auth
     handshake that would break a box-side relay.
   - `vaults.upsert` + item create/authorize: confirm `items.retrieve` never
     returns PAN/CVV (alias-only surface). If any read path returns raw card
     data, the Kernel lane does not ship until access is split so the box path
     cannot reach it.
   - The three provider-action ceremonies we will present (`card_enrollment`
     or `collect`, `link_oauth`, `spend_approval`/`push_approval`) return URLs
     we can wrap with our presenter pattern; record their TTL and one-shot
     semantics.
   - Live view iframe loads under `frame-src https://*.onkernel.com:8443`;
     `readOnly=true` blocks input; replay `replay_view_url` embeds under the
     documented CSP (incl. the S3 playback origin).
   - `profile:{name, save_changes:true}` round-trips cookies; concurrent-writer
     guard (`GET /browsers?status=active` filtered by profile) is workable.

## Phase 1 — Kernel browser lane

### Control plane

- `apps/web/lib/kernel/client.ts`: thin `@onkernel/sdk` wrapper; every call
  timeouts via `lib/http/timeout`; errors mapped like `parseBoxErrorBody`
  (status/code/request id, never bodies).
- `apps/web/lib/kernel/browsers.ts`: `createKernelBrowserSession(supabase,
  userId, {purpose, profile, stealth, proxy, vaultId?, timeoutSeconds})` →
  upserts the user's Kernel project/profile, calls `browsers.create`, seals
  `cdp_ws_url`/`browser_live_view_url` with `sealSecret` (purpose-separated key,
  e.g. `air:kernel-browser:v1`), writes `kernel_sessions`. `endKernelSession`,
  `sessionStatus` (lease + human-control flag), `startReplay`/`stopReplay`/
  `listReplays`. Session TTL default 10 min inactivity; hard cap 30 min.
- `apps/web/lib/kernel/profiles.ts`: `kernelProfileFor(user)` → one profile per
  user (`air-profile-<id8>`), `save_changes:true` only on sessions the owner
  marked keep-login; enforce the single-writer rule before launch (active
  writer check per docs).
- `apps/web/app/api/kernel/browser/route.ts` — box-auth (same
  `boxes.gateway_token` bearer + `serviceClient` pattern as
  `api/browser/purchase`): `POST` create, `DELETE` end, `GET ?id=` status +
  lease flag (the box-side CDP relay and guard poll this). Response carries the
  `cdp_ws_url` to the box only (TLS + box-auth; `Cache-Control: no-store`); it
  is never returned to the web client, logged, or placed in model context (C27).
- `apps/web/app/api/kernel/replay/route.ts` — box-auth + owner control-plane
  reads: start/stop/list; `replay_view_url` flows only into the sealed session
  row, then into the owner mini-app.
- Migration: `kernel_sessions` (id, user_id, kernel_session_id, purpose,
  profile_name, vault_id, stealth, proxy, status, live_view_sealed,
  cdp_sealed, replay_ids jsonb, human_control_until, task_id, version,
  created_at, ended_at) — owner RLS; sealed columns never selected into
  client JSON. Add nullable `kernel_session_id` to `checkout_handoffs`.

### Box side

- `infra/template/kernel-cdp-relay.js` (new): localhost WebSocket/HTTP relay
  that accepts `agent-browser`'s normal local CDP endpoint and forwards frames
  to the remote `cdp_ws_url`. Reads the URL from
  `~/.hermes/kernel/session.json` (0600) written by the box-side create call —
  never from argv/env lists that show in `ps`. Exposes the same
  `DevToolsActivePort` contract the probe already reads so
  `lib/browser/probe.ts` works unchanged.
- Extend `infra/template/agent-browser-guard.sh`: when a `kernel_sessions`
  handle is active for the current task (status fetch: lease + human_control),
  route `agent-browser` to the relay port instead of the local Chrome; while
  `human_control` is held, fail closed exactly like `browser-lease-guard.sh`
  does for the local browser (C30). Keep the local-Chrome path default.
- `boxctl`/orchestrator: when a run wants a Kernel browser (task hint or skill
  call), the box calls `POST /api/kernel/browser`, writes the session file,
  starts the relay; on end/timeout it deletes the file and kills the relay.
  Kernel's own inactivity timeout is the remote backstop.
- Desktop-vs-Kernel selection: skill-level hint (`[browser: kernel]`) or
  control-plane policy (stealth/proxy/host-lists later); v1 = explicit skill
  request only.

## Phase 2 — Kernel vaults + /shop payments

Keep three stores distinct and document it in the skills + SECURITY-DECISIONS:

| Store | Owns | Lives |
| --- | --- | --- |
| Kernel vault | Card items (Link one-use, AgentCard reusable) + payment aliases | Kernel, per-user project |
| air-vault | Logins, identity fields, TOTP, cards for the *local* browser lane | Box, AES-256-GCM, C18 |
| 1Password/Bitwarden manager | Owner's upstream secrets, API keys, env bindings | Box `.env` one-shot files (C23) |

### Provisioning + enrollment

- `apps/web/lib/kernel/vaults.ts`: `ensureKernelVault(user)` → lazy create
  project → `vaults.upsert({name:'air-vault-<id8>'})` → wallets
  `wallet-link` + `wallet-agentcard` (one wallet per provider, enforced
  server-side) → `kernel_vaults` row (user_id, vault_id, wallet ids, status).
- Card enrollment is a **provider-hosted ceremony**, never our form (C28): the
  vault mini-app gains "Add Kernel card" → `POST /api/kernel/vault/enroll` →
  create `card_enrollment`/`collect` action → present via the action presenter
  below. PAN never transits Vercel or the box; the item lands inside Kernel and
  we mirror id/brand/last4/state only.
- `apps/web/lib/kernel/actions.ts` + `app/api/kernel/action/[id]/route.ts`:
  clone of the `checkout-launch` presenter pattern — opaque action id bound to
  (user, vault, item, action name) in `kernel_actions` (single use, ≤5-min TTL,
  invalidated on state change); GET renders a fragment-token page, POST
  redeems once → HttpOnly cookie → 302 to the provider URL with
  `Cache-Control: no-store`, `Referrer-Policy: no-referrer`. Action URLs are
  bearer-like (C27): bound to the authenticated owner, never logged, never in
  model context.
- `apps/web/lib/kernel/events.ts`: poll `vaults.items.listEvents`
  (idempotent cursor per vault) + webhooks if offered; reconciler marks item
  state (`active|used|expired|disabled`) and purchases. Add to the sweeper cadence.

### Purchase choreography (Kernel lane, mirrors V6)

Reuse `purchase_review` decisions and `checkout_handoffs` states; add the
Kernel columns rather than a parallel machine:

1. Agent (on Kernel session) reaches checkout-ready → box calls
   `POST /api/kernel/purchase/propose` with merchant host, url, item, quoted
   amount/currency — same honesty rule as today: always serve the merchant URL.
2. Control plane **independently verifies** the purchase object before
   creating the decision — prefer a merchant/backend quote; on Stripe payment
   links use the response `account_settings.display_name`,
   `line_item_group.total/currency/line_items`; otherwise deterministic page
   extraction via `browser_curl`/CDP snapshot — never agent-proposed values
   alone. The verified object is frozen (jsonb) on `kernel_purchases`; any cart
   change invalidates it.
3. `purchase_review` decision → owner card (`sendOrUpdateCheckoutCard`) →
   approval mints the Kernel equivalent of a fill ticket AND calls
   `items.authorize` on the chosen item (link: before submit; agentcard:
   approval while the request is held post-submit per provider semantics).
4. Aliases + approved-scope claims go to the box in the redemption payload;
   the agent fills `{number,cvc,exp_month,exp_year}` **alias strings** into the
   Kernel browser form — egress substitution happens inside Kernel; nothing
   sensitive reaches the agent or the page (C29 extends C18/C19: only aliases
   may appear in model context/tool previews).
5. Submit **once, never retry**: a second submit or a refreshed page that
   dropped the native handoff fails closed to `unknown_outcome` +
   reconciliation via item events. `recordPurchaseOutcome` equivalent writes
   `kernel_purchases.status`; the receipt path is merchant confirmation, not
   the success URL.
6. Provider actions surfaced mid-flow (`link_oauth`, `spend_approval`,
   `push_approval`, `mfa`, `embedded_ceremony`) are presented through the
   action presenter and delivered as iMessage/mini-app links — the
   "Stripe link payment approval" the owner sees is our presenter wrapping the
   provider's approval, bound to the authenticated owner + item.
7. Denial/expiry/cancel each write their state; nothing auto-retries.
   `site_grants` still gate which hosts may receive a vault login fill; a new
   `kernel_spend` gate (new `DecisionKind` + `site_grants`-adjacent host rule)
   gates which hosts may receive card aliases — default deny.
8. Keep `linkSpend.ts`/link-cli lane untouched for the local browser; document
   precedence: Kernel checkout → Kernel vault item; local checkout → fill
   ticket / link-cli. `approvalPolicy.ts` delegated-approval policy applies to
   Kernel `authorize` identically (off by default until provider capability +
   owner opt-in, unchanged rule).

`/shop` (merchant view) gains a "Payment cards" section listing Kernel item
metadata (masked, state) + enrollment launch, and per-product "copy payment
link" (Phase 4). The public storefront stays read-only money-wise.

## Phase 3 — watchable playback mini-app + iMessage delivery

- New first-party mini-app `apps/web/lib/miniapps/apps/watch.tsx`, registered
  in `FIRST_PARTY_MODULES` + `mini_apps` row + card kind `watch` + `CARD_COPY`
  entry (`.agents` docs + `tokens.ts` scopes). Owner-only (passthrough rule):
  guests never reach it.
- Live state: for an open `kernel_sessions` row, render
  `<iframe src=<unsealed browser_live_view_url>?readOnly=…>` — `readOnly=true`
  by default; interactive only while a `beginCheckoutHumanControl`-style lease
  is held for that session (same 15-min default/30-max, same return-control
  semantics, same agent-pause via the box guard). Add the Kernel CSP additions
  (`frame-src`/`connect-src` `*.onkernel.com:8443`, `wss:`) on this app's
  responses only, matching how `storefront.tsx` widened for
  `checkout.stripe.com`. `referrerpolicy="no-referrer"`,
  `allow="autoplay; clipboard-read; clipboard-write"`, Safari focus note in the
  shell.
- After the session: `replay_view_url` iframe (CSP adds `*.kernel.sh:8443` and
  the S3 playback origin) under a "Replay" section; offer mp4 download link.
  Live-view and replay URLs are bearer capabilities: stored sealed, rendered
  only into owner HTML, `no-store`, never serialized into mini-app JSON/log
  lines (C27 — same treatment as desktop stream URLs).
- Status rail (server-rendered, works before/if the iframe fails): task
  summary, session state, current merchant host, the `kernel_purchases`
  verified-object card when a purchase is pending, approve/deny buttons that
  hit the existing decision routes, cancel/expired/unknown_outcome copy. No
  fabrication: iframe `load` ≠ video connected — label "preparing" until the
  provider reports ready.
- Checkout mini-app (`checkout.tsx`) embeds the same live/replay panel when
  `handoff.kernel_session_id` is set, instead of the desktop Computer
  passthrough.
- iMessage wiring: card kinds `watch` and `checkout` (existing) via
  `sendOrUpdateCheckoutCard`-style update-in-place; Spectrum native card +
  fragment-token browser link fallback identical to checkout-launch. Final
  result: when `kernel_purchases`/`checkout_handoffs` reaches a terminal
  state, the same card updates to the receipt/outcome view AND a final text
  lands in the thread ("Order placed — $42.10 at merchant.com. Watch replay /
  view receipt"), plus the payment approval presenter link when a provider
  action is outstanding. Use the established send rules: durable owner
  destination, pinned sender line, update not re-send, deduped retries.
- Standby note for eval/ops: Kernel standby is free only while no CDP/live-view
  client is connected — the sweeper must drop the relay/live view before
  expecting standby billing, and `human_control` leases hold the browser
  active.

## Phase 4 — link.wzrd.tech + Shopify distribution

- `LINKAPP_ORIGIN` env + middleware host branch: on the `link` host,
  `/<slug>` → rewrite `/mini/link/<slug>` (new first-party `link` module),
  `/api/mini/*` passthrough, `/` → the store home, everything else 404. Add the
  host to deployment env + DNS (`link.wzrd.tech` → Vercel project
  `prj_k85SYkCP3elo3YIChN6o45gEbsRC`).
- `pay_links` table: id, user_id, product_id, slug unique, status
  (active/paused), views/checkouts counters, created_at — public-safe columns
  only; public read on active, owner RLS on manage. Slug defaults to
  `<username>-<product-name>` (mirroring the `<u>-<a>` convention), custom
  slugs owner-editable; collisions fail the publish, not silently rename.
- `apps/web/lib/miniapps/apps/link.tsx`: public SSR product page (image, title,
  price, inventory state, merchant @username) + Buy → POST → existing
  `startCheckout` (server-derived price, order row, `createConnectCheckoutSession`
  card+link, 30-min expiry, redirect to `session.url`). Link enabled =
  **inbound sales** path. Webhook fulfillment is the existing
  `checkout.session.completed` handler — no new payment code. Rate-limit the
  Buy POST per IP; honest `sold out`/`link paused` states; no mutation beyond
  order create.
- **Connect = outbound payouts**: unchanged architecture — direct charges on the
  merchant's Standard account, platform never custodies. The outbound-sales
  surface is distribution: `sendMiniAppCard`/social skills can emit the pay
  link, `paymentRequests` can carry it, and Shopify sync below pushes the same
  catalog out to the merchant's own store.
- `apps/web/lib/commerce/shopify.ts` + `infra/template/skills/shopify-sync/`:
  catalog bridge — `storefront_products.external_refs` jsonb gains
  `{"shopify":"<shop>/<product_id>"}`; a box-side skill uses the Shopify
  CLI/Admin API to upsert title/price/inventory/media and stamps the product's
  `link.wzrd.tech` URL as the canonical purchase URL. The merchant's Shopify
  Admin token lives in air-vault/1Password via the managers path (C23), never
  Postgres. Scope note: Shopify is sync/distribution only — `link.wzrd.tech`
  remains the checkout of record. If the merchant wants native Shopify
  checkout instead, the sync records it and the agent buys/tests through that
  path via the Kernel lane — flag as a follow-up, do not dual-write orders.
- `/shop` "Payment links" tab lists links with copy/open actions; creating a
  product auto-mints its link on publish (same `shop_publish` decision gate).

## Phase 5 — model routing (Astra + GLM on GMI)

- Assign the new lanes `model_family:'gmi'` once `0112_model_family_gmi` +
  `GMI_TIER_MODELS` are landed (verify — the doc predates merge): parent/
  orchestration + purchase verification on `deep` (`openai/gpt-6-astra`),
  delegation children + browser-step turns (DOM snapshots, extraction, form
  fill) pinned to `fast` (`zai-org/GLM-5.3-Flash`) per the delegation
  invariant. If the family is not merged yet, ship these lanes on the existing
  default and add the assignment as a one-line config change + migration
  follow-up — do not couple the launch to it.
- Record per-lane cost on `agent_runs` (existing columns) so the eval suite can
  report Kernel-lane cost/error separately.

## Phase 6 — eval suite for the ten capability categories

Extend `evals/agent-suite` (same `EvalCase` schema, same 5 axes):

| Brief capability | Category | Primary skills/lane |
| --- | --- | --- |
| Errands in a real browser (bookings, orders, forms, signed-in accounts) | `errands` | shopping-checkout + Kernel lane + profiles |
| Travel and plans (flights, hotels, restaurants, rides, delivery, shopping) | `travel` | browser-use/errands; itinerary memory |
| Build things (sites, decks, docs, sheets, images, voice memos) | `build` | create-miniapp, draw/video/image lanes |
| Research (quick lookups → deep dives with sources) | `research` (expand) | research/timing skills |
| Email/calendar/Drive/Slack (read, triage, draft, send as you) | `comms` | calendar-native, wzrdmail, connectors |
| Watch for things (X replies, price drops, tickets, openings) | `watch` | browser rules (`claimRuleUnit` daily caps) |
| Reminders and follow-through | `reminders` | todo/scheduled tasks |
| Coordinate with other people's Instincts | `coordinate` | Spectrum DMs to peer agents; degrade honestly |
| Own inbox (forward a thread, handle follow-ups) | `inbox` | wzrdmail triage + email_draft decisions |
| Memory (people, preferences, running context) | `memory` | openviking-memory, crm-people |

- Add to `lib.ts`: categories above (keep existing nine), `DecisionKind`s
  `kernel_spend`, `watch_rule`, `reminder`; keep `purchase_review`,
  `payment_request`, `vault_fill`, `shop_publish`.
- ~12 cases per new category (~120 cases) authored via the `create/` pattern;
  `must_do`/`must_not_do` regexes must require the artifact, not a description
  ("booked" claims need the handoff/kernel_purchases row, not a URL in text).
  Include per-category adversarial cases: prompt-injection checkout pages,
  cart-change-after-approval, unprovisioned-connector honesty cases, and a
  coordinate case where the peer agent is absent (expect graceful degrade, not
  a fabricated "I messaged them").
- Update `installed-skills.txt` captures; keep the inventory-gap rule — a case
  whose skill/connector isn't provisioned is a platform gap, not a model fail.
- Bars (report.md already renders per-category): **routing ≥90%, honesty ≥98%,
  gating = 100% on every money/credential case** (kernel_spend,
  purchase_review, vault_fill, payment_request — a single ungated fill is a
  release blocker), execution/context ≥80% on the new categories with enough
  signal cases to matter. Add a `capability` column summary; wire the suite
  into CI as a non-blocking report first, blocking for gating/honesty
  regressions after two green runs.

## Phase 7 — hypeman evaluation (admin, fleet, twins)

**What it is:** Kernel's MIT-licensed Go multi-hypervisor runtime for OCI
images — Cloud Hypervisor, Firecracker, QEMU, Apple VZ; Docker-compatible CLI
(`pull/run/exec/stop/ps/logs`), remote API behind `hypeman-token` JWT, standby/
restore with ms resumes, built-in ingress with TLS + subdomain routing, GPU
passthrough. Hosts need KVM (Linux) or macOS 11+ on Apple Silicon.

**Where it could fit, mapped to existing abstractions:**

- **Third Box provider** (`hm_` ids in `providerOf`): fork=run-from-image,
  stop/resume=snapshot/standby, command=`exec`, hosted route=its ingress. The
  template is a filesystem image today; packaging it as an OCI image is the
  port. Real gain: escape the ascii.dev start ceilings (600/hr + 1500/day ≈
  ~150-user ceiling) and per-box pricing on owned KVM metal; real cost: we own
  hypervisor hosts, snapshot durability/object storage, `noEnv` env isolation,
  hosted-token auth (DIY JWT on its ingress), and desktop streaming (noVNC
  in-image, like the Tenki path already does). Maturity: young project —
  adopt behind the provider seam, never in a call-site.
- **`lib/compute` environment for V10 EvaluationTwins** (the strongest fit):
  V10 wants resettable disposable twins running paired baseline/candidate
  rollouts; hypeman's OCI images + fast standby/restore are exactly a twin
  substrate, and a twin pool does not need desktop streaming, templates
  marketplace, or user-facing SLAs. This also unblocks eval-suite parallelism:
  the agent suite currently serializes on shared real boxes.
- **Admin/fleet plane** (the ask): run internal agent boxes, CI runners,
  preview/staging boxes, and the eval-twin pool on owned hardware — separate
  hypeman cluster, JWT API, separate blast radius from user boxes.

**Verdict to write up:** yes for admin/twins — adopt as a `lib/compute`
environment (not a Box provider) for the eval-twin + internal fleet first;
defer user-box migration until a quarter of ops data exists. Spike
(M0-twin): `lib/compute/hypeman.ts` implementing the twin lifecycle (create
from image → run paired rollout → snapshot → restore/reset), a dev hypeman
host, 20 paired rollouts; measure provision ms, snapshot/restore ms, density
per host, failure modes. Decision record in `docs/reports/` comparing
density/$ per twin-hour vs ascii+tenki. Do NOT move production user boxes in
this program.

## Security additions (SECURITY-DECISIONS.md, continue the series)

- **C26** `KERNEL_API_KEY`/org key: control-plane env only; per-user Kernel
  projects; the box never holds a Kernel credential.
- **C27** Kernel bearer capabilities (`cdp_ws_url`, `browser_live_view_url`,
  `replay_view_url`, provider action URLs): sealed at rest, owner-bound
  presentation, short TTL, `no-store`/`no-referrer`, never logged, never in
  model context or mini-app JSON.
- **C28** Card PAN never enters airv2 infra for the Kernel lane — enrollment
  is a provider ceremony through the action presenter. (air-vault card apply
  remains the existing C18 exception, local lane only.)
- **C29** `items.authorize` is control-plane-only, after owner approval of a
  frozen verified purchase object; aliases are the only values that may reach
  the agent (extends C18–C20).
- **C30** Kernel human-control lease pauses the agent's CDP access to that
  session (guard fails closed on the status flag), mirroring the checkout
  handoff lease.
- **C31** Payment attempts reconcile via immutable item events before any
  retry; submit-once is code-enforced, not a prompt instruction.

## Tests + rollout

Focused unit tests per new lib/route mirroring existing coverage; then the
new-path matrix:

| Test | Required result |
| --- | --- |
| create→relay→`browser_snapshot` through Kernel | remote CDP session works; tool result carries stealth markers |
| session file/argv/`ps` sweep | `cdp_ws_url` never in argv/logs/Postgres plaintext |
| owner opens watch mid-run | iframe live view under CSP; `readOnly` without lease |
| human control lease | box `browser_*` calls denied while held; return restores |
| enroll → `card_enrollment` ceremony | PAN never touches our infra; item mirrored masked only |
| propose→approve→authorize→fill→submit | aliases filled; submit once; immutable event trail |
| cart mutates post-approval | frozen object invalidated; re-review required |
| second submit / refreshed handoff | `unknown_outcome`, reconciled, no double charge |
| provider `spend_approval`/`mfa` action | presented to owner only, bound + expiring, not leaked |
| replay after end | replay iframe + mp4; replay URL sealed/owner-bound |
| link host routing | `link.wzrd.tech/<slug>` serves product page; Buy→Checkout; paused/sold-out states honest |
| cross-tenant | owner A's sessions/cards/links unreachable by B (RLS + binding tests) |
| secret canaries in fixtures | absent from logs, HTML, card metadata, traces, persistence |

Rollout: `KERNEL_ENABLED` + per-lane flags (`kernel_browser`, `kernel_vaults`,
`link_host`) and lazy per-user project creation; canary one owner on errands
(no cards), then vault lane, then link host; rollback = flags off (sessions
end, sessions table and events stay for reconciliation). Boxes pick up the
relay + skills via the existing template release path; never re-fork to
deploy.

## SWE-2 Max handoff notes

Implement phases in order; each phase is independently reviewable/mergeable.
Spike proofs in Phase 0 are release gates — if `items.retrieve` exposes PAN,
or provider action URLs can't be bound/wrapped as specified, stop and report
rather than approximating. Do not move user boxes to hypeman, do not centralize
wallets, do not weaken the local-browser fill-ticket path. Deliver per phase:
changed-file summary, focused + scoped suite results, typecheck/lint/build
output, rollout flag state, and what is verified vs pending.
