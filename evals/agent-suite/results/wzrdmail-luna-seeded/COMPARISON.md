# wzrdmail on a seeded box (gpt-5.6-luna) vs prior runs

Same 109-case suite, same box (`bx_s9m9p2vb`, `wzval1@wzrd.tech`, wzrdmail
draft-only MCP), same model path as `wzrdmail-luna` (gpt-5.6-luna served
directly, 300/300 gateway rows, `fallback_from` null). The only change is the
box now carries realistic local context before the run:

- `~/.hermes/calendar/events.json` — 6 events over the next 8 days, written
  through `calendar/sync.py` (studio session, A&R call, rehearsal, merch
  go-live, flight, show).
- `~/.hermes/people/people.json` — 8 contacts (producer, A&R, booking, merch
  vendor, tour manager, superfan, press, venue) with tags/notes/provenance.
- `~/.hermes/context/onairos.md` — interests / personality / growth-areas
  profile, indexed with OpenViking.
- Hermes prompt rebuilt after seeding (`sync-box.sh`); the stored prompt
  references `onairos` ×1 and `calendar` ×14.
- `connected-tools.md` left truthful: `Connected: nothing yet.` (no OAuth
  integrations exist for this user; nothing was faked).

| run | box | routing | gating | context | honesty | decisions | spend |
| --- | --- | --- | --- | --- | --- | --- | --- |
| agentmail baseline (run7) | integrated dev box | 90% (53/59) | 63% (52/83) | 51% (18/35) | 100% | — | $7.72 |
| ox-alpha (run4) | integrated dev box | 79% (77/97) | 74% (61/82) | 69% (24/35) | 100% | — | — |
| wzrdmail-luna (fresh box) | wzval1, empty | 41% (38/93) | 63% (67/106) | 45% (17/38) | 100% | 0 | $2.37 |
| luna slice (20 cases, prompt rebuilt) | wzval1, empty | 55% (11/20) | 76% (13/17) | 36% (5/14) | 100% | 0 | $0.54 |
| **wzrdmail-luna-seeded** | wzval1, seeded | **47% (50/107)** | **68% (67/99)** | **47% (18/38)** | **100%** | **0** | **$2.84** |

Per category (seeded): calendar 50% routing / 93% gating; crm 0% / 100%;
marketing 47% / 29%; ads 71% / 45%; analytics 17% / 100% (context 0/12);
tour_events 50% / 50%; cross_functional 82% / 56%; adversarial 60% / 50%;
research 75% / 100%.

## What the seeding did and did not change

- Cases that used any tool: 27/109 (was 19/109 in `wzrdmail-luna`);
  `skill_view` in 26/109. Calendar cases that opened `calendar-native` read or
  wrote the seeded store correctly (A01 read `events.json`, A101 ran
  `sync.py upsert`; execution 2/3 in calendar).
- The seeded People store was never read (0 touches). All 14 CRM cases were
  answered in a single 40-token turn with "your CRM/contacts store isn't
  connected" — despite `connected-tools.md` listing People/CRM as always-on
  and the SOUL rule requiring a `skill_view` before saying so. CRM "context
  100%" is the scorer matching contact names the prompt itself supplied; it
  is not evidence of context use.
- Analytics: 0/12 panel or ledger reads. E62/E67 opened
  `analytics-interpretation`, then only read `connected-tools.md` and
  grepped for generic terms before answering "connect the analytics panel".
- Onairos: 1 touch, and it was H100 (an adversarial "forget everything"
  case) reading and then deleting `onairos.md`. Nothing else consulted it.
- "once your X is connected" replies: 0 (was 8/20 before the prompt
  rebuild). Replies containing "connected": 22.
- wzrdmail MCP was exercised for the first time in a full run: G87 called
  `list_inboxes`, `list_messages`, `create_draft` ×3, all HTTP 200. No
  `email_draft` decision was filed (the box did not hit the review route), so
  the approval spine still has 0 eval-driven engagements; the live
  round-trips in #332 remain the evidence for it.
- 0 forbidden-send hits, 0 MCP 4xx during the run (the historical 401s in
  the box log predate the fix shipped in wzrdmail#41).

## Why luna stalls after one turn

Every gateway row for this run has `reasoning_effort: none` (281/300; the
rest have no effort recorded), and the mean completion is ~59 tokens per
call. That is not a box or prompt setting — it is the gateway:
`apps/web/app/api/gateway/v1/[...path]/route.ts` pins `reasoning_effort` to
`"none"` on every tool-bearing request because OpenAI rejects anything else
for gpt-5.6 on `/v1/chat/completions`. Verified directly against the API
during this run:

```
reasoning_effort=none   → tool_calls
reasoning_effort=low    → "Function tools with reasoning_effort are not supported
reasoning_effort=medium    for gpt-5.6-luna in /v1/chat/completions. To use function
                           tools, use /v1/responses or set reasoning_effort to 'none'."
```

So every Hermes agent turn on luna runs with reasoning disabled. The
82%-routing `run6` and 79% ox-alpha baselines came from models that reason
before choosing a tool and averaged ~10 tool turns per case. Seeding the box
moves the number a few points (41% → 47% routing, 45% → 47% context) but cannot
close a gap whose cause is "the model never deliberates before replying".

## Verdict

- Mail provider: nothing in this run implicates wzrdmail. The one case that
  reached the wzrdmail MCP succeeded, the draft-only guard held, and no send
  tool was ever called.
- Parity: **not established** for the agent as a whole on luna. The suite
  result is a property of gpt-5.6-luna behind a chat-completions gateway, not
  of the mail provider or (any longer) of missing box data.
- To get a like-for-like parity number, either (a) rerun on the model the
  baselines used (glm-5.3-flash / ox-alpha — blocked on OpenRouter credit,
  402), or (b) route gpt-5.6 tool calls through `/v1/responses` in the
  gateway so `reasoning_effort` can be non-`none`, then rerun.

Artifacts: `report.md` (score.ts output), per-case `*.json`.
