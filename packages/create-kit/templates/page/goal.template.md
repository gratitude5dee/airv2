---
schema: air.goal.v1
appname: <appname>
template: page
theme: <atmosphere|pixel>
lite: true
budget_usd: <n>
---
# Outcome
<one paragraph: who or what the page is about, the URL at link.wzrd.tech/<username>/<appname>, viewers are guests; nothing is written at runtime>

# Screens
## title
- purpose: the name, once, with the shutter type as the hero
- components: [air, arlan/shutter-type, fancy/text-highlighter]
- data: none
- copy: kicker "<kicker>", title "<title>", lede "<one sentence>" with "<phrase>" highlighted
- data-test hooks: [title]
## sections
- purpose: two to four short sections of copy
- components: [air]
- data: none
- copy: <heading + one or two sentences each>
- data-test hooks: [section-<id>]
## links
- purpose: where to go next
- components: [air]
- data: none
- copy: <label → href, two to four rows>
- data-test hooks: [link-<n>]

# Actions
- none

# Functions
none

# Tests   (this array is air.json.tests[]; locked tests are the Planner's)
[
  { "id": "title-visible", "see": "<title>", "locked": true },
  { "id": "first-link", "tap": "[data-test=link-1]", "expectHref": "<first href>", "locked": true },
  { "id": "section-visible", "see": "<first section heading>" }
]

# Acceptance
- 0 hard findings · qa_score ≥ 70 · all tests pass · lite budget

# Out of scope
- forms (the `tool` template), galleries beyond one image, more than one hero motion

# Build log   (Builder appends; never edits above)
