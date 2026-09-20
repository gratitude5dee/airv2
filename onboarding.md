# Onboarding → Digital Twin — implementation brief

Audience: GPT-5.6 Terra (review + analysis), then whoever lands the follow-up
phases. Repo: `gratitude5dee/airv2`, Next.js control plane in `apps/web`.
Written 2026-09-20 against `main` @ `8a59cbe` (PR #433). Every path below is
relative to `apps/web/` unless it starts with `supabase/` or `docs/`.

This document does three things: (1) records how the onboarding mini-app
works today, (2) lists what is wrong or missing, and (3) specifies the
guided "digital twin" flow, the `@username` identity resolver, and the
`/twin` command — with the data model, provider boundaries, privacy rules,
phases, acceptance criteria and tests. The first two phases in §12 are
implemented on branch `claude/stoic-meitner-9y890y`; the rest is a plan.

---

## 1. Current onboarding behavior

### 1.1 What the user sees

The onboarding mini-app (`lib/miniapps/apps/onboarding.tsx`, 2 984 lines)
is a server-rendered HTML deck: a cinematic welcome plus six numbered slides,
swiped like iPhone pages, each slide a stack of "panels" that a small
same-origin script folds into a one-at-a-time stepper. Every mutation is a
plain `<form method="post">` handled by the module's `action()`; there is no
client state and no JSON API.

| # | Slide id | Title | Panels (section keys) | Steps written |
|---|---|---|---|---|
| — | `welcome` | welcome to air | cinematic intro film | `welcome` |
| 1 | `computer` | Your agent's computer | machine picker + `@username` + mailbox, model family | `environment`, `username`, `email`, `model` |
| 2 | `booth` | Photo Booth | Take photo · Photo selection · Generate character sheet · Take video · Create digital twin · Avatar selection | `selfies`, `twin`, `avatar` |
| 3 | `context` | Context retrieval | iMessage history · Browser profile · AI context import | `imessage`, `import` |
| 4 | `personality` | Personality engine | Onairos connect | `onairos` |
| 5 | `apps` | Connect your apps | Composio toolkits · Secrets · Stripe store · Link wallet | `connect`, `secrets`, `stripe`, `link` |
| 6 | `start` | Get started | sample prompts · launcher walkthrough | `agent`, `walkthrough` |

Everything after slide 1 is locked until a username exists
(`slideLocked`, onboarding.tsx:879). Every step is skippable and
re-enterable; the deck opens on the first step whose `effectiveStatus` is
`todo` (onboarding.tsx:793–861), which is derived from real data (a selfie
exists, an address exists, a connection is active…) and falls back to the
recorded step status.

### 1.2 Where state lives

* **Step statuses** live in the user's Box at
  `.hermes/miniapps/onboarding/state.json` (`lib/miniapps/onboarding.ts`,
  constraint C4: no content in shared Postgres). `ONBOARDING_STEPS` is the
  17-entry state model; slides are presentation only.
* **Read-path mirror**: `onboarding_status_mirror` (migration 0074,
  `lib/miniapps/onboardingMirror.ts`) caches the state + ingest/import/
  browser/link status docs so a render never wakes the Box; stale after 60 s,
  refreshed via `after()`.
* **Identity media**: `identity_assets` (0061, 0062) tags private
  `creative_assets` rows with a role: `selfie`, `character_sheet`,
  `character_sheet_draft`, `avatar` (one avatar per user via a partial
  unique index). Bytes live in the private Supabase bucket `creative-assets`
  under `<user_id>/masters/<sha256>.<ext>`; browsers only ever see 30-minute
  signed URLs (`signedIdentityUrl`, `lib/identity/assets.ts:317`).
* **Twin row**: `digital_twins` (0061) — one per user, HeyGen-shaped:
  `provider_avatar_id`, `provider_group_id`, `provider_voice_id`,
  `consent_video_key` (a storage key), `video_asset_id`, `status` in
  `avatar_only|consented|creating|ready|failed`.
* **Username**: `users.username citext unique` + 30-day rename cooldown
  trigger (0001:16–32). `setUsername` (`lib/settings/account.ts:26`) is the
  single write path for the API route, Settings and onboarding: normalize →
  regex `^[a-z0-9_]{2,24}$` → reserved words (`lib/miniapps/reserved.ts`) →
  `mini_apps.slug` collision check → update → catch `23505` (taken) /
  `username_cooldown_active` → best-effort box rename → provision mailbox.

### 1.3 What happens to onboarding data after submission

| Action | Path | Where it lands |
|---|---|---|
| `set_username` | `setUsername` | `users.username`; `agent_addresses` row (additive, never rewritten); box renamed `air-<username>` |
| `upload_selfie` (form or booth) | `uploadIdentityImage` → HEIC→JPEG → `guardMediaUpload` (type allowlist, 8 MB cap, EXIF strip) → `ingestUploadedMedia` (sha256 content-addressed) → `tagIdentityAsset(role='selfie')` | private bucket + `creative_assets` + `identity_assets` |
| `generate_character_sheet` | `generateCharacterSheet` (`lib/identity/generate.ts`) → `createCreativeJob(mode='imagine')` → `executeCreativeJob` on the GPT Image 2 lane (`gpt-image-2-edit` with the newest selfie, `gpt-image-2-generate` without) → tag `character_sheet_draft` | `creative_jobs`, `cost_events(kind='render')`, private asset |
| `save_character_sheet` / `discard_character_sheet` | retag draft → `character_sheet` / remove + revoke deliveries | `identity_assets` |
| `upload_consent` | `uploadTwinConsent` (mp4/webm ≤ 50 MB) | private asset; `digital_twins.consent_video_key`, `status='consented'` |
| `create_twin` | `createTwinVideo` → GMI queue model `heygen-avatar-v4` (talking head from photo or trained avatar id + HeyGen TTS voice) | `creative_jobs(mode='video_render')`, `digital_twins.video_asset_id`, `status='ready'` |
| `create_heygen_avatar` | `createHeygenPhotoAvatar` → `POST https://api.heygen.com/v3/avatars` | `digital_twins.provider_avatar_id/group/voice` |
| `set_avatar` | `setAvatarAssetId` (delete + insert, not atomic) | `identity_assets(role='avatar')` |

Nothing outside onboarding and Settings' IDENTITY VAULT reads these rows
today. `/zap`, `/imagine`, `/animate` never look at `identity_assets`; the
only `@` parser in the codebase (`lib/bots/mentions.ts`) delegates to a
roster **bot**, not to a user identity. `/@username` (`app/[handle]/page.tsx`)
renders a public contact card from `profiles` + the avatar.

### 1.4 Current architecture — important files

| Concern | File(s) |
|---|---|
| Deck render, slide/section model, all actions | `lib/miniapps/apps/onboarding.tsx` |
| Step ids, box-side state | `lib/miniapps/onboarding.ts` |
| Postgres mirror | `lib/miniapps/onboardingMirror.ts`, `supabase/migrations/0074_onboarding_status_mirror.sql` |
| Camera booth client (React, esbuild IIFE → `public/creator-os/identity-booth.js`) | `lib/miniapps/client/identity-booth.tsx`, `scripts/build-identity-booth.mjs` |
| Deck chrome scripts | `client/deck-swipe.ts`, `client/deck-stepper.ts`, `client/intro-cinematic.ts`, `client/prompt-copy.ts` |
| Theme tokens + CSP | `lib/miniapps/themes.ts`, `lib/miniapps/html.ts` |
| Identity assets / roles | `lib/identity/assets.ts`, `supabase/migrations/0061_identity_profiles.sql`, `0062_identity_sheet_drafts.sql` |
| Character sheet | `lib/identity/generate.ts` |
| Twin row + HeyGen | `lib/identity/twin.ts`, `lib/identity/heygen.ts` |
| Username | `lib/settings/account.ts`, `app/api/settings/username/route.ts`, `lib/miniapps/reserved.ts`, `lib/miniapps/nested.ts` |
| Creative lane (commands → jobs → providers → assets) | `lib/creative/parse.ts`, `router.ts`, `run.ts`, `jobs.ts`, `store.ts`, `gmi.ts`, `fal.ts`, `media-url.ts`, `model-prefs.ts`, `preflight.ts` |
| Command dispatch (iMessage) | `lib/orchestrator/flush.ts` (`runFlushInner`, lanes at :836–1137), `lib/creative/imessage.ts`, `lib/miniapps/drawCommand.ts` (template lane) |
| Command dispatch (web) | `app/api/chat/route.ts`, `app/api/creative/[jobId]/events/route.ts` (SSE), `components/prompt-input/PromptInput.tsx` (palette) |
| Command mirror lists (debounce, TTFK) | `lib/orchestrator/flush.ts:140`, `lib/orchestrator/ttfk.ts:19,218`, `app/api/inbound/imessage/route.ts:197` |
| Upload guard / storage | `lib/storage/guard.ts`, `lib/assets/keys.ts`, `lib/assets/pipeline.ts`, `lib/creative/store.ts` |
| Env | `lib/env.ts` (`falKey`, `heygenApiKey`, `gmiCloudApiKey`, …) |
| Deletion / export audits | `app/api/admin/delete/route.ts`, `lib/admin/export-tables.ts`, `lib/security/c18.ts` (`V9_USER_TABLES`), `lib/admin/deletion.test.ts` |
| Tests for this area | `lib/miniapps/apps/onboarding-*.test.ts`, `settings-identity.test.ts`, `lib/creative/*.test.ts`, `lib/orchestrator/flush*.test.ts` |

Baseline on `main` (this container): `tsc --noEmit` clean; `eslint` 0 errors /
789 warnings (all pre-existing, mostly bundled JS); vitest 320 files, 3 610
tests passing, 3 skipped.

### 1.5 Provider reality check (do not assume the brief's names)

* **"Native OpenAI image generation"** in this codebase is the GPT Image 2
  lane (`gpt-image-2-generate` / `gpt-image-2-edit`) reached through the
  GMI Cloud request queue (`lib/creative/gmi.ts`). There is no OpenAI SDK and
  no direct `images/generations` call; `OPENAI_API_KEY` in the repo is the
  box-side alias for our own gateway token. The character sheet already
  renders on this lane.
* **"Sunburst 2.5"** is not a model anywhere in the repo. "Sunburst HQ" is a
  UI *quality label* in the draw/freeze studios (`lib/miniapps/draw.ts:40`)
  mapping to `quality: "high"` on the same GPT Image 2 lane. Per the brief's
  rule ("do not invent an endpoint") the character sheet and profile image
  keep rendering on `gpt-image-2-*` at high quality; see open question Q1.
* **fal.ai** is integrated (`@fal-ai/client`), with a deliberately
  hand-rolled queue driver: one un-retried submit `POST
  https://queue.fal.run/<model>`, SDK reads for status/result
  (`lib/creative/fal.ts`). `minimax/h3-max/*` endpoints are live; there is no
  lip-sync endpoint yet and no fal webhook.
* **ElevenLabs** does not exist in the app. The IVC contract was verified
  against `@elevenlabs/elevenlabs-js@2.68.0` (the current SDK; docs sites are
  egress-blocked from this container): `POST /v1/voices/add` multipart
  (`name`, `files[]`, `remove_background_noise`, `description`, `labels`),
  header `xi-api-key`, response `{ voice_id, requires_verification }`;
  `DELETE /v1/voices/{voice_id}`; TTS `POST /v1/text-to-speech/{voice_id}`
  (`text`, `model_id`; `output_format` query). The app follows the HeyGen
  convention (thin `fetch` client, no SDK dependency).
* **HeyGen** stays as the legacy "trained avatar" path behind `HEYGEN_API_KEY`.

---

## 2. UX and functional problems found

### Identity / twin

1. **Consent is a video file, not a record.** `upload_consent` stores an
   mp4 and flips `status='consented'`. There is no scope (likeness vs voice
   vs video avatar), no policy version, no timestamp of grant/revoke, and no
   way to revoke. The video is required even for users who only want images.
2. **No voice at all.** `provider_voice_id` is HeyGen's default voice; there
   is no sample collection, no clone, no TTS. The brief's `/twin @u Say: …`
   has no backend.
3. **Reference media is images only.** No video reference, no audio, no
   reorder, no delete from onboarding (delete exists only in Settings),
   no per-asset labels or source, no processing status.
4. **Generation has one path.** A character sheet needs a selfie for
   quality; there is no "describe your agent" path for users who do not want
   their own likeness, and no reusable *profile image* concept — the sheet
   itself is reused as the avatar.
5. **Nothing consumes the identity.** `/zap` cannot reference `@username`;
   `@word` is treated as a bot mention and otherwise ignored.
6. **`@username` is display text.** No resolver, no authorization model, no
   distinction between "my twin" and "a public twin".
7. **Twin video is one provider, one shape.** `createTwinVideo` is a HeyGen
   talking head from a still through GMI; the brief's fal H3 Max lip-sync
   path is absent.

### UX / design

8. The booth stepper labels ("Take video", "Create digital twin") do not
   match what those panels do (consent recording; a HeyGen render).
9. The consent copy is a single sentence; the user is never told what is
   uploaded, what is generated, which providers see the media, or how to
   delete it.
10. Long operations (character sheet ≈ 30–90 s, twin video several minutes)
    are synchronous form POSTs: the page hangs on a spinner-less request,
    and a mobile tab kill loses the notice.
11. Lite (Messages) renders lose the booth entirely; there is no progress
    indicator on the multipart upload fallback.
12. The completion slide shows sample prompts but nothing about the twin the
    user just built, and no `/zap`/`/twin` examples.
13. `photo_select` and `sheet` show green checks based only on existence;
    there is no "approved" notion for a profile image.

### Technical / risk

14. `setAvatarAssetId` is delete-then-insert (not atomic); a concurrent
    call can leave no avatar.
15. `identity_assets`, `digital_twins`, `profiles`, `onboarding_status_mirror`
    are missing from `EXPORT_TABLES` and `V9_USER_TABLES` (export and the
    deletion-completeness audit skip them).
16. Username rename leaves `mini_apps.publisher_username`,
    `user_buckets.prefix` and published nested URLs pointing at the old
    name (pre-existing; out of scope here, but the `@username` resolver must
    resolve by `users.id`, never by storing the name).
17. `ingestUploadedMedia` rejects audio (`EXT_BY_MIME` is image/video only),
    so voice samples cannot be stored through the existing pipeline.
18. `CreativeUnconfiguredError` accepts `"GMI" | "Groq" | "OpenAI" | "fal"`
    only.

---

## 3. Proposed onboarding flow

The deck keeps its shell, tokens, swipe/stepper scripts and every
non-identity slide. The **Photo Booth slide becomes the digital-twin
builder** and the **Get started slide gains a twin summary**. Two new step
ids join the state model: `consent` and `voice`.

```
welcome ─▶ 1 Computer (@username, mailbox, model)
        ─▶ 2 Your digital twin
             ├─ 2.1 Consent & privacy      (step: consent)     required before any upload/generation
             ├─ 2.2 Reference media        (step: selfies)     photos (booth/upload), video, voice samples; manage
             ├─ 2.3 Generated identity     (step: selfies)     character sheet + profile image; from photos OR description
             ├─ 2.4 Voice                  (step: voice)       record/upload samples → explicit opt-in → ElevenLabs IVC
             ├─ 2.5 Video avatar           (step: twin)        optional; fal H3 Max lip-sync preview from profile image + voice
             └─ 2.6 Representing image     (step: avatar)      pick the image that stands for @username
        ─▶ 3 Context ─▶ 4 Personality ─▶ 5 Apps
        ─▶ 6 Get started
             ├─ Your digital twin summary  (@username, images, assets, voice, avatar, privacy, /zap + /twin examples)
             ├─ Try a prompt
             └─ Your launcher
```

Resumability is unchanged: every action writes real rows first and marks
the step second, `effectiveStatus` derives from rows, and the deck reopens on
the first open step. Legacy accounts (state files without `consent`/`voice`)
are treated as *skipped* for the new steps once any later step has progress,
so nobody is bounced back into the booth.

### 3.1 The `@username` reference (concept)

```
@username
  → users.id (citext lookup, active user)
  → digital_twins row (sharing, consent ids, voice/avatar config)
  → identity_assets for that user, filtered by purpose and by caller
      caller == owner        : profile_image, character_sheet, selfies, alt images, reference videos, voice
      caller != owner        : only if twin.sharing = 'public'; profile_image + character_sheet only; never voice
  → short-TTL signed URLs minted server-side at job time (never returned to a client)
  → identity_reference_uses row per job (provenance)
```

### 3.2 `/twin` versus `/zap`

| | `/zap` | `/twin` |
|---|---|---|
| Purpose | any short kinetic video from words + attachments | act *as* a digital twin |
| Where `@username` may appear | anywhere in the prose; each resolves to reference images injected as `Image N` | first token after the command (defaults to the caller's own twin) |
| Verbs | none | `say <script>` → talking video (voice clone + lip-sync); otherwise `<image brief>` → identity-consistent image; bare `/twin` → card/status |
| Provider | fal H3 Max Turbo / reference-to-video | fal `minimax/h3-max/lip-sync/image-to-video` (speech), GPT Image 2 edit (image) |
| Voice | never | only the caller's own clone, only with `voice` consent |
| Job mode | `zap` | `twin` (+ `twin_kind` = `speak` \| `image`) |

Examples:

```
/zap Create a cinematic portrait using @grat
/zap Make a short product video starring @grat, vertical, 8s
/twin say Welcome to AirV2
/twin @grat say Welcome to AirV2
/twin @grat Create a profile image in a futuristic editorial style
/twin
```

---

## 4. Screen-by-screen requirements

Shared rules: every panel renders without JS (plain forms), every control has
a visible text label, every notice is in an `aria-live="polite"` region,
focus styles come from `:focus-visible` tokens, tap targets ≥ 44 px, and the
lite (Messages) render keeps working with plain uploads.

### 4.1 Identity (slide 1, unchanged behavior, tightened copy)

* Input `username` with `@` prefix, live suffix `@<mail domain>`, help text
  with the rules (2–24 lowercase letters, digits, underscore; reserved words;
  30-day cooldown).
* Server: `setUsername` (unchanged): normalization, reserved list,
  `mini_apps.slug` clash, DB unique + cooldown trigger. Race safety is the
  `citext unique` constraint (`23505` → "taken"); no read-then-write.
* Success notice names the `@username` and the mailbox. The twin panels
  address the user as `@username` from here on.

### 4.2 Consent & privacy (new panel, step `consent`)

Content (plain language, one screen):

* What you upload: photos, optional video, optional voice samples.
* What we generate: a character sheet, a profile image, optional alternates,
  optional voice clone, optional video avatar preview.
* Who processes it: OpenAI GPT Image 2 via GMI Cloud (images), ElevenLabs
  (voice clone + speech), fal.ai / MiniMax (video), HeyGen (only if you use
  the trained-avatar option). Named explicitly, no logos required.
* Retention: originals stay in your private vault until you delete them;
  provider-side artefacts (voice id) are deleted when you revoke.
* Controls: delete any asset here or in Settings; revoke voice/likeness at
  any time; export via account export.

Controls:

* Checkbox **"I am the person in these photos and I allow AirV2 to generate
  images of my likeness"** → `grant_consent scope=likeness` (required to
  unlock 2.2–2.6).
* Checkbox **"Clone my voice"** → `scope=voice` (optional; unlocks 2.4).
* Checkbox **"Video avatar"** → `scope=video_avatar` (optional; unlocks 2.5).
* Each grant shows `granted <date> · policy v1` and a **Revoke** button.
* Consent for *another person* is refused by copy and by the checkbox
  wording; the voice panel repeats the first-person attestation.

### 4.3 Reference media (step `selfies`)

* Camera booth (existing) for photos; new **audio** booth mode for voice
  samples; video capture stays available for a reference clip.
* Upload forms: images (`png/jpeg/webp/heic`, ≤ 8 MB), video (`mp4/webm`,
  ≤ 50 MB), audio (`mp3/m4a/wav/ogg`, ≤ 25 MB, 10 s–5 min recommended).
* Guidance per type (framing, lighting, quiet room, read naturally).
* Media manager list: thumbnail/preview, role chip, source chip
  (booth/upload/generated), status chip (ready/processing/failed), **Move
  up / Move down** (position), **Delete** (removes tags, revokes deliveries,
  deletes an upload's object when nothing else references it).
* Progress: the booth posts sequentially with an `n/m` live region; the
  plain form path shows a "Uploading…" state via `button[disabled]` +
  `aria-busy` (progressive enhancement only).
* Errors map guard failures to actionable copy (type, size, secrets scrub).

### 4.4 Generated identity (step `selfies`)

Two paths, both bound to `@username` and both metered on the imagine lane:

* **From my photos** → `generate_character_sheet` (existing draft → save /
  discard), then `generate_profile_image` (edit lane on the sheet or best
  selfie) → draft → **Approve** / **Discard**.
* **From a description** → textarea (≤ 500 chars) → `generate_character_sheet`
  with `description` and no photo reference (gpt-image-2-generate). The
  prompt template keeps identity consistency language and forbids real
  third-party likenesses.
* **Alternates** → `generate_alt_image` (edit lane from the approved profile
  image, optional style text) → tagged `alt_image`.
* Each generation shows: queued → generating → ready/refused/failed, retry
  button, the cost line ("counts toward today's creative limit"), and a
  moderation message when the provider refuses.

### 4.5 Voice (new panel, step `voice`)

* Requires `voice` consent; otherwise the panel explains and links to 4.2.
* Sample capture (audio booth, ≤ 60 s each) or upload; list with play,
  delete; recommendation "1–3 clean samples, 30 s+ total".
* **Create voice clone** button → server-side `createUserVoiceClone`
  (idempotent on the sample set) → status pill `pending → ready | failed`,
  provider label "ElevenLabs", `voice id` never shown, error line + retry.
* **Preview** (optional): synthesize a fixed sentence and play it.
* **Delete voice clone** → provider delete + row revoke; consent stays until
  revoked separately (copy says so).

### 4.6 Video avatar (step `twin`)

* Requires `video_avatar` consent, an approved profile image, and either a
  ready voice clone or at least one voice sample (used as the audio).
* **Enable video avatar** → `after()` job: TTS a fixed intro line (or reuse
  the newest sample) → fal lip-sync → preview asset; states
  `off → pending → ready | failed`, with **Refresh status**, **Retry**,
  **Disable** (drops config + preview asset).
* Legacy: consent recording upload and HeyGen "Train an avatar" remain
  available under a "More options" disclosure when configured.

### 4.7 Representing image (step `avatar`) — existing, extended

* Gallery now offers profile image, character sheet, alternates and selfies;
  the approved profile image is preselected.

### 4.8 Completion (slide 6, new "Your digital twin" panel)

* `@username`, profile image, character sheet thumbnail, counts of reference
  photos / videos / voice samples, voice status, video avatar status
  (with preview when ready).
* Privacy controls: **Allow others to reference @you** toggle
  (`sharing = private|public`), links to revoke consent / delete media.
* Copyable examples for `/zap` and `/twin` (reuses `prompt-copy.js`).
* Synthetic-media label: "Voice and video generated from your twin are
  synthetic. Say so when you share them."

---

## 5. Data model changes (migration `supabase/migrations/0121_digital_twin_profiles.sql`)

Forward-only, idempotent where possible, every `references users(id)`
declares `on delete cascade` (enforced by `lib/admin/deletion.test.ts`),
every `create table` ends with `\n);` (parsed by `lib/security/c18.ts`).

```sql
-- identity_assets: more roles + ordering + provenance + processing state
alter table identity_assets drop constraint identity_assets_role_check;
alter table identity_assets add constraint identity_assets_role_check check (role in (
  'selfie','character_sheet','character_sheet_draft','avatar',
  'profile_image','profile_image_draft','alt_image',
  'reference_video','voice_sample','consent_recording'));
alter table identity_assets
  add column if not exists position    integer not null default 0,
  add column if not exists source      text not null default 'upload'
    check (source in ('upload','booth','generated')),
  add column if not exists status      text not null default 'ready'
    check (status in ('ready','processing','failed')),
  add column if not exists consent_id  uuid,            -- fk added below
  add column if not exists label       text,
  add column if not exists provider_ref text;           -- e.g. elevenlabs sample id, never a URL
create unique index if not exists identity_assets_one_profile_image
  on identity_assets (user_id) where role = 'profile_image';

-- Auditable consent, one live grant per scope
create table if not exists twin_consents (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  scope          text not null check (scope in ('likeness','voice','video_avatar')),
  policy_version text not null,
  surface        text not null check (surface in ('onboarding','settings','api')),
  evidence_asset_id uuid references creative_assets(id) on delete set null,
  granted_at     timestamptz not null default now(),
  revoked_at     timestamptz
);
create unique index if not exists twin_consents_live_scope
  on twin_consents (user_id, scope) where revoked_at is null;
alter table twin_consents enable row level security;

alter table identity_assets
  add constraint identity_assets_consent_fk
  foreign key (consent_id) references twin_consents(id) on delete set null;

-- digital_twins: voice clone, video avatar, sharing, consent links
alter table digital_twins
  add column if not exists likeness_consent_id uuid references twin_consents(id) on delete set null,
  add column if not exists voice_provider   text,
  add column if not exists voice_id         text,
  add column if not exists voice_status     text not null default 'none'
    check (voice_status in ('none','pending','ready','failed','revoked')),
  add column if not exists voice_error      text,
  add column if not exists voice_consent_id uuid references twin_consents(id) on delete set null,
  add column if not exists voice_source_asset_ids uuid[] not null default '{}',
  add column if not exists voice_idempotency_key text,
  add column if not exists voice_created_at timestamptz,
  add column if not exists voice_deleted_at timestamptz,
  add column if not exists avatar_provider  text,
  add column if not exists avatar_status    text not null default 'off'
    check (avatar_status in ('off','pending','ready','failed')),
  add column if not exists avatar_config    jsonb not null default '{}'::jsonb,
  add column if not exists avatar_preview_asset_id uuid references creative_assets(id) on delete set null,
  add column if not exists avatar_error     text,
  add column if not exists avatar_consent_id uuid references twin_consents(id) on delete set null,
  add column if not exists sharing          text not null default 'private'
    check (sharing in ('private','public'));

-- creative_jobs: the /twin lane
alter table creative_jobs drop constraint creative_jobs_mode_check;
alter table creative_jobs add constraint creative_jobs_mode_check
  check (mode in ('imagine','animate','zap','video_render','draw','freeze','twin'));
alter table creative_jobs add column if not exists twin_kind text
  check (twin_kind in ('speak','image','preview'));

-- Provenance: which identity assets a job used, and whose
create table if not exists identity_reference_uses (
  id            uuid primary key default gen_random_uuid(),
  job_id        uuid not null references creative_jobs(id) on delete cascade,
  user_id       uuid not null references users(id) on delete cascade,      -- caller
  owner_user_id uuid not null references users(id) on delete cascade,      -- twin owner
  asset_id      uuid references creative_assets(id) on delete set null,
  role          text not null,
  purpose       text not null check (purpose in ('image','video','speech')),
  created_at    timestamptz not null default now()
);
create index if not exists identity_reference_uses_job_idx on identity_reference_uses (job_id);
alter table identity_reference_uses enable row level security;
```

Also required by the repo's audits: add `identity_assets`, `digital_twins`,
`profiles`, `twin_consents`, `identity_reference_uses`,
`onboarding_status_mirror` to `lib/admin/export-tables.ts` and the
user-keyed ones to `lib/security/c18.ts` `V9_USER_TABLES`. `voice_id` and
`provider_ref` are provider handles, not secrets, and may be exported.

Structured asset metadata required by the brief maps as: owner →
`identity_assets.user_id`; profile → `digital_twins.id`; asset id →
`creative_assets.id`; media type/MIME/size → `creative_assets.kind/ext/bytes`;
storage key → `creative_assets.storage_key`; upload source →
`identity_assets.source`; consent → `identity_assets.consent_id`; processing
status → `identity_assets.status`; provider ids →
`identity_assets.provider_ref` / `digital_twins.voice_id`; creation →
`created_at`; deletion → row removal + `revokeDeliveries` (masters swept by
account deletion under `<user_id>/`).

---

## 6. API and background-job requirements

The mini-app keeps its POST-form contract (no new public REST surface is
needed for onboarding). New/changed server modules:

| Module | Responsibility |
|---|---|
| `lib/identity/consent.ts` | `grantConsent`, `revokeConsent`, `listConsents`, `hasConsent`; `CONSENT_POLICY_VERSION` |
| `lib/identity/assets.ts` | roles widened; `uploadIdentityMedia(file, role)` for image/video/audio; `reorderIdentityAsset`; `deleteIdentityAsset` (tags + deliveries + orphan upload object) |
| `lib/identity/generate.ts` | `generateCharacterSheet(…, { description? })`, `generateProfileImage`, `approveProfileImageDraft`, `generateAltImage` |
| `lib/identity/voice.ts` | ElevenLabs client: `elevenlabsAvailable`, `createInstantVoiceClone`, `deleteVoice`, `synthesizeSpeech` — injectable `fetch`, key never leaves the server |
| `lib/identity/voiceClone.ts` | `createUserVoiceClone` (consent check, idempotency key = sha256 of sorted sample ids, `pending → ready|failed`, provider cleanup on DB failure), `revokeUserVoiceClone` |
| `lib/identity/lipsync.ts` | `FAL_TWIN_LIPSYNC_MODEL` (env-overridable), `buildTwinLipsyncRequest` (pure), `generateTwinLipsync` on the shared fal queue driver |
| `lib/identity/twin.ts` | `createTwinSpeechVideo`, `createTwinImage`, `enableVideoAvatar`, `disableVideoAvatar`, `setTwinSharing` |
| `lib/identity/resolve.ts` | `parseIdentityMentions`, `resolveIdentityReference`, `attachIdentityReferences` (for `/zap`), `recordReferenceUses` |
| `lib/identity/twinCommand.ts` | `parseTwinCommand`, `maybeRunTwinLane` (iMessage), `runTwinCommand` (shared executor) |
| `lib/creative/fal.ts` | export `runFalVideoRequest` so lip-sync reuses submit/poll/C23 discipline |
| `lib/creative/store.ts` | `ingestUploadedMedia` accepts audio; `ingestGeneratedAudio` for TTS output |
| `lib/creative/groq.ts` | `CreativeUnconfiguredError` accepts `"ElevenLabs"` |
| `lib/env.ts` | `elevenlabsApiKey`, `elevenlabsApiUrl`, `elevenlabsTtsModel`, `falTwinLipsyncModel` |
| `app/api/chat/route.ts` | `/twin` branch (job + `after()`), `@username` attachment for `/zap` |
| `lib/orchestrator/flush.ts`, `ttfk.ts`, `app/api/inbound/imessage/route.ts` | register `/twin` in the lane chain and the debounce/holding-reply lists |
| `components/prompt-input/PromptInput.tsx` | `/twin` in the palette |
| `lib/miniapps/reserved.ts` | `twin` reserved |

Job model: reuse `creative_jobs` (mode `twin`, `twin_kind`) so the SSE route
`app/api/creative/[jobId]/events` streams progress to the web chat unchanged,
and the daily cap / cost events / concurrency permit apply. Long work runs
in `after()` (web) or inline in the flush lane (iMessage), matching the
existing creative lane; there is no queue table in this codebase and the
brief says to reuse infrastructure. Idempotency: voice clone by key; profile
image and video-avatar enable are no-ops while a matching job is
`submitted|polling`; retries create a new job only after a terminal state.

Provider identifiers are centralized:

```ts
// lib/identity/lipsync.ts
export const FAL_TWIN_LIPSYNC_MODEL = env.falTwinLipsyncModel(); // default "minimax/h3-max/lip-sync/image-to-video"
// lib/identity/voice.ts
export const ELEVENLABS_IVC_PATH = "v1/voices/add";
export const ELEVENLABS_TTS_PATH = (voiceId) => `v1/text-to-speech/${voiceId}`;
export const DEFAULT_TTS_MODEL = "eleven_multilingual_v2"; // env ELEVENLABS_TTS_MODEL
```

Lip-sync input (from the brief, to be re-validated against fal's model page
before production because that page is unreachable from this container):

```ts
{ resolution: "768P", enable_transcription: true, enable_safety_checker: true,
  image_url, audio_url }
```

---

## 7. Media-storage lifecycle

```
capture/upload ──▶ guardMediaUpload (allowlist, cap, secret scrub, EXIF strip)
               ──▶ ingestUploadedMedia (sha256 → <uid>/masters/<sha>.<ext>, creative_assets row)
               ──▶ identity_assets tag (role, source, position, consent_id, status)
render (GPT Image 2 / fal / ElevenLabs TTS)
               ──▶ fetchSafeGeneratedMedia (host allowlist, size cap) ──▶ ingestGeneratedMedia/Audio
               ──▶ identity_assets tag (draft role) ──▶ owner approves (retag) or discards (untag + revokeDeliveries)
use as provider input ──▶ signedIdentityUrl / stageCreativeInput (30-min signed URL, deleted after the job)
serve to the owner   ──▶ signed URL per render, never stored, CSP widened only on identity slides
delete               ──▶ deleteIdentityAsset: tags gone, deliveries revoked, upload master removed when unreferenced
revoke voice         ──▶ DELETE provider voice, voice_status='revoked', samples stay unless deleted
account deletion     ──▶ existing prefix sweep of <uid>/masters + <uid>/deliveries; new tables cascade
```

Private asset URLs never enter a prompt, a chat bubble, a log line, or a
job row; only role names and asset ids do.

---

## 8. Privacy, consent and deletion requirements

* No upload, generation, clone or lip-sync runs without a live `likeness`
  grant; voice cloning additionally needs `voice`; the video avatar needs
  `video_avatar`. Checks happen server-side in the service functions, not
  only in the UI.
* Grants record `policy_version`, `surface`, `granted_at`; revocation sets
  `revoked_at` and, for voice, deletes the provider voice and marks the
  clone `revoked`. A revoked scope disables the dependent features
  immediately (`/twin say` refuses with a helpful line).
* First-person attestation only. The copy and the checkbox text bind consent
  to the authenticated user's own likeness/voice; there is no flow to
  authorize another person, and `@username` never grants voice to anyone
  but the owner.
* Deletion paths exist for: individual reference assets, drafts, the profile
  image, the voice clone (provider + local), the video-avatar preview, and
  the whole account (existing admin delete; new tables cascade).
* Synthetic output is labelled in the summary panel and in the `/twin`
  caption ("synthetic voice/video of @username").
* Analytics: `ops_events` / `cost_events` carry kinds, ids and counts only —
  never prompts, sample audio, or URLs.

---

## 9. Error, retry and loading states

| Situation | Behavior |
|---|---|
| Provider unconfigured (no key) | panel says "not configured on this deployment", step skippable, no failed job created |
| Guard rejects upload | inline notice with the reason, form retains |
| Generation queued / running | job row `submitted|polling`; panel shows a status pill + Refresh; web chat SSE shows progress |
| Provider refusal (moderation) | `refused` + `REFUSAL_LINE`; Retry with different photo/brief |
| Timeout / unknown outcome | `submit_unknown`; never auto-resubmitted (C23); user may start a new job |
| Daily creative cap | `DAILY_LIMIT_LINE`, generation buttons disabled with the reason |
| Voice clone DB write fails after provider success | provider voice deleted best-effort, status `failed`, retry allowed with the same idempotency key |
| Box asleep when marking a step | existing "computer is starting up" notice; rows are already written, mark retried next action |
| Partial multi-file upload | booth reports `saved n/m`, keeps failed shots selected for retry |

---

## 10. Accessibility requirements

* Every input has a `<label>`; file inputs describe accepted types and caps.
* Stepper and page dots are links/buttons with `aria-label`s (existing);
  new status pills carry text, not colour alone.
* Notices render inside `aria-live="polite"`; long-running states use
  `aria-busy` on the form.
* Camera/audio booth: keyboard operable (space/enter shutter, arrows in the
  gallery — existing), reduced-motion honoured, and a plain upload path is
  always present.
* Colour contrast follows theme tokens; the green "done" chips pair with a
  check glyph and text.
* Works at 390 px and 1280 px without horizontal scroll (verified with
  Playwright screenshots in §14).

---

## 11. Command syntax specification

```
/twin                                  → card link into the twin builder + one-line status
/twin @name                            → status for that twin (if resolvable)
/twin [@name] say <script>             → talking video: TTS(voice clone) + lip-sync(profile image)
/twin [@name] <image brief>            → identity-consistent image (edit lane, reference = profile image)
/zap … @name …                         → @name replaced by "the person in Image N" + reference images injected
```

Parsing lives in `lib/identity/twinCommand.ts` (`parseTwinCommand`), a
discriminated union like `lib/trade/parse.ts`. `@name` tokens use the
username grammar `[a-z0-9_]{2,24}`, which is disjoint from bot names
(`[a-z0-9-]{2,32}` with hyphens) — and the creative/twin lanes run *before*
bot-mention delegation in both dispatchers, so a resolvable twin mention
never reaches `parseMention`.

Resolver errors (user-facing lines):

* unknown → `@name isn't a twin you can use.`
* private → same line (do not leak existence)
* mine but incomplete → `@name has no approved profile image yet — finish the Photo Booth in onboarding.`
* voice missing / no consent → `@name doesn't have a voice clone yet — opt in on the Voice step.`

---

## 12. Implementation phases

| Phase | Scope | Status |
|---|---|---|
| **0 Audit + brief** | this document | done |
| **1 Foundations** | migration 0121; consent module; asset roles/media upload/reorder/delete; audio ingest; env + error class; export/audit lists | implemented on this branch |
| **2 Providers behind boundaries** | ElevenLabs client + voice clone orchestration; fal lip-sync request + shared queue driver; profile-image / alt / description generation | implemented on this branch |
| **3 Resolver + commands** | `@username` resolver with authorization + provenance; `/twin` parse + lanes (iMessage, web); `/zap` mention injection; palette, reserved word, debounce lists | implemented on this branch |
| **4 Onboarding UI** | consent panel, media manager, generated identity, voice, video avatar, completion summary, CSS, a11y | implemented on this branch |
| **5 Verification** | unit tests, typecheck/lint/test/build, 390/1280 px review | this branch |
| **6 Follow-ups** | Settings parity for the new panels; fal webhook for long renders; PVC (professional clone) upgrade path; username-rename fix-ups (publisher slugs/prefix); Playwright e2e against a seeded DB | open |

---

## 13. Acceptance criteria

1. A user can claim a valid, unique `@username`; invalid, reserved, taken and
   cooldown cases each return a specific message (existing + tested).
2. Onboarding resumes after interruption on the first open step; new steps
   do not bounce legacy accounts.
3. Images, video and audio can be uploaded (booth or form), previewed,
   reordered, deleted, and are associated with the twin profile with
   source/status/consent metadata.
4. A character sheet and a profile image can be generated (from photos or a
   description) and approved; drafts never reach the vault, `/zap` or
   `/twin` until approved.
5. Voice cloning runs only with a live `voice` grant; retries never create a
   second provider voice for the same sample set; deletion removes the
   provider voice.
6. Every external operation surfaces `pending / ready / failed / refused /
   submit_unknown` with a retry path; nothing is auto-resubmitted.
7. `@username` inside `/zap` and `/twin` resolves to authorized reference
   assets; other users' private twins are indistinguishable from unknown
   names; voice is owner-only.
8. No private asset URL or provider key appears in chat output, prompts,
   job rows or logs (tests assert on the turn handed to the executor).
9. Users can revoke each consent scope and delete media / clone / preview.
10. The booth slide passes at 390 px and 1280 px, keyboard-only operation of
    forms, and the axe-style checks listed in §10.
11. `npm run typecheck`, `npm run lint` (0 errors), `npm test` and
    `npm run build` pass; existing unrelated tests keep passing.

---

## 14. Testing plan

Unit (vitest, existing conventions — module-boundary `vi.mock`, injected
`fetch`/queue seams, hand-rolled supabase chains):

* `lib/identity/consent.test.ts` — grant/revoke/hasConsent, one live grant
  per scope.
* `lib/identity/voice.test.ts` — IVC multipart shape, header, response
  parsing, error mapping; TTS request; delete.
* `lib/identity/voiceClone.test.ts` — consent gate, idempotency, provider
  cleanup on DB failure, revoke.
* `lib/identity/lipsync.test.ts` — pure request builder; queue run via
  injected `submit`/`queue` (mirrors `creative.test.ts` fal seams).
* `lib/identity/resolve.test.ts` — mention parsing, owner vs public vs
  private, purpose filtering, no URLs in cleaned text, provenance rows.
* `lib/identity/twinCommand.test.ts` — grammar; iMessage lane with a fake
  sender (`imessage-burst.test.ts` shape); web branch shape.
* `lib/creative/creative.test.ts` — `/zap` with `@name` injects references
  and strips the mention.
* `lib/miniapps/apps/onboarding-identity.test.ts` — updated panels, consent
  gating of actions, media manager actions, summary panel, lite fallbacks.
* `lib/admin/deletion.test.ts`, `lib/security/ma11.test.ts` — unchanged, now
  covering the new tables.

Manual / visual: `npx tsx scripts/preview-onboarding.ts <dir>` renders every
slide to static HTML; Playwright screenshots at 390×844 and 1280×800 for
the booth and start slides (attached to the PR).

Not covered in this container (needs keys): live ElevenLabs, fal and GMI
calls. Preflight (`lib/creative/preflight.ts`) should gain an ElevenLabs
reachability check in Phase 6.

---

## 15. Open questions and assumptions

**Q1 — "Sunburst 2.5".** Not present in the repo. Assumption: the character
sheet and profile image render on the existing GPT Image 2 lane at
`quality: "high"`. If Sunburst is a real GMI/OpenAI model id, add it to
`LANE_MODELS.imagine/edit` and `REQUIRED_GMI_MODEL_PARAMETERS` and pin it via
`CreativeJobOptions.model` in `generateProfileImage` — one constant.

**Q2 — fal lip-sync schema.** Taken from the brief's snippet
(`resolution`, `enable_transcription`, `enable_safety_checker`, `image_url`,
`audio_url`). Verify on fal's model page before enabling in production;
the identifier is env-overridable (`FAL_TWIN_LIPSYNC_MODEL`).

**Q3 — ElevenLabs contract.** Verified against SDK 2.68.0, not the live
docs (egress blocked). TTS model default `eleven_multilingual_v2`
(env-overridable). IVC may return `requires_verification: true` for some
accounts; the UI treats that as `pending` with a "verify in ElevenLabs"
line.

**Q4 — Sharing.** Default private. The public toggle exposes profile image
and character sheet to other users' `/zap` only. No discovery UI is built.

**Q5 — Where long jobs run.** `after()` inside the request budget (existing
pattern, 800 s route budget). A queue/webhook is a Phase 6 change if fal
renders regularly exceed it.

**Q6 — Legacy twin fields.** `consent_video_key`, `provider_avatar_id`,
`status` keep working (HeyGen path). No data migration; old rows read as
`voice_status='none'`, `avatar_status='off'`.

**Q7 — Username renames.** Out of scope; the resolver keys everything by
`users.id`, so a rename does not break stored references.

**Assumptions:** owner-only mini-app sessions (guests never reach these
actions, MA4); the service-role Supabase client is the only writer; no
generated DB types exist, row interfaces stay hand-written; the Messages
lite render never mounts camera/audio code.
