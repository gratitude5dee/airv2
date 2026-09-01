---
name: tour-planning
description: "Plan tours and event logistics — dates, venues, run-of-show timelines, guest lists, rehearsal and travel bookings, ticket add-ons, and on-sale alerts — staging every outreach, publication, and payment step for owner approval."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Tours, Events, Calendar, Commerce, Approval]
---

# Tour and event planning

Keep routing and date proposals as a plan for the owner to approve. Use the
`calendar-native` skill to inspect dates and calculate travel buffers. Do not
present proposed dates as confirmed.

## Stage event products and payments

Match the owner's request to one of these calls:

| The owner asks for | Call | Decision it files |
| --- | --- | --- |
| ticket products, a catalog, "put it on my storefront" | `publish_catalog` | `shop_publish` |
| a deposit, a split, a fee, money owed to someone | `payment_request` | `payment_request` |
| outreach to a venue, promoter, or ticket-buyer | `create_draft`, then the draft-review route | `email_draft` |

For ticket products and storefront staging, use the commerce backing tool:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST \
  "${OPENAI_BASE_URL%/api/gateway/v1}/api/miniapps/commerce" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"publish_catalog"}'
```

This creates or reuses a pending `shop_publish` decision. To stage a deposit
or split, send:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST \
  "${OPENAI_BASE_URL%/api/gateway/v1}/api/miniapps/commerce" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"payment_request","currency":"<currency>","amount":"<amount>","payee":"<payee>","memo":"<memo>"}'
```

For USD, use a positive integer number of cents for `amount`; for USDC, use
a positive decimal string. Use an on-platform username as a USD `payee` and
a wallet address as a USDC `payee`. This creates a `payment_request`
decision.

Use draft creation for venue or promoter outreach, then immediately use the
`email-draft-review` skill with its `draft_id`. Do not send outreach directly.

## Recurring alerts

The real recurring schedule primitive is the owner-authenticated
`/api/calendar/schedule` route, backed by `agent_schedules` and fired by the
control-plane `/api/cron/schedules` path. There is no box-facing
gateway-token scheduling path; tell the owner to set up recurring alerts.

Nothing publishes, charges, or sends from the box. Every money or publish
step returns a decision requiring owner approval. Report those steps as
pending, never as done. Proposing routing or dates is not staging work: if
the owner asked for tickets, a store, a deposit, or an email, run the
corresponding call in the same turn. An answer that only describes the plan
leaves nothing in Needs-you.
