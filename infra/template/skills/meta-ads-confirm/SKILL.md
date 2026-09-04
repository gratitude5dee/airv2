---
name: meta-ads-confirm
description: "Meta ads campaigns, budgets, audiences, pixel: staged writes"
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Ads, Meta, MCP, Postback]
---

# Meta Ads connect confirmation

After your human has signed in to Meta (via the computer-relay flow) and the
Meta Ads MCP tools work, the control plane still doesn't know the connection
succeeded — its dashboard shows "waiting" until you post this confirmation.

1. Verify the connection is real: call the Meta Ads MCP account/adaccount
   listing tool and read back the ad account id (e.g. `act_1234567890`) and
   its name. Do NOT confirm on a login alone — confirm only when MCP reads
   succeed.
2. Post the confirmation:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST "${OPENAI_BASE_URL%/api/gateway/v1}/api/ads/meta/confirm" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"account_ref":"act_1234567890","label":"My Business"}'
```

Replace `account_ref` with the real ad account id from step 1 and `label`
with its human-readable name. A `{"ok":true}` response means the dashboard's
Ads panel now shows the account as connected.

## Ad copy and ad changes are staged writes

Every change to a live account (new campaign, budget change, pause/resume,
new creative) goes through the write gate — the control plane files it as a
pending `ad_write` decision and only owner approval executes it:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST "${OPENAI_BASE_URL%/api/gateway/v1}/api/ads/writes" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"account_id":"<ad_accounts.id>","kind":"create_ad",
       "campaign_ref":"<campaign>","args":{"ad_group_ref":"<group>",
       "headline":"...","primary_text":"...","cta":"..."}}'
```

`GET /api/ads/writes` lists the account ids and the gate state of earlier
writes. Never call a platform write tool for a change that has no approved
write behind it.

When there is no connected ad account, the write cannot be staged. Say so in
those words — the copy or budget change exists but is not queued for approval
because no ad account is connected — and hand the owner the copy. Do not
present ad creative as if it were scheduled or live.

Notes:

- Send only the account id and name. Never send tokens, cookies, or anything
  from the OAuth session — the control plane must not hold a Meta credential.
- If the call returns 401, your gateway credentials are stale; report the
  problem instead of retrying with anything else.
- Re-running this for the same account is safe (it upserts).
