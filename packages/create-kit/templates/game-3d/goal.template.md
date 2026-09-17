---
schema: air.goal.v1
appname: <appname>
template: game-3d
theme: <atmosphere|pixel>
lite: false
budget_usd: <n>
---
# Outcome
<one paragraph: the game in one sentence, the URL at link.wzrd.tech/<username>/<appname>, guests play; lite and reduced-motion viewers get one complete still frame>

# Screens
## play
- purpose: a spinning cube, tap while it glows
- components: [air, fancy/scramble-in, fancy/basic-number-ticker]
- data: local state only (score, status); no useAirState until a best score is asked for
- copy: title "<title>", hint "<tap when …>", start "<Start>", still "<Still frame — …>"
- data-test hooks: [title, status, scene, poster, still, score, hit, start, tap]

# Actions
- start: guest → local → runs the round (<n> s)
- tap: guest → local → +1 while the cube glows

# Functions
none

# Tests   (this array is air.json.tests[]; locked tests are the Planner's)
[
  { "id": "title-visible", "see": "<title>", "locked": true },
  { "id": "start-runs", "tap": "[data-test=start]", "wait": 400, "changed": "[data-test=status]", "locked": true },
  { "id": "still-frame", "see": "<still copy prefix>" }
]

# Acceptance
- 0 hard findings · qa_score ≥ 70 · all tests pass · under the 1 MiB hard budget (not lite)
- one complete still frame under lite, reduced motion and no WebGL (metal-fx rule)

# Out of scope
- `three` until it is vendored with an SBOM entry (MC5); the scene is Canvas 2D today
- shadows, postprocessing, more than one light, audio

# Build log   (Builder appends; never edits above)
