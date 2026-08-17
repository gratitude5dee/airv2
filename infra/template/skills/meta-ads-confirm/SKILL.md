---
name: meta-ads-confirm
description: "Confirm a Meta Ads connection to the control plane once the Meta login has succeeded and you can read the ad account through the Meta Ads MCP."
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

Notes:

- Send only the account id and name. Never send tokens, cookies, or anything
  from the OAuth session — the control plane must not hold a Meta credential.
- If the call returns 401, your gateway credentials are stale; report the
  problem instead of retrying with anything else.
- Re-running this for the same account is safe (it upserts).
