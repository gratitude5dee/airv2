# Creative model prompt guides

Per-model prompting guidance for the creative lanes (`/imagine`, `/edit`,
`/animate`, `/zap`). The machine-readable copy of each guide lives in
`../model-prefs.ts` (`LANE_MODELS[lane][n].guide`); the router appends the
selected model's guide to its system prompt so the compiled brief is
optimized for the model that will actually render it. Keep the two in sync.

## /imagine — image generation

### OpenAI Image 2 (`gpt-image-2-generate`) — default

Dense natural-language brief ordered subject → action → setting → lighting →
lens or medium → color palette → mood. Best-in-class rendered text: put the
exact copy in double quotes. Never use negative prompting.

> Example: A ceramicist shaping a tall vase at a sunlit wheel, cluttered
> studio shelves behind, warm window light from the left, 50mm photo, muted
> terracotta palette, focused calm. Sign reads "OPEN STUDIO".

### Flux (`Flux2-Dev`)

One-sentence scene followed by concise comma-separated visual tags. Strong
at photorealism and graphic composition; always specify camera and lighting.

> Example: A courier cycling through rain at night. neon reflections, 85mm,
> shallow depth of field, cinematic teal-orange, motion blur on wheels.

### Seedream (`seedream-4-0-250828`)

Cinematic one-paragraph description leading with style keywords, then
subject and setting. Handles multi-subject scenes well; keep rendered text
minimal.

> Example: Editorial photo, golden hour — two chefs plating dessert in a
> steel kitchen, steam catching the low sun through the pass, candid energy.

## /edit — image editing

### OpenAI Image 2 Edit (`gpt-image-2-edit`) — default

Describe only the change and name what must stay identical first.

> Example: Same person, same pose and lighting — replace the denim jacket
> with a black leather jacket. Keep the background unchanged.

### Nano Banana (`gemini-3.1-flash-image`)

Short imperative instruction, one change per request. Identity preservation
is strong — say "the person in the image" instead of re-describing them.

> Example: Give the person in the image a red beanie. Change nothing else.

### Reve (`reve-edit-20250915`)

Precise spatial language: name the region, then the replacement. Excellent
typography edits — quote exact replacement text.

> Example: On the storefront sign at the top, replace the text with
> "WZRD BAKERY" in the same font and color.

## /animate — video generation

### Seedance 2.0 (`seedance-2-0-fast-260128`) — default

Shot direction: subject action → one camera move → environmental motion →
light behavior → ambient sound. One continuous motion; with a first frame,
describe only what changes.

> Example: The dancer spins once and lands facing camera, slow push-in,
> curtains swaying, stage light warming from blue to amber, soft crowd murmur.

### Seedance 2.5 (`seedance-2-5-260628`)

Same structure with better multi-shot coherence — up to two cuts allowed
("cut to close-up"). Name audio cues explicitly.

### LTX (`ltx-2-fast-text-to-video`)

Motion-first: lead with the movement verb, keep the scene simple. One
subject, one camera move, flat lighting descriptions.

### Happyhorse (`happyhorse-1.1-t2v`)

Stylized, expressive motion. Describe mood and energy alongside the action;
strong for character animation and seamless loops.

### H3 (`MiniMax-H3`)

High-fidelity realism. Write like a cinematographer — lens, depth of field,
natural physics ("handheld 35mm, shallow focus"). Avoid surreal instructions.

## /zap — video editing

### H3 Max Turbo (`minimax/h3-max`, fal) — default

Direct one-shot film direction, 5–10 seconds, with the sound directed as
deliberately as the picture. Give each reference an explicit job: the first
image is the opening frame, a second image is the closing frame, any others
are visual context. Order shot → subject action → one named camera move with
lens and film language ("handheld 35mm push-in, shallow focus, fine grain") →
lighting → style or mood → audio as a plain instruction covering ambience,
effects, and music. Use a timed beat list when the shot has distinct beats and
time audio cues to the beats. The model renders legible on-screen text: quote
exact titles or UI copy and say how the type animates. Name the framing in
words — "horizontal" for 16:9, "vertical" for 9:16. Long concrete briefs
are fine. No negatives, no tag soup. Attached video is not an input this model
accepts, so the shot is described in full instead.

> Example: Low-angle handheld 35mm shot, fine grain — skateboard lands and
> throws a rainbow light trail; whip pan to the rider's grin, hard afternoon
> sun, sun-bleached skate-video mood. 0-2s the landing, 2-5s the pan, title
> "GOLDEN HOUR" resolves from blur at 4s. audio: wheels on concrete and a
> crowd cheer on the landing, no music.
