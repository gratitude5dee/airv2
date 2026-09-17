---
schema: air.goal.v1
appname: <appname>
template: landing
theme: <atmosphere|pixel>
lite: true
budget_usd: <n>
---
# Outcome
<one paragraph: what is being promoted, the URL at link.wzrd.tech/<username>/<appname>, viewers are guests; the owner edits nothing at runtime>

# Screens
## hero
- purpose: the promise, seen in one glance
- components: [air, arlan/swing-type, fancy/vertical-cut-reveal, arlan/squircle]
- data: none (static copy)
- copy: kicker "<kicker>", headline "<headline>", subline "<subline>", cta "<cta label>" → <cta href>
- data-test hooks: [headline, cta]
## proof
- purpose: a strip of social proof chips under the fold
- components: [fancy/simple-marquee]
- data: none
- copy: <3–6 short chips, "Sold out · <city>" shape>
- data-test hooks: [proof]

# Actions
- none (a funnel that collects a name is the `tool` template)

# Functions
none

# Tests   (this array is air.json.tests[]; locked tests are the Planner's)
[
  { "id": "hero-visible", "see": "<headline>", "locked": true },
  { "id": "cta-link", "tap": "[data-test=cta]", "expectHref": "<cta href>", "locked": true },
  { "id": "proof-visible", "see": "<first chip text>" }
]

# Acceptance
- 0 hard findings · qa_score ≥ 70 · all tests pass · lite budget

# Out of scope
- payments, sign-ups, counters, more than one hero motion
- the rush-type hero unless surface.lite is false (then swing-type is the lite fallback)

# Build log   (Builder appends; never edits above)
