goal.md — build spec for Air Mini-Apps (V9)
Read ARCHITECTURE.md in full before starting. The prior platform spec (air 2.0, M0–M8 + waves through V8) is archived at docs/goal-air2.md; everything it built is DONE and everything it forbids is still forbidden. This file is the finish-line plan: it turns the existing mini-app rails into the Air Mini-App platform and App Store served at mini.wzrd.tech. Where this file and ARCHITECTURE.md disagree, ARCHITECTURE.md wins and this file is the bug.
What you are finishing: every Air user already has a personal Hermes agent inside their own Box, reachable over iMessage, email, and web. Six token-gated mini-app views already exist. You are building: (1) the store home at mini.wzrd.tech with a public, agent-discoverable registry; (2) a loader v2 that serves every app on three surfaces — web chat, the native Mini-Apps tab, and iMessage cards; (3) the fourteen first-party store apps; (4) the publisher flow so users (and their agents) can register their own apps at mini.wzrd.tech/<username>-<appname> with wallet-based payouts; (5) platform features: per-user public media buckets (R2), persistent per-user memory, Onairos onboarding, x402 + Stripe payments, and agent-trace export.
Target: the existing private beta (10–100 users). Correctness and isolation over scale. Ship in the order of §MA-milestones; parallelize per §9 (Devin child-session plan).
0. What already exists — audit before you write code
Do not rebuild any of this. Extend it.
Subsystem
Where
State
Mini-app loader (token → cookie → SSR HTML)
apps/web/app/mini/[app]/route.ts
Live. 6 apps: kanban, todo, computer, browser, vault, calendar. Single-use token exchange, path-scoped 15-min cookie, Referrer-Policy: no-referrer, CSP, no client storage (C15/C17).
Mini-app tokens
apps/web/lib/miniapps/tokens.ts
Live. HMAC over (userId, app, resourceId, jti, exp); miniapp_redemptions single-use ledger; mint/open/redeem all logged.
Registry table
supabase/migrations/0007_miniapps.sql → mini_apps
Stale. Has slug/route/kind/scopes/backing_tool; seeded with only kanban+todo while the loader serves six. V9 makes the registry the source of truth (§MA1).
iMessage cards
apps/web/lib/miniapps/cards.ts, cardSends.ts
Live. app() thunk mint (no stored URLs), in-place card edits, per-(user,kind) cooldown ledger card_sends.
Owner link mint
apps/web/app/api/mini/link/route.ts
Live. Session-authed owner mints a signed link for the 6 apps. Extend for store slugs + the store session (§MA1).
App state store
apps/web/lib/miniapps/store.ts
Live. Content lives in the user's Box at .hermes/miniapps/<app>/<resource>.json (C4) — agent tools and views share it. Reuse this pattern for CRM, image-editor layers, storefront drafts.
Home dashboard
apps/web/app/home/page.tsx + panels
Live. Chat, Needs you, History, People, Skills, Wallet, Computer (Screen/Browser), Connectors + Calendar/Vault/Bots/Ads panels. The native Mini-Apps tab (§MA1.4) joins this.
Vault / secrets
lib/vault/* (client, purchase, fill, managers, scrub)
Live. Box-side encrypted store, Postgres metadata mirror, reveal rules (C18/C20), purchase-review fill tickets, Bitwarden + 1Password bring-your-own managers (vault_managers).
Browser-use w/ payment stop
lib/browser/*, api/browser/purchase, lib/vault/purchase.ts
Live. Headed browser on the Box desktop, purchase_review decision before any card fill, human always clicks Place order. Stripe Link lands in §MA6.
Computer-use
api/box/*, api/computer/*, lib/box/desktop.ts
Live. Proxied desktop stream (C16), keep-awake schedules, screenshot, power-state history (box_state_events).
Calendar spine
lib/calendar/*, migrations 0015/0023–0025
Live. Sources → moments → slots; agent_schedules execution; ICS approval gating. Persona color-coding + CRM images land in §MA6.
Composio
lib/composio/client.ts, api/connectors
Live. Per-user tool-router session, hosted Connect Links, MCP endpoint installed in the box.
AgentMail
lib/agentmail/client.ts, api/inbound/email
Live. Pod/inbox per user, draft-only box key (C10), threads/drafts/send/blocklists. Inbox UI lands in §MA6.
Wallet
lib/thirdweb/client.ts, lib/wallet/*, api/wallet/*
Live. thirdweb wallet per user (Base, WALLET_CHAIN_ID=8453), balance/activity, approval-gated send (wallet_transfers). Publisher wallet = this wallet.
Creative lane
lib/creative/* (router, gmi, jobs, media-url), api/creative
Live. Image/video generation jobs with limits + costs. Editors (§MA7) sit on top.
Asset pipeline
lib/assets/pipeline.ts (Supabase Storage)
Live. Box → verified ingest → content-addressed master → short-TTL delivery URLs. R2 public buckets (§MA4) are a separate, public lane — do not conflate.
Ads / funnels
lib/ads/*, lib/publish/* (adapters: IG/FB/TikTok/X/YouTube; sources: ecommerce, touring), pixels/metrics/conversions
Live. Meta + OpenAI ads writes with confirm gates, pixel + conversion tracking, publish worker. Storefront (§MA8) plugs into this.
Bots
lib/bots/*
Live. Extra Hermes profiles inside the owner's box, rooms, routines.
Traces / receipts
agent_runs, decisions, vault_events, admin export
Live at admin level. Per-user CSV/JSONL export lands in §MA9.
Hermes memory
per-user ~/.hermes/memories/ (MEMORY.md, USER.md) in each Box
Structurally live (one Hermes per user). Enable + surface in Settings (§MA9). Reference: the hosted Hermes memory doc — https://hermes-agent.nousresearch.com/docs/user-guide/features/memory
Security posture
SECURITY-DECISIONS.md, lib/security/* (C18 sweep, red-team suite)
Live. Every V9 surface that touches vault, box, or payments extends these suites in the same PR.
1. Hard constraints
All C-constraints from docs/goal-air2.md §1 remain in force verbatim — C2 (no provider keys in boxes), C3 (box tokens never reach a browser), C4 (no content in Postgres), C5 (allowlist proxying), C10 (draft-only mail key), C15 (minted, scoped, single-use links), C16 (no box URL in a browser), C17 (separate mini origin), C18 (secret values never on reduced-trust surfaces). New V9 constraints:
#
Constraint
MA1
mini.wzrd.tech stays a separate origin from air.wzrd.tech. The store home, every first-party app, and every published app live on it. No cookie, storage, or session is ever shared with the main app. A "sign in" on the mini origin is its own session, minted by token handoff — never a shared cookie domain, never document.domain.
MA2
The slug in the path is a routing hint; the token/cookie is the only authorization. Loader verifies claims.app === slug on every request. A gratitude-shop cookie is 403 at alice-notes.
MA3
Published apps are static bundles in v1. HTML/CSS/JS + assets served from the platform R2 prefix through the loader with a strict CSP. No publisher server code, no publisher-supplied service workers, no secrets in bundles. Dynamic behavior comes from the platform Apps API (§MA3.3) and the owner's agent — never from publisher infrastructure.
MA4
Guests are tier-2 until the owner says otherwise. A shared multiplayer URL grants exactly the app+resource in the grant — never the owner's box shell, tools, vault, or any other app. Guest actions that would cause an owner side effect route to Needs-you, exactly like a tier-2 sender (C9/M4 rules). Guests never cause a mint of anything broader than their own re-entry token.
MA5
Access gates run server-side in the loader — visibility, password, x402, plugin sign-in. Client-side enforcement of any gate is a stop-the-line bug. Password hashes are scrypt; x402 settlement is verified with the facilitator before the response body exists.
MA6
x402 revenue settles directly to the publisher's verified wallet (users.wallet_address as payTo). The platform never custodies gate revenue. Receipts are ledgered (x402_receipts) before access is granted. Payout = settlement; there is no withheld balance to steal.
MA7
Discovery endpoints expose only visibility='public', status='published' apps and only public metadata (name, description, icon, slug, publisher username, pricing). Never emails, wallets beyond the payment address, install counts per user, or resource ids.
MA8
The public media bucket is PUBLIC. Nothing derived from vault items, inbox content, transcripts, or another user's data is ever written under a user's public prefix. Uploads pass the same log-scrubber patterns as lib/vault/scrub.ts; content-type and extension are allowlisted.
MA9
Every paid or gated open is three ledger events — gate_challenged, gate_settled (with tx hash / session id), app_opened — extending the existing mint/open/redeem logging (C15 §e5).
MA10
The agent still never learns that mini-apps exist as a special thing (ARCHITECTURE.md §2.7). It writes app state through its normal tools; surfaces decide rendering. New store apps get backing state files/tools, not bespoke agent APIs.
2. Non-goals for V9
- Publisher-supplied server code, edge functions, or custom domains for published apps. Static bundles + platform APIs only (MA3). Escalate demand; do not build.
- A general-purpose iframe of third-party websites inside the store.
- Token-gated content sales (files, media) beyond app access — the x402 gate gates the app.
- Platform fee/revenue-share on x402 gates. v1 settles 100% to the publisher (MA6). Fee split is a §10 escalation.
- Per-app subdomains (kanban.mini.wzrd.tech). The path scheme + MA2 covers isolation for now; subdomains are a later DNS/cert exercise, not architecture.
- Rebuilding any V1–V8 surface. If a store app needs something a /home panel already does, extract and share the lib — do not fork it.
3. Accounts, credentials, and verifications to obtain first
Missing credentials block milestones, not tasks — surface gaps immediately.
Service
Needed for
Notes
Cloudflare R2
MA4 — blocking for buckets, MA3 for bundles
One platform bucket + S3-compatible keys; custom domain media.wzrd.tech mapped to the bucket for public URLs.
Stripe
MA2/MA6/MA8
Standard keys + webhook secret. Connect (Standard accounts) for storefront merchants. Link is on by default in Checkout/Payment Element — no extra product to enable.
x402 facilitator
MA2
Coinbase CDP facilitator (or self-hosted from coinbase/x402). Network: Base mainnet USDC (chain 8453 — matches WALLET_CHAIN_ID). Docs: https://github.com/coinbase/x402, https://www.x402.org
Onairos
MA9 (onboarding context)
(Spelled Onairos — the prompt's "Onerous/Onairus" is this.) Developer API key. Docs: https://docs.onairos.uk / https://onairos.gitbook.io/docs
W&B (optional)
MA9 traces mirror
Only if the metadata-only Weave mirror is turned on. Export works without it.
Verify before building (the AgentMail-questions pattern — cheap tests that change the design if wrong):
x402: confirm the chosen facilitator settles exact-scheme USDC on Base mainnet and that payTo can be an arbitrary per-request address (per-publisher settlement, MA6). If facilitators require a fixed payee, escalate — the no-custody model is the point.
Onairos: confirm what a user grant returns (persona/traits JSON? memory API?) and whether tokens are per-user server-held. The integration writes context into the user's box (C4); if Onairos requires client-side SDK only, the connect step lives in the onboarding app's webview and the resulting context is posted to the control plane, then written box-side.
Stripe Connect: confirm Standard-account onboarding links can be created server-side with no platform liability shift, and that Checkout with Link works on a Connect account with on_behalf_of/direct charges. This decides whether storefront checkout is direct-charge (preferred) or destination-charge.
R2: confirm the custom-domain public bucket serves Content-Disposition/Content-Type from object metadata (media links in iMessage depend on correct types).
4. The mini-app model (read this twice)
4.1 One registry, two publisher classes
mini_apps v2 (§6, migration 0034) is the single source of truth the loader, store home, discovery index, and iMessage card mints all read. Every app row carries the full structure from the product spec:
Field
Meaning
slug
Global-unique URL key. First-party: bare reserved word (vault, calendar, onboarding…). Published: <username>-<appname> (^[a-z0-9_]{2,24}-[a-z0-9](?:[a-z0-9-]{0,38}[a-z0-9])?$), username segment must equal the publisher's users.username. Bare slugs are reserved words — a user named vault can never exist (reuse the M3 reserved-word list, extend it with every first-party slug).
name, description, icon_key
Display metadata. Icon is an R2 object under the publisher's prefix (first-party icons under _platform/), rendered everywhere the app appears.
owner_user_id
null = first-party. Else the publisher.
publisher_username, publisher_wallet, agent_identity
Denormalized at publish time from users (+ optional ERC-8004/agent-card URI for the publisher's agent). This triple is what "registers the app to the store and enables payouts." publisher_wallet must equal the publisher's verified users.wallet_address at publish time (MA6).
kind
render / input / passthrough — unchanged semantics (ARCHITECTURE.md §2.7c). Published apps are always input in v1.
visibility
public (store-listed + discoverable), unlisted (URL works, not listed), private (owner + invited guests only).
access
single (owner only) or multiplayer (any Air user with the URL can request a guest session; anonymous guests only if visibility='public' and the manifest opts in).
password_hash
Optional scrypt hash; loader challenges before session mint (MA5). Null = no password.
x402_enabled, x402_price_usdc, x402_config
Optional pay-gate (§MA2). payTo = publisher_wallet.
plugin_signin_enabled
Optional: Codex / Claude Code WZRD.Tech plugin sessions may open this app headlessly (§MA2.4).
scopes, backing_tool
Unchanged — what the app may touch, and which agent tool writes its state.
status
draft → published → suspended. Only published resolves in the loader.
4.2 URL scheme
mini.wzrd.tech/                      store home (public, SSR, SEO/AEO)
mini.wzrd.tech/store/<slug>          public app detail page (public metadata only)
mini.wzrd.tech/<slug>                the app itself, via loader v2
mini.wzrd.tech/mini/<app>            LEGACY — 301 to /<slug>; minted links keep working until expiry
mini.wzrd.tech/api/store/index.json  machine-readable registry (§MA10)
Host-aware routing in apps/web/middleware.ts: requests with Host: mini.wzrd.tech rewrite into the app/mini/ route group; the main origin never serves store routes and vice versa. MINIAPP_ORIGIN already exists in env.
4.3 Three access surfaces, one loader
Web chat (in-conversation): the agent's tool call emits a UI intent; the web chat renders an inline panel that iframes mini.wzrd.tech/<slug>?t=<token> (fresh mint per render, MA1 origin isolation does the rest).
Native tab (the mini-app loader): a new Apps tab in /home — grid of installed/first-party apps with icons; tapping one calls POST /api/mini/link and opens the returned URL in an embedded frame (or new window on mobile web). The frame requires the loader to send Content-Security-Policy: frame-ancestors 'self' <APP_ORIGIN> instead of the current X-Frame-Options: SAMEORIGIN — allow exactly the two origins, nothing else.
iMessage: the existing card flow (app() thunk mint, in-place edit) — extend CardKind to every store app the agent can send and register cooldowns in card_sends.
On every surface the user acts either by direct input (forms/actions in the view) or by asking the agent: every owner-session store app renders the shared prompt bar (§MA1.5) which runs a Hermes turn with {app, resource} metadata and re-renders. The agent plans/tool-calls; the view just re-reads state (MA10).
4.4 Sessions
Session
Minted by
Scope
TTL
Owner app session
token exchange (existing)
one app + resource, path-scoped cookie
15 min (existing)
Store session
POST /api/mini/link {app:"store"} handoff from /home, or thirdweb OTP login on the mini origin for direct visits
store home + install/launch actions; per-app sessions still minted per launch
24 h refresh
Guest session
guest grant redemption (§MA1.3)
one app + resource, guest role claim
15 min, re-entry via grant
Plugin session
WZRD.Tech plugin device-code flow (§MA2.4)
apps with plugin_signin_enabled + the Apps API
token: 30 d, revocable
MA0 — Store home at mini.wzrd.tech
The front door. Public, fast, beautiful, and readable by agents as comfortably as by humans.
Tasks
middleware.ts host routing (§4.2). Legacy /mini/<app> 301s (tokens in ?t= survive the redirect — verify the redemption still single-uses correctly through it).
Store home (app/mini/(store)/page.tsx, SSR): hero, search, category rows (Setup, Money, Create, Operate), app cards (icon/name/description/publisher/price chip for x402 apps). Public — renders logged-out. Design system: the existing dither-kit + globals.css tokens; this must look like Air, not a template.
App detail store/<slug>: metadata, publisher block (@username, agent identity link), gates disclosure (password? x402 price? multiplayer?), Open/Install CTA. Open → store session (or login) → launch. Install = pin to the user's Apps tab (miniapp_installs).
Store session auth on the mini origin: handoff mint from /home (one signed link, app:"store") + a native thirdweb OTP login page for direct visitors. MA1: this session shares nothing with air.wzrd.tech.
Launch action: POST /api/mini/launch {slug} (store session) → runs the gate chain (§MA1.2) → returns the tokened URL.
Acceptance
- [ ] mini.wzrd.tech renders the store logged-out with zero requests to air.wzrd.tech and zero cookies from it.
- [ ] An owner goes /home → Apps tab → any app in ≤2 taps with no re-login.
- [ ] A logged-out visitor can open a public + anonymous-guest app, and is OTP-challenged for anything owner-scoped.
- [ ] Legacy minted /mini/kanban?t=… links redeem exactly once through the 301.
- [ ] Lighthouse SEO ≥ 95 on home + detail pages; both fully SSR (no client-fetch waterfalls for content).
MA1 — Registry v2 + loader v2
Tasks
Migration 0034 (§6): extend mini_apps with the §4.1 fields; seed all fourteen first-party apps (slugs: onboarding, vault, connect, computer, browser, calendar, video, image, crm, analytics, inbox, pay, shop, settings) plus existing kanban, todo; reconcile the 0007 seed. Add miniapp_installs, miniapp_guest_grants, x402_receipts, user_buckets, miniapp_gate_events.
Loader v2 — refactor app/mini/[app]/route.ts from a hardcoded APPS set to a registry-driven dispatcher:
  - resolve slug → registry row (404 unless published);
  - gate chain, in order: visibility → password → x402 → session (MA5). Each gate short-circuits with its challenge page/response;
  - dispatch by kind + slug to a per-app renderer module (apps/web/lib/miniapps/apps/<slug>.tsx — split the current monolith; first-party renderers are server components/HTML exactly as today);
  - published apps (owner_user_id set): serve the bundle from R2 (§MA3) under the same session + CSP.
Guest flow (multiplayer): owner (or agent, decision-gated) creates a grant: miniapp_guest_grants (id, app_id, resource_id, created_by, max_uses, expires_at, role='guest') → share URL mini.wzrd.tech/<slug>?g=<grant>. Redemption mints a guest session (MA4 scope). Guest writes go through the app's action handlers with role='guest' — each app declares which actions guests may take; everything else becomes a Needs-you decision for the owner. Per-grant and per-IP rate limits.
Apps tab in /home (§4.3.2), including install/uninstall and the publisher's own drafts.
Prompt bar (components/miniapp/PromptBar.tsx + POST /api/mini/agent): owner sessions only; runs a turn in MAIN_SESSION with metadata: {app, resource, surface:'miniapp'}; streams status; view refetches on completion. Never available to guests or anonymous visitors.
Extend CardKind + card_sends check constraint to the new store apps the agent may send cards for (keep the cooldown).
Acceptance
- [ ] Adding a registry row (no deploy) makes an app appear in store + loader; status='suspended' kills it everywhere within one request.
- [ ] A kanban-app cookie presented at /vault is 403 (MA2 regression test moves to the registry world).
- [ ] A guest with a valid grant can act only on the granted resource; the same session replayed against another slug/resource is 403; a guest-triggered side effect appears in the owner's Needs-you.
- [ ] Password-gated app: wrong password never mints a session; the hash never leaves the server; challenge page has no token in the URL.
- [ ] The prompt bar round-trips: type "add milk to the list" in the todo app → agent tool-call → view shows it, no reload of anything but the view.
- [ ] npm run test covers: gate ordering, slug/claims mismatch, guest scope, legacy redirect redemption.
MA2 — Payments: x402 gates, Stripe, plugin sign-in
Tasks
x402 gate (lib/payments/x402.ts + loader gate): on a gated app without a paid session — respond 402 with the x402 accepts payload (scheme:'exact', network Base, asset USDC, maxAmountRequired = x402_price_usdc, payTo = publisher_wallet, resource = app URL). On X-PAYMENT header: verify + settle via X402_FACILITATOR_URL, insert x402_receipts (jti, app_id, payer, amount_usdc, tx_hash, settled_at), then mint the session with a paid claim. Use the official x402 npm packages (coinbase/x402) rather than hand-rolling verification. Human browsers (no wallet header): render a pay page driven by the same 402 payload — pay from the user's Air wallet (approval-gated wallet_transfers flow, reused) or an external wallet.
Ledger + MA9 events: gate_challenged / gate_settled / app_opened into miniapp_gate_events; receipts feed the Analytics app and the publisher's earnings view.
Stripe module (lib/payments/stripe.ts): platform account client, webhook route api/inbound/stripe (signature-verified, idempotent by event.id — same discipline as every other webhook), Checkout-session helper (Link surfaces automatically). Used by §MA6 (browser-use), §MA8 (purchase flow + storefronts).
WZRD.Tech plugin sign-in (plugin_signin_enabled apps): device-code flow — POST /api/plugin/auth/start → {user_code, verification_uri, device_code}; user approves in Settings (owner session; shows requesting tool: Codex / Claude Code); plugin polls POST /api/plugin/auth/token → scoped bearer (plugin_tokens row, hashed, revocable). Token opens plugin_signin_enabled apps via the Apps API (§MA3.3) and may drive the prompt bar's endpoint — every side effect still lands in the same decision gates as the owner's own agent. Publish the flow at /.well-known/wzrd-plugin.json so the plugins self-configure.
Acceptance
- [ ] Agent flow: curl with a valid X-PAYMENT for the exact price opens the app; receipt row has the on-chain tx hash; replaying the same payment is rejected; underpayment 402s again.
- [ ] Settlement lands at the publisher's wallet on Base — verified on-chain for a test publisher; no platform address ever holds it (MA6).
- [ ] Human flow: pay page → wallet approval → app opens; the paid claim survives cookie refresh within TTL and expires with it.
- [ ] Stripe webhook replay produces exactly one effect (idempotency test in the same PR).
- [ ] Plugin flow: Codex CLI (or a stub) completes device-code auth, opens a gated app headlessly, and the token is revocable from Settings with immediate effect.
- [ ] Red-team: a tier-2 iMessage sender cannot cause a gate mint, a payment, or a plugin approval (extend lib/security/redteam.test.ts).
MA3 — Publisher flow: register, upload, publish, earn
Tasks
Publish surface — a Publish section in the store (store session): create app → name, appname (slug preview <username>-<appname>), description, icon upload (→ publisher R2 prefix), toggles (visibility, access, password, x402 price, plugin sign-in). Writes a draft registry row. The user's agent can do the same through a miniapp_publish backing tool that stages the identical draft — publishing (the status flip) is always an owner decision (Needs-you if agent-initiated).
Bundle upload: zip of static files → server-side validation (size cap 25 MB, extension/content-type allowlist, no service workers, HTML sanitized of inline event handlers? — no: CSP does the work, but reject <meta http-equiv> CSP overrides) → unpack to apps/<slug>/<version>/ under the publisher's R2 prefix → bundle_version on the row. Serve index.html through the loader with: Content-Security-Policy: default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https://media.wzrd.tech data:; connect-src 'self'; form-action 'self'; frame-ancestors 'self' <APP_ORIGIN> — bundles talk only to the Apps API on their own origin (MA3).
Apps API (/api/apps/v1/*, session-scoped — the only connect-src): GET/PUT state (the app's own .hermes/miniapps/<slug>/<resource>.json in the session user's box — owner full access, guests per declared guest-actions), POST action (typed actions the manifest declares; side effects decision-gate), GET media-upload-url (presigned PUT to the session user's public prefix, MA8 checks). This is how published apps get dynamic behavior without publisher servers.
Agent identity: optional field on the publisher profile — an agent-card URL and/or ERC-8004 registration URI on Base. Render it on the detail page and in the discovery index. Do not build registration itself; link out.
Earnings view: publisher's x402_receipts (+ later Stripe storefront revenue) with CSV export.
Acceptance
- [ ] End-to-end: a beta user names an app, uploads a zip, flips it public, and a second user opens mini.wzrd.tech/<username>-<appname> — no deploy, no operator touch.
- [ ] The bundle cannot: reach any origin but its own Apps API (CSP report test), read another app's state, escalate a guest to owner actions, or serve a service worker.
- [ ] Agent-drafted app appears as a Needs-you publish decision; approving it lists it.
- [ ] Slug collisions with usernames and reserved words are impossible (constraint + tests both directions: username claim vs existing slug, slug claim vs existing username).
- [ ] A suspended publisher's apps 404 within one request; their bundle prefix is inert.
MA4 — Per-user public media buckets (R2)
Every user gets public URLs for media — for storefronts, published apps, agent-generated content, and sharing.
Tasks
One platform R2 bucket, custom domain media.wzrd.tech, public read. Per-user prefix u/<username>/ recorded in user_buckets (user_id, prefix, bytes_used, quota_bytes default 2GB). lib/storage/r2.ts: S3-compatible client (keys server-side only, C2-adjacent), presigned PUT mint, HEAD/usage accounting, delete.
Upload paths: (a) owner uploads from any owner surface via presigned PUT; (b) the agent publishes box files via a media_publish allowlisted control-plane call — control plane pulls the file from the box (capped, like assets/pipeline.ts's readCapped), runs MA8 checks (content-type allowlist: images/video/audio/pdf/txt/json; scrub patterns on text; size caps), writes to the prefix, returns the public URL to the agent. The box never holds R2 keys.
MA8 enforcement is code, not review: shared lib/storage/guard.ts used by every write path; vault-pattern scrubber on text uploads; EXIF strip on images (reuse the CC4 strip approach).
Quota + usage in Settings; deletion cascade includes the prefix (extend /api/admin/delete).
Migrate mini-app icons and storefront product images to this lane. (Creative-asset delivery URLs stay on the existing private signed-URL pipeline — different threat model; do not merge them.)
Acceptance
- [ ] "Put this image at a public link" in chat → agent → media_publish → https://media.wzrd.tech/u/<username>/… loads logged-out, correct content-type.
- [ ] A vault value, an email body, and a transcript snippet all fail the guard when smuggled through every write path (tests per path).
- [ ] R2 keys appear nowhere in a box (grep sweep — extend the C18 harness) and nowhere in a browser.
- [ ] Quota exceeded → clean refusal, usage visible in Settings; user deletion leaves zero objects under the prefix.
MA5 — Store apps, wave 1: the setup four
Store numbers refer to the product list. Each app = registry row + renderer + (where noted) backing state/tool. All are input kind unless noted.
#1 Onboarding (onboarding) — the front-door experience
Guided, resumable steps; each writes real state, none blocks the next: (1) username (existing /api/settings/username), (2) email ID — provision the AgentMail inbox on username set (existing lib/provisioning/email.ts), show <username>@wzrd.tech; (3) Connect accounts — Composio Connect Links for Gmail / Google Calendar (+ Apple Calendar via the ICS/cal.com path that already exists — label it honestly); (4) Onairos personal context (§MA9.2) — connect, preview what the agent will know, consent, import; (5) Secrets — choose native vault or bring-your-own (Bitwarden/1Password — lib/vault/managers.ts already does this) and add first login/card; (6) meet your agent — first prompt-bar exchange. Progress persists per-user (.hermes/miniapps/onboarding/state.json, C4). Acceptance: a fresh beta user reaches a working, personalized agent with mail + calendar + one secret in ≤ 10 minutes, all on their phone, and every step is skippable + re-enterable.
#2 Secrets / Card Manager (vault)
Exists as the vault mini-app + panel. Finish: register in the registry with icon/description; card-manager affordances (default card for purchase flows, per-site grants surface from grant_site/revoke_site events); manager choice (native/Bitwarden/1Password) surfaced here, not only in Settings. Reveal rules unchanged (C18/C20: card number/CVV never on the mini surface). Acceptance: existing vault-redteam.test.ts still green after the registry refactor; a Bitwarden-backed item fills a purchase exactly like a native one.
#3 Composio Auth (connect)
One screen to sign into everything: toolkit grid (existing /api/connectors + listToolkits), status chips, connect → hosted Connect Link → return; disconnect revokes. Add the "used by" hints from the Connectors tab. Acceptance: connecting Gmail here results in the agent reading mail within one turn (M7's acceptance, now on the store surface).
#14 Settings (settings)
Consolidate: username (cooldown-aware), speed tier, timezone, memory viewer (§MA9.1), plugin sessions (list/revoke, §MA2.4), bucket usage (§MA4), trace export (§MA9.3), contact card link, deletion/export requests. Acceptance: no setting anywhere in the product exists only outside this app; every write is the existing API, no new mutation paths.
MA6 — Store apps, wave 2: the operational five
#4 Computer Use (computer) — passthrough, exists
Register + description/icon. Add the task state header the spec asks for: before redirecting to the stream, render a one-glance state page (box power state from box_state_events, current/last run from agent_runs, screenshot thumbnail via the existing server-fetched path) with "Watch live" → the proxied stream (C16 unchanged). Acceptance: no *.on.ascii.dev URL in devtools (existing test), state page renders in <1s with a stopped box (no wake just to look).
#5 Browser Use (browser) — passthrough + purchase stop, exists
Register. The payment-stop flow already exists (purchase_review → fill ticket → human clicks Place order). Add Stripe Link preference: when the checkout host supports Link, the review card offers "Pay with Link" — approval opens the merchant's Link flow instead of a card fill; either way the stop-before-submission invariant is untouched. Acceptance: the purchase red-team suite extends to the Link path; deny still works box-down.
#6 Calendar (calendar) — exists, upgrade
Color-coded persona tabs (Work/Personal/custom): calendar_sources gets a persona + color; views filter by tab. People images: events with known attendees show CRM avatars (#9's store, falling back to dither avatars). Sync stays the existing spine. Acceptance: same event from two sources dedupes as today; persona filter is pure view-state (no schema fork of the spine); attendee resolution never leaks outside the owner session.
#11 AgentMail Inbox (inbox)
Thread list → thread view → reply/compose as drafts — send remains control-plane-after-approval only (C10 is structural; the inbox UI must not add a send path). Unread/blocklist surfaces reuse People/tiers. Backing: lib/agentmail/client.ts (getMessage/replyToMessage/createDraft/sendDraft/blocklists exist — add thread/message listing to the client, it is the one missing call). Acceptance: composing here yields a draft + Needs-you entry, zero sent mail until approved; an email from a blocked sender never renders a remote image (proxy/strip images — this is a reduced-trust surface).
#9 Personal CRM (crm)
People + context, owner-scoped: box-side store .hermes/miniapps/crm/people.json (rich records: name, photos → owner's R2 prefix or private, notes, tags, links to senders ids) with backing tool crm_update so the agent maintains it from conversations (decision-gated for tier-derived edits). Views: list/detail/merge-with-sender. Feeds calendar avatars (#6) and People tab. Acceptance: C4 holds (Postgres gains only the senders links that already exist); deleting a person leaves no orphan images; agent-written updates show provenance.
MA7 — Store apps, wave 3: the creative three
#8 Image Editor (image) — layered
Layered documents: .hermes/miniapps/image/<doc>.json (layer stack: source asset ids, transforms, text layers, blend/opacity) + rendered flats via the creative lane. Direct input: layer list, reorder, opacity, text; generation/edit ops go through the agent (prompt bar: "remove the background on layer 2" → existing creative router). Export → R2 public URL or private delivery. Acceptance: a 3-layer doc survives box stop/resume; every generation is metered through the existing creative limits; export respects MA8.
#7 Video Editor (video) — Hyperframes
Timeline documents: .hermes/miniapps/video/<doc>.json (clips = asset refs, trims, order, captions, audio track) driving Hyperframes/ffmpeg renders in the user's box (the template's creative plugin owns rendering; add a video_render job kind through the existing creative job flow so limits/receipts apply). Views: storyboard strip + preview of the last render + prompt bar ("tighten cut 2, add captions"). Acceptance: render receipts land in the creative job ledger with costs; a 60s 1080p render completes on the default box size or degrades with an honest message; no render bytes transit Postgres.
#10 Analytics (analytics)
One read-only surface over ledgers that already exist + V9's new ones: agent activity (agent_runs by day/trigger), ads (existing ads/analytics + metrics), funnels/pixels (existing), store analytics (per-app opens/gates/receipts from miniapp_gate_events + x402_receipts), storefront revenue (§MA8), spend vs cap. Per-publisher scoping: a publisher sees their apps' numbers only. CSV export per panel. Acceptance: numbers reconcile with the underlying tables in tests (no drifting aggregates); zero write paths; renders with a stopped box.
MA8 — Commerce: purchase flow + the agent-first storefront
#12 Purchase flow with Stripe Link (pay)
The generic "agent needs to buy / user needs to pay" surface: a payment_request decision kind renders here (and as an iMessage card): amount, payee, memo → approve = Stripe Checkout (Link) for fiat or wallet transfer (existing flow) for USDC. Storefront checkouts (#13) and x402 human-pay (§MA2) reuse these pieces. Acceptance: webhook-confirmed payment flips the decision + notifies through the normal channels; abandoned sessions expire; replay-safe.
#13 Agent-first storefront (shop) — the big one; sequence it last
A native, agent-first Shopify: (a) Merchant onboarding — Stripe Connect Standard account link, status on the row (merchants table: user_id, stripe_account_id, charges_enabled). (b) Products — physical/digital/service/event-ticket: box-side catalog .hermes/miniapps/shop/catalog.json (agent edits it conversationally via shop_update; publish is a decision) + published projection into storefront_products (public metadata only — price, name, images on R2, inventory count; C4 kept by storing published listing data, which is public by definition). (c) Storefront pages — mini.wzrd.tech/<username>-shop (a first-party-rendered published app, auto-provisioned per merchant): listing + product pages, SSR, SEO/AEO like the store itself. (d) Checkout — Stripe Checkout (Link) direct-charge on the merchant's Connect account; tickets get QR receipts (reuse lib/wallet/qr.ts); orders table + webhook fulfillment; event check-in view. (e) Funnel + tracking — every storefront/product URL carries the existing pixel/conversion machinery (ads pixels + conversions) so funnels are measurable end-to-end (visit → checkout → conversion), attribution stored against the link. (f) Marketing loop — "promote this product": agent generates creatives (existing creative lane) from product images + copy, proposes posts through the existing publish pipeline (IG/FB/TikTok/X/YouTube adapters), and retargeting campaigns through the existing Meta + OpenAI ads writes with their confirm gates. Nothing in (f) is new machinery — it is wiring the storefront as a publish source (lib/publish/sources/ecommerce.ts already anticipates this). Acceptance: a merchant goes zero → live product page → real Link checkout → order visible → agent proposes a promo post + retargeting ad (both decision-gated) in one afternoon of conversation; platform never touches merchant funds; refunds happen in Stripe and reconcile via webhook; the funnel numbers for one test purchase appear in Analytics.
MA9 — Memory, Onairos, traces
MA9.1 Persistent memory (exists — surface it)
Per-user memory is already structural (one Hermes per user; ~/.hermes/memories/MEMORY.md + USER.md — hosted docs: hermes-agent.nousresearch.com/docs/user-guide/features/memory). Tasks: ensure the template config enables memory (memory.memory_enabled: true, approval mode per the box's approvals posture) — template change + UPGRADE.md note; Settings Memory section: view both files (box read through the control plane, owner session only), edit USER.md, clear-with-confirm; include both files in /api/admin/export. Acceptance: a preference stated on iMessage today is reflected in tomorrow's web chat (memory survives stop/resume — it's the same filesystem); memory contents never appear in Postgres or logs.
Deep memory beyond the two prompt files (semantic recall over ingested iMessage history + Onairos context, via OpenViking as a per-box MCP server; Hindsight optional) is spec'd in docs/memory-upgrade.md — read it before touching the memory layer.
MA9.2 Onairos onboarding context
Connect step in #1: Onairos grant (their SDK/hosted flow — verify §3.2) → control plane receives the persona/context payload → writes ~/.hermes/context/onairos.md (+ structured JSON beside it) in the user's box → agent reads it like any file; USER.md gets one line pointing at it. Re-sync button; disconnect deletes the files. Store only connections-style metadata (provider onairos, status) in Postgres. Acceptance: post-connect, the agent demonstrably knows a preference that was never typed into Air; disconnect leaves zero Onairos-derived bytes box-side or platform-side.
MA9.3 Traces + CSV/JSONL export
Per-user observability without a new vendor: Traces view in Settings (or Analytics): agent_runs joined with decisions, vault_events, miniapp_gate_events, creative jobs — the receipts layer (content stays box-side, C4). GET /api/me/traces/export?format=csv|jsonl&from&to: streams the receipts; &include=transcripts additionally pulls the owner's session transcripts from their box via the existing allowlisted sessions paths, into the JSONL. Optional W&B mirror behind WANDB_API_KEY: forward receipt metadata only (never content) as Weave traces; off by default; document the C4 boundary in code. Acceptance: JSONL of a day's activity round-trips into a dataframe with stable keys; export of a deleted user 404s; W&B off = zero egress.
MA10 — Discovery: SEO, AEO, and agent-readable everything
"Discoverable by our Hermes agent, external Hermes agents, Codex, Claude Code, OpenClaw" = the store is legible to crawlers and to tool-using agents that read text.
Tasks
SEO: SSR everywhere public; per-app <title>/<meta> + OpenGraph (icon-derived OG image, generated once into _platform/ R2); sitemap.xml (home, details, public storefronts); robots.txt; canonical URLs; JSON-LD SoftwareApplication per app (+ Offer with USDC price for x402 apps) and Product/Event on storefront pages.
AEO: llms.txt at the mini-origin root (what the store is, how to open/pay/publish, links) + per-app mini.wzrd.tech/store/<slug>/agent.md — plain-markdown app cards: what it does, URL, gates, how an agent opens it (token? x402 402-flow? plugin sign-in?), the Apps API actions it accepts.
Machine registry: GET /api/store/index.json — array of public apps (name, description, slug, url, publisher{username, agent_identity}, gates{password: bool, x402: {price_usdc}|null, plugin_signin: bool}, access, updated_at). MA7 fields only. ETag + cache headers.
In-agent discovery: the user's own Hermes gets a store_search backing tool (reads the same index server-side) so "find me an app that…" works in-conversation and can hand back an open-ready card.
Storefront pages inherit all of 1–3 automatically (they are store apps).
Acceptance
- [ ] curl mini.wzrd.tech/llms.txt + index.json + one agent.md are sufficient for a stranger's agent to find, pay (x402), and open a gated app with zero human help — run this literally with a scripted client.
- [ ] Google Rich Results test passes on an app detail page and an event product page.
- [ ] Private/unlisted apps appear in none of: sitemap, index.json, llms.txt, store search (MA7 test).
MA11 — Hardening + ops (before calling V9 done)
Red-team wave (extend lib/security/): guest-session escalation attempts, bundle CSP escapes, x402 replay/short-pay, gate-order bypasses (password vs x402 vs visibility in every order), prompt-injected agent attempting: self-publish, gate-strip, quota-drain uploads, payout redirection. Payout redirection must be impossible by construction (MA6: payTo read from users.wallet_address at challenge time, never from the manifest).
Deletion/export extended: registry rows, bundles + media prefix, receipts (export then anonymize payer), guest grants, plugin tokens, merchants (Stripe account de-link), Onairos files. One script, tested on a real account (M8 bar).
Ops counters in /api/admin/ops: store opens/day, gate settles/day + revenue, uploads + bytes/day, guest sessions/day, publish events; alert on receipt/settle mismatch and on upload-guard rejections spiking (someone probing MA8).
Rate limits: launches per session, guest redemptions per grant/IP, uploads per user/hour, publishes per day.
Load: the store home and index.json cached at the edge; loaders stay dynamic.
5. Environment variables (additions — all server-side, none NEXT_PUBLIC_)
# R2 (MA4)
R2_ACCOUNT_ID=            R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=     R2_BUCKET=air-media
R2_PUBLIC_BASE_URL=https://media.wzrd.tech

# Payments (MA2/MA8)
STRIPE_SECRET_KEY=        STRIPE_WEBHOOK_SECRET=
X402_FACILITATOR_URL=     X402_NETWORK=base

# Onboarding context (MA9)
ONAIROS_API_KEY=

# Plugin sign-in (MA2.4)
PLUGIN_TOKEN_SIGNING_KEY=

# Optional trace mirror (MA9.3)
WANDB_API_KEY=            WANDB_PROJECT=air-traces
Existing and unchanged: MINIAPP_ORIGIN=https://mini.wzrd.tech, MINIAPP_SIGNING_KEY, WALLET_CHAIN_ID=8453, everything in lib/env.ts. Extend lib/env.ts accessors; never read process.env at call sites.
6. Schema — migrations 0034+ (forward-only, RLS default-deny, service-role writes; user_id uuid not null everywhere it applies — C7)
Sketches, not gospel — keep names, refine types in review:
-- 0034_miniapp_store.sql
alter table mini_apps
  add column owner_user_id uuid references users(id) on delete cascade,
  add column name text not null default '',
  add column description text not null default '',
  add column icon_key text,
  add column publisher_username citext,
  add column publisher_wallet text,
  add column agent_identity text,
  add column visibility text not null default 'private'
    check (visibility in ('public','unlisted','private')),
  add column access text not null default 'single'
    check (access in ('single','multiplayer')),
  add column password_hash text,
  add column x402_enabled boolean not null default false,
  add column x402_price_usdc numeric(10,6),
  add column x402_config jsonb,
  add column plugin_signin_enabled boolean not null default false,
  add column status text not null default 'published'
    check (status in ('draft','published','suspended')),
  add column bundle_version text,
  add column listed_at timestamptz,
  add column updated_at timestamptz not null default now();
-- first-party seed reconciliation + published-slug format constraint here.

create table miniapp_installs (
  user_id uuid not null references users(id) on delete cascade,
  app_id  uuid not null references mini_apps(id) on delete cascade,
  installed_at timestamptz not null default now(),
  primary key (user_id, app_id)
);

create table miniapp_guest_grants (
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id) on delete cascade,
  resource_id text not null,
  created_by uuid not null references users(id) on delete cascade,
  max_uses int not null default 25,
  uses int not null default 0,
  expires_at timestamptz not null,
  revoked_at timestamptz
);

create table x402_receipts (
  jti text primary key,
  app_id uuid not null references mini_apps(id) on delete cascade,
  payer_address text not null,
  amount_usdc numeric(12,6) not null,
  tx_hash text not null,
  settled_at timestamptz not null default now()
);

create table miniapp_gate_events (   -- MA9 challenged/settled/opened
  id uuid primary key default gen_random_uuid(),
  app_id uuid not null references mini_apps(id) on delete cascade,
  user_id uuid references users(id) on delete set null,
  kind text not null check (kind in ('gate_challenged','gate_settled','app_opened')),
  ref text,
  created_at timestamptz not null default now()
);

create table user_buckets (
  user_id uuid primary key references users(id) on delete cascade,
  prefix text not null unique,
  bytes_used bigint not null default 0,
  quota_bytes bigint not null default 2147483648
);

create table plugin_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  tool text not null,                -- 'codex' | 'claude-code' | ...
  token_hash text not null unique,
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

-- 0035_commerce.sql: merchants, storefront_products, orders, payment_requests
-- (public listing data only; catalogs stay box-side — see MA8b)
7. Conventions (carried, plus)
- Everything in docs/goal-air2.md §6 stands: TS strict, no any in lib/, all Box/Hermes calls through lib/box/lib/hermes, forward-only migrations, idempotency test in the same PR as every webhook, structured logs with user_id.
- New lanes get the same wrapper discipline: lib/payments/, lib/storage/, lib/plugin/ — no fetch to Stripe/R2/facilitator from route handlers.
- Every gate, guard, and scope check ships its negative tests in the same PR (the suite in lib/security/ is the pattern).
- Renderer modules per app under lib/miniapps/apps/ — the loader route file must shrink in this refactor, not grow.
8. Verification before calling a milestone done
npm run typecheck && npm run lint && npm run test — all of it, not the changed slice.
The milestone's acceptance boxes, executed against a real forked box and the real mini origin — not mocks, not localhost-only.
The origin test: from a store page, devtools shows zero cookies/requests to air.wzrd.tech (and vice versa), zero *.on.ascii.dev, zero R2 keys, zero tokens in URLs post-load.
The stranger test: a second real user + an anonymous browser walk the surface — everything they can see is intended-public (MA7), everything they can't fails closed.
The replay test: every new webhook (Stripe) and every settle/redeem path — three replays, one effect.
The C18 grep sweep (scripts/c18-box-sweep.sh) extended with R2/Stripe/facilitator key patterns — zero hits box-side.
9. Order of operations + Devin child-session plan
Dependency spine: MA0+MA1 → MA2 → {MA3, MA4} → everything else. Suggested sessions (child sessions are cheap; merge conflicts are not — each owns disjoint paths):
Session
Scope
Blocked by
A (foundation)
MA0 + MA1 + migration 0034
—
B (payments)
MA2
A
C (publisher+storage)
MA3 + MA4
A (MA3's earnings view finalizes after B)
D (setup apps)
MA5 (#1 #2 #3 #14)
A; #1's Onairos step stubs until H lands
E (operational apps)
MA6 (#4 #5 #6 #11 #9)
A; #5's Link piece after B
F (creative apps)
MA7 (#8 #7 #10)
A; #10 finalizes after B/G ledgers exist
G (commerce)
MA8 (#12 #13) + 0035
B + C
H (platform)
MA9 (memory, Onairos, traces)
A only — start early, it's independent
I (discovery)
MA10
A + C (needs published apps to index)
Final
MA11 hardening
all
Do not parallelize within the spine (A before B before G). D/E/F/H can run concurrently with B/C. One session owns app/mini/[app]/route.ts at a time — it is the merge-conflict magnet; the renderer-module split in MA1.2 exists precisely so later sessions touch only their own lib/miniapps/apps/<slug>.tsx.
10. Escalate to a human, do not decide
Any C- or MA-constraint appears to block a task. The constraint is right.
x402 facilitator cannot settle per-request payTo (breaks MA6's no-custody model), or any pressure to custody publisher funds "temporarily."
Platform fee / revenue share on gates or storefronts — commercial decision, not yours.
Any request for publisher server code, custom domains, or third-party embeds (MA3/non-goals).
Anything that would put a secret, a box URL, an R2 key, or an unexpiring token in a browser or a bundle.
Onairos or Stripe Connect verification (§3) coming back materially different from the assumed shape.
Weakening a decision gate anywhere — including "guests are probably fine" and "the agent can approve its own publish."