# goal.md: Air Create V12 — the `/create` conversation, dev → production, and the operator view

| Field | Value |
| --- | --- |
| Status | Build specification (executable plan) |
| Builds on | [docs/goal-create-v11.md](goal-create-v11.md) (lanes, Build Service, Kit, Functions, app origin — **shipped**, do not rebuild), [docs/goal-gmi-models.md](goal-gmi-models.md) (GMI family, Astra→GLM split), [design.md](../design.md), [ARCHITECTURE.md](../ARCHITECTURE.md), [SECURITY-DECISIONS.md](../SECURITY-DECISIONS.md) |
| Primary outcome | An owner texts `/create <prompt>` with or without files (or a GitHub URL) and, after at most three questions and a plan they approve as a `.md` in Messages, watches a percentage tick to a **shareable dev URL** at `link.wzrd.tech/<username>/<app-name>`; one more confirmation ships it to **production** at `mini.wzrd.tech/<username>/<app-name>`, lists it in the App Store, and mirrors its source to `gratitude5dee/wzrd-create` |
| Secondary outcome | The operator dashboard (`gratitude5dee/admin`) shows dev/prod deployments and token spend per model, lane, and project — see that repository's `goal.md` |
| Model split | **Astra plans, GLM builds.** Planner turns run on `openai/gpt-6-astra`; Builder and Reviewer turns run on `zai-org/GLM-5.3-Flash`, both through the GMI provider the gateway already speaks |
| Repositories | `gratitude5dee/airv2` (this file), `gratitude5dee/admin` (`goal.md`), `gratitude5dee/wzrd-create` (mirror target, **empty at verification**) |
| Last verified | 2026-09-17 against `airv2` @ `f6267a7`, `admin` @ `8174228`, `wzrd-create` @ empty `main` |

**Implementation status (2026-09-17).** This file stays the specification; what
has landed on `claude/stoic-fermi-4l87ma` is recorded in §17.2 at the end of the
milestone list. In short: MC1, MC2, MC5 and MC6 are implemented with tests, MC3
is implemented except for the repository seed MC0 owes it, and MC0 itself is
unstarted because it needs a real line, a real Box and push access to
`wzrd-create`.

Read V11 first. Every term here (`Project`, `Lane`, `Version`, `Draft`, `Bundle`, `Manifest`, `Functions`, `Kit`, the CR-constraints) keeps its V11 meaning. This file specifies the **delta**: a conversational intake, a plan-approval loop, a build-progress relay, a **dev channel** on `link.wzrd.tech`, a finalize step, a source mirror, and the admin surfaces. If this file conflicts with `ARCHITECTURE.md` or a live security decision, this file is wrong.

---

## 0. The outcome, as the owner sees it

```
owner   /create a landing page for my October tour with a ticket link and a countdown
air     got it — 2 quick questions before I plan this:
        1. is this a landing page (one scroll, one call to action) or a product page with a store?
        2. dark and cinematic, or bright and simple? (or send a screenshot you like)
owner   landing page. dark. tickets are on dice.fm/xyz
air     [attachment: tour-plan.md]
        here's the plan for "October tour" → link.wzrd.tech/gratitude/tour when it's ready.
        reply yes to build, or tell me what to change.
owner   make the countdown the hero. yes.
air     Creating your app …
        [card: October tour · building · 10%]          ← the card updates in place every 10 s
        …
        [card: October tour · dev build live · 100%]
        dev build is live: link.wzrd.tech/gratitude/tour — share it with anyone.
        say ship it when you want it in production.
owner   confirmed, let's ship it
air     before it ships: keep the name "October tour"? one-line description?
        and an icon — send an image, or say make one.
owner   keep it. "Every date, every ticket, one link." make one.
air     [attachment: icon preview]
        [decision card: Publish October tour → mini.wzrd.tech/gratitude/tour · public · App Store · source → wzrd-create]
owner   (taps Approve)
air     live: mini.wzrd.tech/gratitude/tour · listed in the App Store
        source: github.com/gratitude5dee/wzrd-create/apps/gratitude/tour
```

Three things never happen in that transcript: the agent never flips a status (the tap does, CR4), no URL is shared before the owner asked for one (CR13 amended by CR17 below), and nothing the owner said is copied into Postgres (C4/CR14 — the conversation lives in the Box).

### 0.1 What V12 is not

Not a new build system (V11's Build Service, Kit resolution, CSP linter, `validateBundle`, versions ledger, app origin, and Functions stay exactly as they are). Not a rewrite of the Create surface (`mini.wzrd.tech/create` gains three panes: Plan, Progress, Release). Not a payments launch (Stripe Connect and thirdweb x402 stay behind `air.json` proposals until `/create` is proven — §13). Not a general GitHub host: a GitHub URL is the Import lane with a public-zipball shortcut, nothing more.

### 0.2 The golden paths

**GP1 — sentence to production over iMessage** (the transcript above). Exit: an owner with a fresh Box goes from `/create …` to a public app in one thread with ≤ 3 questions, ≤ 2 plan revisions, one progress card, one decision card.

**GP2 — files.** `/create turn this into a page` + a PDF one-sheet + two photos. Attachments are materialized (`flush.ts` `materializeAttachments`, exists), the Planner reads them from `~/.hermes/inbox/`, the plan lists which assets it will use, images land in `public/` (≤ 2 MiB each, EXIF-stripped by the existing guard), the PDF's text becomes copy. Exit: the plan names every attachment and says what happens to each; unusable files (mp3, mov, mp4 in v1) are named in the plan under "not used yet" with the reason.

**GP3 — GitHub URL.** `/create https://github.com/someone/vite-portfolio`. Public repo → anonymous zipball → Repo Scan (`planRepository`, exists) → static or build link → dev release. Private repo or a repo that needs a build → the reply asks the owner to install the WZRD GitHub App (`/api/create/github/connect`, exists). Exit: a public static Vite export is on `link.wzrd.tech/<u>/<a>` in under two minutes; a Next server app is refused with the scan's five-line verdict.

**GP4 — web parity.** The same intake runs in the Create surface's Plan pane with the same questions, plan, progress bar and release buttons. Exit: a project started in Messages continues on the web and vice versa (one intake row, one workspace).

---

## 1. Existing substrate (verified) and what changes

| Exists | Where | V12 use |
| --- | --- | --- |
| `/create` slash command → owner-only Create card | `lib/miniapps/imessageCommand.ts` (`parseMiniAppCommand`, the `create` branch) | Gains `parseCreateCommand`: `/create <prompt>` and `/create <url>` start an **intake** instead of only sending the card |
| Attachment materialization into the Box | `lib/orchestrator/flush.ts` `materializeAttachments` | Unchanged; the Planner is told the paths |
| Create turns, sessions, budgets | `lib/create/turn.ts` (`air-create-<appname>`, `create-<tier>:<slug>`), `lib/create/budget.ts` (`create:<slug>` label, `$5` default) | Every intake/plan/build turn is a Create turn on the project's budget |
| Create tier family | `lib/entitlements/models.ts` `CREATE_TIER_MODELS` (today `gpt-5.6-luna` / `terra` / `terra` on the `openai` provider), `MODEL_CREATE_*` overrides | Re-pointed to GMI: deep = Astra, balanced/fast = GLM-5.3-Flash; provider chosen per slug (§7) |
| GMI provider and catalog | `GMI_MODELS`, `GMI_TIER_MODELS`, gateway `case "gmi"`, `gmiReasoningEffort` | Reused; a Create request on a GMI slug dispatches to GMI |
| Build Service, versions, preview | `lib/create/{build,versions,preview,qa,lint,kit,css}.ts`, `POST /api/create/{build,qa,status,preview-link}` | Unchanged; the progress relay reads `build.status` and the version row |
| Draft app origin | `<slug>-draft` Worker, 60-second owner token (`lib/create/preview.ts`) | Unchanged for drafts. A **dev release** is a third script name `<slug>-dev` (§6) |
| Publishing | `POST /api/miniapps/publish` (agent stages), `miniapp_publish` decision, `setPublishStatus`, `pointLiveAt` | Unchanged; finalize (§9) fills the decision payload |
| Cards in place | `lib/miniapps/cards.ts` `sendOrUpdateAppCard`, `updateMiniAppCard`; `cardSends.ts` 2-minute cooldown on *new* sends | The progress card is one `app` card updated every 10 s |
| Attachments outbound | `SpectrumSender.sendAttachment(spaceId, phone, data, {name, mimeType})` (`lib/spectrum/sender.ts`) | Delivers `<appname>-plan.md` and the icon preview |
| Import lane | `lib/create/import.ts`, `lib/github/app.ts` (`installationToken`, `downloadZipball`, `putFile`, `deleteFile`) | GitHub URL intake; `putFile` also writes the mirror (§10) |
| Link host | `middleware.ts` `linkHost()` behind `LINK_HOST_ENABLED`, pay links at `link.wzrd.tech/<slug>` | Gains the two-segment dev route `/<u>/<a>` (§6) |
| Discovery / App Store | `lib/miniapps/discovery.ts` (`discoverable`, index, sitemap, llms.txt, JSON-LD), Apps tab | "Ships to the App Store" = `visibility='public'` + `listed_at` — no new system |
| App art | `lib/miniapps/app-art.ts` (`icon_key`, publisher art wins) | Finalize sets `icon_key` from an upload or a generated image |
| Image generation | `lib/creative/gmi.ts` (`gemini-3.1-flash-image` = "Nano Banana"), `model-prefs.ts` | Icon generation reuses the creative lane's image call (§9.2) |
| Eval suite | `evals/agent-suite/create/{run.ts,cases.jsonl}`, `lib/create/evals.test.ts` | Gains V12 cases (§15) |
| Ops counters | `lib/security/limits.ts` (`BUILDS_PER_HOUR=60`, `CREATE_TURNS_PER_HOUR=120`, `QA_RUNS_PER_HOUR=30`, `IMPORTS_PER_DAY=10`), `ops_events` | Gains `intake`, `plan`, `dev_release`, `dev_revoke`, `mirror` kinds |
| Admin API | `app/api/admin/{tokens,timeseries,boxes,fleet/*,ops}` | Gains `deployments`, `create`, and `tokens?group=` (§12) |
| Fleet channels | `lib/fleet/channels.ts` (`dev` / `prod` pointers into `template_releases`) | Reported on the admin Deployments page beside app deployments |

### 1.1 What this file changes on purpose

1. **CR13 is amended, not removed.** Drafts stay owner-only. V12 adds a **dev release**: one version the owner explicitly promoted to `link.wzrd.tech/<u>/<a>`, unlisted, guest-readable, time-boxed, revocable (CR17).
2. **The Create tier family moves to GMI.** V11 §9.1 planned Anthropic slugs; today's code serves Luna/Terra on OpenAI. V12 pins Astra for planning and GLM-5.3-Flash for building, as `goal-gmi-models.md` §2 argued for the main lane. `goal-gmi-models.md` §1.2 said "`create-*` stays OpenAI-only"; this file is the separate decision it deferred to.
3. **Source may leave the Box.** V11 CR14 keeps content out of Postgres; it still does. The mirror (§10) copies a published app's *source* to a public repository **only** on the owner's tap of a decision whose payload says so, with Tier B modules and secrets stripped.

---

## 2. Constraints added by V12

All C-, I-, MA-, L- and CR1–CR16 constraints remain in force.

| ID | Constraint |
| --- | --- |
| CR17 | **A dev release is an owner act, unlisted, time-boxed, and revocable.** `link.wzrd.tech/<u>/<a>` serves exactly the version in `mini_apps.dev_version`, set only by the owner's confirmation ("yes" to the plan implies "share the first working build on dev"; the plan says so in its last line). Dev releases carry `X-Robots-Tag: noindex`, never join discovery, expire after `CREATE_DEV_TTL_DAYS` (14) unless renewed by a new build, and are revoked by one owner command or one admin action. Drafts (`<slug>-draft`) remain owner-only. |
| CR18 | **Astra decides, GLM types, neither flips.** Planner turns (intake questions, plan, goal, revisions, finalize copy) run on the Create deep tier; Builder/Reviewer turns on balanced/fast. Roles are model tiers on the same Hermes session (V11 §9.1 rule 3); no role gains an approval path. |
| CR19 | **Progress is derived, never self-reported.** The percentage on the card is computed by the control plane from build/QA/test state (§8.2); a model's "I'm 80% done" is text, not state. The card updates at most once per `CREATE_PROGRESS_TICK_MS` (10 000) and never sends a *new* card inside the two-minute cooldown. |
| CR20 | **The mirror is opt-out per app, decision-gated, and scrubbed.** Source reaches `wzrd-create` only via the platform's own GitHub App installation on that repository, only for a version that passed the publish decision with `mirror: true` in the payload the owner saw, never including `@kit/restricted/*` (Tier B, CR11), `functions/` secrets, `.build/`, or any file `textContainsSecrets` flags. The mirror is a copy of what the app origin serves, not a live sync of the workspace. |
| CR21 | **Intake content stays in the Box.** Questions, answers, plan, goal, and the finalize copy live under `~/.hermes/create/<appname>/`. `create_intakes` holds state, counters, template id, hashes, and timestamps only. A plan attached in Messages is bytes read from the Box for that send and not retained by the control plane. |
| CR22 | **Tests are part of the build contract.** A confirmed goal declares acceptance steps (`air.json.tests[]`, §8.4). A dev release requires zero hard findings, `qa_score ≥ 70`, and every declared test passing; production additionally requires the owner's tap. A Builder cannot delete tests it did not add (the Planner's tests carry `locked: true`). |
| CR23 | **`link.wzrd.tech` disambiguates by shape.** One path segment is a pay link (existing); two segments `/<u>/<a>` where `<u>` matches `USERNAME_PATTERN` and is not reserved is a dev app. Nothing else is served on that host. |

---

## 3. Non-goals

- Payments in `/create` (Stripe Connect storefronts, x402-gated apps) — the seam exists (`lib/commerce/payLinks.ts`, `lib/payments/x402`, `air.json` `price`/`access` proposals) and is wired in §13 as P2 after GP1 is measured.
- Editing plans in a rich editor; the plan is Markdown and the owner edits by talking or in the Files tab.
- Video/audio attachments as app content in v1 (mp3/mov/mp4 are acknowledged, stored in the Box, and listed as "not used yet"; the creative lane owns media).
- Custom domains, per-app analytics dashboards for owners, multi-owner apps.
- A second agent identity, memory, or approval path (I1).
- Training or evaluating models (V10).

---

## 4. Canonical domain model (additions)

| Term | Meaning |
| --- | --- |
| `Intake` | One `/create` conversation from first prompt to production or abandonment. Row in `create_intakes`; content in `~/.hermes/create/<appname>/intake/` |
| `Template` | A named starting shape the Planner picks or asks about: `landing` (sales funnel / landing page), `store` (product page; payments P2), `game-2d` (canvas), `game-3d` (Three.js, non-lite), `tool` (utility with state), `page` (content/portfolio) |
| `Plan` | `plan.md` — the owner-facing description of what will be built (screens, copy, assets, components, URL). Versioned `plan.v<n>.md`; the latest is `plan.md` |
| `Goal` | `goal.md` — the Builder-facing executable spec generated from the confirmed plan (§8.3), including `## Tests` |
| `Stage` | Where an intake is: `asking → planning → plan_sent → revising → confirmed → building → qa → testing → dev_ready → finalizing → decision_sent → production` plus `abandoned` and `failed` |
| `Dev release` | `mini_apps.dev_version` and the `<slug>-dev` Worker behind `link.wzrd.tech/<u>/<a>` |
| `Finalize` | The step that collects `name`, `description`, `icon_key`, `mirror` before the publish decision |
| `Mirror` | The copy of a published version's source under `apps/<username>/<appname>/` in `gratitude5dee/wzrd-create` |
| `Progress` | The `{percent, stage, detail}` triple the relay computes (§8.2) |

### 4.1 Precedence

`ARCHITECTURE.md` > security decisions > V11 > this file > Kit `DESIGN.md` > a template's scaffold > the Planner's plan > the Builder's judgment.

---

## 5. Owner experience

### 5.1 Over iMessage — the state machine

| Stage | Owner sees | Owner can say | Transition |
| --- | --- | --- | --- |
| `asking` | One message, ≤ 3 numbered questions (§5.2) | free text answers; "you pick"; "skip" | → `planning` on any reply (unanswered questions default to the template's defaults) |
| `planning` | typing indicator only | — | → `plan_sent` when `plan.md` exists |
| `plan_sent` | `<appname>-plan.md` attachment + 3-line summary + "reply **yes** to build, or tell me what to change" | "yes / go / build it / confirm"; edits; "cancel" | yes → `confirmed`; edits → `revising`; cancel → `abandoned` |
| `revising` | new `plan.v<n>.md` attachment + one line on what changed | same as `plan_sent` | ≤ `CREATE_PLAN_MAX_REVISIONS` (5), then "let's finish this in the Create surface" + card |
| `confirmed` | "Creating your app …" then the progress card | "stop" | → `building` |
| `building` / `qa` / `testing` | card caption `<name> · <stage> · <percent>%` updated every 10 s | "stop" | → `dev_ready` when CR22 holds; → `failed` after 3 consecutive failed builds |
| `dev_ready` | card `dev build live · 100%` + "dev build is live: link.wzrd.tech/<u>/<a> — share it with anyone. say **ship it** when you want it in production." | "ship it / finalize / production"; more edits (→ `building`, dev pointer moves on success) | → `finalizing` |
| `finalizing` | "before it ships: name? one-line description? icon — send an image or say **make one**." | answers; "keep it"; image attachment; "make one" | → `decision_sent` once all three are set |
| `decision_sent` | `miniapp_publish` decision card (V11 §5.4 payload + `mirror`, `store: listed`) | tap Approve / Decline | Approve → `production`; Decline → `dev_ready` |
| `production` | "live: mini.wzrd.tech/<u>/<a> · listed in the App Store" + mirror link when done | further edits start a new dev cycle on the same app | — |

Rules: the owner's phone (sender tier 0) is the only sender that advances an intake; anyone else gets `OWNER_ONLY_CARD_LINE`. "stop" at any stage pauses the run (`POST /api/create/turn/[runId]/stop`, exists) and leaves the stage as is. An intake with no owner message for 7 days is `abandoned` (draft kept, dev release untouched).

### 5.2 The questions

The Planner may ask **zero to three** questions, in one message, only about things the prompt and attachments do not settle. Question slots, in priority order:

1. **Template** — asked only when two templates fit ("landing page, or a product page with a store?"). Never asked when the prompt names one.
2. **Content** — the one missing fact the app cannot ship without (the date, the link, the product name, the game's win condition).
3. **Taste** — one binary or a reference ("dark and cinematic, or bright and simple? or send a screenshot").

Each template contributes defaults so every unanswered slot has a value. The message ends with "reply in one message; say **you pick** for any." A second round is allowed only when an answer contradicts the prompt; a third round never.

### 5.3 The plan (`plan.md`)

Owner-facing, ≤ 60 lines, generated by the Planner from a fixed skeleton (Appendix A). It names: the app's name and URL (`link.wzrd.tech/<u>/<a>` for dev, `mini.wzrd.tech/<u>/<a>` for production), the template, the screens in order, the copy it will write and the copy it needs, every attachment and what happens to it, the Kit components it will use (by catalog id), theme, what it will **not** do, and the last line: "Reply **yes** and I'll build this and put the first working version on your dev link."

Delivery: `sendAttachment(spaceId, phone, bytes, { name: "<appname>-plan.md", mimeType: "text/markdown" })`, then a text with three lines (name → URL, template + theme, "reply yes…"). If the attachment send throws, the text carries the plan's first 12 lines and a Create-surface card (`[card: create]`) whose Plan pane shows the full file.

### 5.4 The web surface

`mini.wzrd.tech/create` gains three panes inside the existing `CreateStudio`:

- **Plan** — the questions as a form (same three slots), the rendered `plan.md`, revision history, a **Build this** button (= "yes").
- **Progress** — the same `{percent, stage, detail}` the card shows, the build log tail (exists), findings, QA, tests.
- **Release** — Dev: URL, expiry, **Renew** / **Revoke**; Production: finalize form (name, description, icon upload / **Generate icon**), mirror toggle, **Request publish** (files the decision; the decision is approved in Needs-you).

Both entry points write the same `create_intakes` row and the same workspace.

---

## 6. URL scheme: the dev channel

```
link.wzrd.tech/<slug>                    pay link (existing, unchanged)
link.wzrd.tech/<username>/<appname>      DEV: mini_apps.dev_version via <slug>-dev (new, CR17/CR23)
mini.wzrd.tech/<username>/<appname>      PRODUCTION: live version (V11 §6, unchanged)
<slug>.apps.wzrd.tech                    live app origin (V11)
<slug>-draft.apps.wzrd.tech              owner-only draft (V11)
<slug>-dev.apps.wzrd.tech                dev app origin (new)
```

### 6.1 Routing (`apps/web/middleware.ts`)

On the link host (`linkHost()`, requires `LINK_HOST_ENABLED=true`): if the path is `/<u>/<a>[/rest]` with `<u>` matching `USERNAME_PATTERN`, not reserved, and `<a>` matching `APPNAME_PATTERN`, rewrite to `/mini/<u>-<a>[/rest]` with `x-mini-nested: 1` **and** `x-mini-channel: dev` (both middleware-owned, stripped from inbound requests like `x-mini-host`). One segment keeps today's pay-link route. Everything else on the link host 404s. The mini host never sets `x-mini-channel`.

### 6.2 The loader (`app/mini/[app]/route.ts`)

With `x-mini-channel: dev`: require `mini_apps.dev_version` not null and `dev_expires_at > now()`; run the gate chain with visibility forced to `unlisted` (no password, no x402, guest session allowed); log `app_opened` with `channel='dev'`; hand off with an app token whose claims add `channel: "dev"` to `<slug>-dev` (the Dispatcher routes by `claims.channel`: `draft` → `-draft`, `dev` → `-dev`, else live). Responses carry `X-Robots-Tag: noindex, nofollow`. Expired or revoked → the manifest's 404 page with one line: "this dev link has expired."

### 6.3 Promotion

`promoteToDev(app, version)` (`lib/create/release.ts`): re-upload the version's digest to `<slug>-dev` (`deployStaticVersion`/`promoteVersion` pattern from `lib/functions/deploy.ts`), write the KV manifest entry, set `dev_version`, `dev_released_at`, `dev_expires_at = now() + CREATE_DEV_TTL_DAYS`, record `ops_events('dev_release')`. `revokeDev(app)` deletes the `-dev` script, nulls the pointers, records `dev_revoke`. Renewal = the same call with the same version. A production publish does **not** revoke dev; the owner or the 14-day expiry does.

### 6.4 Functions on dev

A Functions app on dev gets its own D1/KV pair (`resourceId(app, "dev")`) so dev traffic never touches production data; the egress allowlist and AI cap are the approved ones or, when the backend is not yet approved, **none** (the dev Worker gets no `air.internal` credential until `miniapp_backend` is approved — CR6/CR7 hold on dev exactly as on live).

---

## 7. Model routing: Astra plans, GLM builds

### 7.1 Tier map

| Create tier | Role | Slug (GMI) | Env override |
| --- | --- | --- | --- |
| `create-deep` | Planner: questions, plan, goal, revisions, finalize copy, Repo Scan summary | `openai/gpt-6-astra` | `MODEL_CREATE_DEEP` |
| `create-balanced` | Builder: edits, `air-create build`, fix findings | `zai-org/GLM-5.3-Flash` | `MODEL_CREATE_BALANCED` |
| `create-fast` | Reviewer: `air-create qa`, `air-create test`, small fixes | `zai-org/GLM-5.3-Flash` | `MODEL_CREATE_FAST` |

`CREATE_TIER_MODELS` in `lib/entitlements/models.ts` becomes the table above. `createProviderFor(slug)` returns `"gmi"` when `isGmiModel(slug)` and `"openai"` otherwise, so an operator can still point an override at an OpenAI slug. The gateway's Create branch (already keyed on `CREATE_MODEL_RE`) dispatches on that provider, meters `cost_usd` by served slug (GMI branch, exists), and sends `reasoning_effort` from `GMI_CREATE_BUILD_EFFORT` (default `medium`) for balanced, `low` for fast, none for deep. Astra/Luna GMI pricing remains an open item (`goal-gmi-models.md` §4); until confirmed, `costUsd` uses the OpenAI list price and the admin Tokens page labels it "list-estimated".

### 7.2 Which turn is which role

The skill (§11) opens each stage with the right tier: `air-create plan` runs on `create-deep`; `air-create build` loops on `create-balanced`; `air-create qa|test` on `create-fast`. The owner's entitled tier is the ceiling (V11 §9.1 rule 2): an owner on Balanced gets a Balanced Planner (GLM) and the plan says so in one line. Delegated child runs keep the owner's own family.

### 7.3 Stage attribution

`agent_runs` gains `create_stage text check (create_stage in ('plan','build','review','finalize'))` (migration §14.2) set from the run's model request (`create-<tier>:<slug>#<stage>` — the `#<stage>` suffix is accepted by `CREATE_MODEL_RE` and stripped before resolution). The admin Tokens page groups on it (§12).

---

## 8. The pipeline

### 8.1 Intake (`lib/create/intake.ts`)

```
/create <text> [attachments|url]
  → parseCreateCommand → { prompt, url? }              (imessageCommand.ts)
  → openIntake(user)  → create_intakes row (stage 'asking'), provisional appname
  → workspace ~/.hermes/create/<appname>/intake/{prompt.md, attachments.json}
  → Planner turn (create-deep): reads DESIGN.md + templates/ + prompt + attachments
     writes intake/questions.md (0–3) → stage 'asking' | 'planning'
  → owner reply → intake/answers.v<n>.md → Planner writes plan.md → 'plan_sent'
  → "yes" → Planner writes goal.md (Appendix B) + air.json (tests[]) → 'confirmed'
```

Provisional appname: the Planner proposes ≤ 32 chars from the prompt (`validateAppName`); collisions get a numeric suffix; the owner can rename in the plan revision loop ("call it tour26"). After `confirmed` the appname is fixed for this project (renaming = a new project from the same source, one command: `air-create fork <old> <new>`).

A GitHub URL (`https://github.com/<owner>/<repo>[/tree/<branch>]`) skips the questions: `planRepository` runs on the public zipball (new `downloadPublicZipball`, no token, 50 MiB cap, `IMPORTS_PER_DAY`), the plan is the scan's verdict plus what the dev release will contain, and "yes" runs the existing static Import path or asks to install the GitHub App for a `build` link.

### 8.2 Progress relay (`lib/create/progress.ts`)

```
percent(intake, build, version):
  confirmed .......... 5
  scaffold written ... 10      (air.json + src/main.tsx exist)
  build queued ....... 15
  build running ...... 15 + 25 * min(1, elapsed / p50_build_ms)   // p50 from the last 50 builds, floor 20 s
  build succeeded .... 45     (hard findings → stay at 45, detail = first finding rule)
  qa running ......... 45 → 65 (same elapsed curve)
  qa done ............ 65
  tests running ...... 65 → 85
  tests passed ....... 85
  dev deploy ......... 90 → 99
  dev live ........... 100
```

The relay is a loop inside the flush job that owns the owner's open Create run (the job already holds the Hermes run and streams its reply): every `CREATE_PROGRESS_TICK_MS` it reads `GET /api/create/status`-equivalent state in-process, computes `{percent, stage, detail}`, and calls `sendOrUpdateAppCard` with caption `<name> · <stage> · <percent>%` and subcaption `detail`. The first call sends the card (`app` kind, `resource_id = <slug>`); later calls update in place; three consecutive `failed` update outcomes fall back to a text every `CREATE_PROGRESS_TEXT_MS` (default 30 000; set to 10 000 to match the card cadence when a line has no card support). Percent is monotonic within a build attempt and resets to 15 on a retry with detail "retry 2/3". The web Progress pane reads `GET /api/create/progress?app=` (§14.1), which returns the same triple.

### 8.3 `goal.md` — the Builder's brief (Appendix B)

Generated by the Planner on `confirmed`, ≤ 200 lines, and the only thing the Builder is told to read first. It is **executable**: every screen has a component list from the Kit catalog, every action names its `useAirState` resource, and `## Tests` is the literal `air.json.tests[]` array. The Builder may append to `## Build log` and may not edit any other section; a Planner re-plan rewrites it.

### 8.4 Tests (`air.json.tests[]`, `air-create test`)

A small declarative DSL the Preview QA runner (in the Box browser, existing `air-create qa` harness) executes after QA, at 390×760 with reduced motion on:

```json
{ "id": "hero-visible", "see": "October tour", "locked": true }
{ "id": "tickets-link", "tap": "[data-test=tickets]", "expectHref": "https://dice.fm/", "locked": true }
{ "id": "countdown-ticks", "wait": 1100, "changed": "[data-test=countdown]" }
{ "id": "rsvp-saves", "type": ["[data-test=name]", "Ana"], "tap": "[data-test=rsvp]", "see": "Ana", "role": "owner" }
{ "id": "guest-readonly", "role": "guest", "missing": "[data-test=rsvp]" }
```

Verbs: `see` (visible text), `missing` (selector absent or hidden), `tap`, `type`, `wait`, `changed` (text differs from before the wait), `expectHref`, `viewport`, `role` (`owner` uses the owner preview token, `guest` a guest grant on the dev origin). The runner posts `{ tests_total, tests_passed, failed_ids[] }` to `POST /api/create/qa` (extended), stored on the version row (`tests_total`, `tests_passed` — ids only, no content). `locked: true` tests are the Planner's and cannot be removed by a Builder turn (the build refuses an `air.json` whose locked ids shrink, hard finding `tests.locked-removed`). CR22 gates dev on `tests_passed == tests_total`.

### 8.5 Failure handling

Three consecutive failed builds, a spent budget (`insufficient_quota`, exists), or a QA/test loop that does not converge in 6 Builder turns → stage `failed`, card `<name> · needs you · <percent>%`, one text: "I'm stuck on <first finding rule or failing test id>. open the Create surface to look, or say **try again**." No further model turns until the owner speaks.

---

## 9. Finalize and production

### 9.1 The three answers

`finalizing` collects `name` (≤ 60 chars, default the plan's), `description` (≤ 160 chars), and `icon_key`. Answers are parsed by a `create-deep` turn into `intake/finalize.json` and applied through the existing owner routes (`PATCH /api/mini/publish` for name/description/icon). "keep it" accepts the plan's values.

### 9.2 Icons

- **Upload**: an image attachment → materialized → `POST /api/create/icon` (owner or Box) → `guard.ts` (EXIF strip, secret scrub) → resize to 512×512 and 180×180 PNG → R2 under `apps/<slug>/icon/<sha>.png` → `icon_key`.
- **Generate** ("make one"): `POST /api/create/icon {generate: true}` → one image call on the creative lane with `CREATE_ICON_MODEL` (default `gemini-3.1-flash-image`, the "Nano Banana" entry in `model-prefs.ts`) and a fixed prompt template (app name + description + theme tokens' hue words, "flat, single subject, no text, centered, 1:1") → same pipeline → the preview is sent back with `sendAttachment` → "use it, or send your own." Cost is metered as `render_cents` on the owner's spend like any `/imagine`. One regeneration free; the third asks to upload instead.

### 9.3 The decision

`POST /api/miniapps/publish` (exists) files `miniapp_publish` with the V11 §5.4 payload plus `channel: "production"`, `store: "listed" | "unlisted"`, `mirror: true | false`, `tests: {passed, total}`, `qa_score`, `dev_url`. The card renders those lines. Approve → `setPublishStatus('published')` + `pointLiveAt(version)` + `visibility='public'`, `listed_at=now()` when `store: listed` (the App Store and Apps tab pick it up through `discoverable`, no new code) → mirror job (§10) → reply with the production URL as a rich link and the store line. Decline → `dev_ready`, one line.

"Auto-ships to the App Store" therefore means: the finalize default is `store: listed`; the owner can say "unlisted" in finalize; the decision card shows which.

---

## 10. The mirror: `gratitude5dee/wzrd-create`

### 10.1 Layout (repository is empty today; MC0 seeds it)

```
wzrd-create/
  README.md                         what this is, license note, how apps get here
  LICENSE                           MIT for platform glue; per-app LICENSE inside each app
  .wzrd/schema.json                 manifest schema
  apps/<username>/<appname>/
    README.md                       generated: name, description, URLs, kit version, tests summary
    air.json
    goal.md                         the confirmed Builder brief
    plan.md                         the approved owner plan
    src/**                          source as built (Tier B imports rewritten to a stub + NOTICE)
    public/**                       assets ≤ 2 MiB each, EXIF-stripped
    functions/**                    source only; secrets never existed here (§11.4 V11)
    .wzrd/manifest.json             version, bundle_sha256, worker_sha256, kit_version, mirrored_at, omitted[]
```

Hosting statement in the README: "Apps here run at `link.wzrd.tech/<u>/<a>` (dev) and `mini.wzrd.tech/<u>/<a>` (production). This repository is a source mirror, not the deploy path." The deploy path stays the Build Service and the app origin (CR3, CR10): pushing to this repo deploys nothing.

### 10.2 Mechanics (`lib/create/mirror.ts`)

Triggered by the publish decision's approval with `mirror: true`. Pull the workspace tree through `runCommand` (the same pull `build.ts` does), filter (`.build/`, `node_modules`, anything not in the built version's file list, Tier B modules → `// omitted: Tier B (Commons Clause) — see NOTICE`, files failing `textContainsSecrets`), write each file with `putFile` under the platform installation (`WZRD_CREATE_INSTALLATION_ID`, a GitHub App installation on `wzrd-create` only), one commit per version: `apps/<u>/<a>: v<epoch> (<bundle_sha256[0:12]>)`. A re-publish overwrites the folder; a revoked/suspended app gets a commit that replaces `src/` with `README.md` stating the removal (the history is public; the owner is told this in the decision card's `mirror` line). `ops_events('mirror')`; failures set `create_intakes.mirror_error` and never block the publish.

### 10.3 Consent copy

Decision line: "source → github.com/gratitude5dee/wzrd-create/apps/<u>/<a> (public, MIT). say **no mirror** in finalize to keep it private." Finalize accepts "no mirror" / "keep the code private" → `mirror: false`.

---

## 11. The skill and the Kit

### 11.1 `create-miniapp` skill v4 (`packages/create-kit/prompts/src/skill.md` → generated `infra/template/skills/create-miniapp/SKILL.md`)

New commands, all `curl` to `/api/create/*` with the gateway token as today:

```bash
air-create plan <appname> [--answers <file>]    # Planner: questions or plan.md; posts intake stage
air-create confirm <appname>                    # writes goal.md + air.json.tests; stage → confirmed
air-create test <appname>                       # runs air.json.tests[] in the Box browser; posts results
air-create release <appname> dev                # asks the control plane to promote the draft to dev (CR22 checked server-side)
air-create finalize <appname> --name … --description … [--icon <path>|--generate-icon] [--no-mirror]
air-create fork <old> <new>                     # copy a workspace to a new appname
```

New reporting rules: the plan is delivered by the control plane, not pasted into chat; progress is never narrated in text while the card is live ("building…" lines are removed from the reply); after `release dev` say "dev build is live: <url>"; after `finalize` say "ready for your approval"; never say "published" or "live on mini" before the decision resolves.

### 11.2 Templates (`packages/create-kit/templates/<id>/`)

Each template is a runnable scaffold (`air.json`, `src/main.tsx`, `src/app.css`, `goal.template.md`, `tests.json`) the Planner copies and edits. Six ids: `landing`, `store`, `game-2d`, `game-3d`, `tool`, `page`. The catalog's eight recipes (`prompts/src/recipes/`) gain four: `09-landing-funnel.md`, `10-product-page.md`, `11-game-2d-canvas.md`, `12-game-3d-three.md`. `harvest.ts` includes templates in `DESIGN.md` §2 and verifies each scaffold builds under the lite budget (`game-3d` is `lite: false` and must render a static poster frame under lite/reduced motion — the Kit's `metal-fx` rule).

`game-3d` requires vendoring `three` (MIT) into `vendor/tarballs/` with an SBOM entry (`scripts/vendor.ts --sbom`); its weight (~150 KiB gz for the core) fits the 1 MiB hard budget, not the 300 KiB lite budget, so the scaffold degrades to a 2D canvas poster when `useLite()` is true.

### 11.3 Design references — the effects vocabulary, the Tier B pack plan, and the vault map

**Verified catalogue (2026-09-17).** The owner supplied the hand-off artifact of a crawl of the React Bits public index (`reactbits.dev/llms.txt`) and the arlan.me vault sitemap: 190 rows, kept verbatim as `packages/create-kit/evidence/catalogues/component-prompts-2026-09-17.csv`. It replaces every "unverified" name this section carried before.

| Source | Entries | License / tier | Where it lands |
| --- | ---: | --- | --- |
| React Bits — Text Animations | 32 | MIT + Commons Clause, **Tier B** | vocabulary (`build` / `no`), a few `pack` |
| React Bits — Animations | 38 | Tier B | vocabulary; cursor and scroll pieces are `no` |
| React Bits — Components | 45 | Tier B | vocabulary; mostly `build` |
| React Bits — Backgrounds | 57 | Tier B | 13 already packed; shader scenes are `pack` or `no` |
| arlan.me vault | 18 (+3 owner briefs) | MIT, **Tier A** | 9 harvested (6 studies + 3 briefs), 9 excluded, 1 gap (ransom-note), 2 `build` (kinetic-typography is also a harvest candidate) |

**Outcome of the annotation pass (2026-09-17).** 190 entries plus the three owner briefs (193 lines), 57 verifier corrections in the first pass and a second critic-driven revision (pure-look when-lines, per-verb fields: build briefs with their own renderer/lite/touch flags, pack fallbacks, decline rules with a nearest Kit id): 49 already covered by a Tier A component (`@kit/<id>`), 13 packed Tier B backgrounds, 8 Tier B pack candidates (Laser Flow, Aero Shards, CRT Warp, Ferrofluid, Ghost Fibers, Lightfall, Plasma Wave, Morph Slider), 70 `build`, 53 `no`. Per group: Text 32 (10 Kit / 14 build / 8 no), Motion 38 (8 / 1 pack / 12 / 17), Cards 45 (14 / 1 pack / 18 / 12), Backgrounds 57 (8 / 13 packed / 6 pack / 24 / 6), arlan 21 (9 / 2 / 10). The three owner briefs were harvested the same day as `arlan/shutter-type` and `arlan/swing-type` (lite, Canvas 2D, 3–4 KiB gz) and `arlan/rush-type` (non-lite, WebGL1); the Kit is now 79 components, 76 lite — see §11.4.

**Mechanism: the effects vocabulary (DESIGN.md §4).** Every row was annotated for the Kit — renderer, lite, touch, reduced-motion behaviour, scroll linkage, CSP risk, a Kit-voice when-line, tags, recipe and template fit — and each annotation chunk was audited by an independent adversarial verifier (the annotate → refute workflow; corrections are recorded beside the entries in `evidence/catalogues/kit-annotations-2026-09-17.json`). the curated data lives in `packages/create-kit/prompts/src/effects.json` (with the intro prose in `effects.md`) and is rendered into DESIGN.md as **§4 Effects vocabulary** by `scripts/lib/effects.ts` via `scripts/lib/design.ts`, so the Planner resolves a named look in one lookup to one of five verbs:

| Verb | Meaning | Rule |
| --- | --- | --- |
| `@kit/<id>` | A Tier A component already covers it (e.g. Rotating Text → `fancy/text-rotate`, Cursor Grid → `fancy/pixel-trail`) | Import; never rebuild |
| `@kit/restricted/<name>` | One of the 13 packed React Bits backgrounds | Non-lite; poster frame under reduced motion |
| `pack` | Worth adding to the Tier B artifact (shader, physics, 3D) | Operator packs per `restricted/README.md`; until then `build` or decline |
| `build` | Implement an original under the contract from the one-line description | The description is the brief; upstream source is never copied (CR11) |
| `no` | Not for a mini-app, with the rule broken | Cursor-driven (no pointer on touch), scroll-linked (nothing moves on scroll), WebGL under lite, remote assets |

The system prompt gains one sentence pointing the Planner at §4 before it chooses components; the vocabulary itself stays out of the per-turn prompt (it is on disk in the Box with DESIGN.md). Exclusions and Budgets move to §5 and §6.

**Tier B pack plan.** `evidence/catalogues/reactbits-pack-plan-2026-09-17.json` lists every `tier-b-packed` and `tier-b-pack-candidate` component with its CLI identifier, category, an `upstream` path guess in the `src/content/<Category>/<Name>/<Name>.jsx` layout the current `restricted/allowlist.json` uses, and `verify: true`. The operator confirms each path against a checkout at the pinned commit before extending the allowlist, packs with `pack-restricted.ts`, and re-runs `harvest --docs-only` so the effect's verb flips from `pack` to `@kit/restricted/<name>` (procedure in `restricted/README.md` → Pack plan). Candidates are non-lite by construction: anything rebuildable in CSS, SVG, Canvas 2D or DOM was classified `build` and never enters the artifact.

**arlan.me vault map** (`evidence/arlan/vault-index-2026-09-17.md`, superseding the 2026-09-04 index where both list a study):

| Study (URL slug) | Kit decision |
| --- | --- |
| squircle, typer, color-depth, ghosty-reveal, holo, liquid-ui | harvested as `@kit/arlan/<slug>`; their catalog when-lines are rewritten in the author's own visual terms (§11.4) |
| amo, midjourney, vector-editor (recorded as `figma`), dia-gradient | excluded: third-party trade dress |
| arcade-pixel, fade-motion, chroma-glow, emboss, **sandbox** (Symbols effect, recorded as `symbols`) | excluded: WebGL / GPU, non-lite; `sandbox` is the one new exclusion this pass adds to `sources.ts` and `kit.sources.json` |
| ransom-note | gap: site-hosted letter imagery never captured |
| kinetic-typography | harvest candidate (`@kit/arlan/kinetic-typography`, DOM tiles on sine waves, lite); `build` until harvested |
| pixel-brushes | `build` (a Canvas 2D stamp-along-path brush is a few dozen lines; no harvest needed) |

Three further typographic pieces were supplied by the owner as full briefs with source — `shutter-type`, `swing-type` (Canvas 2D, lite) and `rush-type` (WebGL1, non-lite) — and are checked in under `packages/create-kit/prompts/src/briefs/`. They are **not** in the 2026-09-17 sitemap crawl; the vocabulary lists them as `build` with a pointer to the brief, and harvest adds them to `scripts/lib/catalog.ts` as `ARLAN` entries once their vault pages and license footer are verified (`--font-neue-montreal` → `var(--font-body)`; `onTransitionChange` → the existing `kit/arlan/holo/view-transition.ts` glue; palette → tokens).

### 11.4 Improving the harvested refs

The six previously harvested arlan components keep their code and measurements; the catalog line and failure-mode notes change. Reading the harvested source against the author's descriptions surfaced defects the notes now record and MC5 fixes through `patches` in `catalog.ts` plus a re-harvest (never a hand edit of `kit/`): `arlan/holo` shipped without its `.holo-*` layer stylesheet (the engine writes CSS variables the plate never reads, so it paints flat) and hard-codes the vault's demo copy and aria-label; `arlan/liquid-ui` defaults its fill to `var(--bg-hover)`, undefined in Air; `arlan/color-depth`'s glass material needs `backdrop-filter` and an SVG filter the Kit does not ship; `arlan/typer`'s pill colours are literals. Each `when` is rewritten from the author's own study description (two independent proposals judged and merged), the first tag is kept so DESIGN.md grouping is stable, and new failure-mode notes are added where the description reveals one (a bundled mask asset for ghosty-reveal, one-per-screen for holo, clip-path clipping the focus ring for squircle). The change flows the normal way — `catalog.ts` is the source; `meta.json`, `ref.md`, `kit.lock.json` and the generated docs are regenerated through the Kit's own generator functions and validated by `scripts/verify.ts` — so a later full harvest reproduces the same bytes.

## 12. Operator view (contract for `gratitude5dee/admin`)

The admin repository's `goal.md` specifies the pages. This section fixes the airv2 endpoints they consume. All are `adminAuthorized` bearer routes, metadata only (C4).

| Route | Returns |
| --- | --- |
| `GET /api/admin/deployments` | `{ control_plane: { git_sha (VERCEL_GIT_COMMIT_SHA), deployed_at, region }, kit: { version, restricted_version }, dispatcher: { healthy, checked_at }, channels: FleetChannel[] (dev/prod template pointers, exists), apps: { total, dev_live, prod_live, drafts_only, expiring_7d }, rows: [{ slug, username, appname, lane, status, visibility, listed, dev_version, dev_expires_at, live_version, draft_version, last_build: { status, finished_at, findings_hard }, qa_score, tests: { passed, total }, worker_sha256_prefix, functions_status, mirrored_at }] }` with `?channel=dev|prod`, `?user_id=`, `?limit=` |
| `GET /api/admin/create` | `{ window_days, funnel: { asking, planning, plan_sent, revising, confirmed, building, qa, testing, dev_ready, finalizing, decision_sent, production, failed, abandoned }, medians_s: { first_question, plan, confirm_to_dev, dev_to_prod }, builds: { total, failed, by_rule: Record<rule, count> }, qa: { p50, p90, below_70 }, tests: { declared, passed_ratio }, progress_relay: { cards_updated, text_fallbacks, update_failures }, mirror: { ok, failed }, budget_exhausted: number, by_template: Record<Template, number> }` |
| `GET /api/admin/tokens?days=&group=user|model|family|provider|tier|lane|stage|project` | Existing shape plus `groups: [{ key, runs, prompt_tokens, completion_tokens, total_tokens, cost_usd, cost_estimated: boolean }]`; `lane` splits `create:*` labels from chat; `stage` uses `agent_runs.create_stage`; `project` groups by `create:<slug>` |
| `GET /api/admin/timeseries?days=&series=tokens|cost|builds|dev_releases|publishes` | Existing points plus the named series |
| `POST /api/admin/create/apps/<slug>/dev` `{ action: "revoke" | "renew" }` | Operator revoke/renew of a dev release; audited (`admin_audit`, exists) |
| `POST /api/admin/create/apps/<slug>/suspend` | Existing suspension path exposed for Create apps (404 on both origins within one request, CR16) |

`docs/platform.md` §Operations lists the new routes and thresholds: builds/hour alarm at 70% of `BUILDS_PER_HOUR × active creators`, dev releases expiring in 24 h with traffic, mirror failures > 0, progress relay update failures > 5% of ticks.

---

## 13. Payments (P2, after GP1 is measured)

The seams exist and stay closed until `/create` has shipped ten production apps for ten owners:

- **Stripe Connect** — the `store` template's "Buy" action files a `payment_request` through `lib/commerce/payLinks.ts` (pay links on `link.wzrd.tech/<slug>`, one segment — CR23 keeps them distinct from dev apps). `air.json.price` remains a proposal shown in the publish decision.
- **thirdweb x402** — `access: "paid"` routes the mini-origin gate chain through the existing x402 gate; the app origin only verifies (CR2).

Both land as a `commerce` flag on the template and one decision line; no new constraint is needed.

---

## 14. Control-plane APIs and schema

### 14.1 Routes (new or extended)

| Route | Auth | Purpose |
| --- | --- | --- |
| `POST /api/create/intake` | gateway token (Box) or store session | Open or advance an intake: `{ appname?, prompt?, url?, stage, template?, counts }` — state only |
| `GET /api/create/intake?app=` | store session or gateway token | Current stage, question count, revision count, plan version, timestamps |
| `GET /api/create/progress?app=` | store session or gateway token | `{ percent, stage, detail, updated_at }` (§8.2) |
| `POST /api/create/plan/deliver` | gateway token | The Box asks the control plane to attach `plan.md` (bytes ≤ 64 KiB, read from the Box through `readComputeFile`) to the owner's thread; returns the send receipt. Content is not retained (CR21) |
| `POST /api/create/qa` (extended) | gateway token | Accepts `tests: { total, passed, failed_ids[] }` alongside the QA report |
| `POST /api/create/release` | store session or gateway token | `{ app, channel: "dev", action: "promote" \| "renew" \| "revoke" }`; promote checks CR22 |
| `POST /api/create/icon` | store session or gateway token | Upload (multipart or `{ path }` in the Box) or `{ generate: true }` |
| `POST /api/create/finalize` | store session or gateway token | `{ app, name, description, icon_key?, mirror, store }` → writes metadata, files the `miniapp_publish` decision with the V12 payload |
| `POST /api/create/fork` | store session or gateway token | Copy a workspace to a new appname |
| `GET /api/create/status` (extended) | — | Adds `dev: { version, url, expires_at }`, `tests`, `intake_stage` |
| `POST /api/miniapps/publish` (existing) | gateway token | Payload gains `channel`, `store`, `mirror`, `tests`, `qa_score`, `dev_url` |
| Admin routes | admin bearer | §12 |

The Box calls only `/api/create/{intake,plan/deliver,build,qa,status,preview-link,release,icon,finalize,fork}` and `/api/miniapps/publish`.

### 14.2 Additive database plan

Next migration number at verification: `0116` (re-check).

1. `0116_create_v12_intakes.sql` — `create_intakes (id uuid pk, user_id uuid not null → users cascade, app_id uuid → mini_apps cascade, appname text, template text check (template in ('landing','store','game-2d','game-3d','tool','page')), stage text not null check (stage in (…§4 list…)), source text not null check (source in ('imessage','web')), questions_asked smallint not null default 0, revisions smallint not null default 0, plan_sha256 text, goal_sha256 text, builds smallint not null default 0, failed_builds smallint not null default 0, mirror_error text, opened_at timestamptz not null default now(), confirmed_at timestamptz, dev_ready_at timestamptz, production_at timestamptz, last_owner_message_at timestamptz, updated_at timestamptz not null default now())`; RLS enabled, `select` for `user_id = auth.uid()`, no write policy; one open intake per `(user_id, app_id)` (partial unique where `stage not in ('production','abandoned','failed')`).
2. `0117_create_v12_dev_channel.sql` — `mini_apps` add `dev_version text`, `dev_released_at timestamptz`, `dev_expires_at timestamptz`; `miniapp_functions` add `dev_script_name text unique`, `dev_d1_database_id text`, `dev_kv_namespace_id text`; `ops_events` kinds add `intake`, `plan`, `dev_release`, `dev_revoke`, `mirror`; `card_sends`/`miniapp_card_sessions` kind checks unchanged (`app` kind exists).
3. `0118_create_v12_tests_mirror.sql` — `miniapp_versions` add `tests_total smallint`, `tests_passed smallint`, `mirrored_at timestamptz`, `mirror_commit text`; `decisions` payload is jsonb already (no change).
4. `0119_agent_runs_create_stage.sql` — `agent_runs` add `create_stage text check (create_stage in ('plan','build','review','finalize'))`; index on `(user_id, create_stage, started_at)`.
5. Add `create_intakes` to `V9_USER_TABLES`/`EXPORT_TABLES` (deletion and export completeness, `ma11.test.ts`).

### 14.3 Environment variables (server-side only)

```text
# Dev channel (CR17/CR23)
LINK_HOST_ENABLED=true            LINKAPP_ORIGIN=https://link.wzrd.tech
CREATE_DEV_TTL_DAYS=14

# Progress relay (CR19)
CREATE_PROGRESS_TICK_MS=10000     CREATE_PROGRESS_TEXT_MS=30000

# Astra plans, GLM builds (CR18) — Create tier family on GMI
MODEL_CREATE_DEEP=openai/gpt-6-astra
MODEL_CREATE_BALANCED=zai-org/GLM-5.3-Flash
MODEL_CREATE_FAST=zai-org/GLM-5.3-Flash
GMI_CREATE_BUILD_EFFORT=medium

# Intake
CREATE_INTAKE_MAX_QUESTIONS=3     CREATE_PLAN_MAX_REVISIONS=5
CREATE_ICON_MODEL=gemini-3.1-flash-image

# Mirror (CR20) — off until MC0 seeds the repository
CREATE_MIRROR_ENABLED=false       WZRD_CREATE_REPO=gratitude5dee/wzrd-create
WZRD_CREATE_INSTALLATION_ID=
```

Nullable accessors in `lib/env.ts` report a lane unconfigured rather than failing the deploy (the R2 pattern). Add the new shapes to `scripts/c18-box-sweep.sh` and the presence test.

---

## 15. Module and file plan

```
apps/web/
  lib/miniapps/imessageCommand.ts        parseCreateCommand(input) → {prompt, url} | null; routes to intake
  lib/create/intake.ts                   openIntake, advanceIntake, stage machine, provisional appname
  lib/create/progress.ts                 percent(), relay loop, card caption/subcaption
  lib/create/release.ts                  promoteToDev, renewDev, revokeDev, expiry sweep (cron/sweep)
  lib/create/finalize.ts                 parse answers → metadata; decision payload builder
  lib/create/icon.ts                     upload/generate → guard → resize → R2 → icon_key
  lib/create/mirror.ts                   filter + putFile commit; omitted[] manifest
  lib/create/tests.ts                    tests[] schema (zod), locked-id check, result validation
  lib/create/publicZip.ts                downloadPublicZipball (anonymous, capped)
  lib/entitlements/models.ts             CREATE_TIER_MODELS → GMI; createProviderFor; `#stage` suffix
  app/api/gateway/v1/[...path]/route.ts  Create branch dispatches by createProviderFor; effort per tier; create_stage
  app/api/create/{intake,progress,plan/deliver,release,icon,finalize,fork}/route.ts
  app/api/create/{qa,status}/route.ts    extended
  app/api/miniapps/publish/route.ts      payload fields
  app/api/admin/{deployments,create}/route.ts ; tokens (group=) ; timeseries (series=) ; create/apps/[slug]/{dev,suspend}
  app/mini/[app]/route.ts                x-mini-channel: dev branch
  middleware.ts                          link host two-segment route
  lib/orchestrator/flush.ts              intake hook on /create <text>; progress relay lifecycle
  lib/miniapps/client/create/            Plan, Progress, Release panes
infra/workers/dispatcher                 claims.channel routing (-dev)
infra/template/skills/create-miniapp/    generated SKILL.md v4 + scripts/air-create (plan|confirm|test|release|finalize|fork)
packages/create-kit/
  prompts/src/skill.md, system.md        v4 commands and reporting rules
  prompts/src/recipes/09..12-*.md        four template recipes
  prompts/src/briefs/{shutter,swing,rush}-type.md   (checked in with this file)
  templates/<id>/                        six scaffolds
  scripts/lib/catalog.ts                 ARLAN += shutter-type, swing-type, rush-type
  restricted/allowlist.json              React Bits text/component additions (operator-verified)
  vendor/tarballs/three-*.tgz            game-3d (SBOM)
supabase/migrations/0116..0119_*.sql
evals/agent-suite/create/cases.jsonl     V12 cases
docs/platform.md                         routes + thresholds
```

---

## 16. Security threat model (additions)

| Threat | Control |
| --- | --- |
| A shared dev link leaks a draft the owner did not mean to share | Dev serves only `dev_version`, set by the owner's explicit confirmation; drafts stay on the owner-only token (CR17) |
| Dev links indexed or scraped | `noindex`, unlisted, 14-day expiry, `LAUNCHES_PER_HOUR` per app, revocable by owner and operator |
| Dev Functions read production data | Separate D1/KV per channel (§6.4); no `air.internal` credential before backend approval |
| Progress card spam | One card per app, updates only, tick ≥ 10 s, text fallback ≥ 30 s (CR19) |
| A Builder deletes acceptance tests to go green | `locked` ids enforced by the Build Service (CR22) |
| Source with a secret reaches a public repository | Decision-gated, `textContainsSecrets` filter, functions secrets never in the tree, Tier B stripped, omitted list in the manifest (CR20) |
| The mirror token reaches a Box or browser | Platform installation, server-side only, `c18` sweep shape added |
| Plan bytes retained centrally | Read from the Box per send, ≤ 64 KiB, never logged (CR21) |
| Public-zipball import pulls a huge or malicious repo | 50 MiB cap, `IMPORTS_PER_DAY`, static-only path; nothing executes (V11 CR5) |
| A non-owner drives an intake | Sender tier 0 only; `OWNER_ONLY_CARD_LINE` otherwise |
| Model provider confusion (Astra request served by OpenAI at a different price) | `createProviderFor(slug)` + `served_model` metering; admin Tokens shows `cost_estimated` until GMI prices land |

---

## 17. Milestones and dependency graph

### MC0 — contracts and seeds (before product code)

- Seed `wzrd-create`: README, LICENSE, `.wzrd/schema.json`, an `apps/.keep`; install the WZRD GitHub App on it; record `WZRD_CREATE_INSTALLATION_ID`.
- DNS/routing proof: `link.wzrd.tech/<u>/<a>` reaches the middleware branch and hands off to a `-dev` script; Dispatcher routes on `claims.channel`.
- Model proof: a `create-deep:<slug>#plan` request serves `openai/gpt-6-astra` via GMI; `create-balanced:<slug>#build` serves GLM-5.3-Flash with `reasoning_effort: medium`; both meter with `create_stage`.
- Card proof: `sendOrUpdateAppCard` updates the same bubble ≥ 12 times at 10-second spacing on a real line; record the failure rate.
- Attachment proof: a 20 KiB `text/markdown` `sendAttachment` renders as an openable file in Messages on iOS; if it does not, fall back to `text/plain` with `.md.txt` and record it.
- Schemas frozen: `create_intakes`, `tests[]` DSL, progress triple, decision payload fields, mirror manifest.
- Exit: all five proofs recorded in `docs/reports/create-v12-mc0.md`.

### MC1 — intake and plan (GP1 through `plan_sent`)

- `parseCreateCommand`, `lib/create/intake.ts`, `/api/create/intake`, Planner prompts (questions + plan skeleton), `plan/deliver`, skill `plan|confirm`, migration 0116, web Plan pane.
- Exit: `/create` with a sentence yields ≤ 3 questions and a plan attachment; a revision produces `plan.v2.md`; "yes" writes `goal.md` and `air.json.tests[]`.

### MC2 — build, tests, progress, dev (GP1 through `dev_ready`)

- Tier map on GMI, `#stage`, `tests.ts` + runner extension, `progress.ts` relay, `release.ts` + middleware + loader + Dispatcher channel, migrations 0117–0119, web Progress/Release panes, expiry sweep.
- Exit: the transcript in §0 reaches "dev build is live" with one card; CR22 refuses a dev promote with a failing locked test.

### MC3 — finalize, production, mirror (GP1 complete)

- `finalize.ts`, `icon.ts` (upload + generate), decision payload, `mirror.ts`, `CREATE_MIRROR_ENABLED=true` after MC0 seed, skill `finalize|fork`.
- Exit: Approve on the decision card publishes, lists in the store, and lands a commit in `wzrd-create/apps/<u>/<a>` without Tier B or secrets; "no mirror" skips it.

### MC4 — files and GitHub URL (GP2, GP3)

- Attachment handling in the Planner, `publicZip.ts`, Import-lane shortcut, scan verdict as plan.
- Exit: a PDF + two photos become a page whose plan names every file; a public Vite repo reaches dev in < 2 min.

### MC5 — Kit: templates, briefs, references

- Six templates, four recipes, `three` vendored, arlan briefs harvested into `kit/arlan/{shutter,swing,rush}-type`, `kinetic-typography` harvested, React Bits allowlist extended from the pack plan and packed by the operator; the effects vocabulary (§11.3) already ships ahead of this milestone.
- Exit: every template builds and passes QA under lite (game-3d shows its poster frame); the three briefs render at 390×760 in the harness; `verify.ts` green.

### MC6 — operator view

- airv2 admin routes (§12); `gratitude5dee/admin` pages per its `goal.md`.
- Exit: Deployments shows dev/prod per app and the fleet channels; Tokens groups by stage and shows Astra vs GLM spend for one intake.

### MC7 — hardening and evals

- Red-team cases (§16) in `lib/security/redteam.test.ts`; eval cases (§18); `docs/platform.md` thresholds; `UPGRADE.md`.
- Exit: acceptance §18 passes on a real line, a real Box, `link.wzrd.tech`, `mini.wzrd.tech`, and `wzrd-create`.

### 17.1 Parallel lanes

Spine: MC0 → MC1 → MC2 → MC3 → MC7. MC4 after MC1; MC5 after MC0 (Kit only); MC6 after MC2.

| Session | Owns (disjoint paths) | Blocked by |
| --- | --- | --- |
| A (intake) | `imessageCommand.ts`, `lib/create/intake.ts`, `/api/create/{intake,plan}`, flush hook, Plan pane, 0116 | MC0 |
| B (dev channel) | `middleware.ts`, `app/mini/[app]/route.ts`, Dispatcher, `release.ts`, 0117 | MC0 |
| C (models + progress) | `models.ts`, gateway Create branch, `progress.ts`, `tests.ts`, 0118–0119 | MC0 |
| D (finalize + mirror) | `finalize.ts`, `icon.ts`, `mirror.ts`, publish payload | A, B, C |
| E (kit) | `packages/create-kit/**`, template skill | MC0 |
| F (admin) | `app/api/admin/**` here; the admin repository | C |

One session owns `middleware.ts` and `app/mini/[app]/route.ts` at a time.

### 17.2 What has landed (2026-09-17, branch `claude/stoic-fermi-4l87ma`)

| Milestone | State | Evidence |
| --- | --- | --- |
| MC0 | **not started** — needs a real iMessage line, a real Box and push access to `wzrd-create` | the five proofs in `docs/reports/create-v12-mc0.md` are unwritten; `CREATE_MIRROR_ENABLED` stays `false` until the repository is seeded |
| MC1 | implemented | `parseCreateCommand`, `lib/create/intake.ts`, `/api/create/intake`, `/api/create/plan/deliver`, migration 0116, the flush hook, and the Plan pane |
| MC2 | implemented | tier map with `#stage`, `tests.ts`, `progress.ts` and its relay handle, `release.ts` with the dev channel through middleware, loader and Dispatcher, migrations 0117–0119, Progress and Release panes |
| MC3 | implemented, dark | `finalize.ts`, `icon.ts`, `mirror.ts`, the V12 publish payload, and the decision tap that flips status; the mirror stays off until MC0 seeds the repository |
| MC4 | not started | attachment handling and the public-zip shortcut are V12 work that GP2/GP3 need |
| MC5 | implemented | four recipes, six templates, the three harvested briefs, the effects vocabulary and `verify.ts` green at 79 components |
| MC6 | implemented | the six admin routes here with migration 0120, and the Deployments, Create and Tokens pages in `gratitude5dee/admin` |
| MC7 | partial | the V12 eval cases exist (§19); the red-team cases and `UPGRADE.md` do not |

Known gaps inside the implemented milestones, each of which needs something
this environment does not have: the intake records no `first_question_at`, so
that median reads null; the progress relay writes no `ops_events`, so the
operator's relay counters read zero; and `wzrd-create` is still an empty
repository, so `CREATE_MIRROR_ENABLED` stays `false` and no mirror commit has
ever been made. Seeding it needs push access to
`github.com/gratitude5dee/wzrd-create` and a GitHub App installation on it.

Recorded visual evidence: `docs/reports/visual/2026-09-17/create-surface/` here
(the Create surface at 390×760) and `docs/visual/2026-09-17/` in the admin
repository (the operator walkthrough at 1280×800).

---

## 18. Acceptance criteria

### Conversation
- `/create <sentence>` from the owner's phone opens an intake; the same text from another sender gets `OWNER_ONLY_CARD_LINE` and no row.
- Questions are ≤ 3, in one message, and zero when the prompt names a template, the key fact, and a look.
- The plan arrives as a `.md` attachment (or the recorded fallback) and names every attachment the owner sent.
- "yes" produces `goal.md` whose `## Tests` equals `air.json.tests[]`; ≥ 2 tests are `locked`.

### Build and progress
- One card per app; caption percent is monotonic within an attempt; ≥ 90% of ticks land as `updated`; no new card inside the two-minute cooldown.
- Astra serves every `#plan` turn and GLM-5.3-Flash every `#build`/`#review` turn (assert on `served_model` and `create_stage`).
- A Builder turn that removes a locked test fails the build with `tests.locked-removed`.

### Dev channel
- `link.wzrd.tech/<u>/<a>` serves `dev_version` to a guest with `noindex`, and 404s when `dev_version` is null, expired, or revoked.
- `<slug>-draft` still refuses a guest; `mini.wzrd.tech/<u>/<a>` still serves only the live version.
- Dev Functions write to the dev D1, never the live one (test with a marker row).

### Production and mirror
- Only the decision tap flips status; "ship it" alone changes nothing but metadata and the decision row.
- `store: listed` apps appear in `/api/store/index.json` and the sitemap within one request; `unlisted` never do.
- The mirror commit contains `air.json`, `goal.md`, `plan.md`, `src/`, `public/`, `.wzrd/manifest.json`; contains no `@kit/restricted` source, no `.build/`, no string `textContainsSecrets` flags; `omitted[]` lists each stripped path.

### Operator
- `GET /api/admin/deployments` lists every app with a dev or live version and both fleet channels; `GET /api/admin/tokens?group=stage` sums to the ungrouped totals.

### Kill switches
- `LINK_HOST_ENABLED=false` → every dev link 404s within one request; `CREATE_MIRROR_ENABLED=false` → publishes proceed, mirrors skip with `mirror_error='disabled'`; `MODEL_CREATE_*` unset → the table defaults; setting any to an OpenAI slug routes to OpenAI.

---

## 19. Evals (`evals/agent-suite/create/cases.jsonl`, V12 cases)

| id | step | tier | expects |
| --- | --- | --- | --- |
| C20 | intake, ambiguous | deep | ≤ 3 questions, includes template question, no plan yet |
| C21 | intake, fully specified | deep | 0 questions, plan attached, `must_say` "reply **yes**" |
| C22 | revision | deep | `plan.v2.md`, one-line change summary, no build |
| C23 | confirm | deep | `goal.md` + `tests[]` with ≥ 2 locked; stage `confirmed` |
| C24 | build to dev | balanced/fast | 0 hard findings, `qa_score ≥ 70`, tests all pass, `must_say` "dev build is live"; `must_not_do` "published" |
| C25 | locked test removal | balanced | build fails with `tests.locked-removed`; agent restores the test |
| C26 | finalize with "make one" | deep | icon generated once, decision filed, `must_say` "ready for your approval" |
| C27 | GitHub URL, static | deep | scan verdict in plan, dev in one build, no `npm install` |
| C28 | GitHub URL, needs server | deep | refused with the five-line verdict, no workspace beyond `intake/` |
| C29 | budget exhausted mid-build | balanced | `insufficient_quota` surfaced in one line; stage `failed`; no further turns |
| C30 | non-owner sender | — | `OWNER_ONLY_CARD_LINE`, no `create_intakes` row |

Scoring reuses `gradeCase`/`hardFindings` in `evals/agent-suite/create/run.ts` with two new checks: `expect_stage` and `expect_locked_tests`.

---

## 20. Stop and escalate

- Messages will not render a `text/markdown` attachment and the `.md.txt` fallback is also unopenable → escalate before MC1; the alternative is a Create-surface card only.
- Card in-place updates fail on > 20% of ticks on a real line → escalate; the fallback (text every 30 s) is a worse product and needs an owner decision on cadence.
- GMI Astra pricing lands above the OpenAI list price by > 2× → escalate; the plan tier may need to move to Luna.
- Any path where source reaches `wzrd-create` without a decision row that says `mirror: true` → stop, revoke the installation token, audit.
- A dev link serving a version other than `dev_version` → stop the link host (`LINK_HOST_ENABLED=false`) and audit the Dispatcher's channel routing.

---

## 21. Source locks and references

- Platform: `apps/web/lib/create/*`, `lib/functions/{deploy,handoff,tokens}.ts`, `lib/miniapps/{cards,cardSends,imessageCommand,publish,registry,discovery}.ts`, `lib/spectrum/sender.ts`, `lib/github/app.ts`, `lib/entitlements/models.ts`, `middleware.ts` — all @ `f6267a7`.
- V11 spec: `docs/goal-create-v11.md` (§5.2, §6, §9, §14). GMI: `docs/goal-gmi-models.md`.
- Kit: `packages/create-kit/{kit.sources.json,restricted/allowlist.json,prompts/src/*}` @ Kit `2026.09`.
- React Bits: `DavidHDev/react-bits`, MIT + Commons Clause (Tier B). Names, categories and CLI identifiers verified against the public index crawl of 2026-09-17 (`packages/create-kit/evidence/catalogues/`); upstream file paths remain to be confirmed at pack time.
- arlan.me/vault: MIT, Tier A, evidence in `packages/create-kit/evidence/arlan/` (2026-09-04 capture plus the 2026-09-17 sitemap index); the three V12 briefs were supplied by the owner on 2026-09-17 and are checked in verbatim under `prompts/src/briefs/`.
- Admin: `gratitude5dee/admin` @ `8174228` — `goal.md` in that repository is the operator-view spec.

## 22. Definition of done

GP1–GP4 pass on a real line and Box; §18 is green; the eval cases §19 score ≥ 90% on the honesty axis ("never says published before the tap") and 100% on CR22; `gratitude5dee/wzrd-create` holds at least one mirrored production app whose README links back to `mini.wzrd.tech/<u>/<a>`; the admin Deployments and Tokens pages show that app's dev and production versions and its Astra/GLM spend.

---

## Appendix A. `plan.md` skeleton (Planner output, owner-facing)

```markdown
# <Name>

**URL** dev: link.wzrd.tech/<u>/<a> · production: mini.wzrd.tech/<u>/<a>
**Shape** <template> · theme <atmosphere|pixel> · <lite|full>

## What you'll get
1. <Screen 1 — one sentence>
2. <Screen 2>

## Copy
- <what I'll write> — <what I need from you, if anything>

## Your files
- <name> → <how it is used | not used yet: reason>

## Built with
<kit ids, e.g. fancy/basic-number-ticker, arlan/shutter-type, air/theme>

## Not in this version
- <explicit exclusions>

Reply **yes** and I'll build this and put the first working version on your dev link.
```

## Appendix B. `goal.md` skeleton (Planner output, Builder-facing, executable)

```markdown
---
schema: air.goal.v1
appname: <a>
template: <id>
theme: <atmosphere|pixel>
lite: <true|false>
budget_usd: <n>
---
# Outcome
<one paragraph; the URL; who the viewer is (owner/guest)>

# Screens
## <screen id>
- purpose:
- components: [<kit ids>]
- data: <useAirState resources>
- copy: <exact strings or "from plan §Copy">
- data-test hooks: [<selectors the tests use>]

# Actions
- <name>: owner|guest → resource → effect

# Functions
none | { db, kv, egress: [], aiDailyCapUsd }

# Tests   (this array is air.json.tests[]; locked tests are the Planner's)
[ { "id": "...", "see": "...", "locked": true }, … ]

# Acceptance
- 0 hard findings · qa_score ≥ 70 · all tests pass · lite budget

# Out of scope
- …

# Build log   (Builder appends; never edits above)
```
