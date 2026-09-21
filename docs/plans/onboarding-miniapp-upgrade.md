# Onboarding mini-app: crash, latency and design upgrade

Status: **stages 1, 3 and 4 shipped; stage 2 part-shipped** — the UA logging
that answers it is live, the two decisions that depend on its results are
deliberately still open. See "What is still open" at the end.
Surface: `apps/web/lib/miniapps/apps/onboarding.tsx` (+ `lib/miniapps/onboarding.ts`,
`lib/miniapps/shell.ts`, `lib/miniapps/surface.ts`, `lib/miniapps/client/`).

Three reports from the field, on an iPhone, opening the Onboarding card from a
Messages thread:

1. **"Unable to Load App"** on the digital-twin slide — sometimes on open,
   sometimes mid-scroll, leaving a frozen snapshot of the page behind the label.
2. **Slow loads** throughout, and taps that appear to do nothing.
3. **The deck opens on the last slide** ("Get started") instead of the first.

Plus: the upload controls and the button system need to be much better.

---

## What was actually wrong

### "Unable to Load App" is iOS killing the extension, not a failed request

The label is Apple's, shown when the Messages app extension hosting the webview
is terminated. It is a resource verdict, not a network error — which matches the
symptom exactly: the page renders, then the extension dies, and a frozen
snapshot stays on screen under the label. The code already knew this
(`LITE_CSS`'s comment names it), but the mitigation was gated behind
`session.via === "card"`, and everything else about the render assumed headroom
the extension does not have.

Per open, the twin slide was asking the extension for:

| | bytes |
|---|---|
| HTML — all six stepper panels, ~13 000 px of DOM | 64 KB |
| `wzrd-wordmark-1600.png`, behind a 24 px-tall header image | **772 KB** |
| `fx.js` — a WebGL context and its textures, purely decorative | 89 KB |
| `identity-booth.js` — shipped on all six panels, mounted on three | 200 KB |
| fonts, swipe + stepper bundles | 159 KB |
| **every signed photo, character sheet, avatar frame and alternate look in all six panels**, eagerly, at full resolution | unbounded |

The last row is the one that kills it. The stepper hid five of six panels with
`display:none` **after** the server had already put their `<img>` tags in the
document. A user with a dozen reference photos, a character sheet, a profile
image and two alternates was decoding all of it to show one panel.

The welcome slide had its own version of this: `<video preload="auto">` over a
5.8 MB MP4, with a **75 MB** QuickTime master listed as a second source.

### Opening on the last slide

`snapshotForRender` resolved a stepless URL through `firstOpenStep(snapshot)`,
which walks `ONBOARDING_STEPS` for the first `todo` and **returns `walkthrough`
when there is none**. Every account that has finished or skipped its way through
setup therefore lands on `walkthrough` → the "Get started" slide → the last one
in the deck. A card tap had no way to reach the beginning.

### Latency

`markOnboardingStep` resolved the compute target twice — once inside
`readOnboardingState`, once for the write — so every skip, every "mark done" and
every action that records progress paid two box start-and-wait round trips
instead of one. Compounding it, nothing on screen acknowledged a tap: the deck
is server-rendered, so a press is followed by silence until the next document
paints, which reads as a dead button and earns a second press.

---

## Stage 1 — shipped

### Weight

- **One panel per render.** `stepperHtml` renders the stepper server-side:
  indicator links, one `<section class="panel">`, Previous/Continue. The other
  five panels and their media are not in the document at all. `?panel=<section>`
  addresses a stage directly, which the booth needs because two of its stages
  share the `selfies` step; forms post to the current URL, so an action keeps
  its panel without every form carrying a hidden field.
- **`deck-stepper.js` is gone** — the enhancement it provided is now the
  server's default, and it no-ops against a single panel anyway. Its build slot
  went to `deck-pending.js` (below).
- **Wordmark: 772 KB → 15 KB.** `wzrd-wordmark-320.png` / `-640.png` with
  `srcset`; the 1600 px master stays in the repo as the source the two are
  derived from, but nothing loads it.
- **No WebGL on handhelds.** `isHandheld()` (`lib/miniapps/surface.ts`) keeps
  `fx.js` and the grain overlay to desktop browsers. The backdrop element
  already degraded to the canvas gradient when the script was unavailable, so
  this costs nothing but the parallax.
- **The camera bundle follows the panel**, not the slide: 200 KB on the three
  stages that mount a booth, nothing on the other three.
- **Lazy, sized media.** Every identity preview carries `loading="lazy"`,
  `decoding="async"` and explicit dimensions.
- **The intro film is `preload="metadata"`**, warmed by `intro-cinematic.ts` on
  the first touch of *Begin* — the press-and-hold escalation gives it the
  runway. The 75 MB `.mov` source is deleted (unreferenced; recoverable from
  git history).

Twin slide, cold, per open: **1285 KB → 422 KB (−67%)**, and **222 KB (−83%)**
on a stage with no camera mount.

### Flow

- A render with no `?step=` opens on the **welcome slide**, always
  (`RenderEntry`: `"entry"` for a fresh open, `"next"` for the redirect after an
  action, which still wants the next open step).
- The welcome slide carries a **"Pick up where you left off →"** link for an
  account with progress, so the beginning is a starting line and not a wall.
- A stepped slide now has **one** navigation: the stepper owns
  Previous/Continue, the footer keeps the deck dots and drops its own Back/Next.
  A swipe reads the same pair of targets, so it walks the stages instead of
  jumping the slide and skipping them.

### Latency

- `markOnboardingStep` resolves the compute target **once** for the read and the
  write.
- `deck-pending.js` (1.1 KB) marks the pressed control busy with a spinner and
  **swallows the repeat submit** — one upload, one generation, one charge, once.
- File pickers carry `data-autosubmit`: choosing a photo submits it. The visible
  submit button is the no-JS fallback and hides once the bundle marks the
  document.

### Design

- **Three button weights, not one.** Primary (solid), `.ghost` (ring),
  `.quiet` (underlined link — "Skip for now" is always available and never the
  recommended move; it used to shout as loudly as the real action). Sentence
  case at 0.85 rem replaces 0.78 rem uppercase mono; uppercase mono stays for
  eyebrows and labels, where it belongs. 48 px minimum target. `.btn` shares
  every style with `button`, so a link and a submit feel identical.
- **Upload tiles.** The whole card is the picker's `<label>`: icon, what it
  does, where it comes from. The native "Choose File" control — 90 px wide,
  naming neither the source nor the subject — is gone.
- **Stepper.** Larger indicators, an accent halo on the active stage, green
  check + connector fill on completed ones, `aria-current="step"`.
- **Disclosures** get a chevron and an open state; deck dots are visible when
  unvisited instead of near-invisible; reduced-motion keeps the busy indicator
  but stops it spinning.

---

## Stage 2 — the lite/full question: instrumented, not yet answered

`resolveVia` drops the `card` marker whenever the UA carries a `Safari/`
token, on the documented assumption that the Messages extension's WKWebView
does not. The screenshots show a **full** render (glass panels, slide
animation, the client stepper) inside what is plainly a Messages sheet — so
either that assumption does not hold on current iOS, or the open did not come
through a card link at all.

**Shipped:** the loader's `miniapp load` line now carries the request's raw
user-agent (truncated to 180 chars) and the session's resolved `via` marker,
on every lane and both methods (`app/mini/[app]/route.ts`). A card-opened
render that logs `via: "card"` next to a UA containing `Safari/` settles the
question in one direction; one that logs `via: null` for an obviously
embedded UA settles it in the other.

**Deliberately not shipped**, because both depend on what that data says:

- Flipping the surface detection. If the extension does send `Safari/`, the
  fix is to stop inferring the surface from the UA — have the extension
  append a query marker the loader trusts, keeping `isFullBrowser` for the
  Mac-hands-links-to-Safari case only. Guessing the direction now would mean
  changing how every card session renders on a hunch.
- Moving `lite` from a binary to a budget (`{ fx, camera, film, motion }`).
  The point of the budget is that each surface turns off only what it cannot
  afford — mobile Safari keeps the film, the extension does not — and which
  surface needs which is exactly what Stage 2's data establishes. Stage 1
  already split the largest axis out of the binary (`fx` is gated by
  `isHandheld`, not by `lite`), so the remaining pressure is low.

Stage 1 and 3 together make the full render affordable enough that this is
now a correctness-and-polish question rather than a stability one.

## Stage 3 — the performance budget — shipped

- **Thumbnails, same-origin.** `signedIdentityUrl` handed every preview the
  same full-resolution signed URL — a 64px row, a 96px avatar pick, a 240px
  grid cell. `lib/miniapps/identityThumb.ts` serves a resized JPEG from
  `?thumb=<assetId>&w=<width>` instead, resolved inside the module's own
  `render()` against `listIdentityAssets(supabase, userId)` — already scoped
  to the authenticated owner. No new signing subsystem and no new
  authorization surface: an asset id that is not this session's, or names a
  non-image role, 404s like an unknown one. Widths come from a small
  allowlist; the character-sheet review preview stays full-resolution, since
  that one is meant to be inspected.
  - Chosen over Supabase Storage image transforms, which this plan flagged
    as needing verification first — a transform URL on a project without
    them returns an error rather than the original, and that could not be
    checked from here.
- **The stylesheet is cached, not inlined.** ~40 KB of CSS shipped inline on
  every `no-store` render; it is now `public/creator-os/onboarding.css`,
  served under the `/creator-os/` rule that already caches hard
  (`max-age=86400, stale-while-revalidate=604800`). Per-theme tokens stay
  inline — they are the only part that varies. `style-src` widens to `'self'`
  for the `<link>`; `'unsafe-inline'` alone does not cover one.
- **The client half of the load picture.** `deck-timing.js` (1.3 KB) reports
  TTFB, transfer, DOM, load, first paint, first contentful paint, document
  bytes, and the image bytes and count the page went on to pull, plus
  `deviceMemory` — the coarse bucket the extension-kill hypothesis is about.
  It beacons to the page's own gated POST path (no new endpoint), and the
  server clamps every field to an allowlist with a ceiling before logging
  `miniapp client timing`; nothing a client sends reaches the log as a
  string.
- **A budget test that bites.** `page-weight budget` in
  `onboarding-identity.test.ts` holds one panel per render, a 40 KB ceiling
  on a fully-loaded twin slide (worst case today: ~28 KB), thumbnails on
  every gallery `<img>`, no 1600px wordmark, no WebGL on a handheld, and the
  200 KB camera bundle only on the three stages that mount a booth. Verified
  by simulating the regression: re-inlining the stylesheet takes the slide to
  67 KB and the test fails.

Document bytes, twin slide, heaviest panel: **58 KB → 16 KB**.

## Stage 4 — the iMessage surface

**Shipped — the card as the progress indicator.** The Onboarding bubble
already in the owner's transcript is edited in place as steps settle, so the
thread reads as where setup stands rather than a static "Set up your agent"
from whenever it was sent. It reuses `updateMiniAppCard`/`editApp` and the
existing `cardSessions` row, runs after the response (a Spectrum round trip
is exactly the latency Stage 1 spent a release removing), and coalesces to
one edit per request carrying the final line — the Computer slide settles
username and email together. An owner with no bubble comes back `stale` and
is left alone; a failure never touches the request that triggered it.

**Not shipped — the two that are product calls, not plumbing:**

- **Live card bubbles.** `buildAppCard` deliberately omits `live` so a tap
  opens the full-screen sheet. A `live` card renders the extension UI inline
  in the transcript — which is the same resource budget that caused this
  whole task, in a smaller box. It could work for something genuinely small
  ("3 of 6 done, next: your voice"), but deciding what belongs inline and
  what still needs the sheet is a design call, and getting it wrong
  reintroduces the original failure in a place that is harder to see.
- **Finishing a step from the thread** (a tapback settling consent or a
  skip). `lib/spectrum/tapbacks.ts` has the plumbing, but a tapback is a
  low-confidence signal to hang a consent grant on, and consent in
  particular is the one thing in this flow that should stay explicit and
  legible. Worth designing deliberately rather than shipping alongside a
  performance pass.

---

## What is still open

| Item | Why it is open |
|---|---|
| Flip the lite/full surface detection (Stage 2) | Needs a week of the UA logging that just shipped |
| `lite` as a budget, not a binary (Stage 2) | Depends on the above; the largest axis (`fx`) is already split out |
| Live card bubbles (Stage 4) | Design call with a real regression risk |
| Step completion from a tapback (Stage 4) | Consent should stay explicit; deserves its own design |
| Behaviour in a real Messages extension | Only a device confirms the label is gone |

## Verification

`npm run typecheck`, `npx eslint .` (0 errors, 789 pre-existing warnings in
vendored bundles), and the full suite — **3713 passed, 3 skipped**. Deck
slides rendered with `scripts/preview-onboarding.ts` and screenshot at
393×852, served over HTTP so the extracted stylesheet resolves.

Not verified here: behaviour inside a real Messages extension on a real
device. Stages 1 and 3 remove the specific pressures that make iOS terminate
it, but only a device confirms the label is gone.
