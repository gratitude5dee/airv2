# Air Launch — World-Class Motion Design Review Prompt

Copy the prompt below into a new review task. It is tailored to the existing
`air-launch` HyperFrames project and the supplied component references.

---

## Prompt

You are the lead creative director, motion systems designer, editor, HyperFrames
content engineer, real-time graphics specialist, audio director, VFX producer,
and finishing supervisor for an existing 103-second product launch film.

Work as one decisive lead voice through these lenses:

1. **Narrative editor** — every visual must clarify a product claim, establish
   emotion, or carry continuity.
2. **Brand creative director** — protect identity, typography, palette, tone,
   hierarchy, and the product's sense of intelligence.
3. **Motion director** — own object constancy, pose design, spatial vectors,
   rhythm, choreography, transitions, and final holds.
4. **HyperFrames engineer** — veto anything unseekable, nondeterministic,
   structurally invalid, or needlessly expensive.
5. **Audio director** — connect motion to actual musical anchors and manage
   placed-track relationships without inventing narration.
6. **VFX and generative-media producer** — decide whether a generated asset is
   genuinely necessary and define its production and rejection criteria.
7. **Accessibility and finishing supervisor** — protect readability, contrast,
   frame integrity, reduced-motion equivalents, and delivery quality.

Resolve conflicts in this order:

**technical validity is a hard gate; among valid options, narrative clarity >
brand coherence > continuity > distinctiveness > component coverage.**

### Mission

Audit the existing `air-launch` film and produce a disciplined redesign and
implementation plan that materially improves:

- the first-five-second hook;
- product comprehension;
- brand memorability;
- shot-to-shot continuity;
- motion sophistication;
- rhythm and music synchronization;
- spatial depth and frame composition;
- typography and readability;
- deterministic scrub and render behavior;
- the emotional and branded closing payoff.

“100x better” is an ambition, not a measurable result. Translate it into
observable before/after changes, proof frames, and acceptance criteria. Never
make unsupported quality claims.

### Mode

Start in **REVIEW MODE**.

In REVIEW MODE:

- inspect the supplied project, preview, and references;
- establish the current design truth;
- diagnose before proposing;
- return a shot-level and file-level redesign plan;
- do not edit project files;
- do not install components;
- do not download or generate paid media;
- do not render a final video.

Enter **IMPLEMENT MODE** only after explicit approval of the review plan.

### Project inputs

Project root:

`/Users/gratitud3/Downloads/hyperframes-launches-main/air-launch`

Read, at minimum:

- `PLAN-v2.md`
- `STORYBOARD.md`
- `index.html`
- `meta.json`
- `hyperframes.json`
- `package.json`
- `audiomap.json`
- every `compositions/*.html` file
- relevant assets, fonts, logos, provenance notes, and any existing snapshots
- current Studio preview at `http://localhost:3017/#project/air-launch`

Use the installed HyperFrames by HeyGen plugin and the following skill contracts.
Read the entry-point skill first, then the owning domain references needed for
the review:

- `/Users/gratitud3/.agents/skills/hyperframes/SKILL.md`
- `/Users/gratitud3/.claude/skills/hyperframes/SKILL.md`
- `/Users/gratitud3/.agents/skills/hyperframes-core/SKILL.md`
- `/Users/gratitud3/.agents/skills/hyperframes-cli/SKILL.md`
- `/Users/gratitud3/.agents/skills/hyperframes-creative/SKILL.md`
- `/Users/gratitud3/.agents/skills/hyperframes-animation/SKILL.md`
- `/Users/gratitud3/.claude/skills/hyperframes-keyframes/SKILL.md`
- `/Users/gratitud3/.claude/skills/hyperframes-audio/SKILL.md`
- `/Users/gratitud3/.codex/plugins/cache/openai-curated-remote/hyperframes/0.1.2/skills/gsap/SKILL.md`
- `/Users/gratitud3/.codex/skills/fal-recipes/SKILL.md`

The two HyperFrames entry-point files currently contain the same contract. Do
not double-count them as separate creative requirements.

### Supplied component references

Inspect all eight attachment files, but deduplicate them by content hash:

- `/Users/gratitud3/.codex/attachments/0d2064ee-f403-4b5b-b7d6-927e8864db03/pasted-text.txt`
- `/Users/gratitud3/.codex/attachments/a717b2d4-664a-4f7b-9eca-9a4f99d26151/pasted-text.txt`
- `/Users/gratitud3/.codex/attachments/272b9bf8-0015-4b2a-ae22-674624dd6579/pasted-text.txt`
- `/Users/gratitud3/.codex/attachments/643465be-7bfa-4c5c-a42e-40cb46823a5e/pasted-text.txt`
- `/Users/gratitud3/.codex/attachments/fad0887e-3a39-4638-9203-d62398653f90/pasted-text.txt`
- `/Users/gratitud3/.codex/attachments/31b46c7f-1c1d-4e2e-92e7-37cb59b112d7/pasted-text.txt`
- `/Users/gratitud3/.codex/attachments/ba1c152a-8568-42d3-b672-111dfeb66a2d/pasted-text.txt`
- `/Users/gratitud3/.codex/attachments/097d3dd0-1242-409b-a0e2-5297032d4f13/pasted-text.txt`

The first, second, and third “one body becomes four components” files are
byte-for-byte duplicates. The eight attachments therefore describe **six**
distinct systems:

1. one persistent body becoming four UI components with a travelling rim pulse;
2. a dense tiled wordmark / light field;
3. the Amo puffy hover-video button;
4. a Siri-like spectral listening ribbon;
5. Fade Motion typographic smear / motion memory;
6. Liquid UI smooth-union geometry.

Treat the supplied code as evidence of a visual principle, not code that must be
pasted into the composition.

## Gate 0 — establish reviewable truth

Do not judge timing, typography, logos, or image treatment until the actual
assets are present.

At the time this prompt was written, these files were Git LFS pointer text, not
the intended binary media:

- `assets/bgm.mp3`
- `fonts/Inter-latin-variable.woff2`
- `logos/onairos-avatar.png`
- `logos/wzrdtech-chrome.png`

Verify with `file` and Git LFS status. In REVIEW MODE, report the blocker and the
exact hydration command; do not silently substitute fallback assets. If the user
authorizes implementation and download, hydrate the exact project assets before
visual or timing validation.

Then verify:

- Studio is serving and the project URL returns HTTP 200;
- the music is audible and has the expected 103-second duration;
- the intended font is rendered rather than a fallback;
- Onairos and WZRD artwork displays as real imagery;
- every sub-composition mounts visibly at a representative midpoint.

If Gate 0 fails, continue with a source-level provisional review, label every
visual conclusion that depends on missing assets, and do not pretend the preview
is ground truth.

## Existing-project hard constraints

- This is an existing-project review. Do not reroute it as a fresh creation or
  reopen an intent interview.
- Preserve approved product claims, asset provenance, 1920×1080 resolution,
  30fps, the 103-second master duration, composition IDs, and unrelated timing
  unless a proposed change explicitly justifies the cost.
- Preserve the established 13-shot story unless a cut or merge clearly improves
  comprehension and receives approval.
- Do not add narration, replace the music, add scenes, invent claims, or add
  partner marks merely to accommodate an effect.
- A supplied component must replace, clarify, unify, or elevate something.
  Additive decoration alone is not a reason to use it.
- Maximize component coverage only after coherence gates pass. “Most or all”
  does not authorize an effects reel.
- Assign every adopted component one primary narrative job and one owner shot or
  sequence.
- Allow at most one primary signature mechanism and one secondary accent in a
  beat.
- Preserve stillness, negative space, and readable holds. Do not animate every
  surface.
- Preserve the current leftward motion doctrine unless a better replacement is
  proposed and applied consistently.
- Do not add a different transition to every seam. Use one primary handoff
  grammar and one or two earned accents.
- Do not change the closing 14 seconds into a feature-reel dumping ground.

## Interactive-to-linear translation contract

The reference pieces are interactive web visuals. The film is a deterministic,
frame-seeked composition. Translate the idea, not the browser interaction.

Never use render-critical:

- hover, cursor, microphone, scroll, focus, route state, or user input;
- `Date.now()`, `performance.now()`, timers, or autonomous animation clocks;
- unseeded randomness;
- unregistered `requestAnimationFrame` loops;
- infinite repeats;
- runtime network fetches;
- live DOM measurements during a tween;
- async timeline construction that registers before it is complete.

Required adaptations:

- Drive all motion from composition time on one paused registered timeline per
  composition, with the timeline key matching `data-composition-id`.
- Drive shader time and audio uniforms through deterministic timeline proxies
  and explicit update calls.
- Replace microphone response with precomputed BGM bands or authored envelopes
  derived from `bgm.mp3` / `audiomap.json`.
- Replace pointer paths with authored, seeded paths.
- Replace hover triggers with intentional timeline cues.
- Let HyperFrames own `<video>` and `<audio>` playback and source timing.
- Keep required media local. Never rely on a CDN or generation endpoint at
  preview or render time.
- Use fixed geometry, FLIP, SVG/canvas/SDF poses, transforms, masks, and shader
  uniforms. A reference that depends on continuous DOM `width` / `height`
  animation must be reauthored for seek-safe video.
- The existing sky already owns a full-duration WebGL context. Inventory every
  proposed canvas and GPU context; prefer SVG, Canvas 2D, shared shader
  infrastructure, or pre-rendered media when WebGL is not essential. Hidden
  canvases can still consume resources, so do not assume non-visible equals free.
- Never fake one-body continuity by crossfading four unrelated elements. Either
  keep one owned object alive or clearly label the idea as replacement, not
  transformation.
- Do not animate `display` or raw `visibility` on clip elements.
- Keep IDs unique across the assembled master.
- For templated sub-compositions, keep required styles and scripts inside the
  template and preserve host / root / timeline-key identity.
- Use `fromTo()` with explicit states for scene entrances and
  `immediateRender:false` when a later tween re-owns the same property.
- Avoid concurrent tweens writing the same transform property on one element;
  split entrance and ambient motion across parent and child wrappers.

## Reference deconstruction

For every distinct reference, extract:

- visual essence;
- narrative meaning;
- essential mechanism;
- interaction assumptions;
- transferable properties;
- non-transferable implementation details;
- best HyperFrames runtime;
- likely performance cost;
- palette collision risk;
- best owner shot;
- fallback treatment.

Evaluate these systems specifically:

### A. Persistent AI body

One object becomes a workflow node, progress row, terminal, and prompt bar.
Preserve object constancy, the asymmetric travelling rim, and the disciplined
sequence: pulse → contents out → empty-body morph → new contents in. Translate
the original layout-thrashing measurements and live mask rebuilds into fixed,
authored, seek-safe poses. Include one earned light/dark polarity shift.

### B. Dense tile field

Preserve the sampled word/claim silhouette, authored color field, and sparse
sparks. Replace cursor response with deterministic light coordinates or music
anchors. Keep tile density within a proven 1080p performance budget.

### C. Puffy media transformation

Preserve the tactile inflation and decisive one-shot payoff. Hover is not part
of the film. Treat the transformation as placed timeline media or a procedural
effect. If a transparent generated clip is proposed, it remains conditional on
brand fit, codec support, edge quality, and explicit generation approval.

### D. Spectral ribbon

Preserve the mostly white core, four phase-shifted spectral copies, curvature
dispersion, Lorentzian emitted-light falloff, and fast-attack / slow-release
response. Replace microphone and wall-clock input with precomputed music data.

### E. Fade Motion

Preserve typographic motion memory: accumulated copies becoming a directional
trail rather than a generic blur. Restrict it to one semantic word or handoff.

### F. Liquid UI

Preserve smooth-union geometry and the idea that separate cards become one
material body. Replace dragging and per-frame topology instability with authored
poses, precomputed paths, or a deterministic low-resolution field.

## Phase 1 — baseline audit

First describe the current film without proposing changes:

- narrative spine and act structure;
- strongest five moments to preserve;
- weakest five moments or repeated visual defaults;
- hierarchy and readability issues;
- shots that feel like web layouts rather than composed video frames;
- motion continuity and transition consistency;
- spectral and palette usage;
- density and negative-space rhythm;
- musical synchronization;
- end-card effectiveness;
- technical risks visible in source or scrub behavior.

Use exact shot numbers and global timecodes. Separate observation from inference.
Do not infer visual quality from a missing LFS asset.

Investigate this known mismatch explicitly: Shot 09 claims a dead freeze from
global 67.0s to the 69.0s cut, but the current source continues button, glow,
caption, and exit motion after the 67.0s stop. Determine the exact final pose the
film should reach before 67.0s and specify how every visible channel holds until
the true cut at 69.0s.

## Phase 2 — north-star visual system

Write one sentence explaining the redesigned film's visual thesis.

Then define one compact system:

- hero motif;
- supporting motif;
- palette and spectral-accent rules;
- typography roles and video-scale type sizes;
- surface and material language;
- depth and camera doctrine;
- entrance, transformation, hold, and exit behavior;
- transition grammar;
- audio-response grammar;
- rules for quiet frames;
- reduced-motion equivalent.

The components must feel like manifestations of one intelligence, not six
unrelated demos.

Treat all spectral color as one scarce **AIR energy system**:

- full spectrum appears only at a primary activation point;
- the spectral ribbon stays mostly white, separating into color only at
  energetic bends;
- the tile field remains mostly neutral until one controlled passage;
- liquid joins and fade trails remain predominantly tonal;
- avoid generic cyan/purple “AI glow” and uncontrolled rainbow repetition.

## Phase 3 — component decision rubric

Apply hard gates before choosing a disposition:

1. **Narrative proof** — does it make a claim easier to understand or feel?
2. **Brand fit** — does it express AIR rather than generic AI aesthetics?
3. **Unique ownership** — does it have a job no other treatment already does?
4. **Deterministic feasibility** — can it scrub and render frame-accurately?
5. **Readability** — is copy legible at the proof frame and final hold?
6. **Editorial fit** — is there a genuine music or structure cue for it?
7. **Density control** — can it coexist without crowding the frame?

If gate 1, 2, 4, or 5 fails, the disposition cannot be `ADOPT`.

Use exactly one disposition:

- `ADOPT` — use the core mechanism substantially;
- `ADAPT` — retain its visual principle but change implementation or behavior;
- `REFERENCE ONLY` — useful direction with no direct component;
- `REJECT` — conflicts with story, brand, timing, or runtime.

For every system report leverage, implementation risk, runtime cost, reuse
value, and one concise reason. Do not reward a component merely because it was
supplied.

## Phase 4 — shot mapping

Create a complete 13-shot table. For every shot include:

- shot number and exact global time range;
- current narrative job;
- current hero visual;
- evidence-backed diagnosis;
- `preserve`, `replace`, `reinforce`, or `simplify`;
- proposed component, if any;
- exact semantic reason;
- entry, proof, hold, and exit times;
- music cue or `audiomap.json` anchor;
- foreground / midground / background organization;
- object-continuity handoff to neighboring shots;
- runtime and DOM ownership;
- source files affected;
- fallback if the treatment fails;
- proof-frame timecodes and acceptance criteria.

Start from this integration hypothesis, then verify, improve, or reject it from
evidence:

- **Shot 01 or Shot 06:** compare the tile field as an opening `air` wordmark
  against a Shot 06 scale payoff such as the approved `1,000+` claim. Choose one
  owner; do not repeat the complete effect in both places.
- **Shot 02 → 03:** one restrained Fade Motion typographic handoff.
- **Shot 05:** separate context sources fuse via Liquid UI geometry into the
  persistent AIR interface body.
- **Persistent-body architecture — compare two honest options:**
  1. a master-owned body spanning Shots 05–08 as workflow node → progress row →
     terminal → prompt bar, replacing weaker disconnected hero treatments; or
  2. a self-contained Shot 03 body using its 11.5-second duration to express
     endowments, leaving a small locked token after each pose so additive
     capabilities do not read as mutually replacing states.
  Choose from narrative clarity, object ownership, timing, and implementation
  risk—not novelty.
- **Shot 06:** the app swarm or approved `1,000+` claim resolves through the
  dense tile-field language.
- **Shot 07, 08, or 09:** one puffy tactile payoff is conditional and limited to
  one approved semantic token, such as a restrained `COMING SOON`, Send, or
  command-confirmation microbeat. Reject it if it makes the brand feel toy-like.
- **Shot 09:** the remote press may release the spectral activation ribbon into
  the mesh, but all motion must reach a final pose before 67.0s and freeze
  completely through 69.0s.
- **Shot 12:** the ribbon may return as a restrained bookend if it strengthens
  “guardian angel” without competing with the quiet close.
- **Shots 12–13:** remain comparatively quiet; do not force unused components
  into the ending.

If one body spans multiple sub-compositions, specify one truthful ownership
strategy such as a master-level overlay or a dedicated spanning sub-composition.
Explain transparency, z-order, timing, and how the owner receives per-shot
states. Do not fake continuity with duplicate bodies.

Protect semantics while adopting the mechanics:

- A Shot 03 morph must communicate accumulated endowments, not replacement.
- Shot 05 Liquid UI may fuse data streams as they enter a bounded private-context
  surface; it must not imply uncontrolled mixing of the source services.
- Spectral color means active AIR intelligence. It is not general decoration.
- Shot 06 is already the film's maximal-density frame; simplify before adding a
  second visual system.

## Phase 5 — implementation plan

Organize proposed work by leverage and dependency:

### P0 — structural coherence

- hydrate and verify LFS assets;
- establish persistent motif ownership;
- define shared tokens and a single AIR energy system;
- change layering / transparency / track ownership only where required;
- correct Shot 09's false freeze;
- remove or replace weaker competing mechanisms.

### P1 — signature moments

- persistent body and rim pulse;
- Liquid UI fusion;
- tile field;
- one Fade Motion handoff;
- spectral ribbon;
- conditional puffy-media insert.

### P2 — finishing

- typography and type fit;
- contrast;
- shadows, depth, material response, and foreground detail;
- motion timing and final holds;
- audio cue polish;
- performance fallbacks;
- ending restraint.

For every implementation task state:

- objective;
- exact file(s);
- prerequisite;
- implementation mechanism;
- preserved elements;
- risk;
- smallest useful proof command or snapshot;
- rollback or fallback.

Do not provide implementation code in REVIEW MODE unless a tiny pseudocode
fragment is necessary to explain ownership.

## Phase 6 — audio plan

- Map every proposed cue to the existing music and `audiomap.json`.
- State whether it is visual-only, uses existing BGM analysis, or requires a new
  placed SFX.
- Do not invent voiceover and do not propose voiceover carve when there is no
  voice track.
- Treat new SFX as approval-dependent assets.
- Use precomputed bands for true audio-reactive motion; do not use runtime Web
  Audio analysis.
- Preserve the existing master fade unless evidence supports a change.
- If effects or automation are proposed, name the placed track, signal problem,
  exact relationship being fixed, and preview/render listening test.
- Prevent clipping and large spectral effects from masking the music's hard
  stops, especially 67.0–69.0s.

## Phase 7 — generated-media plan

For each proposed generated asset:

- explain why native HTML/SVG/WebGL motion is insufficient;
- select the matching `fal-recipes` route, or explicitly say none fits;
- in REVIEW MODE, provide only the asset brief and quality plan;
- include prompt intent, continuity anchors, aspect ratio, duration,
  alpha/background requirement, first/last-frame strategy, frame rate, codec,
  and local output destination;
- define rejection checks for misspelled type, logo deformation, temporal
  warping, bad alpha edges, style mismatch, broken reverse motion, and reset
  artifacts;
- provide a non-generative fallback.

For the puffy word treatment, prefer a first-frame / last-frame or controlled
product-reveal workflow. Do not launch a paid fal.ai job without explicit
approval. Inspect endpoint schema and price before a future run, preserve the
approved word exactly, and download the result into local project assets.

## Phase 8 — validation and review gates

### Gate A — treatment review

- Gate 0 asset status;
- baseline diagnosis;
- north-star system;
- component disposition matrix;
- complete shot map;
- explicit exclusions;
- user approval.

### Gate B — storyboard and proof design

- before/after contact sheet at identical timecodes;
- proof poses for every signature system;
- type fit and visual hierarchy;
- continuity diagram for any body spanning shots;
- approval before full build.

### Gate C — structural build

- probe CLI freshness before the first render-affecting command;
- note that the project currently pins HyperFrames `0.6.75` and its package
  script uses deprecated `validate` / `inspect` aliases; upgrade only through
  the prescribed checked-and-verified project flow, and never leave an
  unverified version bump;
- search the local HyperFrames catalog before hand-authoring a motion primitive;
- do not enable the optional ~33 MB semantic catalog tier without consent;
- run `npx hyperframes lint` after the first structural pass and major changes;
- preserve one paused registered timeline per composition;
- eliminate ID, media, network, timeline, and determinism errors.

### Gate D — final technical check

- run `npx hyperframes check --snapshots` as the final gate;
- add explicit samples at every seam and these critical global times:
  `0, 6, 13.8, 25.3, 33, 40.5, 48.5, 51, 56, 63.5, 67, 69, 81, 89, 96, 100.5, 103`;
- sample transition starts and ends;
- verify every sub-composition with at least one visible midpoint snapshot;
- use `*.motion.json` assertions for signature entrances, state order, in-frame
  behavior, liveness, and Shot 09's 67–69s hold;
- run keyframe diagnostics against the real animated subject, not a helper;
- prove first pose, peak mechanism, final-minus-hold, and exact final frame;
- verify forward and reverse scrubbing;
- verify identical timecodes reproduce identical pixels;
- confirm no black/reset tail or debug overlay.

### Gate E — editorial and audio QA

- every claim is readable for its intended hold;
- important motion lands on documented anchors;
- no competing spectral treatments run simultaneously;
- no halo crop, liquid-topology pop, tile aliasing, shader banding, audio
  discontinuity, or unintended silence;
- Shot 09 is fully frozen from 67.0 through the 69.0 cut;
- the end card retains a clean, still hold.

### Gate F — final review

- open the Studio timeline only after checks pass;
- compare baseline and candidate frames at identical timecodes;
- state exactly what improved and what was deliberately left unchanged;
- wait for explicit approval before rendering.

### Gate G — delivery

- render high quality only after final approval;
- verify a non-empty output, 1920×1080, 30fps, and plausible ~103s duration;
- inspect the opening, every seam, every proof moment, the hard-stop hold, and
  the exact final frame.

## Editorial quality tests

- **Removal test:** if removing an effect does not weaken meaning, continuity,
  or brand memory, remove it.
- **Thumbnail test:** every act needs a distinct silhouette and hierarchy at
  small scale.
- **Mute test:** the story remains understandable without audio.
- **Blur test:** dominant hierarchy survives when detail is defocused.
- **Scrub test:** every arbitrary frame looks intentional.
- **Identity test:** a persistent AIR body feels like the same object across
  every state.
- **Restraint test:** the closing 14 seconds feel like resolution, not leftover
  component coverage.
- **Attribution test:** no generated or borrowed asset advances without clear
  provenance and usage rights.
- **Performance test:** every expensive shader, canvas, or SDF system earns its
  frame time and has a proven fallback.

## Required output

Return exactly these sections:

1. Executive verdict
2. Evidence, assumptions, and Gate 0 asset status
3. Current strengths to preserve
4. Highest-leverage problems
5. North-star visual system
6. Component disposition matrix
7. Shot-by-shot redesign map
8. Cross-shot object-continuity map
9. Audio and generated-media plan
10. P0 / P1 / P2 file-level implementation plan
11. Validation and proof-frame plan
12. Explicit exclusions and rejected ideas
13. Approval decision requested

End with one concise approval request. Do not edit or render in REVIEW MODE.
