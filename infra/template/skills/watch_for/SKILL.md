---
name: watch_for
description: "Arm persistent watches: restocks, price drops, availability, releases, deadlines — a real recurring schedule, never a promise to check later"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Watches, Schedules, Alerts, Monitoring]
---

# Watch for it

"Watch for X", "tell me when Y", "let me know the moment Z" is a standing
order, not a one-time lookup. A real watch is a **persisted schedule**:
the control plane fires a check prompt back into this box on a cron and
delivers the result to the owner. Replying "I'll keep an eye on it" with
nothing persisted is the failure this skill exists to prevent.

## Choreography

1. Reduce the request to a self-contained **check prompt**: what to look
   at (URL, mailbox query, calendar), what counts as a hit, and exactly
   what to do on a hit ("tell the owner the vinyl is back in stock at
   <url> with the price"). Always end the prompt with the silence
   contract: `If it is not a hit, reply with exactly "[SILENT]" and
   nothing else` — the control plane drops any output containing
   `[SILENT]`, so a plain "staying silent" sentence still texts the
   owner every tick. The prompt fires as a fresh run each tick — it
   cannot see this chat, so it carries every fact it needs.
2. Pick a cron that fits urgency: drops/restocks hourly (`0 * * * *`),
   slow-moving availability daily (`0 9 * * *`). Timezone is the owner's
   when known, else `UTC`.
3. File it:

```bash
curl -fsS -X POST \
  "${OPENAI_BASE_URL%/api/gateway/v1}/api/calendar/schedule" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "content-type: application/json" \
  -d '{"name":"frank-ocean-vinyl","cron":"0 * * * *","timezone":"America/Los_Angeles","prompt":"Check https://store.example.com/frank-ocean — if the vinyl is in stock, tell the owner it is back with the current price and the link. If it is not a hit, reply with exactly \"[SILENT]\" and nothing else.","deliver":"imessage"}'
# → {"id":"…"} — that row IS the watch; the check now fires on the cron.
```

4. Reply with what persisted: "Watching <thing> hourly, first check
   <next run> — you'll get a ping the moment <condition>."

## Rules

- `deliver` is how a hit reaches the owner: `imessage` by default,
  `email` if they asked for mail, `none` for a silent sweep whose result
  waits in their inbox.
- `[SILENT]` is the only silence that stays silent. Output containing
  the token is dropped before delivery; output *describing* silence
  ("still checking", "nothing new", "staying silent") is delivered
  verbatim — every non-hit tick becomes a bubble the owner has to read.
  Repeat facts are also noise: if the last reported value (price, count,
  status) is unchanged, that is not a hit — report `[SILENT]`.
- The watch request is never answered with a one-time check alone. If
  the POST fails, say the watch did NOT get created — do not describe a
  watch that does not exist.
- `name` is a short safe slug for the owner's schedule list (≤80 chars);
  the prompt itself is never stored in Postgres — it lives box-side at
  `.hermes/schedules/<id>.md`.
- Listing the owner's watches: `GET /api/calendar/schedule` with the same
  bearer; pausing/deleting is the owner's call — offer, don't do it for
  them unless they asked.
- A watch that found its target reports once; for one-shot conditions
  note in the prompt that the job should pause itself after a hit.
