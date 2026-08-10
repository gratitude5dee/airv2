# Phase 0 — creative surface verification (goal-creative.md §3)

Answers to V1–V7, verified 2026-08-10. Each entry states the answer, the
evidence, and what it changes in the CM0–CM8 plan.

## V1 — ChatGPT Ads: full campaign-management API exists

**Answer: yes — OpenAI now ships a full Advertiser API, so ChatGPT Ads is an
adapter (CM6 tier 1), not just an export target.**

- `https://api.ads.openai.com/v1` exposes CRUD for campaigns, ad groups, ads,
  files (creative upload), insights, a bulk async API, product feeds, and
  conversions ([Ads API overview](https://developers.openai.com/ads/api-overview),
  [quickstart](https://developers.openai.com/ads/api-quickstart)).
- Auth: an API key issued in the Ads Manager Settings tab, scoped to **one ad
  account**, sent as a bearer token. Partner access (multi-client) is by
  request to OpenAI.
- Plan change: CM6's OpenAI lane upgrades from "export package + Conversions
  API inbound" to a real write adapter — which means it falls under the CC0
  approval gate exactly like Meta. The per-account API key is a
  user-provisioned credential; note goal.md §2 forbids a screen that asks the
  user for a platform API key, so custody design (Composio custom toolkit vs
  an encrypted control-plane vault) is a CM6 prerequisite decision.

## V2 — Meta Ads MCP can be scoped per user

**Answer: yes — per-user OAuth, no Business-Manager-per-client assumption.**

- `https://mcp.facebook.com/ads` is Meta-hosted (launched 2026-04-29), authed
  with Meta Business OAuth at connect time: the connecting user picks ad
  accounts/Pages and one of three scope tiers (read-only, read/write,
  read/write/financial). No developer app, no app review
  ([Meta Ads MCP/CLI overview](https://mcp.directory/blog/meta-ads-cli-mcp)).
- Access is scoped to whatever the authorizing Meta login can touch, so one
  MCP registration per box = one user's ad accounts. Exactly the shape we want.
- Open sub-question (probe in CM6 session 1): whether `hermes mcp add` can
  complete the OAuth handshake for a remote MCP from inside the box (the
  Composio MCP add in `lib/provisioning/connectors.ts` uses a pre-authed URL;
  Meta's flow needs an interactive browser step). If not, the control plane
  brokers the OAuth and injects the resulting connection — the CC0 gate sits
  in front of write tools either way.

## V3 — Instagram publishing: Composio toolkit is sufficient (thin adapter)

**Answer: Composio — the toolkit models the container→poll→publish flow.**

- The [Composio Instagram toolkit](https://docs.composio.dev/toolkits/instagram)
  has `INSTAGRAM_POST_IG_USER_MEDIA` (create container),
  `INSTAGRAM_GET_POST_STATUS` (poll processing),
  `INSTAGRAM_POST_IG_USER_MEDIA_PUBLISH` (publish; auto-polls FINISHED with
  backoff), and `INSTAGRAM_GET_IG_USER_CONTENT_PUBLISHING_LIMIT` (live cap
  read for CC8). Long-video processing (30–120s) is handled by the toolkit's
  own polling.
- Composio keeps token custody (matches M7); no Graph client of our own.
- CM3's Instagram adapter is thin: our `PublishAdapter` drives the toolkit
  actions and maps Graph error codes (9007 processing, 10 missing scope) to
  the CC6 verdicts. Note: no native scheduling — our cron fires the publish
  (already the CC1 design).

## V4 — TikTok Content Posting API review

**Answer: submit day one; expect days–2 weeks; `video.publish` needs both app
approval and a post-integration audit.**

- TikTok's [App Review FAQ](https://developers.tiktok.com/doc/getting-started-faq):
  review takes "several days to two weeks"; no official timeline guarantee.
- Direct posting requires the `video.publish` scope approved for the app AND
  authorized per user; additionally, **all content posted by unaudited
  clients is restricted to private view** until a separate compliance audit
  passes. So the real clock is review + integration demo + audit.
- Plan unchanged: CM3's TikTok adapter is written but dark; every scheduled
  TikTok is our cron firing an immediate publish (TikTok has no native
  scheduling). **User action required: create/submit the TikTok developer app
  (needs the developer account owner).**

## V5 — Meta review for Instagram publishing

**Answer: required only for the multi-business (Tech Provider) case — which
is us; budget weeks. Business/Creator account is mandatory.**

- Per [Instagram App Review](https://developers.facebook.com/docs/instagram-platform/app-review/):
  an app serving multiple businesses needs Advanced Access via App Review for
  `instagram_content_publish` (Facebook Login) or
  `instagram_business_content_publish` (Instagram Login). Standard Access
  (own-business only) needs no review — good for dogfooding before approval.
- Publishing requires an Instagram professional (Business/Creator) account;
  with Facebook Login it must be connected to a Facebook Page, and Pages with
  Page Publishing Authorization block publishing until PPA completes —
  onboarding must surface this.
- Hard platform cap: 25–50 posts per rolling 24h per account (read live via
  the publishing-limit endpoint) — feeds CC8.
- Since V3 lands on Composio, check whether Composio's Instagram integration
  runs under Composio's own reviewed app (in which case *no Meta review of
  ours is needed*) — probe with a real Business account in the CM3 session.
  **User action possibly required: none if Composio's app suffices.**

## V6 — Object storage for asset delivery

**Answer: Supabase Storage (recommended and assumed by CM2).**

- Already in the stack (same project as Postgres), supports signed URLs with
  short TTLs (CC3) and per-prefix organization for per-user isolation.
- Cost at beta scale is trivial (~GBs); revisit CDN fronting (`cdn.wzrd.tech`
  as a custom domain / Cloudflare in front) when ad asset groups (dozens of
  10–40 MB videos per group) arrive in CM5.

## V7 — Dashboard basic-auth credential is NOT persisted (CC10 blocker confirmed)

**Answer: confirmed in-repo — only the bcrypt-style hash reaches the box;
the control plane stores nothing.**

- `apps/web/lib/provisioning/provision.ts` generates `dashPassword`, hashes it
  in-box, writes only `HERMES_DASHBOARD_BASIC_AUTH_PASSWORD_HASH` to
  `.hermes/.env`, and discards the plaintext. `boxes` holds
  `dashboard_url`/`dashboard_token` (the hosted route) but no basic-auth
  credential.
- Decision (recommended in build-order doc): persist the credential encrypted
  at provision time under a new `BOX_DASHBOARD_AUTH_KEY` envelope, write a
  `SECURITY-DECISIONS.md` entry, and re-issue for existing boxes via a one-off
  in-box password reset. This is CM1 session A, task 0.

---

## Summary of plan deltas

1. **CM6 upgrades**: ChatGPT Ads gets a real write adapter (V1) — both ad
   lanes now sit behind the CC0 approval gate; add an OpenAI Ads API-key
   custody decision to CM6 prerequisites.
2. **CM3 Instagram is thin** (Composio, V3); verify Composio app review
   coverage before submitting our own Meta review (V5).
3. **External clocks**: TikTok app review + post-integration audit (V4) and,
   only if Composio's app doesn't cover us, Meta Advanced Access review (V5).
   Both need the developer-account owner to submit.
4. **V7 confirmed as CM1's task 0** — persist an encrypted dashboard
   credential.
