---
name: skeuomorphic-button-depth
description: >-
  Give any button, control, or surface real physical depth in CSS — glossy,
  metal, glass, matte, neon, recessed, and more — in any colour or mode, not just
  dark. Use whenever a button/pill/icon/toggle/card should read as a tactile
  object instead of a flat rectangle. Teaches the layering method (so you can
  build any material on any shape) plus ten ready techniques.
---

# Skeuomorphic button depth

Depth is never one drop shadow. It is many faint layers stacked on the same
element, each faking one part of how light meets a real surface: the body, the
bevel, the inner glow, the reflection. Learn the layers and you can dress any
button in any material — this works in light, dark, or full-colour palettes; the
colours are variables, the method is fixed.

## The one rule everything obeys

Pick a single light direction and commit every layer to it. By default the light
is from the **top**: bright edge on top, dark edge on the bottom, on every
element in the group. The moment two controls disagree about where the light is,
the illusion breaks. Flip the direction only on purpose (a pressed or recessed
control, below).

The surface also has to sit apart from what's behind it — a raised button needs a
background a step darker or lighter than itself, or its lift shadow has nothing to
lift off.

## The layer recipe

Build any material from the same four layers, outermost first:

1. **Body** — usually a top-to-bottom gradient, lighter at the top so the face
   reads as lit from above. `background: linear-gradient(180deg, <light>, <dark>)`.
   A flat fill is fine for matte materials; the doming then comes from step 2.

2. **Inset shadows** — the bevel and inner light, all `box-shadow` with `inset`:
   - a bright inset at the **top** = the lit bevel edge,
   - a dark inset at the **bottom** = weight and thickness,
   - broad soft inner glows = a domed, internally-lit face,
   - a hairline `inset 0 0 0 1px` = a crisp rim that catches light.

3. **Hover layer (`::before`)** — a second, brighter version of the body/insets
   that fades in on hover: "the light turning on." Keep the label above it with
   `isolation: isolate` (or a `z-index` on the text).

4. **Specular (`::after`)** — a soft bright bar or blob near the top edge
   (`linear-gradient` white → transparent, a touch of `blur`, low opacity): the
   reflection on glossy plastic or glass. Move or brighten it on hover for life.

Not every material uses all four — matte uses 1–2, neon leans on the rim, glass
adds real `backdrop-filter`. Add only the layers the material needs.

## Raised vs recessed

Two opposite reads, same toolkit, mirrored:

- **Raised** (sits on the page): bright inset on top, dark inset on the bottom,
  and an outer drop shadow to lift it off the background.
- **Recessed** (carved into the page): flip it — a dark inset on top (the near
  wall in shadow), a bright inset on the bottom (the far wall catching light),
  and **no** outer shadow. Make the fill close to the page colour so it looks
  like the same surface pushed inward, not a separate dark chip.

On press, a raised control should briefly become recessed (swap the outer lift
for inner shadows, ~50ms), so it visibly pushes in.

## Build order (for compound controls)

For anything with parts — a toggle, a segmented control, a stepper — layer from
the outside in, and don't skip a level:

1. the surface behind it (a step darker/lighter than the control),
2. the raised shell / track (the material lives here),
3. any recessed zones inside it (a track well, an active-segment notch),
4. the raised moving parts (a knob, a thumb) — same material as the shell unless
   you want deliberate contrast,
5. the readout on top (label, value, icon).

Put the material on the **container**, not each cell, so a compound control reads
as one carved piece.

## Rules

1. **One element, many layers.** Use `::before`/`::after` for the glow and sheen,
   not extra DOM. `isolation: isolate` keeps the label on top.
2. **Commit to the light direction** (see above). No element disagrees.
3. **Tint the layers toward the material**, don't just add black/white — cyan
   inside a blue glass, warm white inside a warm gel.
4. **Press = invert.** `:active` swaps lift for inner shadow (or collapses the
   sheen). Short transition (~50ms).
5. **Motion is subtle.** The material sells the depth; a hover doesn't need a big
   lift or scale. A moving highlight beats a moving button.
6. **Respect reduced motion.** Guard transforms/animations with
   `@media (prefers-reduced-motion: reduce)`.
7. **Stay compact.** Real controls are dense: tight padding, ~13–15px labels,
   restrained icons. Reach for smaller spacing before bigger type.

## Anti-patterns

- A flat block with a single soft shadow and no inset layers.
- Light coming from different directions on neighbouring controls.
- Glow so bright it erases the form underneath.
- A "recessed" control whose shadows are oriented like a raised one (it pops out).
- A raised control on a background lighter/brighter than itself (nothing to lift
  from).
- One shared inset behind several buttons when each wants its own well.

## Any shape, any palette

The same `depth-btn` base + one material class works on more than a text pill.
This entry ships the label pill, a square **icon** button (`.depth-icon`), and a
**toggle** switch (the material on the track, a sliding knob on top) — and the
method extends to steppers, cards, inputs, or any control you need. Colour is a
value you swap: retint the gradient stops and inset colours and the same material
becomes a new theme.

## Types

Ten techniques, named by method (colour is just a value you swap). Same markup,
one class swap:

- **Glossy** (`depth-glossy`) — a specular highlight bar over a gradient body.
- **Glow** (`depth-glow`) — a solid body lit from inside; hover turns it up.
- **Metal** (`depth-metal`) — a brushed bevel with a glint that follows the cursor.
- **Foil** (`depth-foil`) — iridescent holographic metal; five stacked light layers
  that shift and glare under the cursor (needs its child layers + a tiny pointer
  driver for --pointer-x/y, --glare-x/y, --shine-angle).
- **Layered** (`depth-layered`) — soft translucent overlays over any fill.
- **Inset** (`depth-inset`) — recessed into the surface; the bevel is flipped.
- **Glass** (`depth-glass`) — subtle refraction through an SVG displacement filter.
- **Neon** (`depth-neon`) — a crisp lit outline; a clean ring, not a bloom.
- **Duotone** (`depth-duotone`) — a hard-bevel extruded key from stacked shadows.
- **Satin** (`depth-satin`) — a soft smooth pastel; diffuse light, no gloss or grain.

## Drop-in CSS

A complete `color-depth.css` implementing all ten is the companion to this skill.
Markup is always the same; only the second class changes:

```html
<button class="depth-btn depth-glossy">
  <span class="depth-label">Get Started</span>
</button>
```
