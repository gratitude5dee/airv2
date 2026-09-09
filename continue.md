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
- Owner resolution of ambiguous legacy labels (unit level). The migration
  preflight now collects every unresolved label→candidates pair across all
  chunks, writes it box-side to
  `.hermes/context/imessage-archive-state/pending-resolution.json`, and throws
  `ArchiveResolutionError`. The upload-ticket POST maps that to
  `409 resolution_required` (terminal, fixed text plus a `resolve_at` URL —
  never the labels). The owner-session route
  `GET/POST /api/me/imessage-history/resolutions` lists pending labels and
  candidates and accepts `{resolutions: [{label, id | null}]}`; POSTs are only
  accepted for labels in the pending report and ids from the offered
  candidates (`id: null` keeps the label as its own legacy-label thread).
  Saved resolutions are persisted under the archive lease to
  `resolutions.json` and merged into `resolveLegacyThreads` on the next
  attempt. Labels travel box → authenticated owner response only; nothing is
  logged or mirrored to Postgres.
- Resumable cursor. `IngestStatus.cursor` is the latest durably committed
  message timestamp (canonical ISO UTC, bounded [2001-01-01, now+24h],
  impossible calendar dates rejected, legacy `to_date` accepted as fallback).
  It is returned by GET and POST, and GET's generated command passes it as the
  extractor's inclusive `SINCE_ISO_UTC` argument so a rerun sends only new
  work (`imessage-ingest.sh` gained the argument; `>=` inclusive boundary and
  GUID dedupe unchanged).
- Actionable upload errors. Every POST failure uses one envelope
  `{error, code, retriable, retry_after_seconds?, resolve_at?}` with stable
  codes (`invalid_ticket`, `upload_too_large`, `unreadable_upload`,
  `invalid_json`, `invalid_chunk`, `archive_busy`, `box_starting`,
  `resolution_required`, `migration_failed`, `upload_failed`); retriable cases
  also send `Retry-After`. `ArchiveMigrationError` carries `retriable`
  (inventory/hash-change/cleanup/backup failures retry; invalid inventory and
  unresolved labels are terminal).

### Durable indexing (MEM-21 `implemented`, not product-verified)

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
  `tests/test_timeouts.py` patches `openviking_sdk.SyncHTTPClient` and asserts
  the `timeout=` kwarg for `cmd_resume_pending` (660) and for `client()`,
  `cmd_status`, `cmd_export`, `cmd_recent` (60). The wheel referenced at
  `/private/tmp/air-openviking-sdk-0.1.7.whl` was not present in this
  environment; the published 0.1.7 wheel was inspected in a scratch venv
  instead (same `NotFoundError` class and 60 s default).
- Index replacement no longer swallows every remove error. `add_resource` and
  `cmd_rm` treat only the SDK's typed `openviking_sdk.errors.NotFoundError`
  as "nothing to remove"; any other removal error propagates, the resource is
  not re-added on top of a failed remove, and the durable receipt stays
  pending (`tests/test_replace.py`).
- Status exposes pending count. Context and Persona distinguish pending,
  empty, and unavailable progress. Reindex is durable/enqueue-only; the API
  returns 202 and the UI reports queued instead of completed.
- Forgetting excludes workers and cancels queued descendants so old queue
  work cannot restore disconnected context. Remote deletion failures return
  failure instead of being swallowed.
- Before clearing completed work, the worker persists completion time.
  `idle-check` denies shutdown while work is pending and for 20 minutes after
  completion, and now also reports `stop_claimed`.
- Coordinated shutdown claim. `ovctl stop-claim --grace-seconds N` takes the
  worker lock non-blocking (a replay in flight → `busy`) and the queue lock,
  evaluates pending/grace state and writes `~/.openviking/stop-claim.json`
  (`token`, `boot_id`, `expires_at`, default TTL 900 s) in one critical
  section. `resume-pending` re-reads the claim under the queue lock and defers
  (`{"deferred": true, "reason": "stop_claimed"}`) instead of starting new
  indexing; enqueues still persist durably and replay on the next boot's timer.
  `stop-release --token T` removes the claim (token mismatch → exit 1). Claims
  from a previous boot or past `expires_at` are ignored; a malformed claim file
  raises rather than being treated as "no claim" (`tests/test_stop_claim.py`).
- Sweeper (`apps/web/lib/orchestrator/indexIdle.ts`, `idleStop.ts`,
  `app/api/cron/sweep/route.ts`): `claimIdleStop` runs `ovctl stop-claim`
  before the provider `stop()` and only proceeds on `claimed: true` with a
  32-hex token; provider-stop failure releases the claim and returns the box to
  `ready`. Old boxes: if `stop-claim` is an unknown subcommand it falls back to
  the read-only `idle-check` probe; if that is also missing (pre-`idle-check`
  template or no `ovctl`) it defers only until the box is `LEGACY_STOP_GRACE_MS`
  (20 min) past `stop_after`/`last_active_at`, then stops — bounded, so the
  control plane does not depend on a fleet update having shipped. Any other
  failure (non-zero exit, corrupt JSON, wrong shape, box command error) defers.
  The cron response reports `indexing: { deferred: {pending, grace, busy,
  claimed, probe_failed, legacy_grace}, claimed, legacyProbe, legacyStop,
  released, releaseFailed }` alongside `stopped`/`indexingDeferred`.
- Explicit `outputFileTracingRoot` (workspace root) in `apps/web/next.config.ts`;
  the production build log no longer contains the inferred-tracing-root warning.
- The sweeper logs a structured `ovctl probe failed` line (box id, subcommand,
  exit + stderr tail, or the command error) whenever a probe fails for a reason
  other than a missing subcommand, so a `probe_failed` deferral in the cron
  response is attributable from the server log.

### Second Box provider: Tenki Sandbox (opt-in, ascii.dev stays the default)

- `apps/web/lib/box/client.ts` dispatches on the id prefix: `bx_` → ascii.dev
  (unchanged), `tk_` → `lib/box/tenki.ts`; template refs `tenki:<snapshot id>`.
  Provisioning accepts `{ "provider": "tenki" }` on the admin route
  (`ubuntu` only, needs `TENKI_TEMPLATE_ID`); an omitted provider is ascii.
- Tenki lifecycle: fork = session from the snapshot (4 vCPU / 8 GB / 40 GB,
  sticky, tagged `air-box:<key>`); `stop()` = snapshot the live session, tag it,
  wait ready, close (Tenki `pause` killed sessions with more than a few GB
  written — guest-agent liveness during PAUSING); `resume()` = fresh session
  from the newest ready snapshot, so the hosted URL changes and is re-exposed
  by `hostRoute()` (`exposePort`, empty route token). Commands run as `user`.
- Template: `apps/web/scripts/tenki-template.mjs` runs `infra/template/setup.sh`
  in a session and snapshots it. Current snapshot built from this checkpoint:
  `tenki:70fd0176-7193-4160-bf65-529958d90802` (all six units active,
  `hermes-host` condition-skipped, `/health` 200 on a fork). The eval user's Box
  was provisioned from the earlier `tenki:2c8ddcce…`.
- `infra/template/verify-box.sh` skips `unit-hermes-host` when
  `~/.ascii/host` is absent (Tenki); on ascii it is still checked.
- ascii.dev fixes found while provisioning real Boxes: command timeouts
  (`exitCode null`) map to 124; the ready wait is `BOX_READY_TIMEOUT_MS`
  (default 240 s; forks took >4 min some of the day); hosted-route
  registration removes `~/.ascii/.gateway-firewall-open` first because the
  marker survives a snapshot while the ufw rule does not (routes returned 500
  after fork/resume until then).

## Validation evidence and limits

- Checkpoint validation: **163 targeted web tests across 17 files pass**,
  all **16 OpenViking Python tests pass**, inventory check passes, and full
  TypeScript checking passes. `git diff --check` passes in the isolated clone.

- Latest box-side run: **39 Python tests pass**
  (`python3 -m unittest infra/template/openviking/tests/test_*.py`), including
  durable retries, concurrent generations, failed writes, malformed completion
  receipts, cancellation recovery, forgetting, idle-window behavior, worker
  timeouts, typed remove-error handling and stop-claim acquisition, conflict,
  release, TTL/boot invalidation and worker deferral.
- Uploader tests: **11 pass** (`scripts/tests/test_imessage_upload.py`).
- Targeted Vitest on the touched modules (`lib/imessage`,
  `app/api/me/imessage-history`, `lib/orchestrator`): **204 tests across 20
  files pass**.
- Full suite after the claim, archive and tracing-root changes (see the
  implementation plan for exact numbers): Vitest, typecheck, lint and
  production build all pass; the inferred-tracing-root warning is gone.
  Remaining build/lint warnings are pre-existing unused-`_arg` warnings in
  test files and the `libheif-js` critical-dependency notice.
- Live evidence (see `docs/reports/openviking-livecheck-isolated-linux.md`):
  livecheck 8/8 on local systemd, a fresh Tenki VM, a real ascii.dev Box and a
  Tenki Box; the control-plane sweeper acquiring the claim and stopping
  provisioned user Boxes on both providers, the bounded legacy path on a real
  old ascii Box (`legacy_grace` then `legacyStop`), and wake clearing the claim
  on both. The 109-case agent suite completed on both providers with
  comparable scores (Tenki 51/14/70/45/100, ascii 52/14/64/50/100 on
  routing/execution/gating/context/honesty; inventories differ, 87 vs 110).
- None of the above is product acceptance. No owner corpus has been imported
  to measure archive recall/coverage (item 5); the suite's `execution` axis has
  n=7; A+/95 is not met.
- `docs/reports/openviking-index-completion.md` records source inspection and
  local regression evidence. This is not a live Linux/systemd or recall test.
- No owner iMessage corpus was imported, no test message was sent to others,
  and no live provider/social/mail cutover was executed.

## Next work, in priority order

1. Resume from the GitHub checkpoint branch above. It contains 90 changed or
   new review files against baseline `bb82c05`; generated bundles, dependencies,
   local skill caches, and environment files are excluded. Verify the branch
   head and review its diff before merging or deploying.
2. Done locally (unit level): worker HTTP timeout tests and the typed
   absence-only remove handling. Still open: confirm against the real pinned
   server that a removal of a missing URI surfaces as `NotFoundError` (server
   0.4.16 source reads as idempotent delete, so the typed path may never fire;
   that is harmless but unmeasured).
3. Done and live-exercised: `stop-claim`/`stop-release` and the claim-first
   sweeper with bounded legacy fallback (item 4 below). The race guarantee is
   only as strong as the box-side locks. Rollout order still matters: until
   the template with `stop-claim` ships, boxes with `idle-check` use the
   read-only probe and boxes with neither are stopped after the 20-minute
   legacy grace — both fallbacks observed on a real production-template Box.
4. Partly done on an isolated Linux/systemd host (not an ascii.dev Box — the
   account was out of usage, HTTP 402). `infra/template/openviking/livecheck.py`
   ran the real units against the pinned server 0.4.16: 8/8 scenarios pass
   (units/health, sync and queued indexing, 3.3 MB index SIGKILLed mid-run →
   queue survived, no receipt, `Restart=always`, timer replayed in 170 s,
   peak server RSS 695 MB; stop-claim grant/refuse/release with the worker
   deferring under a live claim; stale-boot and corrupt-state fail closed;
   `rm`/`clear`; USER.md compare-and-swap). See
   `docs/reports/openviking-livecheck-isolated-linux.md` for the server
   behaviours found (idempotent `rm`, dangling `.abstract.md` vectors after
   delete, a semantic refresh racing `clear` — now settled and re-checked by
   `ovctl clear`). `.github/workflows/box-replica.yml` reran it on a fresh
   Tenki 4c/8g VM (Ubuntu 24.04, systemd 255): also 8/8 (run 34268232169;
   interrupted 3.3 MB replay 305 s, peak RSS 681 MB). Then on a real
   ascii.dev Box (`bx_8mgkj4kb`, a disposable fork of the template candidate
   converged with `sync-box.sh`, everything driven over the provider command
   API): 8/8 from a clean queue (interrupted replay 595 s, peak RSS 660 MB),
   and two provider `stop()`/`resume()` cycles around a live claim with
   deferred work — snapshot preserved `pending.json` and the claim, the boot
   id changed, the stale claim was ignored, and the queue replayed and was
   searchable after resume (cycle 2). Cycle 1 exposed a poison entry: a
   queued source under `/tmp` was gone after the restore and the worker
   failed silently forever, pinning the Box awake; `resume-pending` now drops
   missing-source entries with a metadata-only journal line. The first full
   Box run was 6/8 because the fork carried an old failing archive replay in
   its queue (kept in the report as evidence). Then from the control plane:
   the checkpoint build run locally against the production Supabase project
   provisioned one Tenki user (`tk_7fdbd…`, `provider: "tenki"`) and one
   ascii user (`bx_b363yqgb`, production template = a real old Box); the real
   `/api/cron/sweep` deferred the Tenki Box for its 20-minute grace, then
   `claimed:1 stopped:1` (twice), deferred the old ascii Box with
   `legacy_grace` at 10 min overdue and stopped it with `legacyStop:1` at 25,
   and after `sync-box.sh` claimed and stopped it too; `ensureBoxAwake` woke
   both with the claim cleared and routes healthy. Caveat: production's
   own minute cron sweeps the same rows, so only local response counters are
   attributed. The agent suite ran 109/109 on both (see the report). Still
   open: a strategy for a job exceeding the 600-second server wait that
   avoids continually restarting expensive work, and Tenki's missing periodic
   snapshot. Tenki remains opt-in; ascii.dev is the default provider.
5. Archive co-ship: done locally (unit level) — owner-facing resolution for
   ambiguous legacy labels (API and the onboarding iMessage step, which reads
   labels live only when the box is already awake), resumable cursor in
   status/command, actionable upload error envelope, and a mid-migration
   guard (the migration re-inventories raw chunks before writing its
   completion marker, so a chunk an old writer drops mid-run fails the
   attempt retriably instead of being orphaned behind the marker). Still
   open: old-writer quiescence cannot be enforced — the legacy chunk writer
   holds no lease or marker, so it can only be detected after the fact, not
   fenced; and live corpus recall/coverage verification on a real owner
   export. Source, manifest and enqueue receipts are not proof that every
   resource is searchable; MEM-01/18/19 stay `not_verified` in the ledger.
6. Memory findings, done locally (unit level; ledger `implemented`, none
   `verified`): MEM-04 Dictionary.MD enqueued only after `dictionary_built_at`
   flips; MEM-14/27 `ovctl` docstring, leaf counts, truncation, sorted
   `recent`, Persona totals from status; MEM-25 rows-present-but-nothing-
   replayable proceeds without the amnesia backoff; MEM-15 status/metadata
   reads (Persona chips, deep-memory status, import/ingest status, stale
   mirror refresh) are served from the Postgres mirror for a sleeping box and
   never wake it — content reads still wake by design; MEM-26 `ovctl clear
   --scope` plus a confirm-gated owner clear surface. MEM-10 is `in_progress`:
   the USER.md writer inventory is Hermes's memory tool (box-side), owner edit
   (now a revision-guarded compare-and-swap: a 409 instead of a blind
   overwrite of an agent rewrite), Onairos's bounded persona block
   (read-modify-write, narrow race window, no lock shared with Hermes) and
   owner clear. No consolidation/decay/supersession exists and Onairos still
   writes into USER.md directly; moving it behind a Hermes-consumed digest is
   the remaining design work. Nothing above is live-verified against a real
   box, provider sleep/wake transition or populated OpenViking store. Avoid
   claiming a timer alone proves memory durability.
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
