# iMessage flush: livelock fixes (spec)

## Incident

2026-10-05 ~23:21Z → 2026-10-06 ~00:57Z. Owner space `any;-;+15104154787`
(running box `bx_x7xwnm8r`, `air-main` session). Symptoms:

- `/create miniapp for playing music like Spotify` delivered the intake plan
  (`miniapp-playing-music-plan.md`) then froze; every follow-up turn died.
- `/calendar`, `/calender`, `/trade` ×2, `/avatar` each produced only the
  "still working on it" fallback bubble (`progressFallback("progress-two")`
  @ 20s).
- `flush_jobs.attempts` reached **19** before manual intervention; each retry
  produced one more fallback bubble.

Verified evidence:

- `agent_runs`: every `imessage` outcome `first_response_failed` at ~45s;
  `gateway_completion` lanes healthy throughout.
- Box run `run_7e751f12` (the 19th attempt): `status=cancelled`,
  `turn_exit_reason=interrupted_during_api_call`, killed at exactly 45.2s
  with **zero** emitted events and zero tool calls.
- Same-box probes ("reply with exactly: pong") streamed first delta in ~7s
  → box + provider healthy; the failure is input-shaped, not outage.

## Root cause (three cooperating defects)

### D1 — Initial deadline ignores non-text activity

`INITIAL_RESPONSE_DEADLINE_MS=45_000` bounds `probeForTapback(iterator)`,
which awaits the first **text** delta. `hermesDeltas` yields only
`message.delta`/`run.completed`/`run.failed`; reasoning deltas, tool
calls, and keepalives are silently skipped. A turn whose model thinks or
tool-calls >45s before its first word is killed mid-work
(`interrupted_during_api_call`) — this is what froze `/create` (its turns
lead with tool calls: `cat DESIGN.md`, `mkdir intake`, …).

### D2 — Stream retry has no attempt ceiling

`retryUndeliveredStream` → `carryMessages` + `rescheduleWithBackoff` runs
unbounded (`MAX_ATTEMPTS=5` only guards the registry-lookup / sender-create
/ `ensureBoxAwake` lanes). The retry re-sends the *identical* composed
input, so a deterministically-slow turn can never succeed — 19 attempts
tonight — while the user sees an endless stream of "still working on it".

### D3 — Slash commands can't survive bursts

All deterministic lanes parse `responseLaneInput` — every queued message
joined by `\n` (carried rows additionally prefixed `[Earlier message]`).
`parseMiniAppCommand` anchors `^\/slug$` on the *whole* input, so any
multi-message burst makes `/calendar`, `/trade`, `/avatar`, `/create`,
`/draw`, `/freeze` unmatchable forever. First carry → permanent loss of
every queued command. Also: `calender` typo has no alias.

### Not the cause (ruled out)

- Box health (`/v1/health` ok), session transcript, hosted token, Spectrum.
- Card registry: `calendar`, `trade`, `avatar` all `published`.
- OpenViking: `openviking.service` running, `openviking-index.timer` armed,
  `ovctl status` healthy, queue empty; 5 memories, 1 resource indexed.
- `imessage-history` missing from the index is expected: that resource is
  only written by the opt-in Mac ingest (`/api/me/imessage-history`),
  which was never run for this box.

## Fixes

### F1 — Activity-aware initial deadline

`hermesDeltas` gains an `onActivity` callback fired on every parsed SSE
`data:` event (reasoning.*, tool.*, message.*, run.* — anything with an
`event` field). Keepalive comment frames carry no `data:` line and do NOT
count: a truly hung stream still dies at 45s.

The probe wait becomes activity-relative:

```
effective_deadline = max(initial_deadline, last_activity_at + 45s)
hard_cap           = final_response_deadline (120s, unchanged)
```

- `untilLiveDeadline(promise, activity, deadlineAt, capAt, msg)` —
  poll ≤250ms, re-evaluate deadline each tick, throw `msg` past cap.
- Call site keeps `beforeDeadline` everywhere else; only the
  `probeForTapback` await switches to the live deadline.
- Error message stays semantic: "Hermes did not begin a response" now
  means "45s of true silence" (or 120s absolute), not "45s regardless of
  progress".

### F2 — Cap the stream retry at `MAX_ATTEMPTS`

In `retryUndeliveredStream`, when `job.attempts >= MAX_ATTEMPTS`:

- Drop the drained burst (do **not** re-carry: the input is provably
  unprocessable and would immediately re-livelock on the next claim).
- Delete the `flush_jobs` row (skip when cancelled — successor owns it).
- Send one honest text via `sender.sendText`:
  *"i couldn't finish that one — send it again?"*.
- `log.error("imessage stream retries exhausted")` with the last error.
- Retried-work rule preserved: `notifyFirstRetry` still fires exactly once
  at attempt 1; the exhausted line is the only other user-visible status.

### F3 — Per-message command evaluation

New seam `deliverBurstCommands(supabase, sender, job, drained)` run right
after `drained` is computed, before the progress timeline:

- For each **non-bridge-marker** message, in received order, evaluate
  `parseMiniAppCommand(body)` → card lane; `parseCreateIntent(body)` →
  intake lane; `parseTradeCommand(body)` → trade lane. `/draw`, `/freeze`,
  `/twin` stay whole-input (their matchers already scan the blob) —
  messages consumed by the pre-pass are removed first so a burst like
  `"/draw beach" + "/calendar"` both cards and draws.
- A message consumed by a command is dropped from `rawInput` and
  `responseLaneInput` (the card/trade reply **is** its response; leaving
  it in would double-answer). One exception: an **owner** `/create`
  annotates rather than consumes — the Planner runs in air-main and reads
  the prompt from the model input, so the command stays in the burst and
  the intake's `[create-intake …]` line is prepended, exactly as the
  single-message path does today. A **non-owner** `/create` is consumed
  (the owner-only line was already sent).
- If every message is consumed → delete job + return (same as today's
  single-command path); otherwise the Hermes turn runs on the remaining
  text. Single-message input behaves identically to today.
- Identical duplicate commands in one burst deliver once (`/trade` ×2 →
  one card); distinct commands each deliver.
- Owner-tier and registry rules unchanged (`OWNER_ONLY_CARD_LINE`,
  published-only, `muse` flag, `/create` non-owner line).
- Add `calender → calendar` to `ALIASES`.

Composition change: `composeInput`/`composeResponseLaneInput` take the
filtered `drained` lists — signature stays, call sites pass the remainder.

### F4 — `imessage-history` index gap

Not a code fix in this PR: the directory only exists after the owner runs
the onboarding Mac ingest. Follow-up (separate change, unscoped here):
re-index check for boxes whose ingest completed — and whether box
replacement should carry the ingest forward.

## Testing

`lib/orchestrator/flush.test.ts` + lane tests (vitest, existing harness):

1. Stream emits `reasoning.delta`/tool events then first text at t=60s →
   turn succeeds (previously: killed at 45s).
2. Silent stream (keepalives only) → still fails at 45s.
3. `first_response_failed` ×5 → 6th run sees parked job deleted, carried
   empty, one honest text sent; no further reschedule.
4. Burst `[prose, "/calendar", prose]` → calendar card sent once, model
   turn sees only the prose.
5. Burst `["/calendar","/trade","/avatar"]` → three cards, no Hermes run.
6. `"/calender"` → calendar card (alias).
7. Burst with `/draw <prompt>` + `/calendar` → both handled; no prose
   leaks into the draw prompt.
8. Single `"/calendar"` → card, unchanged path.

## Rollout / risk

- F1 only loosens a deadline that was firing on false positives; worst
  case a turn takes 2min instead of dying at 45s (user already waited
  longer today).
- F2 changes an infinite retry into a bounded one — strictly safer; the
  honest line replaces the infinite fallback loop.
- F3 touches the lane pre-pass only; the model turn is unchanged.
  Risk: a message that used to reach the model as part of a blob now gets
  consumed by a command — intended (that's the fix).
- No migrations. No template changes. Deploy = normal apps/web release.
