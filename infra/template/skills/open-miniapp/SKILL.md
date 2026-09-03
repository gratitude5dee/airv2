---
name: open-miniapp
description: "Open/view/show a wzrd.tech mini-app for your human: put `[card: <kind>]` on its own line in your reply and a tappable card lands in the conversation right after your text (no tool call, never a browser). Not for action requests — scheduling an event or drafting an email is work you do, not a card you send."
version: 2.0.0
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
"show me the vault", "take me to onboarding") MUST be handled by the card
marker below — nothing else. The mini-apps run on the owner's phone: you
send them a card and they tap it.

## Send the card

Write your reply and put the marker on its own line:

```text
Here's your calendar — tap the card below.
[card: calendar]
```

The marker is stripped from what the owner reads, and the control plane
mints a signed link scoped to the owner and drops the card into their
conversation right after your text. There is no tool call, nothing to run,
nothing to wait for — the marker IS the send. Saying "I'll open the card" or
"sent, tap above" without the marker in that same reply sends nothing.

One marker per kind per reply. A kind sent moments ago is skipped
automatically, so don't repeat it — point at the card already in the thread.

Only when you are NOT replying to a message (a scheduled job, a reminder
firing) and there is no reply to carry the marker, run
`open-miniapp-card <kind>` with the `terminal` tool instead (never
`execute_code`, which waits on an approval that never comes). It hits the
same control-plane endpoint; HTTP 429 means the card was just sent, HTTP 409
means the owner hasn't messaged over iMessage yet.

## Not for action requests

Cards are for OPEN / VIEW / SHOW / "take me to" requests only. When the owner
asks you to *do* something, the skill that does it owns the turn and you MUST
NOT send a card instead:

| The owner asks | Handled by | Never |
| --- | --- | --- |
| "schedule an appointment", "add/move/cancel an event", "book X" | `calendar-native` (`sync.py upsert`) | `[card: calendar]` |
| "send/draft/reply to/forward an email" | `email-draft-review` (`create_draft` + the review route) | `[card: inbox]` |
| "pay/send money", "buy this", "post this" | the matching action skill, which stages a decision | a card |

"Open my calendar" → card. "Put a nap on my calendar at 5pm tomorrow" →
`calendar-native`, write the event, confirm it. A card in answer to an action
request hands the work back to the owner and the action never happens.

Hard rules — no exceptions:

- MUST NOT use the computer-use or browser tool for this. There is nothing
  to click.
- MUST NOT open or send any local URL: never `localhost:3000`,
  `127.0.0.1`, `0.0.0.0`, or any port on this machine.
- MUST NOT open the Hermes dashboard on port 9119 or its sign-in page —
  that is this box's own control panel, not a mini-app.
- MUST NOT paste a raw link into the chat instead of sending the card; the
  signed link is minted control-plane-side and only works from the card.
- MUST NOT promise a card without the marker in the same reply.

Bad (never do these):

- "open the calendar miniapp" → browsing to `http://localhost:3000/calendar` ✗
- "open the calendar miniapp" → opening `http://127.0.0.1:9119` (Hermes
  dashboard sign-in) ✗
- "show me onboarding" → launching Chrome / any computer-use action ✗
- "show me onboarding" → "Opening the onboarding card now!" with no marker ✗

Good: "open the calendar miniapp" → reply "Here you go — tap the card below."
followed by `[card: calendar]` on its own line. ✓

## Kinds

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

Keep the words around the marker to ONE short sentence telling them to tap
the card (e.g. "Sent — tap the card below to open it."). Do not explain which
kind you picked, that an alias was used, or how the card system works.

## Anything else

If the request doesn't match a kind above, it's probably a store app: use
the app-store-search skill and reply with the app's `detail_url` link.
Never invent a kind, never guess local URLs, never open a browser on this
machine, and never try to open or sign into an app on the owner's behalf.
