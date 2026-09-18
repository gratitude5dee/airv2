# air by WZRD.tech — launch film

**1920×1080 · 30fps · 103s · 13 shots + one continuous sky + music.**
Master: `index.html` (`data-composition-id="master"`). One sub-composition per shot in
`compositions/`, layered by `data-track-index`, seeked by frame — nothing plays in real time.

## Motion doctrine

Everything in the film obeys three rules, taken from `heygen-apple-motion/01-ui-sting`:

1. **One ease family.** Every entrance is `expo.out`/`power4.out` (the GSAP equivalent of the
   template's `EO = 1 - 2^(-10p)`); every exit is its mirror, `power4.in` (`EI = 2^(10(p-1))`).
   `sine.inOut` appears only for held-state drift (orbit spin, the slow push on a held frame);
   `power2.inOut` only for wires and progress bars, where the motion is a mechanism, not a body.
2. **Matched vectors across every cut.** The film's current runs **leftward**. Each shot exits
   with `x: -230` on `power4.in` and the next shot enters `x: 230 → 0` on `power4.out`, so the
   outgoing frame is still travelling when the incoming frame picks the vector up mid-flight.
   ±230px is ~12% of the frame — enough to read as travel, not as a slide transition.
3. **Springy 3D with soft shadows.** Cards and tiles arrive on `rotateX` from below with
   `transformOrigin: 50% 100%`, under `0 36px 74px -30px rgba(0,0,0,.85)` drop shadows and
   `backdrop-filter: blur()` glass. Scale-in is always paired with opacity, never alone.

Structural consequences: the master stage has an opaque `#050810` ground (every seam is a
mid-motion cut, which briefly sums opacity below 1), and each shot's own root is opaque except
the four that ride the sky (01, 02, 11, 12, 13). A film-grade layer (soft vignette + a
fixed-seed SVG-turbulence grain at 5% overlay) sits above every shot in the master.

## Music (`assets/bgm.mp3` — Passwords.mp3, supplied)

83.4 BPM, 4/4, 103.0s. Analyzed with the canonical beatgrid analyzer into `audiomap.json`,
which is the film's timing spine — every seam sits on one of its anchors:

- **SURGE ~6s** → shot 01 → 02 cut. **Phrase edge 13.77s** → 02 → 03. **Phrase edge 25.33s** → 03 → 04.
- **SURGE ~51s** → shot 07's third computer card slams home (48.5 + 2.5).
- Shot 08's six task rows land on the passage's snare hits (56 + 2.20/2.75/3.26/3.95/4.63/5.42).
- **Hard stops 67s / 69s** → shot 09's second remote press freezes the whole mesh at 67s and the
  frame holds dead still until the 69s cut into the backend act.
- **Near-silence 89–103s** → "air, your guardian angel" and the end card ride the quiet tail;
  the volume lane fades in over 0.35s and out from 100.5s with the sky.

## The sky (`compositions/sky.html`)

One instance, `data-start="0" data-duration="103"`, `data-track-index="0"` — it is the opening
background, it sits unseen behind the opaque chapter shots, and it returns for the close.

- WebGL: fBm cloud layers (4 octaves of value noise), a sun disc with bloom, god rays, and a
  vignette veil. Deterministic `hash()` — no `Math.random()`, no dithering from a clock.
- **Seek-safe by construction.** `uTime`/`uProgress` are *not* read from `performance.now()` or
  a `requestAnimationFrame` loop. A proxy `{t, p}` is tweened on the paused timeline and its
  `onUpdate` re-renders the frame, so frame *n* always produces the same pixels.
- `uProgress` 0 → 1 moves the sky from bright cloud-lit morning to a darker veiled dusk:
  `0 → .18` over the open (0–13.8s), `→ .42` across the chapters (13.8–81s), `→ .86` under the
  close (81–103s) on `power1.inOut`.
- Fallback: if WebGL or shader compilation is unavailable (headless validation), it paints a
  Canvas-2D deep-navy → sky-blue gradient with a sun glow and the same `uProgress` veil.

## Shots

| # | Composition | Start | Dur | Beat | Entrance / exit | Cut technique |
|---|---|---|---|---|---|---|
| 01 | `shot-01-open.html` | 0 | 6.0 | "air by WZRD.tech" over the cloud sky; the hero line from the airv2 landing page; six app tiles (iMessage, Gmail, Calendar, Chrome, Spotify, Shopify) name what the agent does | Inverse-zoom open (`scale 1.08 → 1`, `expo.out`) + waterfall wordmark (`yPercent 112 → 0`); tiles on `rotateX -26 → 0`, shrinking stagger | Opens on the sky, exits left |
| 02 | `shot-02-kinetic.html` | 6.0 | 7.8 | "the future of interfaces is invisible, / as light as air" | Word-level waterfall in from `x: 230`; beat A exits word-by-word on `power4.in` as beat B enters | Hard cut on the sky, matched leftward vector |
| 03 | `shot-03-endowments.html` | 13.8 | 11.5 | "Your agent gets a phone, an email, a wallet, an encrypted key vault, and a custom composable computer." — each noun becomes an icon chip | Words rise 0.16s apart; each chip lands on `rotateX` and its glyph pops 0.10s later | Hard cut, `x: 230 → 0` |
| 04 | `shot-04-hyperpersonalization.html` | 25.3 | 7.7 | "1) Hyperpersonalization" — Spotify, Netflix, YouTube orbit the supplied Onairos persona mark on a tilted 3D ellipse | Depth read off `sin(angle)`: far tiles shrink, dim and blur behind the persona, near tiles pass in front; taste-graph motes stream inward on fixed phases; the hub breathes once per bar (~1.44s half-cycle at 83.4 BPM) | Hard cut |
| 05 | `shot-05-import-context.html` | 33.0 | 7.5 | "2) Import Context" — ChatGPT + Claude/your existing agent, then Notes, Calendar, iMessage, Chrome profile wiring into an air context panel | Source cards cascade in from the left; each SVG wire draws on `strokeDashoffset` after its card lands; imported bars fill `scaleX` from origin `0% 50%` | Hard cut |
| 06 | `shot-06-connect-apps.html` | 40.5 | 8.0 | "3) Connect your Apps — across 1000+ apps" — Instagram, Meta, Shopify featured over a swarm of app icons | Swarm on a deterministic phyllotaxis spiral (golden angle 137.508°, r ∝ √i — no RNG), blooming centre-out in index order; counter proxy tweens 0 → "1,000+" on `power2.out` | Hard cut |
| 07 | `shot-07-composable-computer.html` | 48.5 | 7.5 | "4) A composable computer" — Ubuntu in a VM, Omarchy on Linux, macOS on Apple Silicon, plus "Omarchy on native Apple Silicon — coming soon" | Three cards rise on `rotateX` with a 1.04 → 1 two-frame overshoot; the third lands exactly on the 51s SURGE; then the dashed coming-soon banner slides in | Hard cut |
| 08 | `shot-08-knowledge-work.html` | 56.0 | 7.5 | "5) Knock off Knowledge Work" — a Buoy-style thread: iMessage-blue user bubble, six task rows, a "Memory updated" chip | Prompt bubble scales in; rows land on the passage's snare onsets, each tick drawn by `strokeDashoffset`; the coming-soon row stays dashed and unticked; the memory chip resolves last | Hard cut |
| 09 | `shot-09-remote-control.html` | 63.5 | 5.5 | "6) air is your remote control for hyperpersonal agents" — a remote presses, an 11-node agent mesh lights up | Remote rises from below; the second press lands on the track's 67s hard stop and the whole lit mesh FREEZES dead still until the 69s cut | Hard cut on the second hard stop |
| 10 | `shot-10-guardian-angel.html` | 69.0 | 12.0 | Guardian-angel backend: sandbox → mesh → task router (quantized model) → RL environment → ZDR policy, with the full backend sentence | Halo scales in, ten feathers draw outward from it, then each stage card lands and wires itself to the next; sentence resolves word by word at reading pace | Hard cut |
| 11 | `shot-11-yours.html` | 81.0 | 8.0 | Back to the sky: "Your agent, your RL environment, your model, your weights." | Four clauses in from `x: 230` with shrinking gaps, then a held `sine.inOut` push | Hard cut; the sky underneath is continuous, so the cut reads as a lift |
| 12 | `shot-12-guardian.html` | 89.0 | 7.0 | "air, your guardian angel" — the shot-10 wing, opened wider, over the veiled sky | Words in on the leftward vector; wing feathers draw; "air by WZRD.tech" kicker last | **The film's only dissolve** (0.42s) — legitimate because the sky carries it: the background never cuts |
| 13 | `shot-13-endcard.html` | 96.0 | 7.0 | "Built on Zaps by WZRD.tech, in partnership with" + the 11-partner wall | Scrim fades up over the same sky; lockup arrives by inverse zoom; plates cascade with shrinking gaps, then the frame holds dead still for the last ~5s | Resolves; no exit travel — the film ends on a still frame |

Total: 103.0s — the exact length of the track (inside the 90–120s brief).

## Assumptions

- **Copy.** Shot 01's hero line and the number/inbox/computer framing come from airv2
  `apps/web/app/page.tsx`. Shot 10's sentence is used verbatim as briefed; the per-stage
  captions are written from airv2 `infra/template/setup.sh` (per-person sandbox, agent mesh,
  local task router on a quantized model, RL loops, zero data retention).
- **Chapter numbering.** Shots 04–09 keep the briefed "1)…6)" labels as an on-screen eyebrow
  above a written headline, so each chapter reads as a chapter rather than a list item.
- **buoy.chat** is treated as a *visual* reference only — a glass chat surface with one
  instruction and a task list resolving beneath it. No content is reproduced from it.
- **Type.** Inter (variable, SIL Open Font License) is bundled locally at
  `fonts/Inter-latin-variable.woff2` and loaded with `@font-face`. No CDN font fetch at render.
  No licensed face (TT Norms Pro etc.) is used, so nothing needs a licence check.

## Asset provenance

`logos/` is local; nothing is fetched at render time.

- **Official marks**, from the Simple Icons set (CC0-1.0 icon data; each mark remains the
  trademark of its owner and is used here nominatively): Spotify, Netflix, YouTube, OpenAI,
  Anthropic, Claude, Apple, iMessage, Google Calendar, Google Chrome, Instagram, Meta, Shopify,
  Ubuntu, 1Password, MongoDB, Vercel, Box, Linux, Gmail, and the app-swarm brands in shot 06.
- **Supplied artwork** (provided by the client for this film): `onairos-avatar.png` — the
  Onairos gradient-silhouette persona mark (shot 04 hub + end-card plate; background knocked
  out from the supplied PNG); `wzrdtech-chrome.png` — the WZRD.tech chrome blackletter mark
  (shots 01 and 13; white background knocked out from the supplied PNG). `assets/bgm.mp3` is
  the supplied Passwords.mp3, unmodified.
- **Simplified redraws** (not official artwork — geometric stand-ins drawn for this film,
  because no official SVG was obtainable offline): `onairos.svg` (mesh nodes), `tenkicloud.svg`,
  `gmicloud.svg`, `hudrl.svg`, `cognition.svg`, `omarchy.svg`, `wzrd.svg`, `air.svg`,
  `zaps.svg`. **Replace these with official artwork before any public release.**
- **Generic glyphs** drawn for this film (no brand attached): `glyph-phone`, `glyph-mail`,
  `glyph-wallet`, `glyph-vault`, `glyph-computer`, `glyph-remote`, `glyph-notes`, `glyph-cart`,
  `glyph-shop`, `glyph-miniapp`, `glyph-calendar-check`, `glyph-sparkle`.

## Working on this project

```bash
npm run dev     # preview server (long-running)
npm run check   # lint + validate (runtime/layout/contrast) + inspect
npm run render  # -> renders/air-launch.mp4
```

`renders/` is git-ignored by the repo root. Two constraints are easy to break and hard to
notice: (1) inside a composition's JS, query with root-relative selectors (`root.querySelector('.mesh')`)
— prefixing with the root's own id fails once the composition is assembled into the master
document; (2) never drive a shader from a clock.
