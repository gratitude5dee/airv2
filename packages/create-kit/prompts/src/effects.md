## 4. Effects vocabulary

Owners name looks, not components: "make the title glitch", "an aurora behind it", "a card that tilts", "a trail behind my finger". This section maps 190 named effects from two public catalogues — the React Bits public index (`reactbits.dev/llms.txt`, MIT + Commons Clause, Tier B) and the arlan.me vault (MIT, Tier A) — onto what the Kit actually does for each. It was annotated for the Kit on 2026-09-17 (evidence in `evidence/catalogues/`) and is regenerated, never hand-edited, from that annotation.

Read a line as: **Name** · how · renderer · lite · touch · motion — what it is and when to use it. `how` is one of:

- `@kit/<id>` — a Tier A component already in the Kit covers the look. Import it; do not rebuild it.
- `@kit/restricted/<name>` — a React Bits background compiled from the private Tier B artifact. Non-lite by policy; the surface must not be `lite`, and the poster frame under reduced motion is yours to supply.
- `pack` — a React Bits piece worth adding to the Tier B artifact (shader, physics or 3D that is hard to rebuild well). Until the operator packs it, treat it as `build` if the surface allows, otherwise decline.
- `build` — implement an original version under the contract from the one-line description. Never copy upstream source; the description is the brief. Most text, card, menu and tap effects are `build`.
- `no` — not for a mini-app, with the rule it breaks: no pointer on touch, nothing moves on scroll, WebGL under lite, remote assets, or no phone-sized use. Offer the nearest `build` alternative named on the line.

`lite ✓` means it may appear on a lite surface; `touch ✓` means it works without hover; `motion` is the reduced-motion behaviour (static: complete still frame; reduced: shorter; none: nothing to still; n/a: not animated). Tags feed the same groups as the catalog; "fits" names the recipes and templates the effect suits. Weight is an estimate for an original build, not a measurement.

<!-- ENTRIES -->
