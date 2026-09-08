# Airv3 review implementation — continuation handoff

## Goal and status

Implement all 249 findings in `review.md` and demonstrate A+/95 performance
for task completion, appropriate memory use, and the other review acceptance
axes. The goal is active and incomplete. No live product score has been
measured. Do not reinterpret passing unit tests as achieving this goal.

The user requested this handoff and a GitHub push when usage falls below 10%.
At preparation, the account's five-hour window had 5% remaining; the weekly
window had 66% remaining. No usage-reset credit was redeemed.

## Project and repository

- Saved Codex project: **airv3**.
- Application workspace: `/Users/gratitud3/Downloads/airv2-claude-app-review-optimization-3xnzwg`.
- Existing task: **Improve app from review.md**.
- GitHub repository: `https://github.com/gratitude5dee/airv2`, default `main`.
- This source workspace has no `.git` of its own. Git ascends to an unrelated
  home-directory repository. Never stage or push using that inherited repo.
- Checkpoint branch: `codex/airv3-review-checkpoint`, prepared in
  `/private/tmp/air-review-publish`. Remote handoff URL:
  `https://github.com/gratitude5dee/airv2/blob/codex/airv3-review-checkpoint/continue.md`.
  Verify the remote commit when resuming.
- Do not switch to `/Users/gratitud3/Downloads/airv2-main 3`; that is a separate
  saved project with different goal documents.
- No production deployment or fleet rollout has been performed in this work.

## Authoritative tracking

Read `review.md`, `docs/review-findings.json`, and
`docs/review-implementation-plan.md`. The JSON contains all finding IDs,
dependencies, evidence, and implementation statuses. Run:

```sh
python3 scripts/review-tracker.py --check
```

The tracker is an inventory check, not a quality score. Several substantial
archive changes remain in progress and are deliberately not marked verified.
Preserve the review's co-ship groups and rollout gates.

Explicit user skills already read: `.agents/skills/photon-cli/SKILL.md` and
`/Users/gratitud3/.codex/skills/spectrum/SKILL.md`. Follow their applicable
instructions when continuing. Do not send messages to other people without
the user's explicit authorization. The user has authorized this GitHub push.

## Accomplished locally

### State, tasks, and measurement

- Board/todo initialization falls back only on a typed Box API 404; network,
  server, and malformed-data failures propagate instead of resetting state.
- Board/todo mutations hold a renewable metadata lease across read/modify/
  write. Actions use UUID IDs, reject empty/invalid changes, and expose retry
  behavior for busy state. Action-log lease helpers were extracted and reused.
- Removed whole-environment shell sourcing from eleven template skills;
  gateway values are read as data. These changes address TC-05.
- Eval timing records agent time, first-token time, and settle time separately
  using monotonic measurement, with honest denominators and legacy labels.
- Managed SOUL content has a canonical template and atomic migration helper,
  preserving owner edits, refusing malformed markers/symlinks, and keeping a
  private original backup. Setup/sync use it.
- Fixed macOS realpath containment in the mini-app build sandbox so `/var`
  versus `/private/var` aliases do not falsely reject valid builds; real
  escapes remain rejected.

### Context and configuration

- Agent imports index only the final chunk. Reindex includes each import
  source and Dictionary.MD at stable, non-overlapping URIs.
- Onairos persona injection is bounded to a short digest; USER.md's combined
  character budget is checked before writes. Existing profile read failures
  fail closed; only typed 404 permits initialization.
- OpenViking config writes are atomic/private. Provisioning ensures config
  after per-box credentials are installed and rolls back on failure.
  `ensure --configure-only` avoids recursive service restart in ExecStartPre.

### iMessage archive

- Upload defaults to 365 days, preserves message GUID and stable chat ID,
  supports an explicit inclusive UTC cursor, and queries a full thread
  catalogue beyond the selected date window.
- Attributed-body messages are decoded using an unmodified, hash-checked
  vendored pytypedstream wheel. Corrupt/unrecognized bodies stop upload rather
  than silently disappearing. Synthetic Apple NSArchiver fixtures are included.
- Uploader partitions requests by both message count and exact UTF-8 bytes;
  HTTP intake bounds streamed bytes. Oversized individual messages fail before
  upload rather than truncating content.
- Archive identity is a namespaced stable-chat-ID tuple, with legacy labels
  kept distinct. Records merge by GUID with deterministic ordering, strict
  calendar validation, safe Markdown rendering, and exact-content promotion
  of matching legacy records.
- Archive data is stored as per-thread/month source JSON plus dated Markdown.
  A manifest tracks content and enqueue receipts; aggregate status is rebuilt
  from partitions. Atomic staged writes check content hashes, refuse symlinks,
  fsync, and renew the archive lease before replacement.
- Legacy migration preflights all chunks before mutation, refuses ambiguous
  label-to-thread mapping, preserves backups, retries interrupted migration,
  and removes old per-chunk index URIs. New uploads use the archive path.
- Reindex enumerates only exact archive Markdown resources, excluding raw
  legacy chunks, metadata, and staging files. Legacy chunks cause a visible
  migration-pending result rather than being indexed indiscriminately.

### Durable indexing (MEM-21 still incomplete)

- `ovctl add-resource --no-wait` persists generation-tagged work in
  `~/.openviking/pending.json` under flock and atomic fsync/replace.
- `resume-pending` serializes workers while allowing new enqueues, waits for
  indexing, and acknowledges only the generation it processed. Failures keep
  work queued. A retry timer and nonblocking service-start dispatch are
  installed by setup/sync.
- The pinned SDK can return nested failure/cancellation results without an
  exception. The wrapper now checks completion receipts, task IDs, resource
  URI presence, and queue errors before acknowledging work, and requests
  strict parsing.
- SDK 0.1.7 defaults to a 60-second HTTP timeout. The worker now explicitly
  uses 660 seconds for a 600-second server wait; routine clients stay at 60.
  The wheel is cached at `/private/tmp/air-openviking-sdk-0.1.7.whl` for further
  inspection, not installed into the application.
- Status exposes pending count. Context and Persona distinguish pending,
  empty, and unavailable progress. Reindex is durable/enqueue-only; the API
  returns 202 and the UI reports queued instead of completed.
- Forgetting excludes workers and cancels queued descendants so old queue
  work cannot restore disconnected context. Remote deletion failures return
  failure instead of being swallowed.
- Before clearing completed work, the worker persists completion time.
  `idle-check` denies shutdown while work is pending and for 20 minutes after
  completion. The cron sweeper checks this before stopping and reports
  `indexingDeferred`; corrupt/unreadable state defers shutdown.

## Validation evidence and limits

- Checkpoint validation: **163 targeted web tests across 17 files pass**,
  all **16 OpenViking Python tests pass**, inventory check passes, and full
  TypeScript checking passes. `git diff --check` passes in the isolated clone.

- Latest box-side run: **16 Python tests pass**, including durable retries,
  concurrent generations, failed writes, malformed completion receipts,
  cancellation recovery, forgetting, and idle-window behavior.
- Latest targeted sweeper/guard run: **11 web tests pass**.
- Memory status/reindex tests: **9 pass**.
- Full TypeScript check and targeted lint passed after the idle guard changes.
- Earlier full Vitest run reported 249 files passing, 2,532 tests passing and
  one skipped. It predates the latest queue/idle changes; rerun the full suite.
- A production build passed earlier, before most archive/queue changes. It
  warned that Next inferred a tracing root outside this repository. Fix the
  explicit tracing root and rebuild before deployment.
- `docs/reports/openviking-index-completion.md` records source inspection and
  local regression evidence. This is not a live Linux/systemd or recall test.
- No owner iMessage corpus was imported, no test message was sent to others,
  and no live provider/social/mail cutover was executed.

## Next work, in priority order

1. Resume from the GitHub checkpoint branch above. It contains 90 changed or
   new review files against baseline `bb82c05`; generated bundles, dependencies,
   local skill caches, and environment files are excluded. Verify the branch
   head and review its diff before merging or deploying.
2. Add explicit tests for worker HTTP timeout configuration and rerun targeted
   tests after the latest timeout change. Inspect SDK error types: the index
   replacement still catches all remove errors before add, which can hide an
   actual failed removal. Treat only genuine absence as harmless.
3. Close the idle probe→provider-stop race using a coordinated shutdown claim
   shared with writers. The current separate probe is insufficient to prove
   never-stop-during-indexing. Old boxes without `idle-check` defer indefinitely;
   do not deploy the control plane ahead of matching fleet updates. Design and
   verify rollout compatibility and failure visibility.
4. Test the service units and interrupted indexing on an isolated Linux box.
   Confirm SDK completion receipts with the actual pinned server, verify
   restart recovery and deletion behavior, and measure indexing wall time and
   idle RSS. A job exceeding the 600-second server wait still needs a strategy
   that avoids continually restarting expensive work.
5. Finish archive co-ship requirements: owner-facing resolution for ambiguous
   legacy thread labels, automatic resumable cursor behavior, actionable upload
   errors/retries, rollout quiescence against old writers, and live corpus
   recall/coverage verification. Source/manifest/enqueue receipts are not proof
   that every resource is searchable.
6. Finish Dictionary completion ordering (MEM-04), coordinate all USER.md
   writers (MEM-10), privacy/forget retry and clear flows, and other memory
   findings. Avoid claiming a timer alone proves memory durability.
7. Continue every remaining review workstream in dependency order: silent
   damage prevention, instrumentation, template steering, sender/wake paths,
   shared task/run/effect/approval evidence, sessions, memory, mail and social
   provider parity/cutovers, and all remaining numbered findings.
8. Run full tests, typecheck, lint, build, deployed web/iMessage isolated evals,
   and provider/fleet gates. Measure task completion and appropriate recall with
   actual denominators. Audit every finding and explicit deliverable against
   authoritative runtime evidence before declaring A+/95 or completing goal.

## Operating constraints

Preserve user edits. Do not commit from the inherited home Git repository.
Use the existing task/project rather than creating a new task unless asked.
Disk space was approximately 2.1 GB before publication; avoid duplicate
dependencies and large build artifacts. No reset credit is authorized merely
because this handoff was requested. Keep the full goal active after checkpoint.
