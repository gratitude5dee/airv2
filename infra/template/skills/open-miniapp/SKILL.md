---
name: open-miniapp
description: "Open a wzrd.tech mini-app for your human: send them a tappable card in the current conversation instead of opening anything on this machine."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Apps, Cards, Mini-Apps]
---

# Open a mini-app

When the owner asks you to open, show, or launch a mini-app — "open the
onboarding mini-app", "pull up my calendar", "show me the vault" — do NOT
open a browser, a desktop app, or any local address on this machine. The
mini-apps run on the owner's phone: you send them a card and they tap it.

## Send the card

Pick the matching kind and POST it. The control plane mints a signed link
scoped to the owner and drops the card into their conversation:

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
| `calendar` | calendar, schedule, events |
| `todo` | todo list, tasks |
| `kanban` | kanban, board, projects |
| `inbox` | email inbox |
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

After a successful send, tell them in your reply to tap the card you just
sent (e.g. "Sent you the onboarding app — tap the card above to open it.").

## Errors

- HTTP 409: they haven't messaged you over iMessage yet — ask them to open
  the app from the web dashboard at app.wzrd.tech instead.
- HTTP 429: a card of that kind was sent moments ago — do NOT retry; point
  them at the card already in their messages.

## Anything else

If the request doesn't match a kind above, it's probably a store app: use
the app-store-search skill and reply with the app's `detail_url` link.
Never invent a kind, never guess local URLs, and never try to open or sign
into an app on the owner's behalf.
