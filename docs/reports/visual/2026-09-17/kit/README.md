# Kit visual recordings — 2026-09-17

Recorded with `packages/create-kit/scripts/visual.ts`, which bundles each component exactly as the Kit harness does (vendored React, no network), serves it under the Air shell on a loopback port, and drives the installed Chromium through playwright-core. Viewport 390×760 at 2× device scale, `atmosphere` theme, lite off, reduced motion off, three seconds per component. `manifest.json` lists the render errors observed (zero for all four).

Re-run:

```bash
KIT_PLAYWRIGHT=/path/to/playwright-core KIT_CHROMIUM=/path/to/chrome \
  npx tsx packages/create-kit/scripts/visual.ts --out docs/reports/visual/<date>/kit --seconds 3 \
  arlan/shutter-type arlan/swing-type arlan/rush-type arlan/holo
```

| Component | Video | Frames | What it proves |
| --- | --- | --- | --- |
| `arlan/shutter-type` (new, lite) | `arlan--shutter-type/motion.webm` | `t0_4s`, `t1_5s`, `t3_0s` | The harvested brief runs: at 1.5 s the second phrase ("made visual") is mid-scroll on the paper ground with the type torn into shutter bands; the face is the Kit's `--font-body` (Newsreader), as the harvest patch intends |
| `arlan/swing-type` (new, lite) | `arlan--swing-type/motion.webm` | same | The pendulum row shows only two or three letters at once ("r", "l" of "Arlan" at 1.5 s), coloured per slot on the white field; the word never assembles |
| `arlan/rush-type` (new, non-lite) | `arlan--rush-type/motion.webm` | same | WebGL1 renders through SwiftShader: the resting word "before" is white and sharp on the near-black ground with the faint neutral pool behind it; the still frame is the composition |
| `arlan/holo` (existing) | `arlan--holo/motion.webm` | same | **Defect evidence** for the note added to its ref today: only the hard-coded demo copy ("Kamila / my girlfriend since May 2023") paints — no card plate, foil or pattern — because the `.holo-*` layer stylesheet was never harvested. Fix lands as `patches` in `catalog.ts` plus a re-harvest (goal-create-v12 §11.4) |

Sizes: four WebM files total ≈ 1.1 MB; twelve PNG frames ≈ 5 MB (2× frames of a phone viewport). Delete the PNGs and keep the videos if the directory ever needs to shrink.
