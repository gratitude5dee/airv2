# Catalogue evidence — 2026-09-17

Public component catalogues captured for the Kit's effects vocabulary (`prompts/src/effects.md`, DESIGN.md §4) and the Tier B pack plan (`restricted/README.md`). Nothing in this directory is component source; every file is a public index, a description, or the Kit's own annotation of one. This directory is skipped by `scripts/verify.ts`'s Tier B fingerprint scan on purpose: the catalogue names the restricted library, the Kit never ships it.

| File | What | Provenance |
| --- | --- | --- |
| `component-prompts-2026-09-17.csv` | 190 rows: `source, category, name, canonical_url, cli_identifier, scraped_description, implementation_prompt` — 172 React Bits components (32 Text Animations, 38 Animations, 45 Components, 57 Backgrounds) and 18 arlan.me vault studies | Supplied by the owner on 2026-09-17 as the hand-off artifact of a crawl of `https://reactbits.dev/llms.txt` (the library's official public AI catalogue) and `https://arlan.me/sitemap.xml` plus each public study page, both crawled 2026-09-17. sha256 `6d844044275df7f5a7c66a3b4fa8c284dbdefea9d7bf0a9c9ea15628ab367a59`. The `implementation_prompt` column is a templated original adaptation written by the crawler (one template for all React Bits rows), not upstream text; the `scraped_description` column is the upstream one-liner |
| `kit-annotations-2026-09-17.json` | The Kit's annotation of every row: renderer, lite, touch, reduced motion, scroll linkage, CSP risk, disposition (`kit-a-equivalent`, `tier-b-packed`, `tier-b-pack-candidate`, `build-original`, `not-for-miniapp`), Kit equivalent, when-line, tags, recipe and template fit, weight estimate, confidence, plus the adversarial verifier's corrections | Produced 2026-09-17 by the annotate → refute workflow described in `docs/goal-create-v12.md` §11.3; each chunk annotated once and audited once by an independent verifier |
| `reactbits-pack-plan-2026-09-17.json` | The Tier B extension list derived from the annotation: every `tier-b-packed` and `tier-b-pack-candidate` React Bits component with its CLI identifier, category, an `upstream` path **guess** in the `src/content/<Category>/<Name>/<Name>.jsx` layout the current allowlist uses, and `verify: true` | Derived; the operator confirms each path against a checkout before adding it to `restricted/allowlist.json` (see `restricted/README.md`) |

## License posture

- **React Bits** (`DavidHDev/react-bits`): MIT + Commons Clause. Compiled use inside an application is permitted; redistribution of the components as source, alone or ported, is not (CR11). Only names, URLs, one-line descriptions and the Kit's own annotations are recorded here. Source enters the Build Service only through the private restricted artifact.
- **arlan.me vault** (Arlan Marat): MIT by the footer statement on every study page ("MIT → free to copy", see `../arlan/license-page.md`). Tier A; harvested studies live under `kit/arlan/`.

## How the Kit uses this

1. `scripts/lib/design.ts` folds `prompts/src/effects.md` into DESIGN.md §4 so the Planner can resolve a named look to `@kit/<id>`, `@kit/restricted/<name>`, `pack`, `build` or `no` in one lookup.
2. `restricted/README.md` points the operator at the pack plan when extending the Tier B artifact.
3. `../arlan/vault-index-2026-09-17.md` records the vault's 18 studies with the Kit decision for each, superseding the 2026-09-04 index for anything listed in both.
