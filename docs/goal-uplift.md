# goal-uplift.md — build spec for air 2.1 (product uplift)

**Read `goal.md` and `ARCHITECTURE.md` in full before starting.** This file extends them; it does not replace them. Every hard constraint in `goal.md` §1 (C0–C17) remains in force. Where this file and `goal.md` disagree, the one deliberate supersession is called out in §1 below (C19); anything else that looks like a disagreement is a bug in this file.

**What you are building:** the 2.1 uplift of a shipped system — air, a personal AI agent with its own phone number, email, wallet, and cloud computer (one Box per user running Hermes Agent, orchestrated by a Next.js control plane on Vercel + one Supabase). M0–M8 are built and live. This spec fixes what the first release got wrong in the UI, and adds the next ring of capability: a correct design-token system, visible box power controls, an honest connectors surface, voice input, a real Ads command center (Meta Ads MCP + OpenAI Ads API + an analytics layer), a Wallet tab (thirdweb), durable Composio→Hermes continuity, and the ported WZRD creative command lane (`/imagine`, `/animate`, `/zap`) from `gratitude5dee/outsideairworker`.

**Milestones are numbered M9–M16**, continuing `goal.md`'s M0–M8 (M7.5 is taken). New constraints are numbered C18+ continuing C0–C17.

**Where the evidence lives:** every task below cites `file:line` into this repo as it exists today. Trust the citations over your memory of similar codebases. The port milestone (M16) cites `gratitude5dee/outsideairworker` — request read access to that repo on day one (§3); it is the reference implementation you are porting from.

---

## 1. New hard constraints

| # | Constraint |
|---|---|
| **C18** | **Voice audio is transient.** A recorded clip goes browser → control-plane route → STT provider → text, and is never written to Postgres, Supabase Storage, or a box, and never leaves the request lifecycle. The transcript enters the system only as ordinary typed input. (C4 applied to audio.) |
| **C19** | **Model names in the UI are display-only and server-supplied.** The control plane may *label* each speed tier with the real model it resolves to (`/api/me` projection, resolved from the same `modelForTier()` the gateway uses). The UI never accepts a model ID, never accepts an API key, and boxes still only ever see tier names (C2 untouched). *This deliberately supersedes the `goal.md` M6 acceptance line "No screen anywhere … names a model" — the "accepts an API key" half stands.* |
| **C20** | **Power off is always graceful.** The new stop route calls `stop()` without `force` (C6). A refused stop surfaces as "couldn't sleep safely — try again", never as a forced kill. The stop route authenticates the browser session only — a box must not be able to stop itself or any other box through it. |
| **C21** | **thirdweb secret key stays server-side; only the publishable client ID may ship to the browser.** `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` is the *single* permitted `NEXT_PUBLIC_` variable (amending `goal.md` §5 "None prefixed `NEXT_PUBLIC_`"), because a thirdweb client ID is a publishable identifier by design. Value transfer (send, swap, buy execution) is never one click — it goes through the decisions queue like every other side effect (ARCHITECTURE.md §8.3), and v1 ships read-only + receive + fund. |
| **C22** | **Every spend-mutating ad operation stays behind the `ad_write` decision gate** (`apps/web/app/api/ads/writes/route.ts:1-6`), regardless of provider (Meta or OpenAI) and regardless of which milestone added it. Reads (insights, listings) are ungated. |
| **C23** | **The creative command lane never generates for a tier-2 sender, and never double-pays.** On iMessage, `/imagine`/`/animate`/`/zap` check the sender's trust tier before any provider call (goal.md M4, C9). A submit whose provider request ID is unknown (`submit_unknown`) is never auto-resubmitted; a known request ID is only ever *resumed* by polling. (Port of WZRD's cost discipline, `outsideairworker src/gmi.ts:346-352`.) |

---

## 2. Non-goals for this build

Do not build these. If you think one is required, escalate (§9).

- **Voice replies / TTS.** This build is speech-*to*-text input only. The voice-agent architecture question (ARCHITECTURE.md §11 open question 3) stays open.
- **Wallet send/swap execution.** v1 is read-only balances + activity + receive + optional fund widget. A send flow is sketched as M15-stretch and requires escalation before any code.
- **A charting library.** The analytics visuals are hand-rolled SVG in the existing design system. The repo has zero chart deps and stays that way.
- **Porting `/fanpic` or WZRD Studio (`/cast` `/sheet` `/board`).** `/fanpic` bakes in a named-person likeness reference (rights/consent problem — escalate if wanted). Studio is a large surface; it is listed as an M16 follow-on requiring separate approval.
- **Replacing the box's browser stack with `browser-use`.** The box already ships `agent-browser` + Hermes' native `browser_*` tools headed on the box display (`infra/template/setup.sh:116-137`), and the Computer surface already streams it. That *is* the product's browser-use/computer-use. Do not install a second automation stack.
- **A second Hermes platform adapter, a relay, or any change to C12.**
- **Editing applied migrations.** All schema changes below are new forward-only migrations (`0018+`).

---

## 3. Accounts and credentials to confirm first

Missing credentials block milestones, not tasks — surface gaps immediately (same rule as `goal.md` §3).

| Service | Needed for | Notes |
|---|---|---|
| **Repo access: `gratitude5dee/outsideairworker`** | **M16 — day one** | Private repo; the reference implementation for the creative lane. Read access for the build agent. |
| **Groq** | M16 | `GROQ_API_KEY` — router + vision models (`openai/gpt-oss-20b`, `qwen/qwen3.6-27b`). Held only by the control plane. |
| **GMI Cloud** | M16 | `GMI_CLOUD_API_KEY` (+ optional `GMI_ORGANIZATION_ID`) — the request-queue provider behind `gpt-image-2-*`, `seedance-2-0-fast-260128`, `gemini-omni-flash-preview`. |
| **STT provider** | M13 | Default: reuse `MODEL_PROVIDER_BASE_URL`/`MODEL_PROVIDER_API_KEY` against `/audio/transcriptions` (OpenAI-compatible). Override with `STT_*` if the main provider has no STT. Verify once with a real clip before building UI. |
| **thirdweb** | M15 | Existing `THIRDWEB_SECRET_KEY` (already used for SMS auth, `apps/web/lib/thirdweb/client.ts`). Additionally create/read the project's **client ID** for the browser widget (C21). |
| **Meta Business** | M14 | The user-side OAuth happens inside their box against `https://mcp.facebook.com/ads` (already wired: `apps/web/lib/provisioning/connectors.ts:39-60`). Per `docs/verify-creative.md` V2: no developer app, no app review; scope tier chosen at connect time — use **read/write** (not financial) by default. |
| **OpenAI Ads** | M14 | Advertiser API keys are per-user, operator-sealed via `POST /api/admin/ads` (already built: `apps/web/app/api/admin/ads/route.ts`). Confirm at least one live account before building the analytics ingest. |

**One verification to run before M13:** send a 10-second clip to the provider's `/audio/transcriptions` with the planned model (`STT_MODEL`, default `whisper-1`) and confirm the response shape `{ text }`. If the model provider behind `MODEL_PROVIDER_BASE_URL` rejects audio endpoints, set the `STT_*` overrides instead — do not proxy audio through the inference gateway (`/api/gateway/v1` is for boxes, authenticated by box tokens; the browser is not a box).

---

## 4. Orientation — where things are today

The whole product UI is **one client component**: `apps/web/app/home/page.tsx` (1,232 lines) — sidebar nav, all eight tab panels, account card, apps chips, and the Speed & Intelligence card. The Ads tab body is the one extraction: `apps/web/app/home/ads-panel.tsx` (915 lines). Design tokens live in `apps/web/app/globals.css` (Tailwind v4, CSS-first, **no** `tailwind.config.*`). The composer is `apps/web/components/prompt-input/PromptInput.tsx` + `.module.css`.

| Subsystem | Files (today) |
|---|---|
| Design tokens | `apps/web/app/globals.css:7-59` (light/dark vars + `@theme inline`), primitives `:90-178` (`.panel` `.input` `.btn` `.btn-ghost` `.muted`) |
| Sidebar / tabs | `apps/web/app/home/page.tsx:119-128` (`TABS`), `:619-638` (nav) |
| Speed & Intelligence | right-rail card `page.tsx:1179-1227`; composer picker `components/prompt-input/PromptInput.tsx:18-34,128-167`; write path `PUT /api/settings/speed` (`app/api/settings/speed/route.ts`); tier→model `lib/entitlements/models.ts:9-24`; applied at `app/api/gateway/v1/[...path]/route.ts:171` |
| Connectors | `page.tsx:751-822` (two lists), `app/api/connectors/route.ts` (GET/POST/PUT), `lib/composio/client.ts`, `lib/provisioning/connectors.ts`, table `supabase/migrations/0001_init.sql:160-170` |
| Chat | `page.tsx:988-1092`, send `:224-335`, `app/api/chat/route.ts`, SSE `app/api/chat/[runId]/events/route.ts`, relay `lib/chat/relay.ts` |
| Box lifecycle | `lib/box/client.ts` (fork/resume/stop/getBox/waitForBox/command), `lib/orchestrator/boxes.ts` (`ensureBoxAwake`, `armStopAfter`, `STOP_AFTER_MINUTES=20`), wake route `app/api/box/wake/route.ts`, sweeper `app/api/cron/sweep/route.ts:46-70`, DB `boxes` `0001_init.sql:127-141` |
| Computer | `page.tsx:947-979` (tab), `:1037-1082` (inline-in-chat), `app/api/box/desktop/route.ts` (302 redirect per `SECURITY-DECISIONS.md:102-132`) |
| Ads | `app/home/ads-panel.tsx`, routes `app/api/ads/*`, libs `lib/ads/{openai,approvals,conformance,reconcile,spend,sweep}.ts`, tables `0014_ads.sql`, `0016_ad_pixels.sql` |
| Wallet (today) | read-only string `page.tsx:1119-1123`; thirdweb REST auth only `lib/thirdweb/client.ts` |
| Composio→box | `lib/provisioning/connectors.ts:12-37` (`ensureComposioSession`), `:67-84` (`installComposioMcp` via `hermes mcp add`) |
| Box template | `infra/template/setup.sh` (Hermes config, agent-browser, skills, SOUL.md append), skills `infra/template/skills/computer-relay/SKILL.md` |
| Testing conventions | `.agents/skills/testing-web-ui/SKILL.md` — build + serve on :3999, auth-contract tests with dummy env, secret-leak scans over rendered HTML and `.next/static` |

Two UI bugs you can see in the shipped product (root-caused in M9): the active sidebar item and the selected Speed & Intelligence segment render as a light pill with an **invisible label**, and the connectors page shows the same service twice with contradictory status.

---

## M9 — Design system correctness: tokens, cascade, and the Speed & Intelligence card

### The bug, precisely

`apps/web/app/globals.css:82-88` declares, *outside any `@layer`*, after `@import "tailwindcss"`:

```css
input, select, button, textarea { font: inherit; color: inherit; }
```

Tailwind v4 puts every utility inside `@layer utilities`. Per the CSS cascade, **unlayered author rules beat all layered rules regardless of specificity** — so this `button { color: inherit }` defeats every `text-*` utility on every `<button>` in the app. The two visible casualties both use the inversion idiom on buttons (`page.tsx:627-632` nav, `:1193-1198` tiers):

```tsx
tab === key ? "bg-[var(--text)] text-[var(--bg)]" : "bg-transparent text-[var(--muted-2)] …"
```

`bg-[var(--text)]` applies (fills the pill near-white in dark mode); `text-[var(--bg)]` is generated correctly but loses to the unlayered rule, so the label stays `--text` on `--text`: **white-on-white**. The same rule also kills the *muted* color on inactive items. Proof by contrast in the same repo: the identical class pair works on a `<div>` (chat bubble, `page.tsx:1020`) and works on a button only with `!important` (`ads-panel.tsx:470-475`).

### Tasks

1. **Fix the cascade, structurally.** In `globals.css`, wrap every element-selector rule in `@layer base`: the `*` box-sizing reset, `html, body`, `a`, and the `input/select/button/textarea` reset. Leave the class primitives (`.panel`, `.btn`, `.btn-ghost`, `.input`, `.muted`, `.rise-in`) unlayered **for now** — they intentionally beat utilities today and the codebase compensates with `!` prefixes; migrating them to `@layer components` (and deleting the `!` prefixes) is a separate, optional cleanup with a visual-regression pass. Do not fix the two components by adding `!important` — that treats the symptom and leaves every future button broken.
2. **Add the missing base affordances** while you are in `@layer base`: `html { color-scheme: light dark; }` (native form controls, scrollbars) and a visible keyboard focus ring — `:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }`. There is currently no focus treatment anywhere.
3. **Name the inversion idiom instead of repeating it.** Add two primitives next to `.btn`:
   ```css
   .pill-active { background: var(--text); color: var(--bg); }
   .seg { /* shared segment/nav-item base: rounded, px, text-[13px], transition */ }
   ```
   Replace the inline ternaries at `page.tsx:627-632` (nav) and `page.tsx:1193-1198` (tiers) with `.seg` + conditional `.pill-active`, and normal `text-[var(--muted-2)]`/hover states for inactive. After task 1 the utilities also work — the primitive is for consistency, not as the fix.
4. **Consolidate the third token set.** `components/prompt-input/PromptInput.module.css` hard-codes hex (`#ffffff`, `#1a1a1a`, `#e6e8ec`, `#a1a1a1`, `#0b0d12`, plus a duplicated dark block at `:253-284`). Replace every literal with `var(--token, fallback)` exactly as `components/orb/Orb.module.css:4,13,26` already does, and delete the duplicated dark-mode overrides that the vars make redundant. Zero visual change intended.
5. **Complete the token vocabulary** in `:root` + dark: `--success` (green pair for "connected/active" states — M11 needs it), `--warning` (amber pair for "pending/starting"), and `--accent-contrast` (text color on accent fills). Mirror them in `@theme inline` so `text-success` etc. exist. Keep the existing palette values untouched — this is additive.
6. **Speed & Intelligence: show the models (C19).**
   - Server: add `modelLabelForTier(tier)` in `lib/entitlements/models.ts` — returns `MODEL_LABEL_FAST|BALANCED|DEEP` env override, else the raw `modelForTier(tier)` string. Extend `GET /api/me` (`app/api/me/route.ts`) to include `entitlement.tier_models: { fast, balanced, deep }` from it. The gateway path is untouched; this is a *projection of* the same resolution the gateway performs (`gateway/v1/[...path]/route.ts:171`), so the label can never drift from reality.
   - UI: each segment in the right-rail card renders the tier name and, under it, the model label in `text-[11px] text-[var(--muted-2)]` (e.g. "Fast — gpt-5.6-luna"). The composer's `+` picker (`PromptInput.tsx:128-167`) gets the same sublabel line; pass `tierModels` down from `page.tsx` rather than duplicating a fetch. `SPEED_TIERS` descriptions stay client-side; model labels come only from `/api/me`.
   - Both pickers already write through `saveTier` → `PUT /api/settings/speed`; do not add a second write path.
7. **Right-rail spacing pass** (the screenshot complaint): normalize the three cards to one rhythm — card padding `!p-4`, `h3` margin `mt-0 mb-3`, row gap `gap-2`, meta rows `text-[12px] leading-5`. The Account card's five `muted` rows (`page.tsx:1103-1123`) currently use `my-1`, the Apps chips sit flush under the heading, and the tier list uses `gap-1.5` — make them consistent. Small diff, big calm.

### Acceptance

- [ ] Dark and light mode: the active nav item and the selected tier segment show a legible label (computed `color` ≠ computed `background-color`; contrast ≥ 4.5:1). Verify per `.agents/skills/testing-web-ui/SKILL.md` (build, serve on :3999, check both schemes — note the skill's warning that the test box has no GNOME schema: verify the `prefers-color-scheme: dark` block in built CSS, and screenshot both schemes in a real browser).
- [ ] Inactive nav items are muted again and brighten on hover (the same bug was silently killing `text-[var(--muted-2)]`).
- [ ] Every tier segment shows its model label, and changing `MODEL_BALANCED` env changes the label with no client deploy.
- [ ] `grep -rn "color: #\|color: rgb" apps/web/components/prompt-input/` → zero raw literals (vars with fallbacks are fine).
- [ ] Keyboard-tabbing the nav shows a visible focus ring.
- [ ] No `!text-` or `!bg-` additions anywhere in the diff for M9 tasks 1–3; `ads-panel.tsx:473`'s existing `!` idiom keeps working before you touch it and can be dropped in the same diff since the root cause is gone.
- [ ] `npm run typecheck && npm run lint && npm run test` green; secret-leak scan from the testing skill still clean.

---

## M10 — Power & presence: the box gets a visible switch

Today the box's power state is invisible and half-controllable: wake exists (`POST /api/box/wake`, auto-fired on page load, `page.tsx:175-178`), stop exists only for the cron sweeper and admin delete (`lib/box/client.ts:131-136` callers), and **no route returns box state to a client**. The user experiences cold starts as error strings after the fact (`page.tsx:241-256`: "I couldn't reach my computer — it may still be waking up"). The fix is to surface the lifecycle, not to invent one — `ensureBoxAwake` (`lib/orchestrator/boxes.ts:133-251`) is already the wake path and stays the single implementation.

### Tasks

1. **Migration `0018_box_power.sql`.** Extend the `boxes.state` check constraint to add `'starting'` and `'stopping'` (today: `provisioning|ready|idle|stopped|failed`, `0001_init.sql:130-131`; look up the live constraint name before dropping). Same migration: extend `cost_events.kind` check with `'stt'` (M13 uses it; one migration, two enum widenings).
2. **Write the transitional states.** `ensureBoxAwake` sets `state: 'starting'` immediately before calling `resume()` and already sets `'ready'` on success (`boxes.ts:240-243`); the failure paths set `'failed'` only when `getBox()` reports provider-side `error` — a wake timeout leaves the previous state. The sweeper (`cron/sweep/route.ts:46-70`) sets `'stopping'` before `stop()` and `'stopped'` after, as does the new stop route.
3. **`GET /api/box/status`** — session-authenticated, DB-only (no Box API call on the hot path; the poller must be free):
   ```json
   { "power": "on" | "starting" | "stopping" | "off" | "error",
     "state": "<raw boxes.state>",
     "sleeps_at": "<stop_after ISO or null>",
     "last_active_at": "<ISO or null>" }
   ```
   Mapping: `ready|idle → on`, `starting|provisioning → starting`, `stopping → stopping`, `stopped → off`, `failed → error`. Never include `provider_box_id`, `hosted_url`, `hosted_token`, `api_server_key`, `dashboard_*` (C3). Optional `?reconcile=1` variant calls `getBox()` once and heals a drifted row — rate-limit it to 1/10s per user.
4. **`POST /api/box/stop`** — session-authenticated (browser cookie only — not the desktop bearer, not a box token; C20). Flow: set `'stopping'` → `stop(providerBoxId)` **without force** → `'stopped'`, `stop_after: null`. If Box refuses the stop, restore the prior state and return `409 { error: "stop_refused" }` — the UI says "Couldn't sleep safely — try again in a minute." Refuse with `409 { error: "run_active" }` if an `agent_runs` row for the user is open (started, not ended) — surface "Your agent is mid-task; stop anyway?" only after the run completes or the user retries post-completion. Never expose force.
5. **Extend `POST /api/box/wake`** with optional body `{ "keep_awake_minutes": 60 }` (clamp 1–240): after `ensureBoxAwake`, set `stop_after = now + minutes` instead of the default `armStopAfter` 20 (`boxes.ts:254-265`). This is the "quick start and hold" the power button offers.
6. **Chat boot banner (the "power on" quick start).** In the chat panel, on mount and on tab focus, poll `/api/box/status` — 5s while `starting|stopping`, 60s otherwise. Render a slim banner above the thread (reuse `.panel !p-3` + status dot in `--warning`/`--success`):
   - `off`: "Your agent's computer is asleep." + **Power on** button → `POST /api/box/wake`, banner flips to `starting`.
   - `starting`: "Powering on — usually under a minute…" + elapsed seconds. On 429 `start_limit_reached`: "Can't start right now (provider limit) — retrying at :ss" with backoff retry.
   - `on`: banner collapses to nothing (or a 2s "Ready" flash). The composer is **never disabled** — sends already wake implicitly via `startChatRun → ensureBoxAwake` (`lib/chat/relay.ts:22`); the banner makes the wait visible instead of letting the send fail into the 500-string.
   - Keep the existing error strings (`page.tsx:241-256`) as the fallback of last resort; with the banner they should rarely render.
   - Keep the existing fire-and-forget pre-warm on mount (`page.tsx:175-178`) — the banner shows its outcome instead of hiding it.
7. **Computer tab power control.** Header row above the iframe (`page.tsx:947-979`): status dot + label ("On · sleeps in 14m" from `sleeps_at`, "Off", "Starting…"), a **Power on / Power off** button driving wake/stop, and a **Keep awake 1h** ghost button (wake with `keep_awake_minutes: 60`). While `off`, replace the iframe with an empty-state panel ("Computer is asleep — power it on to view the screen") instead of letting `/api/box/desktop` 502. While `starting`, show the same elapsed-time treatment as chat. The iframe remount-on-epoch behavior (`computerEpoch`, `page.tsx:494-498`) is load-bearing for token rotation — keep it.
8. **Sidebar presence dot (small, optional-but-cheap):** a 6px dot on the "Computer" nav item colored by power state, sourced from the same poll. One source of truth: lift the status poll to `page.tsx` state, consumed by banner + tab + dot.

### Acceptance

- [ ] From `stopped`, clicking **Power on** in chat shows `starting` with elapsed time and lands in `on` without a page reload; the first message sent during `starting` completes after boot rather than erroring.
- [ ] **Power off** on the Computer tab stops the box (verify state in Supabase and via `boxctl.sh get`), the tab shows the asleep empty-state, and the sweeper does not double-stop.
- [ ] A refused stop (simulate by stubbing `stop()` to 409) restores state and shows the graceful message — no `force` anywhere in the diff (`grep -rn "force" apps/web/lib/box/ apps/web/app/api/box/` clean).
- [ ] `GET /api/box/status` response contains no URL, token, or box ID fields (assert in a route test).
- [ ] Devtools during a full off→on→off cycle show no `*.on.ascii.dev` request and no secrets (existing M6 acceptance re-run).
- [ ] 429 start-limit renders the honest banner state, not the generic failure string.
- [ ] Replay test (goal.md §7.5) on the new routes: three rapid identical `POST /api/box/stop` calls produce one stop.

---

## M11 — Connectors: one truthful list

### The bug, precisely

The Connectors tab renders **two unrelated lists** (`apps/web/app/home/page.tsx:751-822`):

- **List 1** (`:764-776`): raw `connections` rows — `<strong>{c.toolkit}</strong> <span>{c.status}</span>` — lowercase slugs ("gmail", "shopify", "metaads"), raw enum statuses, no logos, no actions.
- **List 2** (`:777-816`): the live Composio catalog (`GET /api/connectors` → `listToolkits()`, top 40 by usage) with logos and Connect buttons.

So an `active` gmail appears **twice** ("gmail active" + "Gmail connected"), and a `pending` row appears in list 1 while list 2 still shows a fresh **Connect** button for the same toolkit. `pending` is written the instant Connect is clicked, *before* OAuth (`app/api/connectors/route.ts:66-75`); it only flips via `PUT /api/connectors` — which is called exactly once per page load, when the tab first opens (`page.tsx:419`, guarded by `toolkits === null` at `:511-513`). A user who completes OAuth and returns sees a stale `pending` until a full reload. Two additional wrinkles: `revoked` is never written by any code path, and the `metaads` row is a **Composio** toolkit connection — a *different* path from the Ads panel's native Meta MCP install (`POST /api/ads/accounts {install:"meta-ads"}` → `hermes mcp add meta-ads` — which writes **no** `connections` row at all).

### Tasks

1. **Merge to a single list.** One row per service, catalog-driven: logo + display name from the toolkit catalog, joined against `connections` by slug. Delete the raw list-1 rendering. Rows with a `connections` entry but no catalog match (catalog is `.slice(0, 40)`) still render, title-cased, with a generic mark — never a bare lowercase slug again. Sort: connected first, then pending/error, then the unconnected catalog, search unchanged (`connectorFilter`).
2. **Status chips, in the design system** (M9's `--success` / `--warning` / `--danger`):
   | `connections.status` | Chip | Action on the row |
   |---|---|---|
   | `active` | "Connected" (success dot) | overflow: **Disconnect** |
   | `pending` | "Finish connecting" (warning dot) | **Resume** → re-`POST /api/connectors` for the slug (a fresh Composio link session is the resume path — `createLinkSession` mints a new redirect; do not try to revive the old one) |
   | `error` | "Needs attention" (danger dot) | **Reconnect** (same as resume) |
   | `revoked` | "Disconnected" (muted) | **Connect** |
   | *(none)* | — | **Connect** |
3. **Close the sync gap.**
   - **On OAuth return:** the link-session callback already lands on `/home` (`app/api/connectors/route.ts:69`). Change the callback URL to `/home?connected=<toolkit>`; on mount, when that param is present, immediately call `PUT /api/connectors`, strip the param (`history.replaceState`), and show the flipped chip. No more reload-to-see-it.
   - **On focus:** re-run the PUT sync (cheap: one Composio call) when the Connectors tab is opened *and* the document regains visibility with the tab active — drop the `toolkits === null` once-per-load guard for the sync while keeping it for the catalog fetch.
   - **On schedule:** `cron/health` already flips `active|error` for publish-relevant toolkits (`lib/publish/health.ts:82-88`). Extend it with a full per-user reconcile: any local `active` row whose account no longer appears in `listConnectedAccounts` (ACTIVE-only, `lib/composio/client.ts:141-148`) → `status: 'revoked'`. Any `pending` older than 24h with no ACTIVE match → leave `pending` (the resume action handles it); do not auto-expire.
4. **Write `revoked` on disconnect.** Row overflow → **Disconnect** calls a new `DELETE /api/connectors?toolkit=<slug>`: `deleteConnectedAccount(external_account_id)` (`lib/composio/client.ts:101-106`), set `status: 'revoked'`, `connected_at: null`. (Deletion at the account level already does this en masse — `app/api/admin/delete/route.ts:144` — this is the single-toolkit version.)
5. **Make the `metaads` split coherent.** The Composio `metaads` toolkit row and the Ads panel's native Meta MCP are different integrations. On the Connectors page, the `metaads` catalog row gets a one-line subtitle: "For the Ads tab, use Meta Ads setup →" linking to the Ads onboarding subtab (which drives the richer native `mcp.facebook.com/ads` path, M14). Do not hide either; do not merge their statuses.
6. **First-active install still fires.** Keep `installComposioMcp` on first newly-active (`app/api/connectors/route.ts:113-125`); M12 owns re-install/refresh semantics.

### Acceptance

- [ ] No service ever appears twice. `gmail` active renders once: logo, "Gmail", Connected chip.
- [ ] Complete a real OAuth (per goal.md M7 acceptance, Gmail in a fresh account): returning to the app shows "Connected" within one render, with no manual reload, and the agent reads mail within one turn (M7 acceptance re-run).
- [ ] A `pending` row's **Resume** opens a working OAuth redirect; abandoning it keeps "Finish connecting" (never a dead-end raw "pending" string).
- [ ] Disconnect flips the chip to "Disconnected", the Composio connected account is deleted (verify in Composio dashboard), and the token appears nowhere in Postgres (C-M7: we never stored it anyway).
- [ ] Revoking a Gmail grant at accounts.google.com → within one `cron/health` cycle the row shows "Needs attention"/"Disconnected", not a stale "Connected".
- [ ] The two Meta paths are visually distinct and both reachable; neither claims the other's status.

---

## M12 — Composio → Hermes continuity: connections that survive

M7 built the happy path: first `active` connection → `installComposioMcp` → `hermes mcp add composio --url <per-user tool-router URL>` (`lib/provisioning/connectors.ts:67-84`). What's missing is everything after the happy path — the session URL is installed **once** (`app/api/connectors/route.ts:113-125` fires only on `newlyActive`; provision-time install is best-effort try/catch at `lib/provisioning/provision.ts:291`), nothing refreshes it if the Composio session rotates, nothing verifies the box still has it after template rebuilds, and the agent is never *told* what the user has connected — it only discovers tools if it happens to query the MCP.

### Tasks

1. **Idempotent ensure, not one-shot install.** Extract `ensureComposioMcpInstalled(supabase, userId)`: resolve the session URL via `ensureComposioSession` (`lib/provisioning/connectors.ts:12-37`), run `hermes mcp list` in the box via `command()` and parse for the `composio` entry; if absent **or the URL differs**, run the existing `hermes mcp add` (it validates and overwrites; the `printf 'y'` answers the save-anyway prompt) + `systemctl restart hermes-gateway`. Call it from: (a) the existing first-active hook, (b) `PUT /api/connectors` whenever the user has ≥1 active connection (cheap no-op when already correct), (c) a post-wake best-effort hook — **not** inside `ensureBoxAwake`'s hot path; fire-and-forget after the health probe succeeds, same pattern as `refreshDashboardRoute` (`lib/orchestrator/boxes.ts:232-238`).
2. **Tell the agent what it has.** After any status flip (connect, revoke, disconnect), write `~/.hermes/connected-tools.md` into the box via `writeFile` (`lib/box/client.ts:205-214`):
   ```markdown
   # Connected tools (managed by air — do not edit)
   Your human has connected: Gmail, Shopify. 
   Use them through your composio MCP tools. If a tool fails with an auth
   error, say so and suggest reconnecting from the Connectors page — never
   ask for credentials in chat.
   ```
   And append one line to the template's SOUL.md block (`infra/template/setup.sh:170-189`): "Check ~/.hermes/connected-tools.md for the tools your human has connected." Template change ⇒ bump `template_version` and follow the rebuild procedure (same discipline as `docs/creative-plugin.md`'s version-bump). Escalate if a template rebuild is not possible in the current Box plan.
3. **Fold Meta MCP into the same ensure.** `installMetaAdsMcp` (`lib/provisioning/connectors.ts:47-60`) gets the same `hermes mcp list` idempotence check, so the Ads onboarding button can be pressed twice without a duplicate-entry prompt loop.
4. **Continuity on box rebuild.** `ensureComposioMcpInstalled` + `installMetaAdsMcp`-ensure both run during provisioning *after* the box is healthy (`lib/provisioning/provision.ts:291` already tries Composio; add Meta if the user has an `ad_accounts` row with `provider='meta'`), making a re-forked box converge to the user's connections without manual steps.
5. **Observability.** Structured log line (goal.md §6) on every ensure: `user_id`, `box_id`, `action: none|added|updated`, duration. `cron/health` counts ensures performed; surface in `/api/admin/ops`.

### Acceptance

- [ ] Fresh OAuth → within the same Connectors visit, `hermes mcp list` in the box shows `composio`, and asking the agent "list my connected tools" names Gmail without the agent guessing (reads `connected-tools.md`).
- [ ] Rotate the Composio session (delete `users.composio_session_id`, let it recreate): the next `PUT /api/connectors` heals the box's MCP URL — verify by diffing `~/.hermes/config.yaml` `mcp_servers` before/after.
- [ ] Re-fork a user's box from the template: after provisioning completes, Composio (and Meta, if registered) MCP entries exist with zero manual steps.
- [ ] Pressing the Ads panel's Meta setup twice produces one `meta-ads` MCP entry.
- [ ] The secrets test (goal.md §7.4) still passes: `connected-tools.md` contains display names only — no tokens, no account IDs, no URLs.

---

## M13 — Voice input: hold the mic, get words

Scope: speech-to-text **input** in the web composer (C18). No TTS, no voice channel (non-goal §2). Today there is zero audio code in the repo (the only literal is the unused `'voice'` value in `agent_runs.trigger`, `0001_init.sql:177` — this milestone finally writes it).

### Tasks

1. **`POST /api/voice/transcribe`** — session-authenticated route handler, `multipart/form-data` field `audio`.
   - Accept `audio/webm` (Opus), `audio/mp4`/`audio/m4a` (Safari), `audio/wav`. Reject others `400 { error: "unsupported_format" }`.
   - Caps: 25 MB / 5 minutes → `413 { error: "too_large" }`. Rate limit: 20 transcriptions per user per rolling hour, counted via `cost_events` (`kind: 'stt'`, widened in `0018_box_power.sql`) → `429 { error: "rate_limited" }`.
   - Forward the blob as multipart to `${STT_BASE_URL ?? MODEL_PROVIDER_BASE_URL}/audio/transcriptions` with `model: STT_MODEL ?? "whisper-1"` and `Authorization: Bearer ${STT_API_KEY ?? MODEL_PROVIDER_API_KEY}` (`lib/env.ts` additions, §5). Do **not** route this through `/api/gateway/v1` — that surface authenticates boxes, not browsers, and its metering assumes chat completions.
   - Respond `200 { text, duration_s }`. Insert one `cost_events` row (`kind: 'stt'`, `amount_cents` from `STT_COST_CENTS_PER_MIN ?? 1`, `ref: null`). The audio buffer dies with the request (C18): no Storage write, no DB write of content, no box involvement, and add the route to the testing skill's secret-leak scan surface.
2. **Mic button in the composer.** `components/prompt-input/PromptInput.tsx` — a third icon button in `styles.row` between the `+` menu (`:114-168`) and send (`:170-180`), reusing `.iconBtn` (`PromptInput.module.css:93-123`), `Mic`/`Square` from `lucide-react` (already the icon dep).
   - States: **idle** (Mic) → **recording** (Square, `--danger` pulse, elapsed `0:07`, hard stop at 5:00) → **transcribing** (existing spinner treatment) → **idle** with text delivered.
   - Capture: `navigator.mediaDevices.getUserMedia({ audio: true })` + `MediaRecorder`; pick the first supported of `audio/webm;codecs=opus` → `audio/mp4` (Safari). Stop tracks on every exit path. Esc cancels and discards. Permission denied → inline note under the composer ("Microphone is blocked — allow it in your browser's site settings"), not a modal.
   - Delivery: append the transcript to the current `value` (space-joined at the end; the textarea auto-grows, `PromptInput.tsx:63-68`) — the user **reviews and sends**; never auto-send (the transcript is untrusted input to a tool-using agent, C9 — the human stays the gate).
   - a11y: `aria-pressed` on the toggle, `aria-live="polite"` status text ("Recording… 0:07", "Transcribing…"), fully keyboard operable.
3. **Finally use the `'voice'` trigger.** `send()` (`page.tsx:224-335`) tracks whether the composer content originated from a transcription (any mic use since last send); pass `{ input, via: "voice" }` to `POST /api/chat`; `startChatRun` (`lib/chat/relay.ts:16-35`) writes `agent_runs.trigger: 'voice'` instead of `'web'` for those runs. Zero behavior change downstream; it makes voice adoption measurable in the data you already collect.
4. **Graceful degradation.** No `MediaRecorder` (old Safari) → hide the mic button entirely (feature-detect), no broken affordance.

### Acceptance

- [ ] Chrome + Safari: record 10s, see it transcribed into the composer within ~3s, edit a word, send — the run completes and `agent_runs.trigger = 'voice'` for it.
- [ ] A 6-minute recording is stopped at 5:00 client-side; a hand-crafted 30 MB upload gets `413`; the 21st clip in an hour gets `429` and a friendly inline note.
- [ ] Kill the STT env vars → the button records but transcription fails with an inline "Couldn't transcribe — try again" and the recorded audio is discarded (verify no orphaned state, no retry loop).
- [ ] C18 audit: no Storage bucket write, no Postgres row containing audio or transcript, no request to any box host during the whole flow (devtools + code review).
- [ ] Mic-permission-denied path shows the inline note and recovers when permission is granted.
- [ ] `npm run test` includes a route test covering: bad MIME, oversize, rate limit, provider 500 mapping.

---

## M14 — Ads command center: Meta MCP + OpenAI Ads, and a real analytics layer

What exists (CM5/CM6): the five-subtab panel (`apps/web/app/home/ads-panel.tsx:83-91` — Get set up / Creative / Deploy / Pixels / Analytics), the spend-gated write path (`ad_writes` → "Needs you" decisions, C22), a partial OpenAI adapter (`lib/ads/openai.ts`: `openAdsKey`, `createCampaign`, `updateCampaign`, `campaignInsights`), the Meta MCP install (`installMetaAdsMcp`), pixels + conversions routes, and an Analytics subtab that reads a **Postgres-only** 30-day rollup (`app/api/ads/analytics/route.ts` over `spend_reports`/`ad_conversions`) — no provider metrics ever land in it. This milestone completes both providers and gives the Analytics subtab real data.

### Tasks

1. **Finish the OpenAI Ads adapter** (`lib/ads/openai.ts`), against the published Advertiser API (`https://api.ads.openai.com/v1`, verified in `docs/verify-creative.md` V1). Add, all with per-account key via the existing `openAdsKey` unseal and an `Idempotency-Key` header on every write (the pattern `createCampaign` already uses):
   - `getAdAccount()` — `GET /ad_account` (connect verification; surfaces `review.status`).
   - `uploadAsset({ image_url } | bytes)` — `POST /upload` (JSON `image_url` first; multipart for local bytes) → `{ file_id }`.
   - `listCampaigns / getCampaign` — `GET /campaigns[…]`.
   - `createAdGroup / updateAdGroup` — `POST|PATCH /ad_groups` (`campaign_id`, `name`, `status`, `context_hints[]`, `bidding_config { billing_event_type: "impression", max_bid_micros }`).
   - `createAd / updateAd` — `POST|PATCH /ads` (`ad_group_id`, `creative { type: "chat_card", title, body, target_url, file_id }`; response carries `review_status`).
   - `adInsights(adId, { time_granularity, limit })` and `campaignInsights` kept — `GET /ads/{id}/insights` list envelope (`data[]`, `has_more`).
   - **Units are micros** (`lifetime_spend_limit_micros`, `max_bid_micros`); convert at the adapter boundary and store cents in Postgres (`daily_budget_cents` convention, `0014_ads.sql`). Unit-test the conversions.
2. **Gate the new writes (C22).** Migration `0019_ad_writes_kinds.sql`: widen `ad_writes.kind` check (today `create_campaign|update_budget|set_status`, `0014_ads.sql:58-74`) with `create_ad_group`, `create_ad`, `update_ad`. Asset upload is not spend-mutating — ungated. Executor: extend the approval executor that consumes `ad_write` decisions to dispatch the new kinds through the adapter.
3. **Deploy wizard.** Replace the bare Deploy subtab flow with a three-step wizard, all in existing primitives: **1)** pick provider + campaign (or new campaign: name, lifetime budget); **2)** ad group (name, context hints as chip input, max bid) — OpenAI path; Meta path composes the equivalent through MCP-driven agent runs (below); **3)** ad creative — `chat_card` composer (title ≤ its limit, body, target URL, image from the Creative gallery via the existing `/api/assets` mint) with a live card preview styled like a chat card. **Submit proposes `ad_writes` rows** (one per mutation, ordered), routes to "Needs you", and the wizard's final screen says exactly that — "3 changes waiting for your approval" — linking to the queue. Nothing executes inline.
4. **Meta connect state, honestly.** The Meta path's OAuth completes in the agent's browser inside the box (`docs/verify-creative.md` V2 open question; `connectMetaAds` already prefills chat via `onAskAgent`, `ads-panel.tsx:219-244`). Make it a first-class state machine on the Get set up subtab:
   - "Install" → `POST /api/ads/accounts {install:"meta-ads"}` (exists) → state `installed`.
   - "Sign in with your agent" → prefilled chat run; the chat panel's existing computer-view auto-open (`page.tsx:112-117, 280-291`) shows the login. 
   - **Confirmation postback:** new `POST /api/ads/meta/confirm` authenticated by the per-box `gateway_token` (exact pattern of `app/api/cards/computer/route.ts:87-91`), body `{ account_ref, label }` → upsert `ad_accounts (provider:'meta', status:'active')`. Add a template skill `infra/template/skills/meta-ads-confirm/SKILL.md` (mirroring `computer-relay/SKILL.md`'s curl-with-`$OPENAI_API_KEY` shape) instructing the agent to call it once login succeeds and it can read the ad account via MCP. The subtab shows `connected` when the `ad_accounts` row exists.
5. **The analytics layer: one normalized table.** Migration `0020_ad_metrics.sql`:
   ```sql
   create table ad_metrics_daily (
     id uuid primary key default gen_random_uuid(),
     user_id uuid not null references users(id) on delete cascade,
     account_id uuid not null references ad_accounts(id) on delete cascade,
     provider text not null check (provider in ('meta','openai')),
     level text not null check (level in ('account','campaign','ad_group','ad')),
     entity_ref text not null,
     metric_date date not null,
     impressions bigint not null default 0,
     clicks bigint not null default 0,
     spend_cents integer not null default 0,
     conversions integer not null default 0,
     conversion_value_cents integer not null default 0,
     fetched_at timestamptz not null default now(),
     unique (account_id, level, entity_ref, metric_date)
   );
   alter table ad_metrics_daily enable row level security;
   create policy own_ad_metrics on ad_metrics_daily for select using (user_id = auth.uid());
   ```
6. **Two ingest paths into it.**
   - **OpenAI (pull, control plane):** extend `cron/ads` (`vercel.json` — today `*/10 * * * *` for the spend ceiling) or add `cron/ad-metrics` hourly: for each active `ad_accounts (provider:'openai')`, pull daily-granularity insights for campaigns and ads (last 3 days, to catch late attribution), upsert by the unique key. Respect the list envelope's `has_more`.
   - **Meta (push, agent-side):** the control plane holds no Meta credential (the MCP OAuth lives in the box), so metrics travel the same trust path as everything box-originated: new `POST /api/ads/metrics` authenticated by `gateway_token`, body `{ rows: [{ provider:'meta', level, entity_ref, metric_date, impressions, clicks, spend_cents, conversions, conversion_value_cents }] }`, validated hard (dates within 90d, non-negative ints, ≤200 rows), upsert. A template skill `ads-reporting/SKILL.md` tells the agent how to fetch yesterday's insights via the Meta MCP reporting tools and post them. Trigger: the cron enqueues one Hermes run per Meta-connected user per day ("run your ads-reporting skill for yesterday") — reuse `createRun` with `MAIN_SESSION`? **No** — use a dedicated session id `ads-reporting` so the user's chat thread is not polluted; cooldown by checking `ad_metrics_daily.fetched_at` before enqueueing.
   - Treat all pushed rows as hostile input (C9): clamp, validate, and attribute to the authenticated box's `user_id` only — the body's user-identifying fields are ignored.
7. **Analytics subtab, rebuilt on the table.** `GET /api/ads/analytics` returns, for a `?days=7|30` window: KPI totals (spend, impressions, clicks, CTR, CPA, conversions, conversion value, blended ROAS), a per-day series, and a per-campaign table (name, provider, status, budget, spend, conversions, Δ vs prior period). UI: KPI stat row (`.panel` cards, `text-[12px]` labels — M9 rhythm), provider filter chips (All / Meta / OpenAI), a hand-rolled SVG bar/line chart (≤80 lines, `--accent` fill, `--muted-2` axis text, no deps — non-goal §2), the campaign table, and honest empty states ("No metrics yet — they arrive within an hour of connecting"). Keep the existing Postgres conversions rollup as the `conversions` source of truth where provider numbers are absent; label provider-reported vs pixel-reported explicitly.
8. **Ceiling visibility.** Surface `ad_settings.spend_ceiling_cents` and month-to-date ad spend as a meter on the Analytics subtab, same meter idiom as the right-rail usage bar (`page.tsx:1205-1219`); link "Raise ceiling" to the existing `spend_ceiling` decision flow.

### Acceptance

- [ ] OpenAI end-to-end against a real advertiser account: wizard → 3 gated writes appear in "Needs you" → approve → campaign/ad_group/ad exist via `GET` calls, ad shows `review_status`; nothing was created before approval (C22 — verify by checking the provider *before* approving).
- [ ] Micros↔cents conversions unit-tested at the boundaries (`59999` micros cases); no raw micros ever stored.
- [ ] Meta flow: install → agent login via Computer view → skill postback flips the subtab to `connected` with the real `account_ref`; the `gateway_token` of user A cannot write an `ad_accounts` or metrics row for user B (route test).
- [ ] `ad_metrics_daily` fills from both paths; re-running either ingest is idempotent (upsert by unique key — replay test).
- [ ] A malicious metrics payload (negative ints, 10k rows, future dates, someone else's account_id) is rejected without a write.
- [ ] Analytics subtab renders KPIs + chart + table from real rows in both color schemes with no chart dependency added (`git diff package.json` shows none).
- [ ] `GET /api/ads/analytics` p50 < 300ms on 90 days × 20 entities (indexed reads only).

---

## M15 — Wallet tab: the thirdweb wallet becomes visible

Every user already *has* a wallet — created via thirdweb phone auth at provisioning (`lib/thirdweb/client.ts`, attach at `app/api/auth/login/route.ts:85-92`, `users.wallet_address`) — but the entire UI is one truncated string in the Account card (`page.tsx:1119-1123`). This milestone gives it a tab. Read + receive + fund only; send is gated behind escalation (non-goal §2, C21, ARCHITECTURE.md §8.3).

### Tasks

1. **Dependencies + env.** Add the `thirdweb` npm package to `apps/web` (server-side usage; the client bundle only pays for it if the fund widget ships). Env: `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` (C21), `WALLET_CHAIN_ID` default `8453` (Base). The server client is `createThirdwebClient({ secretKey: env.thirdwebSecretKey() })` — the existing REST helper in `lib/thirdweb/client.ts` stays for auth; new balance/activity code lives in `lib/wallet/`.
2. **`GET /api/wallet`** — session-authenticated projection, cached `Cache-Control: private, max-age=60`:
   ```json
   { "address": "0x…", "chain_id": 8453,
     "native": { "symbol": "ETH", "display": "0.0412" },
     "tokens": [ { "symbol", "name", "display", "usd": null } ],   // ≤20, via thirdweb Insight getOwnedTokens
     "updated_at": "…" }
   ```
   Address comes from `users.wallet_address` — never from client input. `wallet_address` null → `200 { address: null }` and the UI shows the not-set-up state. Balances via the thirdweb SDK server-side (`getWalletBalance` + Insight `getOwnedTokens`); tolerate Insight failures by returning native-only with a `degraded: true` flag rather than 500.
3. **`GET /api/wallet/activity`** — last ≤25 transactions via Insight `getTransactions`, projected to `{ hash, direction, counterparty, value_display, timestamp, explorer_url }` with `explorer_url` built server-side (Basescan for 8453). Same caching.
4. **The tab.** Add `["wallet", "Wallet"]` to `TABS` (`page.tsx:119-128`, after "Ads") and a `tab === "wallet"` panel:
   - **Address card:** identicon (reuse `DitherAvatar` keyed on address), full address in `font-mono text-[12px]`, copy button, **Receive** button → inline QR of the address (server-generated: tiny `qrcode` dep rendering a data-URL SVG in the `/api/wallet` response, or a ≤60-line inline QR SVG util — either way, no client-side QR library).
   - **Balances:** native + token rows (symbol, name, amount) in the single-list idiom of M11; a `degraded` note when Insight was unreachable.
   - **Activity:** the projected list, direction-colored (`--success` in / `--muted-2` out), each row linking to `explorer_url` (`target="_blank" rel="noreferrer"`).
   - **Fund (optional, feature-flagged `NEXT_PUBLIC_THIRDWEB_CLIENT_ID` present):** thirdweb `BuyWidget` for the user's own address on `WALLET_CHAIN_ID`, in the tab — the widget talks to thirdweb's public endpoints with the publishable client ID only (C21). If the client ID is absent, the button doesn't render.
   - **Not-set-up state:** "Wallet not set up yet — sign out and back in with your phone to attach it" (that is the real attach path today: `app/api/auth/login/route.ts:85-92`; the `onboarding.ts:77-78` comment's "attach later from settings" surface is this tab now).
   - Account card keeps the one-liner but it becomes a link that switches to the tab.
5. **M15-stretch (escalate before building, §9): send.** The sketch, for when it's approved: a `wallet_send` decision kind; propose → "Needs you" → approval executes server-side via thirdweb; per-user daily cap in `entitlements`. Do not start this in M15.

### Acceptance

- [ ] The tab renders address, native balance, tokens, and activity for a real provisioned user on Base; numbers cross-check against Basescan.
- [ ] `grep -r "THIRDWEB_SECRET_KEY" apps/web/.next/static/` → zero hits after build (testing-skill secret scan); the only thirdweb credential in any browser request is the publishable client ID, and only when Fund is enabled.
- [ ] Devtools: all balance/activity data arrives from `/api/wallet*` — no direct browser calls to thirdweb APIs except the Fund widget's own (when enabled).
- [ ] Insight outage (stub 500) → tab still renders native balance with the degraded note; wallet-less user sees the not-set-up state, no crash.
- [ ] No send/sign surface exists anywhere in the shipped tab (C21).
- [ ] `npm run typecheck` clean with the new dep; bundle check: the main route's client JS grows < 30KB gzip when Fund is disabled.

---

## M16 — The WZRD creative lane: `/imagine`, `/animate`, `/zap`

Port the proven creative command pipeline from `gratitude5dee/outsideairworker` ("WZRD") into air as a **control-plane command lane** that short-circuits *before* the Hermes agent: parse → route (one strict Groq call) → generate (GMI Cloud request queue) → deliver, on both web chat and iMessage. Rationale for bypassing the box: latency (no wake), cost (no box-seconds for a 6-second video job), and C2 symmetry (the GMI/Groq keys live only in the control plane, exactly like the inference gateway). Prose requests ("make me a picture of…") still fall through to the agent untouched — the lane owns only the explicit slash commands.

**The reference implementation is authoritative for semantics.** Cited paths below are into `outsideairworker`. Port the *discipline*, not just the code: single-mode ambiguity fails deterministically; the router can refuse but never re-route a paid mode; `submit_unknown` is never auto-resubmitted (C23); media URLs pass an SSRF gate before any fetch.

### What the reference does (inventory — verify on day one against the repo)

- **Parse:** `/imagine|/animate|/zap` as standalone tokens anywhere in prose, case-insensitive (`src/router.ts:53-85`); two distinct modes in one message → deterministic failure `"use one command: /imagine, /animate, or /zap"` (`src/router.ts:64-69`) — never picks a paid route.
- **Route:** one strict-JSON Groq call, model `openai/gpt-oss-20b`, 8s timeout, schema-validated, with `enforceExplicitCommandIntent` re-locking the mode afterward (`src/router.ts:158-183, 265-364`); router failure → clarification, never an error.
- **Vision pre-pass** on attached images: `qwen/qwen3.6-27b`, ≤3 images, 40-word clamp, non-fatal (`src/vision.ts`).
- **Generate** via GMI Cloud request queue (`https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey/requests`, submit → poll 2s):
  - `/imagine` → `gpt-image-2-generate` (or `-edit` with one attached image), png, sizes `1024x1536|1536x1024|1024x1024` by ratio (`src/gmi.ts:214-230, 175-186`).
  - `/animate` → `seedance-2-0-fast-260128`, 720p, duration 4–15 default 8, attached image = `first_frame`, audio on unless the user says silent (`src/gmi.ts:232-252`).
  - `/zap` → `gemini-omni-flash-preview`, ≤5 image refs + ≤3 video refs, 3–10s (`src/gmi.ts:254-274`).
- **Prompts:** versioned templates `generation.{imagine,animate,zap}.v2` with shared `VOICE` (≤12-word replies) and `SAFETY` blocks ("Refuse real named public figures, minors…, refusal is one friendly line"; user payload labeled untrusted) (`src/prompts.ts`).
- **Cost discipline:** global concurrency semaphore (default 2, clamp 1–4), 420s end-to-end budget, per-space pending caps, `submit_unknown` never resubmitted / known request IDs resumed by polling only (`src/gmi.ts:6-86, 346-352, 547-563`).
- **Safety rails:** provider moderation-failure classification → "can't make that one. want to try a different angle?"; `assertSafeGeneratedMediaUrl` SSRF gate (HTTPS only, no creds/ports/IP literals, host allowlist) (`src/gmi.ts:565-566`, `src/media-url.ts:71-120`).
- **Deliver (iMessage):** validated bytes as a native attachment first, then a ≤10-word caption; richlink then bare-URL fallbacks (`src/deliver.ts:49-121`).

### Tasks

1. **`lib/creative/` port.** New control-plane module, TypeScript-strict, fetch-based (no new deps): `parse.ts` (the token grammar + ambiguity rule), `router.ts` (Groq client + strict schema + `enforceExplicitCommandIntent`), `prompts.ts` (templates, keep the upstream version strings), `vision.ts`, `gmi.ts` (submit/poll/resume + semaphore + `submit_unknown` semantics), `media-url.ts` (SSRF gate, allowlist from `GMI_MEDIA_HOSTS` + `storage.googleapis.com`). Keep WZRD's model IDs and payload shapes verbatim; they are pinned by the provider (`REQUIRED_GMI_MODEL_PARAMETERS`, `src/provider-preflight.ts:30-50` — port that check too, into `cron/health`).
2. **State + cost.** Migration `0021_creative_lane.sql`: `creative_jobs (id, user_id, channel check ('web','imessage'), mode check ('imagine','animate','zap'), status check ('routing','submitted','polling','delivered','failed','refused','submit_unknown'), provider_request_id, prompt_version, error, created_at, delivered_at)` — **no prompt text, no media content in Postgres (C4)**; the prompt lives only in the request lifecycle. RLS select-own. Each delivered job inserts `cost_events (kind: 'render', amount_cents: CREATIVE_COST_CENTS_{IMAGE,VIDEO})`. Per-user daily cap `CREATIVE_DAILY_LIMIT` (default 20) checked before submit → friendly "you've hit today's creative limit."
3. **Web chat lane.** In `POST /api/chat` (`app/api/chat/route.ts`), before `startChatRun`: `parseExplicitGenerationCommand(input)` → if a mode is present, create a `creative_jobs` row and return `{ creative_job_id }` instead of `{ run_id }`. New `GET /api/creative/[jobId]/events` SSE streams `routing → generating → done|failed|refused` (reuse `SSE_HEADERS`, `lib/chat/relay.ts:73-77`). On success: download the validated bytes, store into the existing `creative_assets` pipeline (`0011_creative_assets.sql` — dedupe by sha256), mint a short-TTL delivery URL via the existing `/api/assets` mint path, and emit it in the terminal SSE event. Chat UI renders the ack line ("creating your image"), a progress shimmer, then the inline `<img>`/`<video controls>` bubble — the media `src` is the short-TTL delivery URL, never a provider URL.
4. **iMessage lane.** In the flush orchestrator (`lib/orchestrator/flush.ts`), after trust-tier resolution and before the Hermes run: same parse → **tier-2 senders never reach the lane (C23)** — their commands fall through to the existing tier-2 handling as if the lane didn't exist. For tier-0/1: run the lane, deliver via `lib/spectrum/sender.ts` — port WZRD's order (validated bytes as native attachment via spectrum-ts `attachment()`, then the caption line, then richlink/URL fallbacks). Debouncing (C14) still applies — the lane consumes the settled burst's text + attachments.
5. **Composer affordance.** Typing `/` at the start of an empty composer opens a small command palette above the input (same popover pattern as the `+` tier menu, `PromptInput.tsx:128-167`) listing the three commands with one-line descriptions from the reference's `docs/reference/commands.md:62-84` semantics ("Creates a still, or edits an attached image", …). Selecting inserts the token. Attachment support in the web composer (image for `/imagine` edit + `/animate` first-frame) — if web attachments don't exist yet, ship text-only `/imagine` first and file a follow-up; do not build a generic attachment system inside this milestone.
6. **Copy.** Port the user-facing strings verbatim where they fit ("creating your image", "here is your video", "can't make that one. want to try a different angle?", "i'm juggling a few. try again in a sec.", the ambiguity line). They are product voice, tested in production.
7. **Preflight.** Extend `cron/health` with the ported provider preflight: Groq + GMI model lists reachable, required payload parameter names present per model; alert via the existing ops surface on drift.
8. **Agent awareness (one line, not a system):** append to the template SOUL.md block: "Your human can also use /imagine, /animate, /zap in chat for instant media — those are handled before you see them." Prevents the agent from claiming it made something it didn't.

### Acceptance

- [ ] Web: `/imagine a cobalt paper kite over the ocean` → ack ≤2s, image bubble ≤60s typical, `creative_jobs` row `delivered`, asset in `creative_assets` with sha256 dedupe, media served only via short-TTL delivery URL (devtools: no `gmicloud.ai`/`googleapis` URL reaches the browser).
- [ ] iMessage tier-1 sender: same command round-trips to a native image attachment + caption; tier-2 sender's identical message produces **zero** provider calls and zero minted URLs (log-verified, C23).
- [ ] `please /imagine x with /animate y` → the exact deterministic failure line, no provider call, no charge.
- [ ] Kill the network between submit and poll → job lands `submit_unknown`, is never resubmitted, and "retry" creates a *new* job only on explicit user action; a job with a known request ID resumes by polling after a worker restart.
- [ ] Moderation-flagged prompt → the friendly refusal line; `creative_jobs.status = 'refused'`; no cost event.
- [ ] Daily cap: the 21st generation in a day is refused client-side and server-side.
- [ ] Concurrency: 4 simultaneous generations across 2 users → semaphore holds (≤`CREATIVE_MAX_CONCURRENCY` in flight), the rest queue with the "juggling" line.
- [ ] `grep -ri "GROQ_API_KEY\|GMI" apps/web/.next/static/` → zero (keys never reach a browser); the secrets test on a box shows neither key (they never reach a box either).
- [ ] Prose "make me a picture" (no slash) still goes to the Hermes agent unchanged.

---

## 5. Environment variables — additions

**Control plane (Vercel), server-side** — extending `goal.md` §5's list:

```
# M9  — display labels (optional; default = the resolved model ID itself)
MODEL_LABEL_FAST=            MODEL_LABEL_BALANCED=         MODEL_LABEL_DEEP=

# M13 — speech-to-text (defaults in parentheses)
STT_BASE_URL=                (MODEL_PROVIDER_BASE_URL)
STT_API_KEY=                 (MODEL_PROVIDER_API_KEY)
STT_MODEL=                   (whisper-1)
STT_COST_CENTS_PER_MIN=      (1)

# M15 — wallet
WALLET_CHAIN_ID=             (8453)

# M16 — creative lane
GROQ_API_KEY=                GMI_CLOUD_API_KEY=
GMI_ORGANIZATION_ID=         GMI_REQUEST_QUEUE_URL=   (GMI default queue URL)
GMI_MEDIA_HOSTS=             (storage.googleapis.com built in)
CREATIVE_MAX_CONCURRENCY=    (2, clamp 1–4)
CREATIVE_DAILY_LIMIT=        (20)
CREATIVE_COST_CENTS_IMAGE=   (5)
CREATIVE_COST_CENTS_VIDEO=   (25)
```

**Browser-visible — exactly one, by C21:**

```
NEXT_PUBLIC_THIRDWEB_CLIENT_ID=     # publishable; enables the Fund widget when present
```

**Per-user box env: unchanged.** Nothing in this spec adds a variable to the box's env list — adding one that carries a provider key violates C2; the two new box-callable routes (`/api/ads/meta/confirm`, `/api/ads/metrics`) authenticate with the existing `GATEWAY_TOKEN`.

---

## 6. Conventions — inherited, plus

Everything in `goal.md` §6 stands (TypeScript strict; all Box/Hermes calls through `lib/box/`/`lib/hermes/`; forward-only migrations; idempotency tests in the same PR as any webhook-shaped handler; structured logs with `user_id` + `box_id`). Additions:

- **All Composio calls go through `lib/composio/client.ts`; all creative-provider calls through `lib/creative/`; all wallet reads through `lib/wallet/`.** No raw `fetch` to any provider from a route handler.
- **New box-callable routes follow the `cards/computer` pattern exactly** (`app/api/cards/computer/route.ts`): `gateway_token` lookup → `user_id`, hostile-input validation, per-user rate limit or idempotent upsert.
- **UI work follows M9's system**: tokens from `globals.css`, `.panel`/`.btn`/`.seg` primitives, no new component library, no new `!important` color overrides, `lucide-react` for icons.
- **Every new user-visible failure has a written string** in the component (the codebase's existing habit — `page.tsx:241-256`, `service`-style copy in M16 task 6). No raw error objects in the UI.
- **Ported WZRD code keeps its prompt/protocol version strings** (`generation.imagine.v2`, …) so upstream diffs stay legible.

---

## 7. Verification before calling a milestone done

Run all of goal.md §7 (typecheck/lint/test; acceptance against a real forked box; the isolation test; the secrets test; the replay test), plus per this spec:

1. **The contrast test (M9+):** active/selected/hover states on nav, tiers, chips, and banners are legible in both color schemes — automated where cheap (computed-style assertions), eyeballed in a real browser per `.agents/skills/testing-web-ui/SKILL.md` both ways.
2. **The power test (M10+):** a full off → on → off cycle from the UI with devtools open — no `*.on.ascii.dev`, no token, no box ID in any response or request initiated by the page.
3. **The transient-audio test (M13):** record → transcribe → send, then prove absence: no Storage object, no Postgres row, no box request contains audio bytes or the transcript (other than the ordinary chat input path).
4. **The gate test (M14):** attempt every new ad write kind without approval — zero provider mutations observed provider-side.
5. **The tier-2 test (M16):** a tier-2 sender's `/imagine` produces zero provider calls, zero cost events, zero minted URLs — log-verified, same bar as goal.md M7.5's "tier-2 produces zero minted URLs".
6. **The spend test (M14/M16):** every paid path increments its meter (`ad_metrics_daily` reconciles with provider dashboards ±1 day; `cost_events` rows exist for stt/render) — money is never silent.

---

## 8. Order of operations

**M9 → M10 → M11 → M12 → M13 → M14 → M15 → M16.**

- **M9 first, alone, small.** It is a one-day milestone that every later UI task builds on; do not let it grow. Everything after it inherits legible states for free.
- **M10 before M11–M16** because every later milestone touches box interactions and inherits the visible power model (and its 429 honesty) instead of re-inventing error strings.
- **M11 and M12 are one story in two layers** — ship the UI truth (M11) before the continuity plumbing (M12) so the sync work has a surface that shows it working.
- **M13–M16 are mutually independent.** After M12 they can proceed in any order — or in parallel sessions if you are running more than one build agent; they touch disjoint files except `page.tsx` (tab shell) and `vercel.json` (cron), so coordinate those two files if parallelizing.
- **Raise the M16 credentials (Groq, GMI Cloud) and the `outsideairworker` repo access on day one**, like goal.md's Photon note — they are commercial dependencies with no engineering workaround.
- Within every milestone: migration → lib → route → UI → acceptance, in that order.

---

## 9. Escalate to a human, do not decide

All of goal.md §9 stands. Additionally, stop and ask when you hit any of these:

1. **Any impulse to weaken C18–C23** — especially "just store the audio for retries", "just execute this one ad write inline", "just put the secret key in the client for the demo".
2. **The STT verification (§3) fails** on the main model provider *and* no `STT_*` alternative is provisioned — provider choice is a commercial decision.
3. **Wallet send** (M15-stretch) — do not begin it without explicit approval; it is a value-transfer surface (ARCHITECTURE.md §8.3).
4. **The Meta MCP OAuth cannot complete from the box's browser** (the open question in `docs/verify-creative.md:36-41` turning out negative) — the fallback (operator-registered system-user token) changes credential custody and needs a human call.
5. **Porting `/fanpic` or Studio** — `/fanpic` embeds a real person's likeness as the fixed reference (`outsideairworker src/fanpic-storage.ts:21-25`); rights and consent are not an engineering question.
6. **A template rebuild is required but the Box plan/limits make re-forking user boxes disruptive** (M12 task 2, M16 task 8) — sequencing user-visible downtime is an operator decision.
7. **GMI/Groq pricing or model deprecations** discovered during preflight — swapping a pinned model ID is a product decision (output quality changes), not a config fix.

---

*End of spec. The order is the order. Cite this file in PRs by milestone and task number (e.g. "M10.4").*
