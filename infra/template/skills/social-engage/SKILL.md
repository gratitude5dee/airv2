---
name: social-engage
description: "Engage on social platforms safely: likes under the human's standing rules, comments/replies and posts only through approval decisions, APIs before browser."
version: 1.0.0
author: air
license: MIT
platforms: [linux]
metadata:
  hermes:
    tags: [Social, Browser, Automation, Approval]
---

# Social engagement

You may act on social platforms for your human, but public actions in their
name are gated. The gates are enforced by the control plane — follow them.

## API before browser

Before driving the browser, check whether the platform has an API adapter:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS "${OPENAI_BASE_URL%/api/gateway/v1}/api/browser/social" \
  -H "Authorization: Bearer $OPENAI_API_KEY"
```

The response lists `adapter_platforms`. If the target platform is listed,
publishing goes through the existing content-plan/publish flow (propose the
post there) — do NOT post via the browser. Use the browser only for actions
the adapters don't cover (likes, follows, replies on platforms without an
adapter).

## A plan the owner can approve, not a paragraph

When the ask is a calendar, a campaign week, or a set of posts ("plan launch
week", "a 2-week content calendar", "a hook strategy for X"), the turn ends
with a staged plan, not prose. File it the same turn:

```bash
set -a; . ~/.hermes/.env; set +a
curl -fsS -X POST "${OPENAI_BASE_URL%/api/gateway/v1}/api/content/plan" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"label":"Launch week","timezone":"America/Los_Angeles","steps":[
        {"platform":"instagram","brief":"<what this post says>","scheduled_at":"2026-09-08T18:00:00Z"},
        {"platform":"tiktok","brief":"<what this post says>","scheduled_at":"2026-09-09T18:00:00Z"}]}'
```

`{"ok":true,"status":"pending_approval"}` means it is in Needs-you; slots are
proposals until the owner approves, so staging publishes nothing.

Missing details are not a reason to stop. Pick obvious defaults (a two-week
cadence from today, one post per named platform, evening local slots), stage
the plan, and say which assumptions you made so the owner can correct them
when they review. Never end a planning turn with a question and nothing in
Needs-you.

## Likes / reactions — standing rules only

Rule-covered actions (likes, reactions) run without asking, but ONLY when the
human enabled a standing rule for that platform, and every single action must
first claim a unit against the daily cap:

```bash
curl -fsS -X POST "${OPENAI_BASE_URL%/api/gateway/v1}/api/browser/social" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"claim","platform":"<platform>","target":"<safe target description>"}'
```

- `{"allowed": true, "remaining": N}` — proceed with exactly one action, then
  claim again before the next one.
- `{"allowed": false, "reason": ...}` — stop. `rule_disabled` means no
  standing rule; `cap_reached` means done for today; `quiet_hours` means wait
  for the human's waking hours. Never act without an allowed claim.

Pace like a human: one action at a time, tens of seconds apart, never a burst.
Each claim writes a receipt into the human's Needs-you history — the target
you send is user-visible, keep it short and content-free (e.g. a post URL).

## Comments, replies, posts — always a decision

Anything that publishes text in the human's name (a comment, a reply, a post)
ALWAYS requires their approval first, even when a standing rule exists:

1. Compose the exact final text and identify the exact target.
2. File the decision card FIRST — always, including when the platform has no
   connected account and when the owner left a detail out. A proposal is a
   card the owner can read and correct; a question is not. If a caption needs
   an asset you cannot see, propose the caption and name the missing asset in
   the same turn.

```bash
curl -fsS -X POST "${OPENAI_BASE_URL%/api/gateway/v1}/api/browser/social" \
  -H "Authorization: Bearer $OPENAI_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"action":"propose","platform":"<platform>","text":"<exact text>","target":"<exact target>"}'
```

3. Then attempt the publish action itself — it will pause for approval (your
   approval policy escalates all public posting). Do NOT try to word the
   command to slip past the pause; the pause IS the mechanism that lets the
   human answer.
4. If the human approves, your run resumes — post exactly that text to
   exactly that target, nothing else. If they dismiss, the answer is no: do
   not post, do not rephrase and retry.

## Hard limits

- Never publish publicly without an approval or a visible standing rule.
- Respect the daily cap and quiet hours — they are the human's, not yours.
- Platforms rate-limit and sometimes ban accounts for automated engagement;
  the human accepted that risk knowingly. If a platform warns, blocks, or
  challenges you (CAPTCHA, unusual-activity page), STOP the playbook entirely
  and tell the human — never evade detection.
- Sign-ins for social sites go through the vault-use skill.
