---
name: motion
description: >
  Produce a finished 60–120s launch video for a repo/product using the HyperFrames
  stack — music-to-video beat-synced structure, real project assets plus fal.ai
  generation inside a hard credit budget, minimal SFX, and a visual-autograde loop
  that scores and self-improves the render before it ships. Use for "launch video",
  "promo", "product video", "repo reveal", or any one-off video package built from a
  codebase's latest features. Also the contract for the recurring
  new-repo → video automation.
---

# /motion — launch video recipe

Input: a repo (or product) + a music track + an asset budget.
Output: one rendered MP4 (60–120s), a `GRADE.md` autograde log, and (optionally) a README-refresh PR.

**Load first, non-negotiable:** `motion-doctrine` (seam law supersedes everything below it in the stack), then `cut-the-curve` for seams and `music-to-video` for the beatgrid workflow. This skill is the recipe that binds them; it does not re-specify motion law.

## Pipeline

### 0 · Repo intake

Clone the repo. Inventory what is real: logos, screenshots, demos, diagrams, README, and — the point of the exercise — the **latest features** (`git log` since the last release/tag, recently merged PRs). Ground every claim in the video to something actually in the tree. If the README is clearly stale relative to the code, open a small `devin/<ts>-readme-refresh` PR (optional; only when obviously warranted).

Work in `videos/<repo-kebab>/`. Init with `hyperframes init <dir> --non-interactive --example=blank --skill=music-to-video` (or `npx hyperframes init`).

### 1 · Music spine

The supplied track is the spine — place it at `assets/bgm.mp3` (transcode from wav first if needed). Run **only** `music-to-video/scripts/analyze-beatgrid.py` for timing (`pip install librosa numpy soundfile`); never re-measure beats by another tool or by ear. Cuts, text hits, and transitions land on its `beats_sec`/`key_moments`; on calm sections pace by phrases and energy, not the imposed grid.

Duration = video length; trim or loop with ffmpeg, fade the tail, duck under any VO (`sidechaincompress` or manual gain curve).

### 2 · Assets — real first, fal second

Use the repo's own assets wherever they exist. Generate the rest with fal.ai (`FAL_KEY` in env):

- **Hard budget: $10 per video.** Track spend in a ledger (requests → unit price) and stop when the budget is out.
- Prefer stills (flux schnell/dev ≈ $0.003–0.03/image) for b-roll, backdrops, and mock-UI plates. Image-to-video only when a shot clearly pays for it (~$0.3–2 per clip).
- Pin a ≥7-day-old model version; write files into `public/` or `assets/` so compositions stay deterministic (local paths only, never remote URLs inside a render).

### 3 · Structure (beats, not features list)

60–120s, aspect for the audience (16:9 default; 9:16 for mobile/social products). Shape:

1. **Cold open (≤8s)** — the one image that makes someone stop scrolling.
2. **What it is** — name + one-line promise, type-led.
3. **3–4 latest features** — each a scene: real UI/screenshot or faithful mock in motion, keyed to the beat. Follow the vector law across seams.
4. **Payoff** — the strongest single frame (feature, result, or metaphor).
5. **End card** — brand lockup (logo + repo/product name + one-line tag) ~3s.

**Minimal SFX:** ≤1–2 subtle accents (a low hit on the apex beat, a soft whoosh into the end card), synthesized via ffmpeg (`sine`, `anoisesrc`, filters) or a single short fal generation if budget remains. No busy sound design — the music is the sound.

### 4 · Render

`npx hyperframes render <project>` (30fps MP4; `-q looks` for review passes, `-q delivery` for final). Keep everything deterministic — no `Date.now()`, `Math.random()`, or network fetches inside compositions.

### 5 · Autograde loop (required before stopping)

Never ship the first render. Each pass:

1. Extract a contact sheet (`ffmpeg -i out.mp4 -vf "fps=1,scale=320:-1,tile=8x8" sheet.png`) + 5–6 full-res frames at key beats.
2. Score /10 across: legibility, beat sync, design cohesion, brand consistency, story clarity (rubric in `references/SPEC.md`).
3. Fix the weakest axis, re-render.
4. Stop at **≥8.5/10 or 3 loops**. Log scores + what changed per pass in `GRADE.md`.

## Deliverables

- `<repo>-launch.mp4` (the master) + `GRADE.md`
- Optional: `devin/<ts>-readme-refresh` PR if the README needed it
- Structured report: `{video_attachment_url, duration_s, aspect, fal_spend_usd, autograde_score, readme_pr_url|null, notes}`

See `references/SPEC.md` for the full contract (budget ledger, grading rubric, recurring-automation parameters).
