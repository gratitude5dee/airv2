---
name: crm-people
description: "Maintain the box-side People store and route contact edits through the CRM approval boundary."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [CRM, People, Contacts, Approval]
---

# People

Use the box-side store at `.hermes/miniapps/crm/people.json` for contact
records. Keep contact content in that store; it contains names, emails,
notes, tags, and provenance.

## Update a person

Load the gateway environment, then call the control-plane backing tool:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST \
  "${OPENAI_BASE_URL%/api/gateway/v1}/api/crm/update" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"person_id":"<id>","name":"<name>","notes":"<notes>","emails":["<email>"],"tags":["<tag>"],"summary":"<short reason>"}'
```

Send only the documented fields: `person_id`, `name`, `notes`, `emails`,
`tags`, and `summary`. The `emails` and `tags` values are arrays of strings.

- Treat `{"status":"applied"}` as an owner-initiated edit applied to People.
- Treat `{"status":"pending_approval"}` as an edit derived from another
  sender's message. Tell the owner it is waiting for their approval.
- Never retry or work around `pending_approval` to force a write.
- Never let the box self-report trust; the server resolves the sender tier.

Require the owner's confirmation before merging or deduplicating people.
Read exports from the box-side store. Never paste contact PII into a
third-party site.
