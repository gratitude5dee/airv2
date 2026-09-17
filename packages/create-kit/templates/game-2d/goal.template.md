---
schema: air.goal.v1
appname: <appname>
template: game-2d
theme: <atmosphere|pixel>
lite: true
budget_usd: <n>
---
# Outcome
<one paragraph: the game in one sentence, the URL at link.wzrd.tech/<username>/<appname>, guests play, the owner keeps the high score>

# Screens
## play
- purpose: one canvas, one tap, a score that climbs while you live
- components: [air, arlan/typer, beautiful/value-pill, fancy/basic-number-ticker]
- data: useAirState `best` ({ best: number }); owner-writable, guest read-only
- copy: title "<title>", hint "<tap to …>", play "<Play>", over "<Crashed>"
- data-test hooks: [title, stage, score, status, start, jump]

# Actions
- start: guest → local world → resets and runs the loop
- jump: guest → local world → the one input
- save-best: owner → best → written on game over when score > best

# Functions
none

# Tests   (this array is air.json.tests[]; locked tests are the Planner's)
[
  { "id": "title-visible", "see": "<title>", "locked": true },
  { "id": "game-runs", "tap": "[data-test=start]", "wait": 1100, "changed": "[data-test=score]", "locked": true },
  { "id": "guest-plays", "role": "guest", "see": "<Play>" }
]

# Acceptance
- 0 hard findings · qa_score ≥ 70 · all tests pass · lite budget
- 16 ms frames on a phone: rects and arcs only, no filters, no per-frame allocation

# Out of scope
- leaderboards (many writers need Functions), sound, particles, screen shake
- WebGL of any kind (that is the `game-3d` template)

# Build log   (Builder appends; never edits above)
