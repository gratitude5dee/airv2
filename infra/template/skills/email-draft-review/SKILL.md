---
name: email-draft-review
description: "File every agent-composed email draft in Needs-you without attempting to send it from the box."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Email, Drafts, Approval, AgentMail]
---

# Email draft review

After creating any agent-composed AgentMail draft, immediately file it for
owner review. Use the returned `draft_id` and do not self-report the draft's
recipient or subject:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST \
  "${OPENAI_BASE_URL%/api/gateway/v1}/api/email/drafts/review" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"draft_id":"<draft_id>"}'
```

The request body accepts `draft_id` and optional `to` and `subject`
fallbacks. The control plane verifies the draft and derives its metadata
from AgentMail before filing an `email_draft` decision.

- Treat `{"ok":true,"status":"pending_approval"}` as queued in Needs-you.
- Treat `{"ok":true,"status":"already_pending"}` as already queued.
- If the review call fails, tell the owner that the draft exists but was not
  queued for approval.
- Never claim that an email was sent from the box.

The box's AgentMail key is draft-only. Sending from the box is structurally
impossible; only the owner's approval path can send a held draft.
