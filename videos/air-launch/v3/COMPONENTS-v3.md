# COMPONENTS-v3 — disposition matrix

Rubric from `REVIEW-PROMPT.md`: **ADOPT** (install/port as-is, translate interactive triggers to linear time), **ADAPT** (take the idea or one sub-mechanism, re-author to the motion doctrine), **REFERENCE ONLY** (look, do not port), **REJECT** (does not belong in this film; reason given). Translation contract: hover → downbeat, scroll → camera drift, click/tap → the kick named in `cutsheet.json`, autoplay loops → one deterministic pass timed to the phrase. Every ported piece must be seek-safe: no rAF loops, no clocks, no unseeded random.

The "AIR energy system" applies: spectral colour is spent exactly four times (24.358, 61.301, 87.957, 108.669). Any component whose whole point is a coloured glow is out unless it can run in cream/blue at ≤ 0.2 opacity.

## 1. HyperFrames catalog (pasted docs)

| item | disposition | used in | translation notes |
| --- | --- | --- | --- |
| `chat-thread` | ADOPT | S02, S06, S07, S09 | Base of the phone thread. Bubbles land on downbeats, typing dots ride hihat rolls, thread column translates (never scrolls). Re-skin to the iMessage spec in PLAN §3.5 |
| `modal-morph` | ADOPT | S01→S02, S05→S06, decision-card flips | FLIP from banners → bubble → phone; ring → `/home` card; sent bubble → card. One morph per section entrance |
| `notes-typing` | ADOPT | S06 commands, S07 prompt | Per-character reveal 28–36 ms, deterministic, always finishing on the send downbeat |
| `cta-close` | ADOPT | S10 | CTA line, URL, freeze, then the WZRD lockup replaces the block's default end state |
| `caption-parallax-layers` | ADOPT | every shot | Caption plane at +1.5 depth on the shot's `cam` proxy; giant type at 0, phone at +1, sky at −1 |
| `carousel-orbit-4` | ADOPT | S04 | One 45° slot per downbeat (34.900 / 36.479 / 38.058); facing tile scales 1.18 |
| `carousel-vision-3` | ADOPT | S05 | 24-logo ring; slot advance on 41.146 / 42.701; collapses into the phone at 45.813 |
| `carousel-circle-1` | REFERENCE ONLY | — | Same family as orbit/vision; one ring language per film |
| `halftone-field` | ADAPT | S06 `/zap` progress | 12 × 5 dot field filling one column per hihat hit of the 66.804–67.268 roll; cream dots on glass, no colour |
| `ios26-liquid-glass` | ADAPT | phone frame, cards | Only the CSS glass (backdrop blur + 1 px line + inner highlight). No refraction shader: it fights the sky and costs WebGL |
| `vfx-iphone-device` | ADAPT (P2) | S09 turntable at 100.589 only | GLTF needs the canvas-draw-element render flag; budget against the sky's WebGL context. Default turntable is the CSS phone |
| `stop-motion-cadence` | REJECT | — | Held-frame cadence contradicts the film's continuous expo.out grammar; the freeze at 104.606 is the only held moment and is musical, not stylistic |
| `svg-stroke-trace` | ADAPT | S03 glyphs, S10 underline | `strokeDashoffset` draws each endowment glyph over 0.35 s on its downbeat; the URL underline at 103.770 |

## 2. Arlan Vault (CSV rows, `source = Arlan Vault`)

**Revised for v3.1.** Four items this matrix first ruled out or held at arm's length are now
built into the film, on the client's direction and with their implementation prompts in hand.
Each was re-authored for linear time rather than ported: there is no hover, no cursor and no
scroll in a film, so the trigger became a transient in the track.

| item | disposition | used in | translation notes |
| --- | --- | --- | --- |
| The typer | **ADOPT** | S03 sublines | Built: each letter passes through a filled pill, then a highlight, then plain text, on a wave that crosses the line. Runs under the endowment nouns at 25.5, 27.1 and 31.7 s |
| Fade motion | REFERENCE ONLY | — | Superseded: the drop's "air" is now an arcade-pixel resolve with a chromatic split, which carries the same idea with more force |
| Chromatic glow | **ADOPT** | S01 name, S03 drop | Built as the reference describes: the word bloomed at three radii and split into a warm and a cool copy drifting opposite ways, the gap reading as a rainbow edge. The split opens on the crash at 24.358 and again on the bass snare, then settles |
| Liquid UI | ADAPT | bubble → card fusion (S06) | The sent bubble stretches and settles into the card rect (FLIP with a 0.08 s squash), then the card lands |
| Apple's corners | ADAPT | phone frame, every card, banners | SVG superellipse mask (n = 5) instead of `border-radius` |
| Holo | ADAPT | `/trade` and `/shop` cards | 1.2° rotateX/rotateY kick on landing with a moving specular line, no rainbow |
| Dia Browser's gradient | ADAPT | composer bar glow on the phone while typing | Soft blue-cream gradient at 0.25 opacity behind the input, pulsing once per bar |
| Ghosty reveal | **ADOPT** | S09 `/zap` result | The finished clip bleeds in through a radial fog mask opening from 52% to 300%, instead of fading up |
| Kinetic typography | REFERENCE ONLY | — | Giant-word energy is right, but v3 uses split-text lands on downbeats, not continuous kinetic motion |
| Realistic emboss | REFERENCE ONLY | — | Might suit the chrome mark; the PNG already carries the emboss |
| The art of color depth | **ADOPT** | every Approve, the end-card CTA | Built as layers on one button: a gradient body, inset bevel and glow, a brighter layer, and a bar of light along the top. It is what makes an approval in this film read as a physical thing rather than a rectangle |
| Symbols effect | **ADOPT** | S09 `/zap` render | The generated clip is cut into four brightness bands, each stamped with its own mark and tint, one column band per hihat hit of the 66.80-67.27 roll, then resolved into the picture |
| Amo hover button | **ADOPT** | S14 CTA pill | The hover is gone; the puff stays. `air.wzrd.tech` sits in a glossy pill and its letters inflate one at a time on a 28 ms stagger as the pill lands at 103.770 |
| Arcade pixel | **ADOPT** | S01 name reveal | Built with no pixel grid anywhere: "air" is drawn to a canvas at 1/46 scale and blown back up, and the block size falls to 1 over 0.92 s so the letters resolve out of their own pixels. It is the first thing in the film after black |
| Figma vector editor | REJECT | — | Tool UI, not product UI |
| Midjourney Medical's ASCII | REJECT | — | ASCII fx conflicts with the photographic sky |
| Pixel brushes | REJECT | — | Same as Arcade pixel |
| Ransom note | REJECT | — | Tone mismatch (playful chaos vs. calm authority) |

## 3. React Bits (CSV rows, `source = React Bits`)

Category rules first, then the exceptions.

- **Backgrounds (57)** — REJECT as a class: the film has one background, the sky. Exceptions: `Dither` REFERENCE ONLY (the brand's `wz-dither` already exists in `fx.js`), `Grainient` REFERENCE ONLY (grade grain is already fixed-seed SVG), `Orb` REJECT (the orb is a PNG asset, never a shader).
- **Animations (38)** — cursor-driven items REJECT (`Blob/Ghost/Glow/Splash/Swarm/Target Cursor`, `Crosshair`, `Cursor Grid`, `Magnet`, `Magnet Lines`, `Click Spark`, `Image Trail`, `Pixel Trail`); glow borders REJECT (`Electric Border`, `Star Border`, `Laser Flow`); the rest per the table below.
- **Components (45)** — most are navigation/gallery UI; only the items below.
- **Text Animations (32)** — scramble/glitch/decrypt family REJECT (`Decrypted Text`, `Scrambled Text`, `Glitch Text`, `Fuzzy Text`, `Letter Glitch` (bg), `Shuffle`, `Split Flap Text` — the film never implies computation-as-noise); scroll-triggered items are REFERENCE ONLY unless listed.

| item | category | disposition | used in | translation notes |
| --- | --- | --- | --- | --- |
| Split Text | Text | ADOPT | all giant words and captions | Per-word `y 0.6em → 0, rotateX 24 → 0`, stagger 0.04, expo.out 0.7 |
| Count Up | Text | ADOPT | S05 counter, S07 progress % | `power2.out` for 0 → 1000+, `power1.inOut` for 10 → 100 %; both land on the named downbeat |
| Shiny Text | Text | ADAPT | S10 lockup chrome sweep | One 0.35 s sweep at 108.669 (spectral moment 4), then static |
| Blur Text | Text | ADAPT | S08 words dimming to 0.35 | Previous word blurs 2 px as the next lands |
| Text Type | Text | REFERENCE ONLY | — | `notes-typing` owns typing |
| Stroke Text | Text | REFERENCE ONLY | — | Considered for the giant slash commands; solid cream at 0.38 reads better on the sky |
| Stepper | Components | ADAPT | S07 progress card | Four steps check on 80.109 / 81.688 / 82.477 (+ plan at 78.53) |
| Glass Surface | Components | ADAPT | cards, banners | CSS only; see `ios26-liquid-glass` |
| Counter | Components | REFERENCE ONLY | — | Count Up covers it |
| Tilted Card / Reflective Card / Spotlight Card | Components | ADAPT (merged) | `/trade`, `/shop` cards | Folded into the Holo tilt; a single specular line, no spotlight follow |
| Card Swap / Stack / Bounce Cards | Components | REFERENCE ONLY | S09 montage | Hard cuts on downbeats replace card swapping |
| Dock / Glass Icons | Components | ADAPT | S06 `/home` icon grid | Icon pop scale 0.7 → 1 with 0.04 s stagger per hihat hit; no dock magnification |
| Carousel / Circular Gallery / Depth Carousel / Dome Gallery / Orbit Images | Components/Animations | REFERENCE ONLY | — | Catalog `carousel-orbit-4` / `carousel-vision-3` are the ring language |
| Model Viewer | Components | REFERENCE ONLY | — | `vfx-iphone-device` is the 3D route if any |
| Animated List | Components | ADAPT | S02/S06 thread growth | Column translate with expo.out; no fade-in per item beyond the bubble land |
| Logo Loop | Animations | ADAPT | S10 partner wall rows | Static rows rising on kicks; no loop |
| Fade Content / Animated Content | Animations | REFERENCE ONLY | — | Doctrine already specifies entrances |
| Gradual Blur | Animations | ADAPT | thread top edge mask on the phone | Static gradient mask on `.thread` so old bubbles fade into the nav bar |
| Halftone Reveal | Animations | REFERENCE ONLY | — | Catalog `halftone-field` chosen instead |
| Metallic Paint / Liquid Chrome / Molten Metal | Animations/Backgrounds | REJECT | — | The chrome mark is a PNG; shader chrome fights it |
| Noise | Animations | REFERENCE ONLY | — | Grade grain already fixed-seed |
| Scroll Expand / Scroll Reveal / Scroll Float / Scroll Velocity / Scroll Stack | various | REJECT | — | Scroll semantics have no linear equivalent that is not already camera drift |
| Infinite Menu | Components | REFERENCE ONLY | — | Brand `wz-infinite-menu` exists in `fx.js`; not used in the film |
| Everything else in the CSV | — | REJECT | — | Category rules above |

## 3b. v3.4 rulings — the second component catalogue

A second pass over the same catalogue, after the film existed. Several v3 rulings were reversed
because the shot they would have served had since been built, and a study that was
REFERENCE ONLY against a storyboard is a different question against a frame.

| component | v3 ruling | v3.4 ruling | where | how it was re-authored for linear time |
| --- | --- | --- | --- | --- |
| Noise | REFERENCE ONLY | **ADOPT** | global grade | Six fixed-seed turbulence tiles, one shown per 1/24 s, indexed off the clock. The static plate read as a texture laid on top; grain that changes every frame reads as film. |
| Grainient | — | **ADOPT** | global grade | Grainy gradient under a turbulence swirl, drifting on two incommensurate periods. Stops the large flat sky from banding. |
| Gradual Blur | ADAPT (thread mask) | **ADOPT (also global)** | frame boundary | Three masked `backdrop-filter` bands of increasing blur at the crop. The source keys off scroll; here it is static and spatial. |
| Aurora | REJECT | **ADOPT** | `sky.html`, 0 → 24.358 | Three blurred bands on separate sine periods, up over the cold open and gone before the crest. |
| Light Pillar | — | **ADOPT** | S01, the name resolving | One blurred column, scaled and faded on the resolve beat. |
| Light Rays | — | **ADOPT** | S03, the crest | Eleven masked gradient wedges fanned from a point on the horizon. The single biggest lift in the film: the sun now throws light rather than only brightening. |
| Masked Heading | — | **ADOPT** | S02 hero line | A colour mesh `background-clip: text` behind the glyphs, drifting for 5.4 s; each word uncovered from its own `overflow:hidden` clip instead of faded. |
| Split Text | REFERENCE ONLY | **ADOPT** | S02 captions | Per-character spans built at load, staggered 11 ms off the caption's beat. |
| Star Border | REJECT | **ADOPT** | S04 persona ring | Sixteen sparks placed on the ring by angle; each twinkles as a conic sweep reaches it. The source animates a gradient on hover. |
| Halftone Reveal | REFERENCE ONLY | **ADOPT** | S05 connector wall | A dot-matrix plate whose `background-size` closes 15 px → 2.2 px over 3.6 s. The source resolves around the cursor; here it resolves on the beat. |
| Magic Bento | REJECT | **ADOPT** | S06 app family | A spotlight translated across the grid; each tile lifts as it passes. No hover, no expansion. |
| Depth Text | — | **ADOPT** | S06–S11 slash words, S06 caption | A lit face over eight offset shadow copies, the block turning −9° → +4° across the shot. The source parallaxes against the pointer; the camera move replaces it. |
| Specular Button | — | **ADOPT** | S07, S08, S11 approvals | A conic rim light rotated once around the edge, plus a glass sweep, fired on the approval beat rather than followed from a cursor. |
| Shiny Text | — | BUILT, UNUSED | — | The helper exists in `parts.py`; no line in the cut wanted a second sheen on top of the chrome mark's own. |
| Prismatic Burst | — | **REJECT (tried twice)** | — | Behind the giant word on the drop it was occluded and read as one stray line; over `/zap` it screen-blended against bright halftone and vanished. Rebuilding the hairlines as tapered wedges fixed the look, not the placement. A hard radial starburst is a different idiom from this film, and the chromatic split and light rays already do its job. |

## 4. Brand shader components (`apps/web/public/creator-os/fx.js`)

`wz-sky`, `wz-dither`, `wz-chrome`, `wz-prism`, `wz-beams`, `wz-burst`, `wz-gridmotion`, `wz-griddistort`, `wz-pixels`, `wz-pixel-veil`, `wz-terminal`, `wz-trail`, `wz-electric-border`, `wz-infinite-menu`, `wz-ascii-fx` are **REFERENCE ONLY** for palette and feel. They animate on their own clocks and are not seek-safe; do not embed them. `sky.html` is the film's port of `wz-sky`; `wz-prism` informs the four spectral moments (a 6-stop conic gradient, PLAN §3.7).

## 5. External style references

| reference | status | note |
| --- | --- | --- |
| github.com/heygen-com/hyperframes-launches | README read; repo tree unreachable | Conventions folded into PLAN §9 (snapshots at seams, one composition per beat) |
| x.com/mvanhorn/status/2063624356484501832 | unreachable from sandbox | human reviewer note at Gate A |
| x.com/Miguel07Code/status/2098527121702309905 | unreachable | same |
| x.com/HeyGen_Official/status/2075262117964615956 | unreachable | same |
| x.com/HeyGen_Official/status/2077438104982667282 | unreachable | same |
| `apps/web/public/creator-os/airintrofin.mp4` | analysed (12 frames, contact sheet) | the primary visual reference: sky arc, mark scale 0.62, "air by" lockup |
