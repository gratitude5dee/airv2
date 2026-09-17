# arlan.me vault — owner-supplied briefs, 2026-09-17

Three typographic studies were supplied by the owner on 2026-09-17 as complete "Build this:" briefs with source (`prompts/src/briefs/{shutter,swing,rush}-type.md`). They are captured under `upstream/<slug>/` exactly as supplied (params, engine, card) and indexed in `capture.json` with `capturedAt: 2026-09-17`; the `sha256` there is over the concatenated source blocks, because no page HTML was fetched — `arlan.me` was unreachable from the harvesting environment and the 2026-09-17 sitemap crawl (`../catalogues/component-prompts-2026-09-17.csv`) does not list these slugs.

| Slug | Files | Renderer | Kit id |
| --- | --- | --- | --- |
| `shutter-type` | `params.ts`, `engine.ts`, `ShutterTypeCard.tsx` | Canvas 2D | `arlan/shutter-type` |
| `swing-type` | `params.ts`, `engine.ts`, `SwingTypeCard.tsx` | Canvas 2D | `arlan/swing-type` |
| `rush-type` | `params.ts`, `engine.ts`, `RushTypeCard.tsx` | WebGL1 (non-lite) | `arlan/rush-type` |

License basis: the vault's footer statement "MIT → free to copy" (`license-page.md`) as for every other harvested study, on the owner's assurance that the briefs come from the vault. Re-verify each study's page and footer with `harvest --refresh --only arlan/<slug>` once the site is reachable; if a page or its footer is missing, move the component to `gaps` in `scripts/lib/sources.ts` and drop the directory.
