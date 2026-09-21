# Onboarding mini-app: crash, latency and design upgrade

Status: **stage 1 shipped**, stages 2–4 proposed.
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

## Stage 2 — proposed: settle the lite/full question properly

`resolveVia` drops the `card` marker whenever the UA carries a `Safari/` token,
on the documented assumption that the Messages extension's WKWebView does not.
The screenshots show a **full** render (glass panels, slide animation, the
client stepper) inside what is plainly a Messages sheet — so either that
assumption does not hold on current iOS, or the open did not come through a
card link at all. Stage 1 makes the full render affordable enough that it no
longer matters for stability, but it is worth knowing.

1. Log the raw UA alongside the existing `miniapp load` line, keyed by lane, for
   a week. That answers it directly.
2. If the extension does send `Safari/`, stop inferring the surface from the UA:
   have the extension append a query marker the loader trusts, and keep
   `isFullBrowser` for the Mac-hands-links-to-Safari case only.
3. Either way, move `lite` from a binary to a budget — `{ fx, camera, film,
   motion }` — so a surface turns off what it cannot afford instead of
   everything at once. Mobile Safari should keep the film; the extension should
   not.

## Stage 3 — proposed: a real performance budget

- **Serve thumbnails.** `signedIdentityUrl` hands out the full-resolution
  original for a 64 px row and a 180 px grid cell. Supabase Storage image
  transforms (or a small same-origin resize route) would cut the largest
  remaining variable cost. Needs verification that transforms are enabled on the
  project before it can be relied on — a transform URL on a plan without them
  returns an error, not the original.
- **Split `SLIDE_CSS`.** ~30 KB of inline CSS ships on every render, most of it
  for components the open panel does not use. Split per slide, or move the
  stable part to a cached same-origin stylesheet (it is `no-store` on the
  document, but a stylesheet under `/creator-os/` is already cached hard).
- **Instrument the client.** The `miniapp load` line measures the server. Add
  first-paint and decode timing from the page itself, so "slow" has a number.
- **Budget test.** A unit test asserting the rendered twin slide stays under a
  byte ceiling and mounts at most one panel — the regression that caused this
  is easy to reintroduce.

## Stage 4 — proposed: the iMessage surface itself

Worth taking from the photon-hq references the user pointed at
(`advanced-imessage-ts`, `create-spectrum-project`,
`vercel-chat-adapter-imessage`):

- **Richer card bubbles.** `buildAppCard` deliberately omits `live` so a tap
  opens the full-screen sheet. A `live` card renders inline in the transcript —
  worth a look for short, glanceable steps ("3 of 6 done, next: your voice"),
  keeping the sheet for anything that needs room. The trade-off is that a live
  card runs the extension UI in the transcript, which is the same budget
  problem in a smaller box: it only works for something genuinely small.
- **Card edit-in-place on progress.** `editApp` already exists and
  `cardSessions` tracks the sent card. Refreshing the Onboarding bubble as steps
  complete turns the thread itself into the progress indicator.
- **Finish a step from the thread.** The consent and skip actions are one-bit
  decisions; a tapback or a quick reply could settle them without opening the
  sheet at all. `lib/spectrum/tapbacks.ts` already has the plumbing.

---

## Verification

`npm run typecheck`, `npx eslint .` (0 errors), and the full suite —
**3689 passed, 3 skipped** — plus `scripts/preview-onboarding.ts` rendered to
static HTML and screenshot at 393×852 for each slide.

Not verified here: behaviour inside a real Messages extension on a real device.
Stage 1 removes the specific pressures that make iOS terminate it, but only a
device confirms the label is gone.
