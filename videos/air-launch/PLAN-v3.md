# PLAN-v3 — air by WZRD.tech · launch film (iMessage cut)

**Build brief for the implementing agent (Opus). Read top to bottom once, then work the build order in §11.**
Source of truth for timing is `v3/cutsheet.json` (generated from `audiomap.json`). Source of truth for component choices is `v3/COMPONENTS-v3.md`. Gate doctrine is `REVIEW-PROMPT.md` (unchanged from v2; the gate letters below refer to it). The v2 film (`STORYBOARD.md`, `PLAN-v2.md`, `compositions/shot-*.html`) is the baseline you are replacing: keep its motion doctrine, its stage/grade stack and its approved claim copy; replace its structure, its soundtrack and its sky direction.

| Field | Value |
| --- | --- |
| Deliverable | `renders/air-launch-v3.mp4`, 1920×1080, 30 fps, 119.699 s, h264 + aac, `--quality high` |
| Soundtrack | `assets/bgm.mp3` = vstar (152 BPM, 4/4, downbeat phase 0, 119.699 s). The v2 track is kept as `assets/bgm-v2-passwords.mp3` for reference only |
| Emphasis | iMessage agents. The phone is on screen for ~88 of 120 seconds. Every product moment is shown as a text thread |
| Required section | Mini-apps `/home /shop /trade /zap` (S06) and how owners make their own with `/create` (S07) — 44 s, the spine of the film |
| Visual grammar | The brand intro film `apps/web/public/creator-os/airintrofin.mp4`: sky dawns night → sunrise → bright cumulus; chrome WZRD.tech mark centred; "air by" resolves above it at the end. v3 reproduces that arc across the whole film and lands on the same lockup |
| Stack | HyperFrames 0.8.22 (pinned in `package.json`), one paused GSAP timeline per composition, DOM/CSS phone, WebGL fBm sky with Canvas-2D fallback, fal-generated plates where a photograph beats a shader |

---

## 0. What is already done (Gate 0 partial) and what is not

Done in this scaffold (do not redo):

- `assets/bgm.mp3` is vstar (md5 `a6fe9c9dfaeea9d0fc0425eab16bce36`). `audiomap.json` is the canonical `analyze-beatgrid.py` output for it (`audiomap-v2.json` is the old track, reference only).
- `v3/cutsheet.json`: 10 shots, 105 anchors, each snapped to a downbeat, beat, or the exact onset the visual must hit, plus per-shot downbeats, rolls, hard stops, energy mix, the phrase grid and the snapshot seam list.
- Fonts on disk, real WOFF2, not LFS pointers: `fonts/Inter-400-latin.woff2`, `fonts/Inter-700-latin.woff2`, `fonts/newsreader-latin.woff2`, `fonts/azeret-mono-latin.woff2`.
- `renders/.gitkeep` so the output folder exists.

Not done, yours at Gate 0 (first commit of the build):

1. **Fonts.** Every v2 composition declares `@font-face{font-family:'Inter var';…src:local('Helvetica Neue')}` — a stand-in that never loaded Inter. New compositions use the block in §3.6 verbatim. Grep for `Helvetica Neue` before Gate C; zero hits.
2. **Duration.** `meta.json` `duration` → `119.699`; master `#air-root data-duration="119.699"`; sky, grade and bgm clips → `data-duration="119.699"`; bgm automation → `[{t:0,v:0},{t:0.2,v:1},{t:114.5,v:1},{t:119.4,v:0}]` (`data-volume="0.9"` stays).
3. **Master.** Rewrite `index.html` tracks to the v3 layout in §4. Remove `#ink-transitions` (v3 has no ink wipes; every seam is a motion match through the phone or a hard cut on a downbeat). Keep `#music-bloom` but drive it from the kick list in §3.9.
4. **v2 compositions.** Leave them in place until each v3 shot passes Gate C, then `git rm` them (history keeps v2). Never leave an unreferenced composition in `compositions/` at Gate D — lint scans the folder.
5. **CLI probe.** `npx hyperframes@latest upgrade --project . --check` once, before the first render-affecting command. If it reports the pin behind, apply, run `npm run check`, and name old → new version in your summary; if the check fails, revert and stay on 0.8.22.

---

## 1. North star

One sentence: **air is the agent you already know how to use, because it lives in your Messages** — a number you text like a friend, an inbox that works around the clock, a computer that remembers, and a row of mini-apps you summon with a slash and can build yourself in the same thread.

What the film must make a viewer feel, in order: quiet (night sky, a familiar notification sound-image), recognition (it's iMessage, I know this), speed (the drop; nouns land), delight (mini-apps pop out of a slash command), agency (`/create` builds a real app while you watch), calm (yours, private), and finish (the WZRD lockup from the brand film).

Three rules that override everything else in this document:

- **One primary mechanism per beat.** A downbeat gets a card landing *or* a giant word *or* a sky step. Never two.
- **The phone never lies.** Every screen is live DOM built to the iMessage spec in §3.5 with real product copy from §5–§6. No screenshots, no lorem, no invented claims: product lines come from `STORYBOARD.md` (approved v2 copy), `docs/goal-miniapps-v9.md`, `docs/goal-create-v12.md` §0, `docs/commerce-zaps.md` and the hero on `apps/web/app/page.tsx`.
- **Spectral colour is scarce.** Prism/chrome/iridescence appears exactly four times: the sunrise crest (24.358), the `/trade` fill (61.301), the `/create` Approve (87.957) and the WZRD lockup (108.669). Everything else is cream ink, atmospheric blue, iMessage blue and one green.

---

## 2. Music spine

`vstar` at 152 BPM: beat 0.3947 s, bar 1.5789 s, phrase = 4 bars ≈ 6.3 s. Downbeat phase 0. Phrase starts (also the shot seams unless noted): 2.415, 8.707, 14.721, 20.875, 27.074, 33.344, 39.590, 45.813, 52.059, 58.259, 64.412, 70.682, 76.974, 83.244, 89.536, 95.829, 102.168, 108.669, end 119.699.

Energy arc (from `audiomap.json` energy phases and key moments):

| Window | Character | Film use |
| --- | --- | --- |
| 0 – 2.4 | void | black → stars |
| 2.4 – 10.1 | sparse kicks, hihat fills, VOID gaps at 4–6 and 7–10 | one sky step per downbeat; four accented hits 8.173 / 8.661 / 9.149 / 9.636 |
| 10.170 | SURGE +0.75 | banners collapse → phone |
| 10 – 24 | HIGH with LOW pockets, sustained hihat fills | the thread; words on downbeats |
| 24.358 → 25.496 | crash → snare 0.68 → kick 0.52 (the slam) | sunrise crest, then the single word, then nouns |
| 25 – 104 | sustained HIGH/MEDIUM; peaks 36–40, 55–57, 63–67, 84–90, 99–100 | product body |
| 86 / 90 / 100 | DROPs (−0.52 / −0.54 / −0.53) | breath before Approve; the "yours" section; the turntable |
| 104.606 – 105.535 | hard stop (VOID) | TOTAL FREEZE |
| 105.535 – 109 | final rise, kicks 106.812 / 107.950 | lockup build |
| 109 | DROP −0.58 | lockup lands, nothing else moves |
| 115 – 119.7 | silence | fade to black |

Structural map (all seams are downbeats; durations in seconds and bars):

| # | Composition id | Start | End | Dur | Bars | Beat of the film |
| --- | --- | ---: | ---: | ---: | ---: | --- |
| S01 | `shot-01-cold-open` | 0.000 | 10.170 | 10.17 | 6.4 | night sky, WZRD mark, four notifications |
| S02 | `shot-02-imessage-thread` | 10.170 | 24.358 | 14.19 | 9.0 | the thread: text it like a friend |
| S03 | `shot-03-endowments` | 24.358 | 33.344 | 8.99 | 5.7 | the drop: "air", then five nouns |
| S04 | `shot-04-hyperpersonal` | 33.344 | 39.590 | 6.25 | 4.0 | it already knows you (Onairos orbit) |
| S05 | `shot-05-connect-apps` | 39.590 | 45.813 | 6.22 | 3.9 | 1000+ apps ring → phone |
| S06 | `shot-06-mini-apps` | 45.813 | 70.682 | 24.87 | 15.8 | `/home /shop /trade /zap` |
| S07 | `shot-07-create` | 70.682 | 89.536 | 18.85 | 11.9 | `/create` end to end |
| S08 | `shot-08-yours` | 89.536 | 95.829 | 6.29 | 4.0 | yours · private · always on |
| S09 | `shot-09-finale-montage` | 95.829 | 102.168 | 6.34 | 4.0 | four hard cuts and a turntable |
| S10 | `shot-10-end-card` | 102.168 | 119.699 | 17.53 | 11.1 | CTA, URL, FREEZE, WZRD lockup, black |

Sync rules (apply everywhere):

- A visual **attack** lands 1 frame (33 ms) *before* its audio transient; a **settle** (ease-out tail) may run past it. Never late.
- **Card lands / word lands** → downbeat. **Tap / press** → the kick named in the cut sheet. **Typing dots, counters, icon grids** → ride the hihat roll named in the cut sheet (one increment per hit; rolls carry 8–12 hits).
- **Hard stop** (104.606 → 105.535): every timeline plateaus (no tween is mid-flight), the grade dims 8 %, the sky holds. Release on the kick at 105.535, not the grid downbeat at 105.488.
- **DROPs** at 86, 90, 100 are breaths: pull the camera 1 % back, drop caption opacity to 0.6, nothing new enters for one beat.
- Verify the crash by ear in Studio: scrub 24.30–24.40 and nudge the S03 start ±1 frame if the cymbal attack is audibly at 24.311 rather than the 24.358 grid beat on your speakers; the cut sheet keeps 24.358.

---

## 3. Shared systems

### 3.1 Stage and grade (carry from v2)

Opaque ground `#050810` on `#air-root`; nothing ever shows the compositor's white. `#grade` on the top track: vignette (radial, 0.35 at corners) plus fixed-seed SVG turbulence grain at 0.06 opacity, seeded, no time-based animation. Add one v3 lane to the grade: `--freeze-dim`, tweened 0 → 0.08 at 104.606 (0.05 s) and back to 0 at 105.535 (0.15 s).

### 3.2 Sky (`compositions/sky.html`, track 0, 0 → 119.699)

Keep the v2 WebGL fBm cloud shader and Canvas-2D fallback; keep `uTime`/`uProgress` proxied through a `{t,p}` object tweened on the sky timeline (seek-safe). **Reverse the direction**: v3 goes night → blue hour → sunrise → day, exactly the brand film's arc.

`uProgress` keyframes (0 = starfield night, 0.5 = sun cresting, 1 = bright cumulus noon):

| t | p | ease | why |
| ---: | ---: | --- | --- |
| 0.000 | 0.00 | — | black with stars fading up 0.6 s |
| 2.415 | 0.05 | expo.out 0.4 | mark up |
| 3.947 / 5.433 / 7.105 | +0.04 each | expo.out 0.35 | one stop per downbeat (the four cold-open kicks) |
| 10.170 | 0.22 | power4.out 0.6 | SURGE |
| 24.000 | 0.32 | linear climb | blue hour |
| 24.358 → 24.60 | 0.55 | expo.out | **sunrise crest = the crash**. Add a horizon bloom uniform `uCrest` 0 → 1 → 0.3 over 24.358–26.0 |
| 70.682 | 0.80 | linear climb | morning → day under S03–S06 |
| 102.168 | 0.95 | linear climb | full day under S07–S09 |
| 108.669 | 1.00 | power2.out 1.2 | lockup on the brightest sky |
| 115.0 → 119.699 | hold | — | fade handled by a black overlay in S10, not by the sky |

Star layer: 220 fixed-seed points (mulberry32 seed 7) drawn in the same canvas, opacity `1 − smoothstep(0.05, 0.3, p)`. Sun disc: only when `0.45 < p < 0.75`, cresting at the horizon line y = 62 %. Cloud density rises with p; warm tint peaks at p ≈ 0.55 then cools to white.

Photographic option (P1): four fal plates from §8 as `<img>` layers cross-faded on the same keyframes, with the shader on top at 0.35 opacity for motion. Use the plates only if a side-by-side snapshot at 24.6 and 108.669 reads better than shader-only; do not ship both at full strength.

### 3.3 Parallax depth stack

Every shot tweens one camera proxy `cam = {x: 0, y: 0, z: 0}` on its own timeline. Layers translate against it by depth (percent of stage width per unit of `cam.x`):

| layer | depth | notes |
| --- | ---: | --- |
| sky (master track 0) | −1.0 | compositions cannot share a proxy, so `sky.html` carries its own mirror of every shot's camera drift and −230 px exit at the seam times in §4 (a small table of `{t, x}` pairs copied from the cut sheet) |
| giant type (Newsreader) | 0.0 | the anchor plane; giant words do not parallax, the world moves around them |
| phone | +1.0 | |
| captions / mono lines | +1.5 | closest plane |
| grade | 0 | never moves |

Camera vector = the shot's exit vector: −230 px leftward over the last 0.35 s (power4.in), matching v2's doctrine so the next shot's entrance (expo.out from +230 px) reads as continuous. Inside a shot, camera drift is ≤ 1.5 % over the shot's length, linear, and pauses on DROPs. Base component: `caption-parallax-layers` (ADOPT) for the caption plane; the phone and giant type are hand-authored on the same proxy.

### 3.4 The phone (`compositions/components/air-phone.html`, shared include)

A DOM/CSS iPhone, not a screenshot and not a 3D model (the GLTF `vfx-iphone-device` is P2 for the 100.589 turntable only, and needs the canvas-draw-element flag on render; budget WebGL against the sky before adopting it).

- Frame: 402 × 874 CSS px at scale 1 (fills 81 % of stage height at scale 1.0; S02 uses 0.92, S06/S07 use 1.0, montage cuts use 1.12). Squircle corners via the "Apple's corners" mask in COMPONENTS (SVG superellipse, not `border-radius`). Titanium rim 2 px, `linear-gradient(160deg, #3a3f4a, #0f1218)`. Dynamic Island 126 × 37 px. Glass: `backdrop-filter: blur(24px) saturate(1.2)` on the frame's shadow catcher only.
- Tilt: parent `perspective: 1800px`; resting pose `rotateY(-9deg) rotateX(4deg)`; every card landing adds a 1.2° `rotateX` kick that eases back over 0.6 s (holo tilt, see COMPONENTS "Holo").
- Screen: `.phone-screen` `overflow: hidden`, iOS dark Messages: bg `#000`, nav bar 88 px with the contact "air" and the blue orb avatar (`logos/air-brand.png`, 52 px, circle), thread scrolls by translating a `.thread` column (tweened, never `scrollTop`).
- Back face (S07 84.822 flip): `.phone-back` with `backface-visibility: hidden`, shows the running app (a dark "October tour" landing page: title in Newsreader, a countdown in Azeret Mono ticking on the beat, a "Tickets" button). Flip = `rotateY 180deg`, 0.7 s, expo.inOut, phone scale 1.0 → 1.06 → 1.0.

### 3.5 iMessage language (exact)

| element | spec |
| --- | --- |
| sent bubble | `#0A84FF` bg, white 17 px Inter, radius 20 px with the tail on the right, max-width 78 % |
| received bubble | `rgba(255,255,255,0.14)` bg, cream `#F4EFE6` text, tail left |
| send pop | scale 0.86 → 1.0, `back.out(1.4)` 0.32 s — the **only** overshoot allowed in the film, because iMessage does it |
| typing indicator | three 8 px dots in a received bubble; dot lift 3 px, one dot per hihat hit of the named roll, deterministic (hit times from `audiomap.json`) |
| owner-only mini-app card | received rich card: 12 px inset panel `rgba(255,255,255,0.08)`, 1 px `rgba(255,255,255,0.12)` border, squircle, header row (icon 36 px + title 15/600 + subtitle 13 mono), body, action row |
| decision card | mini-app card with two buttons: **Approve** (`#30D158` fill, black text) and **Edit** (ghost). Tap = 0.9 scale for 2 frames, then the card flips (rotateX 90 → 0, 0.45 s) to its resolved state with a green check |
| system line | centred 12 px mono `rgba(244,239,230,0.55)` — used for "remembered:" memory chips and delivery states |
| notification banner (S01) | iOS banner 366 × 78 px, glass, app icon = orb, title "air", body in 15 px, "now" |
| card **landing** | `y: +28 → 0, opacity 0 → 1, rotateX 12 → 0`, expo.out 0.55 s |
| bubble **exit** | thread column translates up by the incoming height, power3.out 0.45 s, no fades |

Owner-only rule from `apps/web/lib/miniapps/imessageCommand.ts`: mini-app cards render only in the owner's thread. The film shows one owner. Never show a card in a second person's thread.

### 3.6 Typography

```css
@font-face{font-family:'Inter';font-weight:400;font-display:block;src:url('../fonts/Inter-400-latin.woff2') format('woff2')}
@font-face{font-family:'Inter';font-weight:700;font-display:block;src:url('../fonts/Inter-700-latin.woff2') format('woff2')}
@font-face{font-family:'Newsreader';font-weight:200 800;font-style:normal;font-display:block;src:url('../fonts/newsreader-latin.woff2') format('woff2')}
@font-face{font-family:'Azeret Mono';font-weight:100 900;font-display:block;src:url('../fonts/azeret-mono-latin.woff2') format('woff2')}
```

Paths are relative to `compositions/`. Wait for `document.fonts.ready` before building the timeline (v2 already does this; keep it).

| role | face | size / weight / tracking | colour |
| --- | --- | --- | --- |
| giant parallax words | Newsreader 300, optical size high | 260–320 px, tracking −0.035 em, line-height 0.86 | cream `#F4EFE6` at 0.92; in S06 the giant word is the slash command in Azeret Mono 200 px at 0.38 |
| section captions | Newsreader 400 | 56 px | cream |
| mono captions / URLs / system lines | Azeret Mono 400 | 22 px, tracking 0.02 em, uppercase off | `rgba(244,239,230,0.7)` |
| phone UI | Inter 400/700 | iOS scale (17 body, 15 card, 13 sub, 12 system) | white / cream |
| end-card CTA | Newsreader 300 | 148 px | cream |

Text entrances: `split-text` per word (ADOPT) with `y: 0.6em → 0, opacity, rotateX 24 → 0`, stagger 0.04, expo.out 0.7. Giant words exit by the camera vector, not by fading.

### 3.7 Colour

`--ground #050810 · --ink #F4EFE6 · --ink-dim rgba(244,239,230,.62) · --imsg #0A84FF · --ok #30D158 · --glass rgba(255,255,255,.08) · --line rgba(255,255,255,.12)`. Sky palette lives in the shader (night `#06091A` → blue hour `#1B2A5B` → crest `#F2A65A` over `#6C8CD5` → day `#8FB7EA` with white cumulus). Spectral: a 6-stop conic gradient (`#ffd6a5, #fdffb6, #caffbf, #9bf6ff, #bdb2ff, #ffc6ff`) used only at the four moments in §1, as a 1 px rim light or a 0.35 s sweep. No cyan/purple "AI" glows anywhere.

### 3.8 Motion doctrine (carry from v2, with two v3 additions)

- Entrances `expo.out` 0.55–0.7 s; exits `power4.in` 0.35 s along −230 px; cards enter with `rotateX 12°`; no `linear` on visible motion except counters and camera drift; no bounce except the iMessage send pop.
- **v3 addition — the freeze**: at 104.606 no tween may be mid-flight in any composition; schedule the last tween before it to end ≤ 104.55 and the first after it to start ≥ 105.535.
- **v3 addition — one morph per section entrance**: S01→S02 (banners → bubble → phone), S05→S06 (ring → `/home` card), S09→S10 (turntable → end card) are `modal-morph` style FLIP transforms, never crossfades.

### 3.9 Music bloom (master `#music-bloom`, track 0 above the sky)

A 1920 × 1080 radial light at the sun position, opacity pulses `0.10 → 0` over 0.28 s on every kick with energy ≥ 0.5 in `audiomap.json` (there are ~40). Precompute the list into the master timeline at build; no audio analysis at runtime. Suppress inside 104.606–105.535 and after 111.3.

---

## 4. Master layout (`index.html`)

| track | clip id | src | start | duration |
| ---: | --- | --- | ---: | ---: |
| 0 | `sky` | `compositions/sky.html` | 0 | 119.699 |
| 0 | `music-bloom` | inline | 0 | 119.699 |
| 1 | `shot-01` | `compositions/shot-01-cold-open.html` | 0 | 10.170 |
| 2 | `shot-02` | `compositions/shot-02-imessage-thread.html` | 10.170 | 14.188 |
| 3 | `shot-03` | `compositions/shot-03-endowments.html` | 24.358 | 8.986 |
| 4 | `shot-04` | `compositions/shot-04-hyperpersonal.html` | 33.344 | 6.246 |
| 5 | `shot-05` | `compositions/shot-05-connect-apps.html` | 39.590 | 6.223 |
| 6 | `shot-06` | `compositions/shot-06-mini-apps.html` | 45.813 | 24.869 |
| 7 | `shot-07` | `compositions/shot-07-create.html` | 70.682 | 18.854 |
| 8 | `shot-08` | `compositions/shot-08-yours.html` | 89.536 | 6.293 |
| 9 | `shot-09` | `compositions/shot-09-finale-montage.html` | 95.829 | 6.339 |
| 10 | `shot-10` | `compositions/shot-10-end-card.html` | 102.168 | 17.531 |
| 11 | `bgm` | `assets/bgm.mp3` | 0 | 119.699 |
| 12 | `grade` | inline | 0 | 119.699 |

Shots do not overlap; each shot owns its entrance from `+230 px` and its exit to `−230 px`, so a seam is a hard cut that reads as a continuous move. Where the phone persists across a seam (S05→S06, S06→S07) the outgoing shot leaves the phone at rest at the exact pose the incoming shot starts from (pose table in §5) — snapshot both sides of the seam at Gate D and diff.

Root timeline: `window.__timelines["master"]` drives the bloom and the grade freeze-dim only.

---

## 5. Shot-by-shot spec

Each shot: composition template pattern from `compositions/shot-01-open.html` (a `<template id="…-template">` wrapping `<div id="sNN-root" data-composition-id="…" data-width="1920" data-height="1080" data-duration="…">`, one paused GSAP timeline registered under `window.__timelines[id]`, `?t=` seek and `?dev=1` play for local checks). Times below are absolute film times; the cut sheet gives each anchor's `rel` offset for the composition timeline.

### S01 · `shot-01-cold-open` · 0.000 → 10.170

Intent: the brand film's first ten seconds, then the product interrupts it.

| t | event | mechanism |
| ---: | --- | --- |
| 0.000 | black; stars fade up by 0.6 | sky |
| 2.415 | `logos/wzrdtech-chrome.png` mark rises from y +40 to centre, 0.9 s expo.out, scale 0.62 (the film's framing) | one element |
| 3.947 / 5.433 / 7.105 | sky steps (§3.2); the mark's chrome picks up the new key light (a `mask` sweep 0.3 s, "chromatic glow" ADAPT) | sky + rim only |
| 8.173 | banner 1 slides down from y −120, expo.out 0.45: **air** · "your 9am moved to 10 — i told Sam." | banner |
| 8.661 | banner 2 stacks under it: **air** · "invoice #218 paid · $1,200" | banner |
| 9.149 | banner 3: **air** · "shop: 3 new orders overnight" | banner |
| 9.636 | banner 4: **air** · "want me to book Friday?" | banner |
| 10.170 | SURGE: the four banners FLIP into one `#0A84FF` bubble (modal-morph, 0.4 s) which scales into the phone frame as S02 opens; the mark drops out along −230 px | morph |

Copy is illustrative of approved capabilities (calendar, invoices/pay, shop, scheduling); keep amounts modest and names first-name only.

Proof frames: 2.9, 7.2, 9.7, 10.15.

### S02 · `shot-02-imessage-thread` · 10.170 → 24.358

Intent: "A number — text it like a friend — it answers on iMessage." Layout: phone right of centre (x +260, scale 0.92, resting tilt), giant Newsreader words on the left plane, mono captions bottom-left.

| t | thread | words / captions |
| ---: | --- | --- |
| 10.170 | bubble finishes morphing into the phone (0.45 s) | |
| 10.519 | **sent**: "dinner fri 8pm at the usual spot. tell Sam." (send pop) | |
| 11.587 → 13.1 | typing dots ride the sustained hihat fill (9.543–13.259) | |
| 13.189 | **recv**: "on it." | giant **TEXT IT** lands |
| 14.721 | **recv card** (mail glyph `logos/glyph-mail.svg`): "Reservation request · sent from your inbox" | mono: "its own email address, working around the clock." |
| 16.277 | **recv card** (calendar glyph): "Held · Fri 8:00 pm · table for 2" | giant **LIKE A** lands (kick 0.59 under it) |
| 17.786 | **decision card**: "Text Sam? — 'dinner fri 8pm, usual spot. see you there.'" · Approve / Edit; settles 18.158 | |
| 19.319 | | giant **FRIEND.** lands |
| 21.223 | Approve tap (hihat onset) → card flips to "Sent to Sam ✓" | |
| 22.430 | system line: "remembered: Sam · Fridays · the usual spot" | mono: "a real machine that remembers everything for you." |
| 24.358 | **crash**: phone slams toward camera (scale 0.92 → 2.4, rotate to flat, 0.25 s power4.in); the screen's black fills the frame 1 frame before S03's white crest | slam |

Proof frames: 13.25, 17.85, 21.3, 24.33.

### S03 · `shot-03-endowments` · 24.358 → 33.344

Intent: the drop. One word, then five nouns. The sky crests behind.

| t | event |
| ---: | --- |
| 24.358 | open on the sunrise crest (sky) with a 2-frame near-white `#F7EFE2` flash at 0.85 → 0 over 0.3 s |
| 24.40 → 25.30 | the word **air** (Newsreader 300, 420 px) fades in with the "fade motion" treatment (letter opacity noise, seeded), no movement |
| 25.310 | snare: "air" snaps to the top-left corner at 64 px (FLIP, 0.25 s) |
| 25.496 | kick: **a phone.** lands with `glyph-phone` · subline "text it like a friend — it answers on iMessage." |
| 27.074 | **an email.** · `glyph-mail` · subline "its own email address, working around the clock." |
| 28.630 | **a wallet.** · `glyph-wallet` · no subline |
| 30.209 | **an encrypted key vault.** · `glyph-vault` · no subline |
| 31.742 | **a composable computer.** · `glyph-computer` · subline "a real machine that remembers everything for you." |
| 33.344 | exit along −230 px |

Each noun: 148 px Newsreader. The five nouns are the approved v2 sentence from `STORYBOARD.md` shot 03 ("Your agent gets a phone, an email, a wallet, an encrypted key vault, and a custom composable computer.") cut into five lands; the three mono sublines (22 px) are the hero lines from `apps/web/app/page.tsx`. Wallet and key vault have no approved one-liner, so they land bare. **Do not write new sublines.** Nouns stack leftward: each new noun enters at centre and pushes the previous one 230 px left and 12 % smaller (a horizontal stack, three visible at once). The kick roll 29.373–30.441 and fill 30.674–31.231 pulse the glyph stroke width (svg-stroke-trace ADAPT: dashoffset draws each glyph over 0.35 s on its downbeat).

Proof frames: 24.42, 25.55, 30.25, 33.30.

### S04 · `shot-04-hyperpersonal` · 33.344 → 39.590

Intent: it already knows you. Reuse the approved copy of v2 `shot-04-hyperpersonalization` (Onairos import). Mechanism: `carousel-orbit-4` translated to linear time.

- 33.344 persona chip (`logos/onairos-avatar.png` + "Onairos persona") lands centre; caption "hyperpersonalization." (Newsreader 56; the approved v2 heading). "it already knows you." is a proposed alternative listed in §6 and needs sign-off before use.
- Orbit of 8 taste tiles (Spotify, Strava, Netflix, Calendar, Notion, YouTube, Duolingo, Peloton from `logos/`) at radius 380 px, one slot rotation (45°) per downbeat 34.900 / 36.479 / 38.058, expo.out 0.5, tile facing camera scales 1.18.
- 39.590 hand-off flash (hihat 0.57): the orbit collapses to a 1 px ring (0.25 s) that S05 inherits.

Proof frames: 33.9, 36.6, 39.55.

### S05 · `shot-05-connect-apps` · 39.590 → 45.813

Intent: 1000+ apps (approved v2 claim, Composio). Mechanism: `carousel-vision-3` ring + `count-up`.

- 39.590 ring (24 partner logos from `logos/`) blooms from the inherited 1 px ring to radius 420 px, expo.out 0.6.
- 39.962 counter starts, Azeret Mono 220 px: `0` → `1000+`, ease `power2.out` over 4.3 s, landing exactly at 44.257; a ring slot advance on 41.146 / 42.701.
- 44.257 counter lands; ring stops; caption "connect your apps — across 1000+ apps." (Newsreader 56; approved v2 shot 06 wording) lands under it.
- 45.813 the ring FLIPs into the `/home` launcher card inside the phone that S06 owns (S05 ends with the ring at the phone's screen centre, scale 0.3; S06 starts with the card at the same rect — pose hand-off, snapshot both sides).

Proof frames: 40.2, 44.3, 45.78.

### S06 · `shot-06-mini-apps` · 45.813 → 70.682 — **required section**

Intent: four slash commands, four owner-only cards, one phone that never cuts. Layout: phone centre-left (x −180, scale 1.0), giant slash command in Azeret Mono on the right plane at 0.38 opacity, mono explainer bottom-right. Typing uses `notes-typing` cadence (per-character reveal, 28–36 ms per char, deterministic), always finishing on the send downbeat.

| t | thread | right plane |
| ---: | --- | --- |
| 45.813 | **sent** `/home` | giant `/home` |
| 47.090 → 48.669 | Home card lands 47.345 ("your apps"), then the clay icon grid pops one icon per hihat hit of the sustained fill: `home, shop, pay, inbox, calendar, vault, computer, image, video, persona` from `apps/web/public/app-icons/wabi-v1/` (copy the ten PNGs into `assets/icons/`) | mono: "your first-party apps, one text away." |
| 50.480 | settle; card scrolls up | |
| 52.059 | **sent** `/shop` | giant `/shop` |
| 53.615 | Shop card: product art (fal §8) + "October tour tee · $35 · staged" · sub "Needs you" · Approve / Edit | mono: "a storefront on Stripe. you approve every listing." |
| 55.147 | Approve tap → 55.519 flips to "Live · mini.wzrd.tech/gratitude-shop" | |
| 56.703 | kick 0.59: toast bubble "1 order · $35" | |
| 58.259 | **sent** `/trade` | giant `/trade` |
| 59.791 | Trade ticket: "Buy 0.05 BTC · paper · balance $10,000 · preview" · Approve / Edit; holo tilt on the card | mono: "every order previewed. you approve. paper mode first." |
| 61.068 | Approve tap (kick) → 61.301 "Filled · paper" with the spectral 1 px rim (moment 2 of 4) | |
| 62.880 | settle | |
| 64.412 | **sent** `/zap the orb rising over clouds, 6s` | giant `/zap` |
| 65.991 | **recv** "on it — about 40s." | mono: "video, images, animation — creative lanes in the thread." |
| 66.757 → 67.524 | progress: a halftone dot field fills left→right riding the accel roll 66.804–67.268 (`halftone-field` ADAPT, 12 × 5 dots, one column per hit) | |
| 67.524 | result card: 6 s clip (fal §8; fallback = pan across the day sky plate) autoplays muted inside the card via `data-*` media timing | |
| 69.103 | settle; caption "mini-apps. make your own." (Newsreader 56) lands bottom-right and stays through the seam | |
| 70.682 | phone holds pose; S07 takes over | |

Product facts to respect (from `docs/goal-miniapps-v9.md`, `docs/commerce-zaps.md`): `/shop` listings are staged and approved in "Needs you" and the public storefront is `mini.wzrd.tech/<username>-shop`; `/trade` is Coinbase Advanced Trade, paper mode with $10,000, every order previewed, a 5-minute signed token, owner taps Approve; `/zap` is the creative video lane beside `/imagine` and `/animate`; `/home` lists published first-party apps. Never show a live-money trade.

Proof frames: 47.4, 48.6, 55.6, 61.35, 67.6, 69.2.

### S07 · `shot-07-create` · 70.682 → 89.536 — **required section**

Intent: the `/create` conversation from `docs/goal-create-v12.md` §0, compressed to 19 s. Same phone pose as S06 (no cut). Giant `/create` on the right plane at 70.682; the mono explainer reads "describe it. approve the plan. it ships." The film compresses the transcript by skipping the name/description/icon exchange; keep every other line in the same words.

| t | thread |
| ---: | --- |
| 70.682 → 72.214 | typing (notes-typing): `/create a landing page for my October tour with a ticket link and a countdown`; **sent** on 72.214 |
| 73.770 | **recv** "got it — 2 quick questions before I plan this:" + "1. landing page or product page with a store?" |
| 75.349 | **recv** "2. dark and cinematic, or bright and simple?" |
| 76.185 | **sent** "landing page. dark. tickets are on dice.fm/xyz" |
| 76.974 | **recv** attachment `tour-plan.md` + "here's the plan for 'October tour' → link.wzrd.tech/gratitude/tour when it's ready. reply yes to build." |
| 78.530 | **sent** "make the countdown the hero. yes." |
| 78.530 → 82.477 | **recv** "Creating your app …" + progress card "October tour · building · 10 %" counting to 100 % (count-up, power1.inOut), a 4-step stepper checking plan / scaffold / build / deploy on 80.109 / 81.688 / 82.477 (stepper ADAPT). The card updates in place, never re-sends |
| 83.244 | **recv** "dev build is live: link.wzrd.tech/gratitude/tour — share it with anyone. say ship it when you want it in production." |
| 84.822 | **phone flips** (§3.4) to its back face: the October tour page, countdown ticking on the beat; giant **YOUR OWN.** lands on the right plane |
| 85.983 | phone flips back |
| 86.378 | **sent** "confirmed, let's ship it" (DROP at 86 — nothing else moves for a beat) |
| 86.936 | kick 0.65: **decision card** "Publish October tour → mini.wzrd.tech/gratitude/tour · public · App Store · source → wzrd-create" · Approve / Edit |
| 87.957 | Approve tap → flips to "live: mini.wzrd.tech/gratitude/tour · listed in the App Store" with the spectral rim (moment 3 of 4) |
| 89.536 | system line "source: github.com/gratitude5dee/wzrd-create/apps/gratitude/tour" lands as S08 begins to pull the camera back |

Proof frames: 72.3, 77.0, 82.5, 85.2, 88.0, 89.5.

### S08 · `shot-08-yours` · 89.536 → 95.829

Intent: the breath. DROP at 90. Copy is the approved v2 `shot-11-yours` line and the `shot-12-guardian` kicker, unchanged. The phone recedes to scale 0.55 at x +520, tilt 18°, over 1.2 s; the sky dominates.

- The approved sentence "Your agent, your RL environment, your model, your weights." lands as three split-text groups on the downbeats: 91.092 **Your agent,** · 92.671 **your RL environment, your model,** · 94.273 **your weights.** — Newsreader 148 px, each group lands centre-left and the previous dims to 0.35 with a 2 px blur, never removed.
- 95.039 (beat): kicker "air, your guardian angel" in Azeret Mono 22 px under the sentence (approved v2 shot 12 line).
- Three thin glass cards float at +1.5 depth around the small phone, one per downbeat after the word: the stage captions approved for v2 shot 10 (per-person sandbox · agent mesh · zero data retention), copied verbatim from `compositions/shot-10-guardian-angel.html` before that file is removed. No new backend claims.
- 95.829 hard cut.

Proof frames: 91.2, 94.4, 95.8.

### S09 · `shot-09-finale-montage` · 95.829 → 102.168

Intent: four hard cuts on downbeats, then a spin. Each cut is a full-frame re-pose of the same phone with the thread scrolled to that section's best frame (S02 at 21.3, S06 at 61.35, S07 at 88.0). No transitions between cuts; cut = the phone is already at rest in the new pose.

- 95.829 cut 1: the thread (scale 1.12, tilt −14°).
- 97.408 cut 2: mini-apps (`/trade` filled; scale 1.12, tilt +14°).
- 98.987 cut 3: `/create` live (scale 1.12, flat).
- 99.869 snare fill: 0.1 s push-in.
- 100.589 cut 4 (DROP): **turntable** — the phone spins `rotateY 0 → 360` over 1.579 s, `power2.inOut`, scale 0.9, back face showing the October tour page mid-spin. P2: swap for the GLTF `vfx-iphone-device` if the WebGL budget allows; default is the CSS phone.
- 102.168 the spin resolves with the phone facing camera at scale 0.42, bottom-right, which is S10's opening pose.

Proof frames: 95.9, 97.5, 101.2, 102.15.

### S10 · `shot-10-end-card` · 102.168 → 119.699

Intent: `cta-close`, then the brand film's last frame. Sky at its brightest.

| t | event |
| ---: | --- |
| 102.168 | **Text your agent.** (Newsreader 148 px) lands centre-left; small phone at rest bottom-right. This is a NEW line (see §6); the approved fallback is v2's "Get your air today." |
| 103.770 | `air.wzrd.tech` (Azeret Mono 44 px) lands under it with a 1 px underline drawing left→right 0.4 s |
| 104.606 | **TOTAL FREEZE** (hard stop): nothing moves; grade dims 8 % |
| 105.535 | release on the kick: CTA and phone exit upward 120 px (power4.in 0.3 s); the chrome WZRD.tech mark rises from y +160 to centre, expo.out 0.9, scale 0.62 |
| 106.812 | kick: partner wall row 1 (8 logos, `logos/`) rises under the mark, 0.4 s |
| 107.950 | hihat 0.74: row 2 rises |
| 108.669 | **lockup**: "air by" resolves above the mark exactly as in `airintrofin.mp4` (Newsreader 300, 64 px, tracking 0.12 em, cream); spectral sweep across the chrome once, 0.35 s (moment 4 of 4). DROP at 109 — nothing new after this |
| 111.293 | perc 0.62: last logo tile settles (a 1 px line completes under the wall) |
| 113.755 | perc: the frame is still |
| 115.000 → 119.699 | black overlay 0 → 1, power2.in; audio is already silent |

Proof frames: 103.9, 104.9 (frozen), 105.9, 108.8, 113.9, 119.6.

---

## 6. Copy sources and the claims wall

Every product sentence in the film must trace to one of: `STORYBOARD.md` (v2 approved copy), `apps/web/app/page.tsx` hero ("A number — Text it like a friend — it answers on iMessage." / "An inbox — Its own email address, working around the clock." / "A computer — A real machine that remembers everything for you."), `docs/goal-miniapps-v9.md`, `docs/goal-create-v12.md` §0, `docs/commerce-zaps.md`. Thread lines that are scenario (the dinner, the tee, the BTC preview) must stay plausible, modest and paper/dev-mode where money or trading is shown. Before Gate E, produce `v3/CLAIMS.md`: one row per on-screen sentence → source path. Anything without a source is cut, not paraphrased.

Lines in this plan that are **new** (written for v3, not yet approved). Present them at Gate A as one list; each is used only if approved, else replaced by the fallback:

| line | where | fallback if not approved |
| --- | --- | --- |
| "Text your agent." | S10 102.168 | "Get your air today." (v2 shot 14) |
| "mini-apps. make your own." | S06 69.103 | "mini-apps." |
| "YOUR OWN." | S07 84.822 | "/create" stays on the plane |
| "your first-party apps, one text away." | S06 `/home` explainer | drop the explainer |
| "a storefront on Stripe. you approve every listing." | S06 `/shop` explainer | "staged listings. you approve." (from `docs/commerce-zaps.md` wording) |
| "every order previewed. you approve. paper mode first." | S06 `/trade` explainer | "paper mode. every order previewed." |
| "video, images, animation — creative lanes in the thread." | S06 `/zap` explainer | drop the explainer |
| "describe it. approve the plan. it ships." | S07 explainer | drop the explainer |
| "it already knows you." | S04 alternative caption | "hyperpersonalization." (approved) |
| the four S01 banner bodies | S01 8.173–9.636 | rewrite from approved capability lines only |

The giant words TEXT IT / LIKE A / FRIEND. are the hero line "Text it like a friend" and need no approval. Thread scenario lines (the dinner, the tee, the BTC paper preview, the October tour transcript) are scenario, not claims, and follow the product facts in §5.

---

## 7. Component dispositions (summary; full matrix in `v3/COMPONENTS-v3.md`)

ADOPT: `chat-thread`, `modal-morph`, `notes-typing`, `cta-close`, `caption-parallax-layers`, `carousel-orbit-4`, `carousel-vision-3`, `count-up`, `split-text`. ADAPT: Arlan Vault "The typer", "Fade motion", "Chromatic glow", "Liquid UI", "Apple's corners", "Holo", "Dia Browser's gradient", "Ghosty reveal"; HyperFrames `halftone-field`, `svg-stroke-trace`, `ios26-liquid-glass` (as CSS glass only), `vfx-iphone-device` (P2 turntable only); React Bits `stepper`, `glass-surface`, `count-up`, `split-text`, `shiny-text` (the chrome sweep). REFERENCE ONLY: `carousel-circle-1`, hyperframes-launches repo, the four X posts (unreachable from the build sandbox; a human reviewer supplies notes). REJECT: `stop-motion-cadence`, decrypted/scrambled/glitch text, electric and star borders, aurora/hyperspeed/particle backgrounds, any cyan-purple glow, ASCII and pixel-art effects, ransom-note type.

Install what is adopted with `npx hyperframes add <name>` (blocks → `compositions/`, components → `compositions/components/`), then translate to linear time per the interactive-to-linear contract in `REVIEW-PROMPT.md`: hover → downbeat, scroll → camera drift, click → the kick.

---

## 8. Generated media (fal)

The user approved fal image generation with the "openai sunburst" model. Resolve the exact endpoint id first: query the fal catalog (`anthropic-skills:fal-models-catalog`, terms `openai`, `sunburst`) and use the image endpoint it returns; if no such id exists, use the catalog's current best photoreal text-to-image endpoint and say which one you used in the delivery note. Generate via `fal-generate`; write outputs to `assets/gen/` with the names below; keep the prompt and seed in `assets/gen/MANIFEST.json`.

| file | size | prompt (append the brand tail to each) | rejection checks |
| --- | --- | --- | --- |
| `sky-night.png` | 3840×2160 | "night sky over a still sea of low clouds, deep indigo, sparse sharp stars, no moon, horizon at 62 %, ultra-clean, no grain" | any text, moon, lens flare, purple cast, horizon off ±3 % |
| `sky-bluehour.png` | 3840×2160 | "pre-dawn blue hour, layered cumulus lit from below the horizon, cobalt to pale gold, calm, horizon at 62 %" | oversaturated orange, sun disc visible |
| `sky-crest.png` | 3840×2160 | "the first second of sunrise, sun cresting a cloud sea, warm gold rim light, cool blue sky above, cinematic, horizon at 62 %" | sun above 58 % height, HDR halo, rainbow artefacts |
| `sky-day.png` | 3840×2160 | "bright noon cumulus time-lapse still, brilliant white clouds on a clear cerulean sky, high altitude, crisp" | grey haze, vignette baked in, birds/planes |
| `shop-tee.png` | 1024×1024 | "black cotton t-shirt flat lay on a cream linen background, small 'OCT' embroidered chest mark, soft daylight, product photo" | any legible brand, mannequins, hands |
| `zap-orb.mp4` (optional, P2) | 6 s, 1080×1080 | video endpoint from the same catalog: "a glossy blue glass orb rising slowly through a sea of sunlit clouds, camera locked, photoreal" | cuts, camera shake, text; fallback = pan across `sky-day.png` |

Brand tail for every prompt: "colour palette of atmospheric blue and cream, photographic, no typography, no logos, no people." The blue orb itself is never generated: use `logos/air-brand.png`.

---

## 9. Verification gates and proof frames

Run from `videos/air-launch/`. Flags per `/hyperframes-cli`; confirm with `--help` before first use.

| gate | command / action | pass condition |
| --- | --- | --- |
| 0 | §0 items 1–5; `npm run check` on the retimed master | check passes; zero `Helvetica Neue` hits |
| A/B | this plan + cut sheet are the treatment and board; a human approves before P1 starts | — |
| C | `npx --yes hyperframes@0.8.22 lint`, `npm run check` after each shot | clean; every composition registers `window.__timelines[id]` |
| D | `npx --yes hyperframes@0.8.22 check --snapshots`; `snapshot --at t` for every seam in `v3/cutsheet.json → snapshot_seams` (0, 10.17, 24.358, 33.344, 39.59, 45.813, 70.682, 89.536, 95.829, 102.168, 104.606, 105.535, 108.669, 115, 119.6, 119.699) and every proof frame listed in §5 | both sides of each seam match pose within 2 px; 104.9 and 105.4 are pixel-identical (freeze); 119.6 is black |
| E | preview with audio (`preview --background` then scrub); check every anchor in the cut sheet at 0.25× and 1×; `v3/CLAIMS.md` complete | attacks lead transients by ≤ 1 frame; no late lands; no claim without a source |
| F | full-film review against `REVIEW-PROMPT.md`; spectral count = 4; one mechanism per beat audit on the 40 loudest kicks | reviewer notes resolved or written down |
| G | `npm run render -- --quality high` → `renders/air-launch-v3.mp4`; probe duration 119.70 ± 0.05 s, 30 fps, audio present | file committed or published per the repo's convention (renders are large; publish and link if > 50 MB) |

Determinism audit before D: no `requestAnimationFrame` loops, no `Date`/`performance.now`, no unseeded `Math.random`, no CSS `animation` that is not driven by the timeline, no `<video>` outside HyperFrames media timing, all typing/counters/roll increments computed from `audiomap.json` times at build.

---

## 10. Render and delivery

1. `npm run render -- --quality high` (1920×1080, 30 fps). Output `renders/air-launch-v3.mp4`.
2. Three hero stills for the site, `npx … snapshot --at 18.158`, `61.301`, `89.536` → `renders/stills/` (P1; these are the "iPhone renders" for air.wzrd.tech).
3. P2 vertical cut: 1080×1920 master reusing the same compositions with `data-variable-values` for pose tables; not in scope for the first render.
4. Delivery note: versions (CLI old → new if bumped), fal endpoint used, deviations from this plan with timecodes, unresolved reviewer notes.

---

## 11. Build order

**P0 — the film exists (must ship):** Gate 0 → sky retime (§3.2) → phone component (§3.4–3.5) → S01, S02, S03 → S06, S07 → S10 → grade freeze lane, bloom, bgm automation → Gate C/D on those → temporary S04/S05/S08/S09 as caption-only holds (Newsreader caption on sky, correct durations) so the film is continuous → first full render for review.

**P1 — the film is right:** S04 orbit, S05 ring + counter, S08 cards, S09 montage + CSS turntable → parallax pass on every shot (§3.3) → fal plates A/B at 24.6 and 108.669 → `shop-tee.png` → hero stills → Gate E/F → second render.

**P2 — the film is rich:** GLTF turntable (`vfx-iphone-device`, canvas-draw-element flag, WebGL budget check against the sky), `zap-orb.mp4`, halftone progress polish, vertical cut.

Time budget guidance: P0 ≈ 60 % of effort, P1 ≈ 30 %, P2 ≈ 10 %. Do not start P1 until P0 has a full-length render that passes Gate D.

---

## 12. Exclusions and open items

- **X posts** (mvanhorn 2063624356484501832, Miguel07Code 2098527121702309905, HeyGen 2075262117964615956 and 2077438104982667282) could not be fetched from the build sandbox (proxy blocks X). They are style references only; a human reviewer adds notes at Gate A if any specific move should be lifted.
- **hyperframes-launches** (github.com/heygen-com/hyperframes-launches): only the README was reachable. Treat its conventions (one composition per beat, snapshots at seams, registry-first) as already folded into this plan.
- **"Air icon svg (attached)"** was not in the uploads. The film uses `logos/air.svg` (redraw) and `logos/air-brand.png` (the glossy orb). If the real icon arrives, drop it in as `logos/air-icon.svg` and swap the avatar and banner icon; nothing else changes.
- **fal endpoint id** for "openai sunburst" is unverified; §8 says how to resolve it.
- **Real phone number**: the hero says "a number". No number is shown; the CTA is the URL. If marketing supplies a public number, it goes under the URL at 103.770 in the same mono style.
- **Crash frame**: cut sheet keeps 24.358 (grid); §2 says how to verify by ear and nudge ±1 frame.

---

## 13. As built (v3.0, first full cut)

This section records what shipped against the plan above, so a reviewer reads the film and the
brief as one document. Everything not listed here was built as specified.

### Delivered

| Item | State |
| --- | --- |
| `index.html` | v3 master: 10 shot tracks, sky, sky scrim, music bloom, bgm with automation, grade with the freeze lane. Duration 119.699 s |
| `compositions/sky.html` | Night → blue hour → sunrise crest on the crash → noon on the lockup. The dawn ladder is a pure function of time (no overlapping property tweens), sampled by one driver tween; WebGL fBm with a Canvas-2D fallback on the same curve |
| `compositions/shot-01-cold-open.html` … `shot-10-end-card.html` | All ten shots, built to the anchors in `v3/cutsheet.json` |
| `assets/icons/` | The eleven clay mini-app icons the film shows, copied from `apps/web/public/app-icons/wabi-v1/` |
| `vendor/gsap.min.js` | GSAP 3.14.2, vendored (see below) |
| `renders/air-launch-v3.mp4` | 1920×1080, 30 fps, `--quality high` |

### Deviations, and why

1. **No fal-generated media.** `FAL_KEY` is not present in this environment, so the four sky
   plates, the `/shop` product shot and the optional `/zap` clip in §8 were not generated. The
   shader sky carries the film (it is the plan's default), the shop listing uses a drawn tee on a
   cream tile, and the `/zap` result is a built mini-sky with the brand orb rising through it —
   the plan's own fallback. §8 stands unchanged for whoever runs it with a key.
2. **GSAP is vendored, not a CDN script.** The render browser has no outbound network: every
   composition failed with `gsap is not defined` on the first check. GSAP 3.14.2 now lives at
   `vendor/gsap.min.js` and every composition loads it from there. Do not point these files back
   at jsDelivr.
3. **CLI pin bumped 0.8.22 → 0.8.48** via `upgrade --project .`, verified with `check` (passing).
4. **The phone's internal type is one notch above iOS-exact** (19 px bubbles, 17 px card titles).
   At 1080p with the phone at 86 % of frame height, true iOS metrics are unreadable.
5. **The iMessage bubble is `#0C72D8`, not `#0A84FF`.** Apple's dark-mode blue is 3.7:1 against
   white and fails the contrast gate at body size; one notch deeper clears AA and still reads as
   the iMessage bubble. The Approve button is `#1FA64F` with white type for the same reason.
6. **A shared sky scrim** sits between the sky and every shot in the master, plus per-shot
   washes. Cream ink has to hold over both a night sky and a noon sky; this is what makes that
   work, and it replaces per-shot colour juggling.
7. **The phone thread is clipped by a real scroll box** (`.ph-scroll`) under the nav bar rather
   than sliding under translucent glass, so rows that ride up are genuinely gone.
8. **S09's turntable is the CSS phone**, not the GLTF `vfx-iphone-device` (P2 in the plan). The
   sky already owns the only WebGL context in the render.
9. **Two continuity beats were added** that the plan implies but does not name: S05 ends by
   collapsing its ring into the *silhouette* of the phone S06 opens on, and S07's thread opens on
   a line that carries the `/zap` clip into `/create` ("the clip is in your camera roll. want it
   on a page people can actually buy from?"). Both are recorded in `v3/cutsheet.json`.
10. **S03's nouns** are the approved v2 sentence split five ways, and they assemble along the
    bottom into that whole sentence by 33.3 s, rather than a leftward stack of three.

### Copy still awaiting sign-off

The cut currently uses the plan's primary lines. Each is a one-line edit away from its approved
fallback (§6 lists every pair): "Text your agent." (S10), "mini-apps. make your own." (S06),
"YOUR OWN." (S07), the four explainer lines in S06, "describe it. approve the plan. it ships."
(S07), and the four cold-open banner bodies. The three giant stanza lines, the `/create`
transcript, the endowment nouns, "hyperpersonalization.", "connect your apps — across 1000+
apps.", the "Your agent, your RL environment, your model, your weights." stanza, the
"air, your guardian angel" kicker and the backend cards are all approved v2 or product copy.

### Gate state at this commit

`npm run check` passes: 0 errors across lint, runtime, layout, motion and contrast. Three
warnings remain and are understood: two software-WebGL `ReadPixels` performance notices from the
headless renderer, and one 2-sample box-overlap inside the phone during the 360° turntable, where
the auditor's 2D test cannot model the rotation.


---

## 14. v3.1 — the launch-film rebuild

The first cut was structurally honest and rhythmically correct, and it still read as a slideshow.
A thirty-frame sample across its 120 seconds showed eighteen frames of the same locked-off
composition: one phone, one size, one tilt, a giant mono word to its right. The product name never
filled the screen, the camera never moved more than one percent, and nothing in the frame answered
a transient. This pass fixes that, on the client's direction, using the Arlan Vault implementation
prompts as the source rather than the previous film.

### What changed

| | v3.0 | v3.1 |
| --- | --- | --- |
| Shots | 10 | **14** |
| Longest single composition | 24.9 s (`/home /shop /trade /zap` in one take) | 11.0 s |
| Camera | 1–1.5 % drift | a stage per shot: punch-in, macro, pull-out, six-cut montage |
| Beat punctuation | card lands only | scale pops, frame flashes, shake and chromatic pulses on named transients |
| Arlan Vault items built | 8 adapted | **14**, including four the first matrix had ruled out |

### The structure now

The mini-apps block is four separate shots, each with its own framing and its own takeover, so the
film changes shape every 6.2 seconds through the middle act: `/home` ends with the app family
filling the frame at ten times phone size; `/shop` lifts the listing out as a real product frame;
`/trade` opens tight and turns the approval into a macro plate with the fill as the loudest frame
of the act; `/zap` hands the whole frame to the render. `/create` splits into the plan and the
ship, so the build gets a live console and the app it made plays full-bleed before the publish
decision. Every seam is still a downbeat and every anchor still comes from `audiomap.json`.

### The four Arlan items that were ruled out and are now in the film

1. **Arcade pixel** opens it. "air" is drawn to a canvas at 1/46 scale and blown back up, and the
   block size falls to 1 over 0.92 s, so the first thing after black is the product name resolving
   out of its own pixels. No pixel grid is ever drawn, which is the point of the reference.
2. **Chromatic glow** carries the drop. The word is bloomed at three radii and split into a warm
   and a cool copy that drift opposite ways; the gap is the rainbow edge. The split opens on the
   24.358 crash, again on the bass snare, and settles.
3. **The art of color depth** makes every approval a physical object: a gradient body, inset bevel
   and glow, a brighter layer, and a bar of light along the top. It is the reason a tap in this
   film now reads as pressing something.
4. **Amo** closes it. The hover is gone and the puff stays: `air.wzrd.tech` sits in a glossy pill
   whose letters inflate one at a time as it lands at 103.770.

Two more were promoted from reference to built: **Symbols effect** renders the `/zap` generation as
four brightness bands stamped with their own marks, and **The typer** runs the wave of pills and
highlights under the endowment sublines.

### One bug worth recording

Every timeline in the project now carries `defaults: {immediateRender: false}`. GSAP renders a
`fromTo`'s start state at build time by default, which left the first shot's flash plate at 30 %
over the opening two seconds — a washed-out night sky that no amount of sky tuning would have
fixed. These timelines are only ever seeked, never played, so nothing may render ahead of its own
position.

---

## 15. v3.2 — sound, grade, and the real mark

Three things separated the cut from a finished launch film, and none of them were shots.

### Sound design

The film had music and nothing else. It now has a foley layer of 94 cues, synthesised rather
than sampled: `v3/authoring/sfx.py` builds each one from an envelope and an oscillator or a
filtered noise burst. A send is air moving away from you, a receive is a struck bell, an approval
is a switch closing, the drop is a body hitting a floor, the `/zap` render is granular and
deliberately unmusical.

The mix is the part that matters. A fixed gain is wrong: the same tap is lost under the chorus and
deafening in the silence at 7 s. Every cue declares a role and how far below the music that role
should sit, and the script solves its gain against the music's own level in the half second around
it. The music then sidechains under the cues, up to 4 dB. Measured against target:

| cue | target | delivered |
| --- | ---: | ---: |
| send, receive | −8 dB | −8 |
| tap | −9 dB | −7 |
| card land | −9 dB | −11 |
| the drop | +2 dB | +3 |
| the fill, the publish | +2 dB | +1 |
| the lockup | −4 dB | −2 |

`assets/bgm-mix.mp3` is what the film plays. `assets/bgm-music-only.mp3` is the untouched vstar
track and remains the source of truth for the beat grid in `audiomap.json`.

### The grade rides the track

A 15 fps envelope of the music is baked into the master at build time: `punch` follows transients,
`arc` follows the arrangement. Three things read it every frame. A real bloom (a backdrop-filtered
layer that blurs what is behind it and screens it back, so bright areas spill the way they do
through glass) breathes between 4 % and 22 %. The vignette opens as the arrangement fills. And the
sky's depth of field moves shot by shot, from sharp when the sky is the subject to 8 px of blur
when a phone or a card is. Nothing reads audio at render time; the numbers are baked, so a seek
always lands on the same grade.

A lens-fringe layer adds warm and cool colour at the extreme frame edges only, where a real lens
breaks down.

### The supplied mark

The app icon is rebuilt as `logos/air-icon.svg`: a superellipse tile, a white rim, the banded orb
and its specular, all vector, so the film can scale it from a 44 px avatar to a 430 px hero and
animate what is inside it. It replaces the old orb everywhere the product appears, and it earns
two moments of its own. At 89.536 s the DROP hands it the frame: the mark lands, a glint crosses
the glass, and its wave bands drift for the whole shot while the approved stanza lands around it.
At 105.535 s it leads the lockup, icon first, then "air by", then the wordmark, with the glint
crossing a beat behind the chrome sweep.

### Also in this pass

Whip transitions between the mini-app cuts: the outgoing shot is still travelling when the cut
lands and the incoming one picks the move up mid-flight, blurred, for two frames. It is the only
transition in the film that is not a straight cut.


---

## 16. v3.3 — the notes pass

Four corrections from review, all of them things the film was getting wrong about the product.

**The foley sits 6 dB lower.** Every role target in `v3/authoring/sfx.py` dropped six decibels and
the sidechain duck halved, so the cues read as texture under the song rather than as a second
track beside it. A send now sits about 15 dB under the music where it sat at 8, and the drop about
3 dB over where it sat at 7.

**The film no longer counts the apps.** It shows a handful of the mini-apps, so it must not imply
that is all of them. "ten apps. one thread." became "your apps. one thread.", and the montage
label "five mini-apps" became "a few of the apps".

**No carousels, no orbiting text.** Both were replaced with mechanics that do not rotate.
Hyperpersonalisation is now a signal board: the persona on the left, and six sources landing one
per half bar on the right, each stating what it knows and how much it weighs. Connect is now a
wall coming online: forty-five connector marks lighting up in a fixed shuffle, unevenly, the way a
real integration list fills, with the count in front of them.

**The source repository is out of the film.** The line naming the mirror repo is gone from both
the publish card and the montage.

### And the phone stopped reading as a black slab

Two screenshots made the problem plain: a 402 by 874 screen with three messages at the bottom is
mostly a black rectangle, and in `/shop` it was a black rectangle parked on top of the giant word.

- Every phone now carries an iOS status bar (time, signal, wifi, battery) and a raking glass
  reflection, so the device reads as a device before anything happens on it.
- Every thread opens on a real tail of prior conversation, seven or eight rows of it, dimmed. The
  screen is full in the first frame of every shot that has a phone.
- `/shop` is the mirror of the other mini-app shots: the giant word takes the left, the phone the
  right, and the product frame lands where the word was.
- The listing shows an actual garment: a lit tee on a studio sweep with fabric shading, a collar
  rib, side seams, a fold highlight and the tour print, instead of a flat pictogram.

The last device in the film had the same problem. The end card's phone sat under "Text your
agent." for three and a half seconds with nothing on it — an off slab beside the ask. It now runs
a thread of its own: five dimmed rows of the day already behind it, then two live arrivals on the
last two bars before the freeze, ending on "any time. i'm here." The film's closing product shot
is a conversation, which is the whole claim.

### Two more from the same pass

Reviewing the render turned up two beats that were wrong in the same way the freeze-frame
review usually catches: they read as intended in motion and fell apart on a single frame.

**The identity claim now exists as one sentence.** Each clause of "your agent, your RL
environment, your model, your weights" dimmed to 34% and blurred as the next arrived — a focus
pull that carried the reading nicely, but meant the complete claim never appeared in a legible
frame. The pull now releases on the kicker at 94.767: all three lines come back to full and
sharp, and the line the film is named for lands as a block.

**The publish payoff is a hard swap, not a dissolve.** "It's live." was fading in over a publish
card still at full opacity, stacking `mini.wzrd.tech/gratitude/tour` twice across the Approve
button for about a fifth of a second. The card now leaves in 100 ms and the payoff fills in
behind it at 9.532 — the same correction `/trade` already had. The approval press moved a half
beat earlier so it reads before the card goes, instead of on the frame it exits.

## 17. v3.4 — the component pass

Two notes: the foley is still too loud in the first half, and the design should be pushed hard
using a supplied catalogue of 190 components (18 Arlan Vault studies, 172 React Bits).

### The first half runs 6 dB quieter

The v3.3 pass cut every role by 6 dB against the music. That was right for the back half and
still wrong for the front: the opening is a night sky, one phone and one word, and foley that
reads as texture under the chorus reads as clatter under near-silence.

`v3/authoring/sfx.py` now applies a second trim on top of the role table. Everything before
`/shop` sits another 6 dB down; across 52.059 → 62.0 the trim smoothsteps back to zero, so the
second half is untouched and there is no step you can hear. All 37 cues before the boundary are
exactly 6 dB quieter and none of them hit a gain clip.

The mix itself was a shell pipeline that lived only in a transcript. It is now
`v3/authoring/mix.py`: read the track and the foley bus, sidechain the track under the cues by
at most 2 dB, sum at 0.86 / 0.95, limit at 0.94, write the mp3. The 48 kHz bus is resampled to
the music's 44.1 kHz through a polyphase filter in exactly one place, because an earlier pass
compared the two rates under one variable and read the balance 24 dB wrong.

Measured foley residual, old mix against new, by window:

| window | before | after |
| --- | ---: | ---: |
| shots 03–04, the drop and the board | −32.4 dB | −38.0 dB |
| shots 05–06, the wall and /home | −31.3 dB | −37.4 dB |
| shot 07, /shop — the ramp | −26.5 dB | −27.6 dB |
| shots 08–11, trade to ship | −27.9 dB | −28.0 dB |
| shots 12–14, yours to the end | −31.2 dB | −31.1 dB |

### Ten components, re-authored for linear time

Every one of these is a pointer, scroll or hover effect at the source. A film has no pointer, so
in each case the input becomes the timeline clock — which is usually the better trigger, because
the light can arrive when the decision does instead of when a cursor happens to pass.

**Global, every frame.** *Noise* replaces the static grain plate: six fixed-seed turbulence tiles
cycle at 24 per second off the clock, so the grain is alive and a seek still lands on the same
tile. *Grainient* adds a grainy gradient under a slow swirl, drifting on two periods, which keeps
large flat areas of sky from banding. *Gradual Blur* gives the frame three bands of increasing
blur at the boundary, so the picture falls off the way it does through a lens instead of stopping
dead at the crop.

**Aurora** (sky) — the cold open was a clean dark field. Three bands now drift over the night
half at different rates and are gone before the sun crests, because an aurora under a sunrise is
a lie.

**Light Pillar** (shot 01) — a column of light behind the name as it resolves, so the word looks
lit from somewhere rather than drawn bright on black.

**Masked Heading + Split Text** (shot 02) — "TEXT IT LIKE A FRIEND." is no longer filled with a
flat colour: a colour mesh shows through the glyphs and keeps drifting after the words land, and
each word is uncovered from under its own clip. The two mono captions arrive a character at a
time, so they read as something being said.

**Light Rays** (shot 03) — the biggest single lift in the film. The crest now throws an eleven-ray
volumetric fan up through the frame instead of only brightening the sky.

**Star Border** (shot 04) — sixteen sparks orbit the persona ring and twinkle as the sweep reaches
them, so the hub reads as something being read from rather than a photograph.

**Halftone Reveal** (shot 05) — the connector wall does not fade up, it develops. A print dot
matrix sits over the grid and its dots close from 15 px to 2 px as the connectors come online.

**Magic Bento** (shot 06) — a spotlight crosses the app family and each tile lifts as it passes.

**Depth Text** (shots 06–11, and the /home caption) — the slash words were flat ghosts at 36%
opacity behind the phone. Each is now a lit face over a stack of eight offset shadow copies, and
the whole block turns from −9° to +4° across its shot, so `/shop`, `/trade`, `/zap` and `/create`
read as objects with a side.

**Specular Button** (shots 07, 08, 11) — a rim light runs the edge of the glass on the beat the
approval lands.

### One component rejected

**Prismatic Burst** was tried twice and removed twice. Behind the giant word on the drop it was
occluded and showed only as one stray horizontal line; over the `/zap` plate it screen-blended
against bright halftone dots and vanished. Rebuilding its hairlines as tapered wedges fixed the
look and not the placement. The honest reading is that a hard radial starburst is a different
idiom from this film, which is soft, atmospheric and photographic — and the chromatic split and
the light rays already do its job better. A catalogue of 190 components is a menu, not a
checklist.
