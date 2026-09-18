# Air Launch

HyperFrames source project for the `air by WZRD.tech` launch film.

**Current build target: v3, the iMessage cut.** Read `PLAN-v3.md` first; it is the build brief. Timing comes from `v3/cutsheet.json`; component choices from `v3/COMPONENTS-v3.md`. The v2 film (`STORYBOARD.md`, `PLAN-v2.md`, the current `compositions/shot-*.html` and `index.html`) is the baseline v3 replaces and stays in the tree until each v3 shot passes its gate.

## Open locally

```bash
npm run dev
```

The Studio URL is printed in the terminal. It supports timeline scrubbing and live-reloads source edits.

## Validate and render

```bash
npm run check
npm run render
```

## Project map

- `PLAN-v3.md` — v3 build brief: north star, music spine, systems, shot specs, fal briefs, gates, build order
- `v3/cutsheet.json` — 10 shots, 105 anchors snapped to downbeats / beats / onsets, snapshot seams, parallax stack
- `v3/make_cutsheet.py` — regenerates `v3/cutsheet.json` from `audiomap.json` (edit anchors there, never the JSON by hand)
- `v3/COMPONENTS-v3.md` — ADOPT / ADAPT / REFERENCE ONLY / REJECT for every catalog, Arlan Vault and React Bits item
- `index.html` — master sequence and timing (v2 layout; v3 layout in PLAN-v3 §4)
- `compositions/` — individual, seek-safe HTML/GSAP scenes (v2 set; v3 replaces them shot by shot)
- `assets/bgm.mp3` — soundtrack (vstar, 152 BPM, 119.699 s); `assets/bgm-v2-passwords.mp3` is the v2 track, reference only
- `audiomap.json` — canonical beat-grid analysis of vstar (`analyze-beatgrid.py`); `audiomap-v2.json` is the v2 track's
- `fonts/` — Inter 400/700, Newsreader, Azeret Mono (real WOFF2)
- `logos/` — supplied and partner logo assets; `air-brand.png` is the orb, `wzrdtech-chrome.png` the chrome mark
- `renders/` — output folder (renders are not committed unless small)
- `STORYBOARD.md`, `PLAN-v2.md` — v2 scene plan and approved claim copy
- `REVIEW-PROMPT.md` — gate doctrine and disposition rubric (applies to v3 unchanged)
