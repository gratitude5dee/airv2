---
name: open-miniapp
description: "Open/view/show a wzrd.tech mini-app for your human: run `open-miniapp-card <kind>` with the terminal tool (never execute_code, never a browser) to send them a tappable card in the current conversation. Not for action requests — scheduling an event or drafting an email is work you do, not a card you send."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Apps, Cards, Mini-Apps]
---

# Open a mini-app

This skill is the ONLY correct way to open a mini-app. ANY request of the
form "open/show/launch/pull up the <X> mini-app" (or "open my calendar",
"show me the vault", "take me to onboarding") MUST be handled by the single
`POST /api/cards/<kind>` call below — nothing else. The mini-apps run on the
owner's phone: you send them a card and they tap it.

## Not for action requests

Cards are for OPEN / VIEW / SHOW / "take me to" requests only. When the owner
asks you to *do* something, the skill that does it owns the turn and you MUST
NOT send a card instead:

| The owner asks | Handled by | Never |
| --- | --- | --- |
| "schedule an appointment", "add/move/cancel an event", "book X" | `calendar-native` (`sync.py upsert`) | `open-miniapp-card calendar` |
| "send/draft/reply to/forward an email" | `email-draft-review` (`create_draft` + the review route) | `open-miniapp-card inbox` |
| "pay/send money", "buy this", "post this" | the matching action skill, which stages a decision | a card |

"Open my calendar" → card. "Put a nap on my calendar at 5pm tomorrow" →
`calendar-native`, write the event, confirm it. A card in answer to an action
request hands the work back to the owner and the action never happens.

Hard rules — no exceptions:

- MUST NOT use the computer-use or browser tool for this. There is nothing
  to click; the card send is one curl command.
- MUST NOT open or send any local URL: never `localhost:3000`,
  `127.0.0.1`, `0.0.0.0`, or any port on this machine.
- MUST NOT open the Hermes dashboard on port 9119 or its sign-in page —
  that is this box's own control panel, not a mini-app.
- MUST NOT paste a raw link into the chat instead of sending the card; the
  signed link is minted control-plane-side and only works from the card.
- MUST run `open-miniapp-card <kind>` with the `terminal` tool. NEVER use
  `execute_code` for it — `execute_code` waits on an approval that never
  comes and the card never sends. The command is read-only on this machine
  and needs no consent.

Bad (never do these):

- "open the calendar miniapp" → browsing to `http://localhost:3000/calendar` ✗
- "open the calendar miniapp" → opening `http://127.0.0.1:9119` (Hermes
  dashboard sign-in) ✗
- "show me onboarding" → launching Chrome / any computer-use action ✗

Good: "open the calendar miniapp" → terminal: `open-miniapp-card calendar`,
then tell the owner to tap the card. ✓

## Send the card

Pick the matching kind and run this one command with the `terminal` tool
(not `execute_code`). The control plane mints a signed link scoped to the
owner and drops the card into their conversation:

```bash
open-miniapp-card <kind>
```

If that command is missing on this box, fall back to the equivalent curl
(still terminal, never execute_code):

```bash
OPENAI_BASE_URL="$(grep -m1 '^OPENAI_BASE_URL=' ~/.hermes/.env | cut -d= -f2-)"
OPENAI_API_KEY="$(grep -m1 '^OPENAI_API_KEY=' ~/.hermes/.env | cut -d= -f2-)"
curl -fsS -X POST "${OPENAI_BASE_URL%/api/gateway/v1}/api/cards/<kind>" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

Valid kinds and when to use them:

| Kind | Owner asks for |
| --- | --- |
| `onboarding` | onboarding, setup, getting started |
| `calendar` | *viewing* the calendar, schedule, events (never to create one) |
| `todo` | todo list, tasks |
| `kanban` | kanban, board, projects |
| `inbox` | *viewing* the email inbox (never to send or draft mail) |
| `vault` | vault, passwords, keys |
| `connect` | connecting accounts/integrations |
| `pay` | payments, sending money |
| `shop` | shopping |
| `crm` | contacts, CRM |
| `analytics` | analytics, stats |
| `ads` | ad campaigns |
| `video` | video tools |
| `image` | image tools |
| `settings` | settings, preferences |
| `computer` | seeing/controlling this computer's screen |
| `home` | home, dashboard, the main app, "all my apps" |
| `persona` | persona, "what do you know about me", their context map |
| `feedback` | reporting a bug, requesting a feature, product feedback |

Common aliases — map silently, never explain kind names to the owner:

- "wallet", "money", "payments" → `pay`
- "home", "dashboard", "main app" → `home`
- "passwords", "keys", "secrets" → `vault`
- "my persona", "my profile", "what you know about me" → `persona`
- "report a bug", "this is broken", "feature request", "I wish air could…" → `feedback`

After a successful send, tell them in ONE short sentence to tap the card you
just sent (e.g. "Sent — tap the card above to open it."). Do not explain
which kind you picked, that an alias was used, or how the card system works.

## Errors

- HTTP 409: they haven't messaged you over iMessage yet — ask them to open
  the app from the web dashboard at app.wzrd.tech instead.
- HTTP 429: a card of that kind was sent moments ago — do NOT retry; point
  them at the card already in their messages.

## Anything else

If the request doesn't match a kind above, it's probably a store app: use
the app-store-search skill and reply with the app's `detail_url` link.
Never invent a kind, never guess local URLs, never open a browser on this
machine, and never try to open or sign into an app on the owner's behalf.
