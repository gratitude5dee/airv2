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

Treat filing as a postcondition of drafting, not a follow-up. After every
`create_draft`, immediately POST the returned `draft_id` to the review route
before replying to the owner. A draft that is not filed is invisible in
Needs-you, so the owner can never send it. The AgentMail MCP may create the
draft in an inbox other than `AGENTMAIL_INBOX_ID`; pass the `inbox_id` returned
by the create call alongside `draft_id`:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST \
  "${OPENAI_BASE_URL%/api/gateway/v1}/api/email/drafts/review" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"draft_id":"<draft_id>","inbox_id":"<inbox_id>"}'
```

The request body also accepts optional `to` and `subject` fallbacks. The
control plane verifies the draft and derives its metadata from AgentMail
before filing an `email_draft` decision.

- Treat `{"ok":true,"status":"pending_approval"}` as queued in Needs-you.
- Treat `{"ok":true,"status":"already_pending"}` as already queued.
- If the response is 404, say exactly that the draft is in an inbox the
  control plane cannot see; do not claim it is queued for approval.
- For any other failure, tell the owner that the draft exists but was not
  queued for approval.
- Never claim that an email was sent from the box.

The box's AgentMail key is draft-only. Sending from the box is structurally
impossible; only the owner's approval path can send a held draft.
