# air 2.0 — Mini-Apps Platform: Review, Design Pass & Feature Ideas

**Date:** 2026-08-20 · **Scope:** `lib/miniapps/**` (51 files), `app/mini/**`, `app/api/{mini,apps,miniapps,store,cards}/**`, Spectrum delivery path · everything verified in code. Cross-references: security/correctness findings P0-2/3/4 and P1-10 live in `01-engineering-review.md`.

---

## 1. How the platform actually works (map)

**Registry as source of truth.** `mini_apps` (migration 0034) holds slug, kind, owner, visibility/access/status, password hash, x402 fields, bundle version. `lib/miniapps/registry.ts` reads per-request, so suspension is instant. `middleware.ts` does host routing on `mini.wzrd.tech` (`/<slug>` → `/mini/<slug>` rewrite with a spoof-stripped `x-mini-host` marker).

**Chat → app.** The agent never learns mini-apps exist (MA10): its tools write box-side JSON at `.hermes/miniapps/<app>/<resource>.json`; views re-read the same file. From web, the Apps tab or quick buttons call `POST /api/mini/link` → `mintSignedLink` → opens `mini.wzrd.tech/<slug>?t=<token>` **in a new tab**. The goal.md §4.3.1 inline-iframe chat panel does not exist yet — and `lib/miniapps/html.ts`'s `frame-ancestors 'self'` would block it (fixing this is a prerequisite for the redesign's "apps load in chat"; see spec §5).

**Token exchange (C15).** HMAC claims `(userId, app, resourceId, jti, exp, role?, grantId?)`; loader verifies → `redeemOnce` (first insert wins; replay 403) → 303 with token stripped + HttpOnly cookie path-scoped to `/<slug>`, 15 min. Every request re-runs the full gate chain: visibility → password (scrypt, proof cookie 1h) → x402 (Base USDC, exact scheme, `payTo` from `users.wallet_address` at challenge time, nonce ledger) → session. Gate events ledger to `miniapp_gate_events`.

**Guests (MA4).** Owner-minted resource-scoped grants (max_uses CAS, expiry/revoke, throttles); guest cookies carry `role:'guest'`; loader filters POSTs by each module's `guestActions`. Storefront is the one `publicAccess` module (anonymous synthetic owner-scoped session).

**iMessage (Spectrum).** Inbound: HMAC + staleness → resolve → dedupe → 200 → `after()` work; tier-2 senders mint nothing (redteam-tested). Outbound: `sendApp` uses a live thunk `app(() => mintSignedLink(...))` so no URL is stored; `card_sends` gives per-(user, kind) cooldowns. **Send paths exist for only 4 of 16 card kinds** (computer, browser, vault purchase-review, calendar invite) — the other 12 registered kinds are dead (F11 below).

**Publishing (MA3).** Draft via store session or agent staging (decision-gated); slug = `<username>-<appname>` with reserved-word guards; icon through the MA8 guard to R2; bundle through a dependency-free zip validator (25MB/100MB/500 files, extension allowlist, SW + CSP-meta rejection) to immutable `apps/<slug>/v<ts>/`; owner flips status (rate-limited 20/day); served under a strict publisher CSP (`script-src 'self'`, `worker-src 'none'`). Suspension kills loader+assets+discovery within one request.

**Apps API (MA3.3).** Published bundles get a second HttpOnly cookie scoped to `/api/apps`: `GET/PUT v1/state` (owner box file, 256KB, guests read-only), `POST v1/action` (only manifest-declared actions; they *never execute* — they append to `actions.json` for the owner's agent to pick up through decision-gated tools), presigned media uploads with quota pre-charge + confirm re-guard.

**Discovery (MA10).** One projection feeds `/api/store/index.json`, `llms.txt`, `sitemap.xml`, `robots.txt`, `/store/<slug>/agent.md` (gates + how-an-agent-opens-it + manifest actions), JSON-LD, and the agent's `store_search` tool.

This is a real platform: origin isolation, capability tokens, payments, publishing, discovery — all present and mostly tested. The gaps below are almost all "built but not wired."

## 2. App catalog + design-standards pass

Standard for "up to standard": handles loading/empty/error + box-asleep states, owner/guest roles asserted, consistent header/nav, an agent prompt affordance where an owner is present, and no dead buttons.

| App | Quality today | States | To reach standard |
|---|---|---|---|
| kanban | spartan | ✗ empty, ✗ error, ✗ StartLimit | Wrap render/action like `crm.tsx:105-115`; empty-state; **Share link UI** (grants exist, no UI); prompt bar |
| todo | spartan | ✗ (same) | Same as kanban |
| computer | decent | ✓ all | — (owner-only enforced; screenshot-when-awake is by design) |
| browser | minimal (by design) | ✓ | — |
| calendar | decent-polished | ✓ | Color input → swatch picker; prompt bar |
| vault | polished shell | ✓ | Fix: action responses drop pending purchase cards (`vault.tsx:266` hard-codes `reviews=[]`) |
| connect | decent | partial | Catch `listToolkits()` failure (currently uncaught → 500) |
| onboarding | decent-polished | ✓ | Swap step-4 Onairos stub for the real `lib/onairos/sync.ts` (F6) |
| settings | decent | ✓ | **Mount the three built sections** (memory/traces/onairos) — 5 of 9 sections say "coming soon" while 3 backends shipped (F5) |
| inbox | decent | ✓ | Pagination + unread; reply-all option; prompt bar |
| crm | decent | ✓ | Search; senders cap >50 |
| image | decent | pending ✓ | **Real `publicExporter`** — "Public link" is a permanent dead end (F7); StartLimit wrap |
| video | decent | ✓ render states | StartLimit wrap |
| analytics | decent | ✓ | Trend sparklines (SVG pattern exists in ads-analytics); gate-conversion rate |
| pay | decent | ✓ | **Assert owner role** (comment claims it, code doesn't — F14); StartLimit wrap |
| shop | decent | ✓ | Assert owner role (F14) |
| storefront | decent | ✓ | Quantity → number input (server already clamps) |
| published | n/a | ✓ | Fix x402-payer 500 (P0-3) |

Cross-cutting design gaps to standardize (all apps): one shared app-shell header (icon + name + owner chip + "open in store"), one empty-state pattern, the shared **prompt bar** (`components/miniapp/PromptBar.tsx` + `/api/mini/agent` are fully built and imported by *zero* files — F8), and a styled session-expiry page (today: bare text "no session — open this from your card", F13).

## 3. Platform findings (verified; highest first)

1. **[HIGH → P0-2]** x402 settle at `/api/mini/launch` burns payment without access (cookie path mismatch). `x402.ts:341`, `middleware.ts:76-83`.
2. **[HIGH → P0-3]** Paying x402 visitor 500s on first state fetch (`x402:<payer>` hits a uuid box lookup). `apps/v1/state:26-33`.
3. **[HIGH → P0-4]** No writer for `x402_enabled/password_hash/plugin_signin_enabled/access` — publisher gates unreachable. `publish.ts:91-106`.
4. **[MED]** kanban/todo/image/video never catch `StartLimitError` → raw 500 instead of the "computer is starting" page. `store.ts:61`, `kanban.tsx:41-48`.
5. **[MED]** Built Settings sections (`sections/{memory,traces,onairos}.tsx`) imported nowhere; Settings shows "coming soon" for shipped backends. `settings.tsx:128-166`.
6. **[MED]** Onboarding step 4 uses the `available:false` Onairos stub though `lib/onairos/sync.ts` landed. `apps/onairos.ts:21-25`.
7. **[MED]** `publicExporter` placeholder although the media lane it waits for exists. `publicExport.ts:27-35`.
8. **[MED]** Shared prompt bar + `/api/mini/agent` are dead code; goal.md wants it on every owner-session app (2/16 today). `PromptBar.tsx:13`.
9. **[MED]** Store `LaunchButton` answers every 402 with "payments are coming soon" though the pay page shipped; owners of paid apps also 402 (owner exemption needs a cookie launch never gets). `LaunchButton.tsx:36-39`.
10. **[MED → P1-10]** Agent `media_publish` skips rate limit + ops ledger. `api/media/publish:81-140`.
11. **[MED]** 12 of 16 `card_sends` kinds have no send path — agent can't send kanban/todo/inbox/pay/onboarding cards. `cardSends.ts:12-28`.
12. **[MED → P1-5]** `pending_uploads` sweeper promised, never built → quota leak. `0039`, `confirm.ts:41-58`.
13. **[LOW]** Session-expiry dead end (bare text, form contents lost). `gates.ts:186-190`.
14. **[LOW]** pay/shop/settings comment "owner sessions only" but never assert `role` — one registry flip to `multiplayer` exposes payment queues to guests. `pay.tsx:60`.
15. **[LOW]** First-party pages send `frame-ancestors 'self'` + XFO SAMEORIGIN; goal.md §4.3.2 requires `'self' <APP_ORIGIN>` for the /home embed — **prerequisite for the redesign's in-chat apps**. `html.ts:11-13`.
16. **[LOW]** `SERVICE_WORKER_RE` matches only the literal string (obfuscation passes); CSP `worker-src 'none'` is the real guard — don't claim upload-time rejection.
17. **[LOW]** Store "Work" category lists kanban/todo which 0034 made private → permanently dead config. `(store)/page.tsx:40-41`.
18. **[LOW]** Vault action responses drop pending purchase cards. `vault.tsx:266`.
19. **[LOW]** Store session TTL 7d vs specified 24h-with-refresh. `storeSession.ts:18`.

## 4. Feature ideas (ranked; every one rides existing rails)

1. **Mount the three built Settings sections** (memory/traces/onairos) — pure wiring; turns three shipped milestones from dark to live.
2. **Swap the Onairos stub** for `lib/onairos/sync.ts` — onboarding step 4 lights up.
3. **Real `publicExporter`** (~30 lines over guard + R2 + `publicUrl`) — image "Public link" and shareable video renders.
4. **Generic agent card route `POST /api/cards/[kind]`** — `claimCardSend` already supports all 16 kinds; completes the "agent emits → card appears in iMessage" loop everywhere.
5. **Publisher gate settings** (P0-4 fix) — the ~100 lines that unlock paid/password/plugin apps, i.e. store monetization.
6. **Finish the human x402 purchase path** — LaunchButton 402 → navigate to `/<slug>` pay page; "Request from my wallet" files a `payment_request` (pay app + iMessage decisions already render them).
7. **Share-link UI for kanban/todo** — grants + guest sessions fully built/tested; add a "Share" form; instant multiplayer demo.
8. **Prompt bar everywhere** — copy image.tsx's `action=prompt` handler into the shared shell; "ask your agent" on every owner surface (MA1.5).
9. **Show store icons** — `icon_key` is uploaded and stored but rendered only in OG tags; show `<img>` on store home/detail. (Also feeds the redesign's icon-grid App Store.)
10. **`pending_uploads` sweeper** — closes the quota leak inside the existing cron.
11. **Onboarding card at provisioning** — kind exists; send it from the M3 claim flow so a new user's first tap lands in setup.
12. **Analytics deep-links + gate-conversion rate** — both event kinds already ledgered; link Publish ↔ analytics CSV.
13. **Storefront products in discovery** — per-product URLs/Offer JSON-LD from `storefront_products`; merchant catalogs become agent-shoppable.
14. **In-place card edits** — persist the Spectrum card ref alongside `card_sends`, add `editApp` to `lib/spectrum/sender.ts`; purchase cards flip to "Approved" without a second bubble.
15. **`store_search` open-ready replies** — include a `card_kind` hint per result so "find me an app that…" ends with a launchable card in the same turn.

Ideas 1-3 + 9 + 17 (store category fix) are also prerequisites/quick wins for the App Store redesign in `03-redesign-spec.md`.