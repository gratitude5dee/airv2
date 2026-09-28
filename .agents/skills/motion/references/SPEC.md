# /motion spec

The contract every `/motion` run satisfies. If a run deviates, it says so in `notes`.

## Inputs

| Input            | Required | Notes                                                          |
| ---------------- | -------- | -------------------------------------------------------------- |
| repo             | yes      | Git repo to market; latest features = `git log` since last tag |
| music track      | yes      | `assets/bgm.mp3` after transcode; the beatgrid is canonical    |
| fal budget       | yes      | USD cap for generation; default $10, hard stop                 |
| aspect           | no       | 16:9 default, 9:16 for mobile/social products                  |
| duration         | no       | 60–120s                                                        |
| readme refresh   | no       | PR only when README is clearly stale vs the code               |

## fal ledger

Track every generation call in `fal-ledger.json`: `{model, kind, unit_usd, n, total_usd}`.
Never exceed the budget; when a generation would overflow it, drop to stills or reuse
repo assets. Typical healthy spend: 5–15 stills + 0–2 short clips.

## Grading rubric (autograde)

Score each axis 0–10 after every render; the video's score is the mean. Weakest axis
is the fix target for the next pass.

| Axis              | 10 looks like                                                          |
| ----------------- | ---------------------------------------------------------------------- |
| Legibility        | Type readable at every sampled frame; contrast held on busy plates     |
| Beat sync         | Cuts/text hits land within ±80ms of `beats_sec`/`key_moments`          |
| Design cohesion   | One type system + palette end to end; no orphan styles mid-video       |
| Brand consistency | Logo/name/tag appear correctly; end card matches repo's visual identity|
| Story clarity     | Cold-open hook → what → 3–4 features → payoff → end card, no dead air  |

Ship bar: **≥8.5 mean, or 3 loops** (log in `GRADE.md`, one line per pass:
`pass N — score X — changed: ...`).

## SFX budget

≤2 subtle accents per video (apex hit, end-card whoosh). Synthesize with ffmpeg
first; fal sound generation only if the budget has room. BGM always present, ducked
−6 to −10dB under any voiceover.

## Recurring automation contract

The daily automation fires with a repo candidate list. For each repo:

1. Skip repos that already have a `*-launch.mp4` delivered in the last N days
   (or a pinned `launch-video` artifact) — idempotent by default.
2. Run the full pipeline above.
3. Report per repo: video URL, autograde score, fal spend, README PR (if any).

Sessions spawned by the automation run at the strongest available agent mode
(SWE-2 Max where the org allows it).
