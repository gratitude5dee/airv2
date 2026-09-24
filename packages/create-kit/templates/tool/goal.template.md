---
schema: air.goal.v1
appname: <appname>
template: tool
theme: <atmosphere|pixel>
lite: true
budget_usd: <n>
---
# Outcome
<one paragraph: what the owner tracks, the URL at link.wzrd.tech/<username>/<appname>, the owner edits and guests read>

# Screens
## list
- purpose: rows the owner adds and checks off, a count of what is left
- components: [air, arlan/typer, beautiful/value-pill]
- data: useAirState `items` ({ items: { id, text, done }[] }); owner-writable, guest read-only
- copy: title "<title>", kicker "<Today>", placeholder "<Add…>", empty "<Nothing yet.>", saved "<Saved.>"
- data-test hooks: [title, items, new, add, toggle-<id>, clear-done, saved, error, empty]

# Actions
- add: owner → items → appends a row (≤ 120 chars)
- toggle: owner → items → flips done
- clear-done: owner → items → drops done rows

# Functions
none (many writers → recipe 05 with Functions instead)

# Tests   (this array is air.json.tests[]; locked tests are the Planner's)
[
  { "id": "title-visible", "see": "<title>", "locked": true },
  { "id": "add-item", "type": ["[data-test=new]", "<sample row>"], "tap": "[data-test=add]", "see": "<sample row>", "locked": true },
  { "id": "guest-readonly", "type": ["[data-test=new]", "Nope"], "tap": "[data-test=add]", "see": "Guests are read-only." }
]

# Acceptance
- 0 hard findings · qa_score ≥ 70 · all tests pass · lite budget
- rows 44px, inputs 16px, reorder by explicit chips if asked (never drag)

# Out of scope
- guest writes, due dates, reminders, more than one list per app

# Build log   (Builder appends; never edits above)
