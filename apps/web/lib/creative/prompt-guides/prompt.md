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

### Flux (`flux-1-dev`)
One-sentence scene followed by concise comma-separated visual tags. Strong
at photorealism and graphic composition; always specify camera and lighting.

> Example: A courier cycling through rain at night. neon reflections, 85mm,
> shallow depth of field, cinematic teal-orange, motion blur on wheels.

### Seedream (`seedream-4-0`)
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

### Nano Banana (`nano-banana`)
Short imperative instruction, one change per request. Identity preservation
is strong — say "the person in the image" instead of re-describing them.

> Example: Give the person in the image a red beanie. Change nothing else.

### Reve (`reve-edit`)
Precise spatial language: name the region, then the replacement. Excellent
typography edits — quote exact replacement text.

> Example: On the storefront sign at the top, replace the text with
> "WZRD BAKERY" in the same font and color.

### Qwen Edit (`qwen-image-edit`)
Plain instruction plus a short description of the desired result. Strong
style transfer; state "keep composition unchanged" when it matters.

> Example: Repaint this photo as a loose watercolor with visible paper
> texture. Keep composition unchanged.

## /animate — video generation

### Seedance 2.0 (`seedance-2-0-fast-260128`) — default
Shot direction: subject action → one camera move → environmental motion →
light behavior → ambient sound. One continuous motion; with a first frame,
describe only what changes.

> Example: The dancer spins once and lands facing camera, slow push-in,
> curtains swaying, stage light warming from blue to amber, soft crowd murmur.

### Seedance 2.5 (`seedance-2-5`)
Same structure with better multi-shot coherence — up to two cuts allowed
("cut to close-up"). Name audio cues explicitly.

### LTX (`ltx-2`)
Motion-first: lead with the movement verb, keep the scene simple. One
subject, one camera move, flat lighting descriptions.

### Happyhorse (`happyhorse-video`)
Stylized, expressive motion. Describe mood and energy alongside the action;
strong for character animation and seamless loops.

### H3 (`h3-video`)
High-fidelity realism. Write like a cinematographer — lens, depth of field,
natural physics ("handheld 35mm, shallow focus"). Avoid surreal instructions.

## /zap — video editing

### Google Omni (`gemini-omni-flash-preview`) — default
Tight kinetic 3–6 second instruction: one subject, one motion, one strong
visual hook. With attached video, phrase it as an edit instruction; attached
images are shared visual context.

> Example: Make the skateboard trail rainbow light as it lands, quick whip
> pan to the rider's grin.
