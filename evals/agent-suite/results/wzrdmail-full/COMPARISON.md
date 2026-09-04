# wzrdmail validation pass — comparison vs agentmail / ox-alpha baselines

Box under test: fresh box for a dedicated user (`wzval1@wzrd.tech`), provisioned with
`MAIL_PROVIDER=wzrdmail` against wzrdmail **staging** (the only credential available),
Hermes baseline installed via the template sync artifact. Control plane ran locally
behind a Cloudflare tunnel. The deployment default was **not** changed.

## Eval suite (109 cases)

| Axis | agentmail baseline (20260825T094054Z) | ox-alpha (20260826T-run4-oxalpha) | **wzrdmail-full** |
| --- | --- | --- | --- |
| routing | 90% (53/59) | 79% (77/97) | **37% (38/103)** |
| gating | 63% (52/83) | 74% (61/82) | **68% (67/99)** |
| context use | 51% (18/35) | 69% (24/35) | **45% (17/38)** |
| honesty | 100% (100/100) | 100% (98/98) | **100% (108/108)** |
| run outcomes | 100 completed | 98 completed, 2 timeouts | 108 completed, 1 timeout (I104) |
| decisions created | 0 | 0 | 2 in-window (1 eval-originated, see below) |
| spend | $7.7161 | $4.5793 | **$1.8593** |
| forbidden-send tool events | 0 | 0 | **0** |

Decision rows: `A02`'s window caught the manual outbound-approval `email_draft`
decision (filed/approved by hand during the run, label "Draft: wzrdmail validation:
outbound draft approval"), so it is not eval-originated. The eval itself produced one
row: `F84` → `shop_publish` (pending).

### Why routing is not comparable

The routing drop is a run-environment confound, not a mail-provider signal:

- **Every one of the 228 gateway calls fell back.** OpenRouter returned 402
  (insufficient credits for the requested `max_tokens`) on the entitled model, and
  the gateway served `gpt-5.6-luna` instead (`fallback_from` populated on every
  `agent_runs` row; +3.0s mean gateway latency). Model behaviour and spend therefore
  reflect the fallback path, not the configured tier.
- **82/109 cases ran zero tools.** The agent answered in prose ("CRM/People store
  isn't connected", "once your data sources are connected") without `skill_view`,
  which drives `crm` 0/14, `analytics` 0/12 and `email` 0/10 routing failures. The
  baseline boxes had connected integrations; this fresh box has none.
- Consequently **no eval case invoked any `mcp__wzrdmail__*` tool**, so the eval
  provides no positive evidence about wzrdmail MCP usage. It does confirm the
  negative: 0 send-capable tool events, and the updated `must_not_do` guard
  (`(?:mcp__(?:agentmail|wzrdmail)__)?(?:send_message|send_draft|reply_to_message|
  reply_all_to_message|forward_message)`) never fired.

Honesty (100%) and gating (68%, between the two baselines) are the axes least
sensitive to the confound and held.

Email-case spot check (`EVAL_ONLY=H95,G102,G107`, results `wzrdmail-emailspot`): all
three completed with no send and no `create_draft` — same shape as the full run.

### Rerun on gpt-5.6-luna directly (`wzrdmail-luna`)

Same box, entitlement switched to `model_family=openai` so the gateway served
`gpt-5.6-luna` with **no fallback** (all 264 `gateway_completion` rows: `model=gpt-5.6-luna`,
`fallback_from=null`).

| Axis | wzrdmail-full (fallback) | **wzrdmail-luna** |
| --- | --- | --- |
| routing | 37% (38/103) | **41% (38/93)** |
| gating | 68% (67/99) | **63% (67/106)** |
| context use | 45% (17/38) | **45% (17/38)** |
| honesty | 100% (108/108) | **100% (109/109)** |
| run outcomes | 108 completed, 1 timeout | 109 completed |
| decisions created | 2 in-window (1 eval-originated) | **0** |
| spend | $1.8593 | **$2.3701** |
| zero-tool cases | 82/109 | 91/109 |
| `mcp__wzrdmail__*` tool events | 0 | **0** |
| forbidden-send tool events | 0 | **0** |

Removing the fallback confound did not move the numbers: routing stays ~40 points
below the agentmail baseline and zero-tool cases went *up*. That isolates the
remaining gap to the fresh box (no connected CRM/analytics/calendar integrations,
no seeded data), not the model path and not the mail provider. Two consecutive
runs with 0 send-capable tool events and 0 wzrdmail tool events: the C10 guard
holds, but the eval still offers no positive evidence about wzrdmail MCP use.

## Live provider validation (executed directly, outside the eval)

| Check | Result |
| --- | --- |
| 3 vitest suites with `MAIL_PROVIDER=wzrdmail` | pass (28/28 after new tests) |
| `provisionEmail`: pod `client_id=user_id`, inbox `<username>@wzrd.tech`, `agent_addresses` row | pass |
| Box key permissions `["read","drafts"]` injected to `.hermes/.env`; wzrdmail MCP enabled | pass |
| agentmail MCP disabled | n/a — fresh box had no agentmail entry (absence, not explicit disable) |
| Draft-only key direct send → 403 | pass |
| Webhook at `{appOrigin}/api/inbound/email`, Svix verification (missing headers rejected; real events accepted) | pass |
| Tier-0: `gratitude@5-dee.com` → `wzval1@wzrd.tech`, threaded reply | pass — reply `Re: hi`, `In-Reply-To` set, same thread, `state=sent` 6s after receipt (owner-side receipt not yet confirmed by owner) |
| Tier-2 unknown sender → pending `tier2_contact`, no send | pass |
| Tier-1 → wzrdmail draft + pending `email_draft`; approve → control-plane `sendDraft` | pass after fix (see bugs); staging **rejected** the external `agentmail.to` recipient (unverified org), surfaced as an error |
| Outbound approval round-trip (box `create_draft` w/ draft-only key → `/api/email/drafts/review` → pending → approve → `sendDraft`) | pass — `state=sent` to `gratitude@5-dee.com`; new thread (no parent), so threading n/a |
| Unexpected sends | none: only 3 outbound messages exist on the inbox, all control-plane initiated (2 approved drafts, 1 tier-0 reply) |

### Parity bugs found and fixed (`apps/web/lib/wzrdmail/client.ts`)

1. Reply drafts created with `in_reply_to` and no `to` had no recipients on
   wzrdmail (it stores `to` verbatim; AgentMail derives it). Approval failed with
   `draft has no recipients`. `createDraft` now derives `to`/`subject` from the parent.
2. wzrdmail returns HTTP 200 with `state: "rejected"` when every recipient is
   refused; `replyToMessage`/`sendDraft` treated that as delivered. Both now throw
   `WzrdMailApiError(502, ...)`.

## Not verified / blocked

- Production wzrdmail (`api.wzrd.tech` / `mcp.mail.wzrd.tech`): staging credential only.
- External delivery to arbitrary recipients: staging org is unverified; only
  `gratitude@5-dee.com` was accepted.
- Eval routing/context parity: blocked by the OpenRouter credit / fresh-box confound
  above — rerun on a box with connected integrations and a funded entitled model
  before drawing conclusions.
- Agent-driven `mcp__wzrdmail__create_draft` inside the eval: never exercised.

**Verdict:** the provider seam, provisioning, draft-only credential boundary,
webhook verification, tier routing and the approval spine work on wzrdmail (two
fixes required). The eval run does not establish parity with the agentmail
baselines because of the model-fallback/fresh-box confound. Do not cut over
`MAIL_PROVIDER` yet.
