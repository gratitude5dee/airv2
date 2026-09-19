# Air Launch

HyperFrames source project for the `air by WZRD.tech` launch film.

**v3.5, the iMessage cut, is built.** Fourteen shots over the vstar track, 119.699 s, cut to the beat grid in `v3/cutsheet.json`. `PLAN-v3.md` is the brief; section 13 records what shipped and section 14 records the v3.1 rebuild (camera, takeovers, Arlan Vault effects) section 15 the v3.2 pass (sound design, the audio-driven grade, the app icon), section 16 the v3.3 notes pass (foley level, no app-count claims, no carousels or orbits, and every phone in the film — the end card's included — lit and mid-conversation), section 17 the v3.4 component pass (ten React Bits studies added, then reverted in the next pass), and section 18 the v3.5 pass (the component pass reverted back to v3.3, the cold open now plays on music alone, and a real MP3 intersample-peak clipping bug fixed with a true-peak-aware limiter). `v3/COMPONENTS-v3.md` holds the component rulings. The v2 compositions are gone from the tree (git history keeps them); `PLAN-v2.md` and `STORYBOARD.md` stay as the source of the approved claim copy.

Every composition loads GSAP from `vendor/gsap.min.js`. The render browser has no outbound
network, so pointing them back at a CDN breaks the render.

## Open locally

```bash
npm run dev
```

The Studio URL is printed in the terminal. It supports timeline scrubbing and live-reloads source edits.

## Validate and render

```bash
npm run check
npm run render -- --quality high --output renders/air-launch-v3.mp4
```

The raw render is about 120 MB; the committed master is a CRF 20 delivery encode of it at 58 MB, which fits GitHub's file limit and is visually indistinguishable.

## Project map

- `PLAN-v3.md` — v3 build brief: north star, music spine, systems, shot specs, fal briefs, gates, build order
- `v3/cutsheet.json` — 14 shots, 115 anchors snapped to downbeats / beats / onsets, snapshot seams, parallax stack
- `v3/make_cutsheet.py` — regenerates `v3/cutsheet.json` from `audiomap.json` (edit anchors there, never the JSON by hand)
- `v3/COMPONENTS-v3.md` — ADOPT / ADAPT / REFERENCE ONLY / REJECT for every catalog, Arlan Vault and React Bits item
- `index.html` — master sequence and timing: sky, scrim, bloom, fourteen shot tracks, bgm, grade
- `compositions/` — `sky.html` plus the fourteen seek-safe HTML/GSAP shots
- `assets/icons/` — the clay mini-app icons the `/home` grid shows
- `vendor/gsap.min.js` — GSAP 3.14.2, vendored because the renderer has no network
- `assets/bgm-mix.mp3` — what the film plays: the vstar track with the 84-cue foley layer mixed under it (nothing under the first 10.17 s)
- `assets/bgm-music-only.mp3` — the untouched track, and the source of truth for `audiomap.json`
- `assets/bgm.mp3`, `assets/bgm-v2-passwords.mp3` — the raw vstar file and the v2 track, reference only
- `audiomap.json` — canonical beat-grid analysis of vstar (`analyze-beatgrid.py`); `audiomap-v2.json` is the v2 track's
- `fonts/` — Inter 400/700, Newsreader, Azeret Mono (real WOFF2)
- `logos/air-icon.svg` — the app icon, rebuilt as vector so it can scale and animate
- `logos/` — supplied and partner logo assets; `wzrdtech-chrome.png` is the chrome wordmark
- `renders/stills/` — hero stills pulled from the render (the iPhone frames for air.wzrd.tech)
- `renders/air-launch-v3.mp4` — the delivered master, 1920x1080 / 30 fps / h264 + aac, 58 MB, committed so it has a download URL
- `renders/` — render output; rebuild with
  `npm run render -- --quality high --output renders/air-launch-v3.mp4` (about 20 minutes here)
- `STORYBOARD.md`, `PLAN-v2.md` — v2 scene plan and approved claim copy
- `REVIEW-PROMPT.md` — gate doctrine and disposition rubric (applies to v3 unchanged)
