---
schema: air.goal.v1
appname: <appname>
template: store
theme: <atmosphere|pixel>
lite: true
budget_usd: <n>
---
# Outcome
<one paragraph: what is sold, the URL at link.wzrd.tech/<username>/<appname>, guests browse and tap Add; nothing is charged in this version>

# Screens
## bag
- purpose: how many things are in the bag, large
- components: [air, fancy/basic-number-ticker]
- data: local state `bag: string[]` (no useAirState — guests must be able to add)
- copy: kicker "<In the bag>"
- data-test hooks: [bag-count, notice]
## products
- purpose: one featured tile plus a grid of the rest, price on each
- components: [arlan/squircle, beautiful/value-pill]
- data: PRODUCTS[] (id, name, price, note, image?)
- copy: <product names, prices, one-line notes>; images from the owner's media prefix or a token swatch
- data-test hooks: [product-<id>, buy-<id>]

# Actions
- buy: guest → local `bag` → adds the id and shows "<stub notice>"; files nothing (payments are P2, §13)

# Functions
none

# Tests   (this array is air.json.tests[]; locked tests are the Planner's)
[
  { "id": "product-visible", "see": "<featured product name>", "locked": true },
  { "id": "buy-stub", "tap": "[data-test=buy-<featured id>]", "see": "<stub notice prefix>", "locked": true },
  { "id": "bag-visible", "see": "<kicker>" }
]

# Acceptance
- 0 hard findings · qa_score ≥ 70 · all tests pass · lite budget

# Out of scope
- checkout, prices that change, inventory, a cart that survives reload (payments are P2)
- images from any host but the owner's media prefix

# Build log   (Builder appends; never edits above)
