# iMessage context and shopping reliability plan

Prepared 2026-09-15. Originally scoped for GPT-5.6 Sol.

## Implementation status

The P0 hotfix is implemented on `codex/imessage-context-timeout-fix`:

- Context-dependent replies such as “Yee”, “yes”, “I meant yes”, “go ahead”, “ok”, and negative/cancel replies cannot be consumed by the history-free completion lane. They remain in `batch_queue` for Hermes to interpret with the existing transcript.
- Positive and negative contextual replies receive non-final holding acknowledgements, so the inbound route does not delete their queue rows.
- Elapsed-time progress is limited to one truthful 20-second update instead of three generic 10/20/35-second bubbles.
- A 45-second generation deadline is described as needing more time, not as an unproven connection failure.
- Focused regressions, the orchestrator/Hermes suite, type-check, lint, and the production build pass. The full suite reached 3,181 passing tests; its sole CPU-contention timeout passed when rerun alone.

The transcript-tail investigation, resumable long-run work, and fresh-source shopping behavior below remain follow-up reliability work. They are not required for the contextual-routing hotfix.

## Outcome

After Air asks whether it should check a product's live availability, a reply such as “Yee”, “yes”, or “I meant yes” must continue that shopping task. Air must retain the relevant question across retries, new messages, and box resume. It must verify live sources for “latest drop” requests and avoid repeated generic progress followed by an unnecessary restart.

This document records both the implemented hotfix scope and the remaining reliability work.

## Evidence and confidence

### Confirmed from the screenshot and production trace

- Input: `/shop find me the latest drop by menace`.
- The September 15 17:11:59 UTC request on deployment `dpl_5shyELBqj3CXbmuk7GTyd7dHakG3` logged a delivered reaction at 1,295 ms and a holding reply at 1,517 ms.
- Generic progress followed at 10,470, 20,361, and 35,427 ms.
- History replay reported session `air-main`, 500 source rows, 60 replay messages, `first_turn:false`.
- The request then logged `imessage stream retry scheduled`, attempt 1, error `Hermes did not complete a response within 45 seconds`.
- A later screenshot shows an eventual answer offering to check the live site. “Yee” received an unrelated creative-assistant greeting; “I meant yes” received another response asking what help was needed.

The trace proves a run deadline failure. It does not prove a network outage, SQLite corruption, missing long-term memory, or that the 500 replayed rows were the newest rows. The claimed MENACE products, release date, and prices in the screenshot have not been independently verified.

### Confirmed in the application code

1. `apps/web/lib/orchestrator/ttfk.ts`: `isFastInitialQuestion` accepts short acknowledgements and corrections including “Yee” and “I meant yes”. Its exclusion list catches status/fresh-data questions but does not establish that a request is self-contained.
2. `apps/web/lib/orchestrator/sharedBridge.ts`: `gatewayCompletion` sends a system prompt plus only the current user message. `initialResponse` allows that model's `FINAL:` prefix to finish a turn. It also unconditionally finishes several deterministic acknowledgements, including “ok” and “sounds good”. These can instead answer an outstanding question.
3. `apps/web/app/api/inbound/imessage/route.ts`: after a final initial response is sent, the exact input row is deleted from `batch_queue`. Hermes can therefore never see that reply or replay its context. There is no canonical transcript append in this direct-completion branch.
4. `apps/web/lib/orchestrator/flush.ts`: the 45-second generation deadline begins after box wake, delegation checks, and history replay. It buffers the complete response before delivery, stops the run at the deadline, and schedules another attempt. Thus it is neither a 45-second end-to-end deadline nor evidence of a failed connection.
5. `apps/web/lib/hermes/client.ts`: history loads `/api/sessions/<id>/messages` without explicit pagination/order. `history.ts` slices the last 60 sanitized messages from whatever rows it receives. A nonempty response is not proof that the latest assistant question is included.
6. `apps/web/lib/miniapps/imessageCommand.ts`: only bare `/shop` opens the mini-app. `/shop <request>` falls through to Hermes. This is the current routing contract, not itself proof of an error.

### Executed reproduction

From the repository root, this read-only probe exercises the actual routing predicate:

```sh
node --experimental-strip-types --input-type=module -e 'import { isFastInitialQuestion } from "./apps/web/lib/orchestrator/ttfk.ts"; const inputs = ["Yee", "I meant yes", "yes", "go ahead"]; let failed = false; for (const input of inputs) { const allowed = isFastInitialQuestion(input); console.log(JSON.stringify({input, eligibleForHistoryFreeAnswer: allowed, expected: false, result: allowed ? "FAIL" : "PASS"})); failed ||= allowed; } process.exitCode = failed ? 1 : 0;'
```

Observed: all four cases returned `eligibleForHistoryFreeAnswer:true`, `FAIL`; exit code 1. This proves the routing defect, not the exact model output or the root cause of the slow shopping run. Add the integration reproduction below before fixing.

## Implementation order

### 1. P0 — Close the context-free completion shortcut

Files: `ttfk.ts`, `sharedBridge.ts`, `app/api/inbound/imessage/route.ts`; their existing unit tests plus a new route-level regression test.

- Write the failing integration test first: seed a prior assistant offer to check live stock, deliver “Yee”, and make the quick model return `FINAL: Yee! What creative spark can I help with?`. Assert that this reply is not sent as a final answer and that the input survives for the contextual run. Repeat with “I meant yes”, “yes”, “go ahead”, “ok”, and “sounds good”.
- Keep immediate deterministic arithmetic for genuinely standalone arithmetic. Replace the broad short-message heuristic with a conservative policy: ambiguous confirmations, corrections, pronouns, selections, and task follow-ups go to the contextual path. Cover “the blue one”, “same size”, “do that”, “no, the other one”, “what about that?”, and negative/cancel replies too. A longer denylist alone is not a complete policy.
- Do not let `FINAL:` from a model with no transcript authorize removal from the queue. Initially keep generative quick responses as acknowledgements only, or bypass their generation entirely for contextual follow-ups. Preserve fast generative final answers only when a tested context/self-containment contract can justify them.
- Check contextual eligibility before deterministic acknowledgement completion too. “Okay” after an offer must not be swallowed by `deterministicAcknowledgementAnswer`.
- Return a clear routing decision (`complete`, `defer`, or equivalent) separately from user-visible text. A deferred follow-up can use the existing reaction while it reaches Hermes; it does not need another generic question or a new sequence of holding bubbles.
- Preserve precise queue ownership: only the message actually completed may be removed. Test a new inbound arriving while the initial response is being sent, retries, duplicate webhooks, and failed sends.

Acceptance: the exact screenshot follow-ups reach `air-main` with the preceding offer. If a size is unknown, Air asks for that size in the shopping context. It does not ask what creative help is needed. Reading stock is not approval to purchase or place a trade.

### 2. P0 — Verify and preserve recent conversation history

Files: `lib/hermes/client.ts`, `lib/hermes/history.ts`, `lib/orchestrator/flush.ts`, `lib/hermes/client.test.ts`, `lib/hermes/history.test.ts`, `lib/orchestrator/flush.test.ts`.

- Inspect the actual pinned/running Hermes messages API to establish pagination, ordering, limits, identifiers, and persistence behavior. The observed 500-row response is a pagination warning to investigate, not a reason to assume a specific upstream API shape.
- Add a fixture with more than 500 rows and the live-stock offer at the end. The loaded replay must contain that newest offer, in chronological order. Cover descending pages, same-timestamp rows, tool-heavy turns, and supported structured content.
- Request the newest bounded transcript window using supported upstream parameters. If the API has no tail operation, implement the smallest box-side adapter needed. Do not fetch an entire lifetime transcript on every message.
- Bound replay by both turns and content size/token estimate. Keep the latest completed user/assistant pair; do not let merged tool-heavy or same-role content evict the immediate question. Preserve meaning and the API's required role alternation.
- Distinguish a real empty first session from load failure, malformed payload, stale pagination, or a temporarily uncommitted latest turn. Use counts, sequence IDs, timestamps, and durations for diagnostics; never log transcript text.
- Ensure final answers sent outside Hermes are represented in the canonical box-side conversation, including their paired user input. Use an existing supported append API if available; otherwise implement a bounded, idempotent box-side append adapter with stable message IDs. Do not start a synthetic model run just to save history.
- Do not claim to have completed a direct answer until delivery and transcript reconciliation are durably tracked. Handle send-success/persist-failure and persist-success/send-failure without duplicate messages or permanently missing history.
- Serialize or reconcile adjacent turns so a fast “yes” arriving before the prior answer's persistence finishes still has that answer available. Respect the existing user/session/channel isolation rules; a global pending question must not leak into a different conversation.

Use canonical transcript replay first. Add a compact box-local pending-task checkpoint only if retries or cross-turn interruption cannot be represented reliably with the existing run/session state. If needed, version it and bind it to the originating conversation, run, and assistant message; record completion/expiry explicitly. Do not introduce a second general memory system.

Acceptance: exact follow-up sequences work after retry, box resume, >500 transcript rows, and an immediate reply arriving during persistence. A failed history read does not become a confident context-free greeting.

### 3. P1 — Make shopping completion and retry behavior explicit

Files: `lib/orchestrator/flush.ts`, `lib/orchestrator/boxes.ts`, Hermes client/event helpers, existing flush job/admission machinery, `lib/orchestrator/bubbles.ts` and `outbound.ts` as needed.

Start by measuring these hypotheses separately:

1. Wake/history preparation dominates: removing a cold wake or unnecessary replay transfer reduces receipt-to-run-start, with model/tool time unchanged.
2. The full-answer deadline interrupts otherwise healthy tool work: a trace shows live tool/run progress at timeout and a retry repeats that work.
3. Slow gateway/model/tool calls dominate: run-start is prompt, but a named provider or tool stage consumes the budget.
4. Replayed context is stale or excessive: the newest-turn fixture or replay-size metrics fail, and correcting the window reduces latency or improves continuity.

- Add stage metrics: receipt, queue claim, wake complete, replay complete, run created, first useful output, tool progress, terminal event, send accepted, delivery receipt when available. Carry stable run/turn correlation identifiers; log no content or credentials.
- Treat 30–45 seconds as the target for a useful result or an accurate, actionable blocker. Do not label elapsed time alone as a connection issue.
- Separate the user-visible response target from the maximum duration of a tool operation. A run making legitimate progress must not be stopped and recreated merely to send a progress update.
- At the short request budget, checkpoint or reattach to the same run through existing durable jobs, where Hermes supports it. Keep run IDs, cursors/checkpoints, operation leases, and terminal delivery claims consistent. If upstream runs cannot be resumed, implement a bounded continuation from persisted state and make retry policy aware of side effects.
- Define explicit finite total-run and idle limits based on measurements. A genuinely hung run must reach a recorded failure/blocker; no unbounded stream or retry loop.
- For safe textual output, evaluate incremental delivery through existing message editing. Preserve attachment/card marker parsing and deduplication. Never replay a purchase, checkout submit, or other side effect merely because final output was not delivered.
- Add tests for a run crossing 45 seconds while making progress, a hung stream, terminal event delivery failure, newer inbound during retry, cancellation, and a late result after ownership changed. Assert one useful final answer and no duplicated operation.

Acceptance: the MENACE request completes once, or identifies a specific real blocker. “Still working” and “retrying” do not count as completed shopping. A timeout does not restart work that is still running successfully.

### 4. P1 — Tie progress messages and shopping claims to evidence

Files: `ttfk.ts`, `sharedBridge.ts`, `flush.ts`, `infra/template/skills/shopping-checkout/SKILL.md`, and the existing explicit command/agent instruction dispatch.

- Keep the reaction target at 1 second and initial useful response/acknowledgement at 5 seconds. Track dispatch and transport acknowledgement separately.
- The optional 10/20-second updates must report an observed stage change or concrete blocker. Suppress duplicates, follow-up timer fan-out, and unsupported “finalizing” claims. Do not generate extra status model calls if they cannot improve the update.
- Route `/shop <request>` with the existing shopping skill/tool instructions while preserving bare `/shop` as the card command. Avoid building a new commerce service for a routing fix.
- For “latest”, perform fresh discovery and extraction against official merchant sources before calling an item the newest. Separate release date, page check time, and current stock. If verification is blocked, disclose that with the best verified official link and the actual limitation.
- Checking the live site is already part of “find me the latest drop”; do not make that an extra permission question after answering from stale knowledge. Ask only for genuinely missing choices, such as size, when necessary.
- Respect existing Kernel human-control leases and approval gates. A conversational “yes” to checking stock authorizes that check only. It does not approve a cart, Link payment, or Coinbase order.

Acceptance: the answer cites pages actually checked during the run, reports any unavailable stock verification accurately, and continues the same product task on “Yee”.

## Test matrix and commands

| Scenario | Required assertion |
| --- | --- |
| Offer to check stock → “Yee” → “I meant yes” | Same task and last assistant question are present; no generic greeting. |
| Offer → “ok” / “sounds good” / “no” | Deterministic acknowledgement does not swallow the user's answer. |
| Two possible outstanding choices | Ask a contextual clarification; never choose an irreversible action. |
| “what is 9 × 7?” | `63` from deterministic arithmetic, no model dependency. |
| More than 500 transcript rows | Latest completed turn is replayed, not an old page. |
| Fast answer followed immediately by a question | Both delivered user/assistant turns exist exactly once in canonical history. |
| Box resume / unavailable history | Same task resumes; unavailable context is handled explicitly. |
| Healthy tool run exceeds 45 seconds | Same run/operation continues or checkpoints; no blind restart. |
| Hung run or provider failure | Finite failure, preserved task, truthful blocker, bounded retry. |
| Duplicate webhook or overlapping turn | No dropped input, duplicate final reply, or cross-conversation leakage. |
| “latest drop” with only an old cached result | Fresh-source check or honest inability to verify latest; no unsupported claim. |
| “yes” after purchase/trade discussion | Existing exact transaction approval remains required. |

Run from repository root:

```sh
npm run test --workspace apps/web -- lib/orchestrator/ttfk.test.ts lib/orchestrator/sharedBridge.test.ts lib/orchestrator/flush.test.ts lib/orchestrator/flush-sender-outage.test.ts lib/hermes/client.test.ts lib/hermes/history.test.ts
npm run test --workspace apps/web -- app/api/inbound/imessage/route.test.ts
npm run typecheck
npm run lint --workspace apps/web -- --quiet
```

The inbound route test is a new deliverable; it does not exist yet. Add its actual file name to the command if a better integration seam is chosen. Run the normal CI/build gate before deployment. Existing tests currently enshrine some context-free acknowledgement behavior; revise those expectations to distinguish truly standalone input from a pending conversation.

## Delivery and rollout

1. Refresh remote `main`, inspect current production commit and local changes, and create an isolated `codex/` branch. This analysis used local head `871136eb5b64723a945cb2dab5bdd7ad187f35e0`, included in merged PR #428; recheck line locations before editing.
2. Ship the smallest P0 fix first: contextual routing plus queue/delivery regression coverage. Then address any demonstrated replay defect. Do not couple this hotfix to a long-term memory migration or new provider.
3. Validate with mocked multi-turn routing tests and the user's actual failed sequence in the existing authenticated application. Use fresh merchant reads but do not buy anything or place a trade for testing.
4. Verify Kernel using an authenticated, owner-scoped vault/browser call and any required owner enrollment ceremony. A `401` response and Vercel `READY` do not demonstrate that the new key works or that a wallet is connected. Local Link CLI authentication is also separate from Kernel's managed OAuth wallet enrollment and from each user's box session.
5. After targeted tests and CI pass, deploy through the existing workflow. Check the exact deployment and branch in runtime logs. Compare receipt-to-useful-answer timing and confirm the user-visible follow-up stays in context.
6. Report commit/PR/deployment, before/after timings, regression results, and remaining blockers. If a regression appears, revert the code change through the normal workflow; preserve all user memory and recovery backups.

## Boundaries and operational notes

- No evidence from this incident currently justifies SQLite repair, clearing memory, replacing OpenViking, deleting history, or increasing box size. Investigate those only if a separate health/error signal establishes a need. Preserve the existing damaged-database and recovery backups.
- Keep conversation text and any task checkpoint in the user's box. Shared control-plane records may hold identifiers, lifecycle state, timestamps, and other allowed metadata; do not add a shared transcript cache or log prompts.
- Retain the existing GMI routing preference. Provider changes are not a substitute for fixing context routing.
- `/trade` uses Coinbase Advanced Trade directly through `lib/trade/coinbase.ts` and the user's sealed Coinbase key; paper mode is the fallback until a connected account is in live mode (`lib/trade/service.ts`). It does not use Stripe Link for trade funding or execution. A Link connection does not connect Coinbase.
- During investigation, automatic approval review rejected an escalated shell log read with “workspace is out of credits.” The Vercel connector independently returned the trace cited above. Local reading and the predicate reproduction succeeded. If the implementation environment still lacks execution/deployment access, report the specific blocked operation without claiming the production fix is live.

## Ready-to-paste instruction for Sol

Implement `docs/plans/imessage-context-and-shop-sol.md`. Start with the P0 multi-turn regression: Air offers to check live MENACE stock; “Yee”, “I meant yes”, and “ok” must reach the contextual run with that offer and must never be consumed by a history-free final reply. Fix routing and queue ownership first, then prove the newest transcript is replayed. Measure and correct the independent 45-second retry problem and unsupported progress/freshness claims. Use the existing GMI, Hermes, per-user storage, shopping tools, and approval flows. Preserve user data and backups. Run meaningful integration tests, ship through the established CI/deployment workflow, and verify an authenticated shopping continuation before reporting completion.
