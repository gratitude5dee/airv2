## 4. Effects vocabulary

Owners name looks, not components: "make the title glitch", "an aurora behind it", "a card that tilts", "a trail behind my finger". This section maps {{count}} named effects from two public catalogues — the React Bits public index (`reactbits.dev/llms.txt`, MIT + Commons Clause, Tier B) and the arlan.me vault (MIT, Tier A, including the three studies harvested from owner briefs) — onto what the Kit does for each. The data is `prompts/src/effects.json` (annotated for the Kit on {{captured}}, each entry audited by an independent verifier; evidence in `evidence/catalogues/`); this section is rendered from it by `scripts/lib/effects.ts`, never hand-edited.

Read a line as: **Name** · how · flags — what it is and, where the verb needs it, what to do. `how` is one of:

- `@kit/<id>` — a Tier A component already gives this look (or its touch-native counterpart, and the line says so). Import it; do not rebuild it. The flags are that component's measured lite / touch / reduced-motion behaviour from §3.
- `@kit/restricted/<name>` — one of the thirteen React Bits backgrounds compiled from the private Tier B artifact. Non-lite; the surface must not be `lite`, and you supply the still frame under reduced motion.
- `pack` — worth adding to the Tier B artifact (a shader, physics or 3D piece that is hard to rebuild well) but not in it yet. Do not build it; use the packed background the line names, or decline when it names none.
- `build` — implement an original from the one-line look and the `Build:` sentence that follows it. Never copy upstream source; the line is the brief. The flags describe the original you will write (renderer, lite, touch, still frame), not the catalogued source.
- `no` — not for a mini-app; the line names the rule it breaks and, when a Kit component gives the same read on a phone, the component to use instead; `Instead: none` means there is no substitute, and you say so to the owner.

Text and card effects split between `@kit` and `build`; backgrounds are where `@kit/restricted` and `pack` live; cursor-driven and scroll-driven effects are `no`. Tags feed the same groups as the catalog; "fits" names the recipes and templates the effect suits.
