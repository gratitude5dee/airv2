---
name: computer-relay
description: "Show your human this computer's screen when a browser step needs them (logins, OAuth consents, CAPTCHAs, 2FA)."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Browser, Login, Relay, Human-In-The-Loop]
---

# Computer relay

When a task requires the human to act inside this computer's browser — signing
in to a website (e.g. Meta Business), completing an OAuth consent, solving a
CAPTCHA, or entering a 2FA code — do NOT ask them to paste credentials into
chat. Instead:

1. Open the page in this computer's browser and get it to the exact step that
   needs the human.
2. Send them a computer card so they can see and control this screen from
   their phone:

```bash
OPENAI_BASE_URL="$(grep -m1 '^OPENAI_BASE_URL=' ~/.hermes/.env | cut -d= -f2-)"
OPENAI_API_KEY="$(grep -m1 '^OPENAI_API_KEY=' ~/.hermes/.env | cut -d= -f2-)"
curl -fsS -X POST "${OPENAI_BASE_URL%/api/gateway/v1}/api/cards/computer" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

3. Tell them in your reply what you need them to do on the screen (e.g.
   "I've opened the Meta Business login — tap the Computer card I just sent
   and sign in; I'll take it from there.").
4. Wait for them to finish, then continue the task in the same browser
   session.

For a checkout handoff, the owner must start control from the Checkout
mini-app. That creates a short owner-scoped control lease. Before every
browser read or input, GET the handoff state using its id:

```bash
BASE="${OPENAI_BASE_URL%/api/gateway/v1}"
curl -fsS "$BASE/api/checkout/handoff?handoff_id=<handoff_id>" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

If `human_control.active` is true, do not click, type, inspect the DOM, or
take screenshots. Wait for the owner to press **Return control to agent** or
for `human_control.expires_at` to pass, then GET the state again. On resume,
re-check the same browser profile and tab, cart contents, hold timer, and total
before taking any action. A chat message saying “done” does not override an
active lease.

Notes:

- The card link opens a live view of this machine's desktop on their phone.
  If the send fails with HTTP 409, they haven't messaged you over iMessage
  yet — ask them (in the current conversation) to open the Computer tab in
  the web app instead.
- HTTP 429 means a card was already sent moments ago — do NOT retry; point
  them at the card that's already in their messages (or the web Computer tab).
- Never read, log, or store anything the human types during their turn
  (passwords, codes). Credentials belong to the browser session, not to
  your notes or memory.
- Never place checkout URLs, cookies, payment details, or credentials in
  screenshots, notes, logs, or memory.
