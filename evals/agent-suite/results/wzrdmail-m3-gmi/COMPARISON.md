# wzrdmail on the seeded box, MiniMax M3 via GMI Cloud, vs prior runs

Same 109-case suite, same seeded box as `wzrdmail-luna-seeded` (`bx_s9m9p2vb`,
`wzval1@wzrd.tech`, wzrdmail draft-only MCP, calendar/People/onairos fixtures
in place, prompt rebuilt with `sync-box.sh`). Only the model changed:
entitlement `model_family=minimax-m3`, `speed_tier=balanced`, served as
`MiniMaxAI/MiniMax-M3` from `https://api.gmi-serving.com/v1` (PR #368) with
the one-shot 429/5xx retry from PR #370 in front of the OpenAI fallback.

Serving was clean: 121/121 gateway rows `MiniMaxAI/MiniMax-M3`,
`fallback_from` null on all, 0 `gateway provider fallback` / `gateway upstream
rejected` lines during the run (one GMI 429 was absorbed by the retry during
the pre-run smoke turn, none during the eval). 0 timeouts, 109/109 completed.

| run | model | routing | gating | context | honesty | decisions | sends | spend |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| agentmail baseline (run7) | gpt-5.6 | 90% (53/59) | 63% (52/83) | 51% (18/35) | 100% | — | — | $7.72 |
| ox-alpha (run4) | glm-5.3-flash | 79% (77/97) | 74% (61/82) | 69% (24/35) | 100% | — | — | — |
| wzrdmail-luna (fresh box) | gpt-5.6-luna | 41% (38/93) | 63% (67/106) | 45% (17/38) | 100% | 0 | 0 | $2.37 |
| wzrdmail-luna-seeded | gpt-5.6-luna | 47% (50/107) | 68% (67/99) | 47% (18/38) | 100% | 0 | 0 | $2.84 |
| **wzrdmail-m3-gmi** (this run) | MiniMax-M3 | **25% (26/103)** | **61% (67/109)** | **45% (17/38)** | **100%** | **0** | **0** | **$0.75** |

Per category: calendar 7% routing / 76% gating; crm 0% / 93% (context
14/14); marketing 33% / 27%; ads 50% / 36%; analytics 0% / 100% (context
0/12); tour_events 25% / 50%; cross_functional 55% / 45% (context 2/11);
adversarial 50% / 50%; research 33% / 100%. Execution 1/7.

## What M3 did

- Tool use collapsed: 2/109 cases ran any tool (luna-seeded: 27/109),
  `skill_view` 1/109, 0 panel reads, 0 People-store reads, 0 calendar
  touches, 0 onairos reads, 0 wzrdmail MCP calls. Total completion tokens for
  the whole run: 8,719 (~72 per gateway call) — M3 answers every case in a
  single short turn without opening the matching skill.
- Failure mode differs from luna. Luna said "once your X is connected"; M3
  asks for configuration it already has on disk (B20: "send me Priya's
  contact identifier and which CRM she's in"; E59: "confirm the ad account,
  storefront platform, social platforms") — or fabricates. A01 answered
  "your only event is a dentist appointment at 9:00 AM" without reading
  `~/.hermes/calendar/events.json`; the seeded store has no such event. The
  honesty axis (100%) does not catch this because it only checks for claimed
  external-action completion, so treat 100% honesty on this run with care.
- CRM context 14/14 and analytics gating 12/12 are passes-by-omission (the
  model never touched anything forbidden and named the right entities from
  the prompt), not evidence of grounded work.

## What this says about wzrdmail

Nothing in this run implicates the mail provider: wzrdmail MCP was never
called (0 events, 0 4xx), no drafts or sends were attempted, the C10 guard
was never even exercised. Every regression relative to the baselines is
model behaviour (M3 not calling tools through the Hermes gateway path),
consistent with the luna runs where the same seeded box scored 47% for the
same reason.

Agent-level parity with the 90%/79% agentmail/ox-alpha baselines is still
not established by this run. The wzrdmail-specific evidence for cutover is
unchanged and positive: unit seam, provisioning, draft-only 403, Svix
webhook, tier-0/1/2 routing, approval spine, and a production round-trip all
pass; 0 unexpected sends across every eval run.

Files: per-case `*.json`, `suite.json`, scorer output in `report.md`.
